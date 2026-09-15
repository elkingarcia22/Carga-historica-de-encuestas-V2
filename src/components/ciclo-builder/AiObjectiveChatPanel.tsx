/**
 * Panel lateral conversacional para crear objetivos con IA.
 *
 * Reemplaza la tarjeta paso-a-paso del compositor por una experiencia de chat
 * natural: el usuario describe lo que quiere, la IA extrae lo que puede y
 * pregunta lo que falta, uno a uno, hasta tener todo para generar. La
 * propuesta se muestra como tarjetas preview dentro del propio chat, con
 * acciones de conservar, regenerar, modificar o descartar.
 *
 * El panel se renderiza en el `ShellAgentPanelSlot`, que es un flex sibling
 * de la columna de contenido: abrirlo la empuja en vez de taparla, exactamente
 * como ya hace el `AiAgentDrawer` en las demás pantallas.
 */

import * as React from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUp,
  Check,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MovingBorderBeam } from "@/components/ui/moving-border-beam";
import { AI_GRADIENT, CURRENT_USER } from "@/components/app-shell/appShellData";
import { AiSparkGlyph } from "@/components/ai-interaction/AiSparkGlyph";
import {
  AMBITION_META,
  AMBITION_ORDER,
  FOCUS_META,
  FOCUS_ORDER,
  createBlankBrief,
  generateObjectiveSet,
  isBriefReady,
  focusLabel,
  isPresetFocus,
  type AiObjectiveBrief,
  type AmbitionLevel,
  type BriefFocus,
  type ObjectiveFocus,
} from "./aiObjectiveBrief";
import { MEASURE_META, formatRawValue, type Objective } from "./cicloBuilderTypes";
import {
  parseBriefFromMessage,
  getMissingCriteria,
  mergeBriefUpdate,
  toAiObjectiveBrief,
  type CriterionId,
  type ParsedBrief,
} from "./aiChatParser";

/* ------------------------------------------------------------------ *
 * Tipos de mensajes del chat
 * ------------------------------------------------------------------ */

type ChatRole = "ai" | "user";

interface ChatMessageBase {
  id: string;
  role: ChatRole;
  timestamp: Date;
}

interface TextMessage extends ChatMessageBase {
  kind: "text";
  text: string;
}

interface ChipsMessage extends ChatMessageBase {
  kind: "chips";
  text: string;
  chips: readonly ChatChip[];
}

interface TypingMessage extends ChatMessageBase {
  kind: "typing";
}

type ChatMessage =
  | TextMessage
  | ChipsMessage
  | TypingMessage;

interface ChatChip {
  label: string;
  value: string;
}

/* ------------------------------------------------------------------ *
 * Constantes
 * ------------------------------------------------------------------ */

const GREETING_SINGLE =
  "¡Hola! 👋 Cuéntame qué objetivo quieres crear. Descríbelo con tus palabras: qué quieres lograr, para qué área, y qué tan exigente debe ser la meta.";

const getGreetingSet = (scopeLabel: string) =>
  `¡Hola! 👋 Cuéntame qué objetivos quieres crear. Describe lo que necesitas: cuántos, para qué áreas, qué contexto debe reflejarse en los objetivos ${scopeLabel}, y qué tan exigentes deben ser las metas.`;


const GREETING_STARTERS: readonly ChatChip[] = [
  { label: "3 objetivos de crecimiento y clientes, retadores", value: "Quiero crear 3 objetivos enfocados en crecimiento y clientes, que sean retadores" },
  { label: "Subir la satisfacción del cliente este trimestre", value: "Subir la satisfacción del cliente este trimestre" },
  { label: "Reducir la rotación y mejorar el clima laboral", value: "Quiero reducir la rotación de los colaboradores y mejorar el clima organizacional" },
];

const FOCUS_CHIPS: readonly ChatChip[] = FOCUS_ORDER.map((focus) => ({
  label: FOCUS_META[focus].label,
  value: focus,
}));

const COUNT_CHIPS: readonly ChatChip[] = [
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: "4", value: "4" },
  { label: "5", value: "5" },
];

const AMBITION_CHIPS: readonly ChatChip[] = AMBITION_ORDER.map((level) => ({
  label: `${AMBITION_META[level].label} — ${AMBITION_META[level].tagline}`,
  value: level,
}));

const CLARIFICATION_QUESTIONS: Record<CriterionId, string> = {
  focuses: "¿En qué frentes se juega este ciclo? Elige los que apliquen:",
  count: "¿Cuántos objetivos quieres que genere?",
  ambition: "¿Qué tan exigentes deben ser las metas?",
};

const CLARIFICATION_CHIPS: Record<CriterionId, readonly ChatChip[]> = {
  focuses: FOCUS_CHIPS,
  count: COUNT_CHIPS,
  ambition: AMBITION_CHIPS,
};

/** Lo que la IA dice estar haciendo mientras genera. */
const WORKING_PHASES: readonly string[] = [
  "Leyendo tu contexto…",
  "Eligiendo cómo medir cada objetivo…",
  "Definiendo la dirección de cada métrica…",
  "Proponiendo metas para el ciclo…",
];

const GENERATION_MS = 2800;

let _messageId = 0;
function nextId(): string {
  return `msg-${++_messageId}-${Date.now()}`;
}

/* ------------------------------------------------------------------ *
 * Props del panel
 * ------------------------------------------------------------------ */

export type AiChatComposerMode = "single" | "set";

export interface AiObjectiveChatPanelProps {
  mode: AiChatComposerMode;
  onConfirm: (objectives: Objective[]) => void;
  onClose: () => void;
  maxCount?: number;
  scopeLabel?: string;
  onRemoveObjectives?: (ids: string[]) => void;
  onWorkingStateChange?: (isWorking: boolean, progress: number, caption: string, detail: string) => void;
  /**
   * "Conservar todos" dispara esto en vez de `onClose` cuando se pasa: quien
   * contiene el panel decide qué significa conservar —guardar sola la
   * asignación si ya quedó completa, o solo cerrar el panel si todavía falta
   * algo—, no el panel del chat. Sin este prop, conservar simplemente cierra.
   */
  onKeep?: () => void;
}

/* ------------------------------------------------------------------ *
 * Componente principal
 * ------------------------------------------------------------------ */

type ChatPhase = "chatting" | "generating" | "reviewing";

export function AiObjectiveChatPanel({
  mode,
  onConfirm,
  onClose,
  maxCount = 10,
  scopeLabel = "del ciclo",
  onRemoveObjectives,
  onWorkingStateChange,
  onKeep,
}: AiObjectiveChatPanelProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = React.useState("");
  const [phase, setPhase] = React.useState<ChatPhase>("chatting");
  const [brief, setBrief] = React.useState<ParsedBrief>({
    count: mode === "single" ? 1 : null,
    focuses: [],
    ambition: null,
    context: "",
    notes: "",
  });
  const [pendingCriteria, setPendingCriteria] = React.useState<CriterionId[]>([]);
  const [generatedObjectives, setGeneratedObjectives] = React.useState<Objective[]>([]);
  const [insertedIds, setInsertedIds] = React.useState<string[]>([]);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const runRef = React.useRef<{ cancelled: boolean } | null>(null);

  const firstName = CURRENT_USER?.name?.split(" ")[0] || "Usuario";

  // Scroll al fondo cuando cambian los mensajes.
  React.useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  // Limpieza al desmontar.
  React.useEffect(
    () => () => {
      if (runRef.current) runRef.current.cancelled = true;
    },
    []
  );

  // Saludo inicial.
  React.useEffect(() => {
    const greeting: ChipsMessage = {
      id: nextId(),
      role: "ai",
      kind: "chips",
      text: mode === "single" ? GREETING_SINGLE : getGreetingSet(scopeLabel),
      chips: GREETING_STARTERS,
      timestamp: new Date(),
    };
    setMessages([greeting]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Helpers de mensajes ---- */

  const addMessage = (msg: ChatMessage) =>
    setMessages((prev) => [...prev, msg]);

  const addAiText = (text: string) =>
    addMessage({
      id: nextId(),
      role: "ai",
      kind: "text",
      text,
      timestamp: new Date(),
    });

  const addAiChips = (text: string, chips: readonly ChatChip[]) =>
    addMessage({
      id: nextId(),
      role: "ai",
      kind: "chips",
      text,
      chips,
      timestamp: new Date(),
    });

  const addUserText = (text: string) =>
    addMessage({
      id: nextId(),
      role: "user",
      kind: "text",
      text,
      timestamp: new Date(),
    });

  const addTyping = () => {
    const msg: TypingMessage = {
      id: nextId(),
      role: "ai",
      kind: "typing",
      timestamp: new Date(),
    };
    addMessage(msg);
    return msg.id;
  };

  const removeMessage = (id: string) =>
    setMessages((prev) => prev.filter((m) => m.id !== id));

  /* ---- Generación ---- */

  const startGeneration = async (finalBrief: ParsedBrief) => {
    const run = { cancelled: false };
    runRef.current = run;
    setPhase("generating");

    const typingId = addTyping();

    // Iniciar progreso
    let progress = 0;
    const detail = mode === "single" ? "Creando un objetivo..." : `Creando objetivos ${scopeLabel}...`;
    onWorkingStateChange?.(true, progress, WORKING_PHASES[0], detail);

    const interval = setInterval(() => {
      progress = Math.min(95, progress + 5);
      const step = Math.floor((progress / 100) * WORKING_PHASES.length);
      const caption = WORKING_PHASES[Math.min(WORKING_PHASES.length - 1, Math.max(0, step))];
      onWorkingStateChange?.(true, progress, caption, detail);
    }, 150);

    // Espera simulada
    await new Promise((resolve) => setTimeout(resolve, GENERATION_MS));
    clearInterval(interval);
    if (run.cancelled) {
      onWorkingStateChange?.(false, 0, "", "");
      return;
    }

    progress = 100;
    onWorkingStateChange?.(true, 100, WORKING_PHASES[WORKING_PHASES.length - 1], detail);
    await new Promise((resolve) => setTimeout(resolve, 450));
    if (run.cancelled) {
      onWorkingStateChange?.(false, 0, "", "");
      return;
    }

    removeMessage(typingId);
    onWorkingStateChange?.(false, 0, "", "");

    // Generar objetivos
    const aiBrief = toAiObjectiveBrief(finalBrief);
    const generated = generateObjectiveSet(aiBrief, {
      useContextAsObjective: mode === "single",
    });

    setGeneratedObjectives(generated);

    // Inyectarlos en la lista real (pantalla principal) para que el usuario los revise allí
    onConfirm(generated);
    setInsertedIds(generated.map((o) => o.id));

    const countLabel = generated.length === 1
      ? "1 objetivo"
      : `${generated.length} objetivos`;

    addAiText(`¡Listo! Acabo de proponer ${countLabel} en la pantalla principal. Revísalos allí y usa los botones de abajo para decidir qué hacer con ellos.`);

    setPhase("reviewing");
  };

  /* ---- Preguntar criterio faltante ---- */

  const askNextCriterion = (missing: CriterionId[]) => {
    if (missing.length === 0) return;
    const next = missing[0];
    setPendingCriteria(missing);

    setTimeout(() => {
      addAiChips(CLARIFICATION_QUESTIONS[next], CLARIFICATION_CHIPS[next]);
      inputRef.current?.focus();
    }, 500);
  };

  /* ---- Procesar mensaje del usuario ---- */

  const handleUserMessage = (text: string) => {
    const trimmed = text.trim();
    if (trimmed === "") return;

    addUserText(trimmed);
    setInputValue("");



    // Si hay criterios pendientes, intentar parsear respuesta
    if (pendingCriteria.length > 0) {
      handleCriterionAnswer(trimmed);
      return;
    }

    // Primer mensaje o mensaje adicional de contexto
    handleInitialMessage(trimmed);
  };

  const handleInitialMessage = (text: string) => {
    const parsed = parseBriefFromMessage(text);
    // Si es modo single, forzar count=1
    if (mode === "single") parsed.count = 1;

    setBrief(parsed);

    const missing = getMissingCriteria(parsed);

    if (missing.length === 0) {
      // Todo completo, generar
      addAiText("¡Perfecto! Tengo todo lo que necesito. Déjame preparar los objetivos…");
      setTimeout(() => void startGeneration(parsed), 600);
    } else {
      // Reconocer lo que entendimos
      const understood: string[] = [];
      if (parsed.focuses.length > 0) {
        understood.push(`frentes: ${parsed.focuses.map(focusLabel).join(", ")}`);
      }
      if (parsed.count !== null) {
        understood.push(`${parsed.count} objetivo${parsed.count !== 1 ? "s" : ""}`);
      }
      if (parsed.ambition !== null) {
        understood.push(`nivel ${AMBITION_META[parsed.ambition].label.toLowerCase()}`);
      }

      const intro = understood.length > 0
        ? `Entendido: ${understood.join(" · ")}. Solo me falta algo más:`
        : "¡Gracias! Para armar los objetivos necesito saber algo más:";

      setTimeout(() => {
        addAiText(intro);
        setTimeout(() => askNextCriterion(missing), 400);
      }, 500);
    }
  };

  const handleCriterionAnswer = (text: string) => {
    const currentCriterion = pendingCriteria[0];
    let updatedBrief = { ...brief };

    if (currentCriterion === "focuses") {
      const lower = text.toLowerCase().trim();
      if (lower === "seguir" || lower === "seguir con estos" || lower === "continuar" || lower === "listo") {
        const remaining = getMissingCriteria(brief).filter((c) => c !== "focuses");
        if (remaining.length === 0) {
          addAiText("¡Perfecto! Tengo todo lo que necesito. Déjame preparar los objetivos…");
          setTimeout(() => void startGeneration(brief), 600);
        } else {
          setTimeout(() => askNextCriterion(remaining), 500);
        }
        return;
      }

      // Intentar parsear como focus
      const parsed = parseBriefFromMessage(text);
      if (parsed.focuses.length > 0) {
        updatedBrief = mergeBriefUpdate(updatedBrief, { focuses: [...updatedBrief.focuses, ...parsed.focuses] });
      } else {
        // Tratar como focus custom
        updatedBrief = mergeBriefUpdate(updatedBrief, { focuses: [...updatedBrief.focuses, text.trim()] });
      }
    } else if (currentCriterion === "count") {
      const num = parseInt(text.replace(/\D/g, ""), 10);
      if (!isNaN(num) && num >= 1 && num <= maxCount) {
        updatedBrief = mergeBriefUpdate(updatedBrief, { count: num });
      } else {
        addAiText(`Necesito un número entre 1 y ${maxCount}. ¿Cuántos objetivos?`);
        return;
      }
    } else if (currentCriterion === "ambition") {
      const parsed = parseBriefFromMessage(text);
      if (parsed.ambition) {
        updatedBrief = mergeBriefUpdate(updatedBrief, { ambition: parsed.ambition });
      } else {
        // Intentar match directo
        const lower = text.toLowerCase().trim();
        const match = AMBITION_ORDER.find(
          (level) => lower.includes(level) || lower.includes(AMBITION_META[level].label.toLowerCase())
        );
        if (match) {
          updatedBrief = mergeBriefUpdate(updatedBrief, { ambition: match });
        } else {
          addAiChips(
            "No logré identificar el nivel. Elige una de estas opciones:",
            AMBITION_CHIPS
          );
          return;
        }
      }
    }

    setBrief(updatedBrief);
    const remaining = getMissingCriteria(updatedBrief).filter(
      (c) => c !== currentCriterion
    );

    if (remaining.length === 0) {
      addAiText("¡Perfecto! Tengo todo lo que necesito. Déjame preparar los objetivos…");
      setTimeout(() => void startGeneration(updatedBrief), 600);
    } else {
      setTimeout(() => askNextCriterion(remaining), 500);
    }
  };



  /* ---- Acciones de revisión ---- */

  const handleKeep = () => {
    if (onKeep) onKeep();
    else onClose();
  };

  const handleRegenerate = () => {
    // Quitar los anteriores si ya estaban insertados
    if (insertedIds.length > 0) {
      onRemoveObjectives?.(insertedIds);
      setInsertedIds([]);
    }
    addAiText("Voy a preparar una nueva propuesta con los mismos criterios…");
    setTimeout(() => void startGeneration(brief), 600);
  };

  const handleModify = () => {
    if (insertedIds.length > 0) {
      onRemoveObjectives?.(insertedIds);
      setInsertedIds([]);
    }
    setPhase("chatting");
    setPendingCriteria([]);
    addAiChips(
      "¿Qué quieres cambiar? Puedes decírmelo con tus palabras o elegir:",
      [
        { label: "Más exigentes", value: "Quiero que las metas sean más exigentes" },
        { label: "Más realistas", value: "Quiero que las metas sean más realistas" },
        { label: "Cambiar frentes", value: "Quiero cambiar los frentes de los objetivos" },
        { label: "Más objetivos", value: "Quiero más objetivos" },
        { label: "Menos objetivos", value: "Quiero menos objetivos" },
      ]
    );
  };

  const handleDiscard = () => {
    if (insertedIds.length > 0) {
      onRemoveObjectives?.(insertedIds);
      setInsertedIds([]);
    }
    addAiText("Descartados. Si cambias de idea, puedes volver a abrir el chat. 👋");
    setTimeout(() => onClose(), 1200);
  };

  /* ---- Chip click ---- */

  const handleChipClick = (chip: ChatChip) => {
    // Si estamos en reviewing, tratar como acción
    if (phase === "reviewing") {
      addUserText(chip.label);
      if (chip.value === "conservar") handleKeep();
      else if (chip.value === "regenerar") handleRegenerate();
      else if (chip.value === "modificar") handleModify();
      else if (chip.value === "descartar") handleDiscard();
      return;
    }

    // Si hay criterio pendiente
    if (pendingCriteria.length > 0) {
      const current = pendingCriteria[0];

      if (chip.value === "__continue__") {
        addUserText("Seguir con estos");
        const remaining = getMissingCriteria(brief).filter((c) => c !== "focuses");
        if (remaining.length === 0) {
          addAiText("¡Perfecto! Tengo todo lo que necesito. Déjame preparar los objetivos…");
          setTimeout(() => void startGeneration(brief), 600);
        } else {
          setTimeout(() => askNextCriterion(remaining), 500);
        }
        return;
      }

      if (current === "focuses") {
        addUserText(chip.label);
        const newFocuses = [...brief.focuses];
        if (!newFocuses.includes(chip.value as BriefFocus)) {
          newFocuses.push(chip.value as BriefFocus);
        }
        const updated = mergeBriefUpdate(brief, { focuses: newFocuses });
        setBrief(updated);

        // Dar chance de elegir más o avanzar
        setTimeout(() => {
          addAiChips(
            `Frente "${chip.label}" añadido. ¿Quieres agregar otro frente o seguimos?`,
            [
              ...FOCUS_CHIPS.filter((c) => !newFocuses.includes(c.value)),
              { label: "✓ Seguir con estos", value: "__continue__" },
            ]
          );
        }, 300);
        return;
      }

      // Count o ambition
      addUserText(chip.label);
      handleCriterionAnswer(chip.value);
      return;
    }

    // Sugerencia inicial
    handleUserMessage(chip.value);
  };

  /* ---- Submit ---- */

  const handleSubmit = () => {
    handleUserMessage(inputValue);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  /* ---- Render ---- */

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-ai-mesh-agent shadow-card">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-3.5 border-b border-border/20">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: AI_GRADIENT }}
        >
          <Sparkles className="h-4 w-4 text-white" strokeWidth={2} />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-[13px] font-bold text-text-primary leading-tight">Agente IA</h2>
          <p className="text-[11px] text-text-muted">
            {mode === "single"
              ? "Crear un objetivo"
              : `Crear objetivos ${scopeLabel}`}
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-black/5 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      {/* Mensajes */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-5 space-y-4"
      >
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onChipClick={handleChipClick}
          />
        ))}
      </div>

      {/* Input / Actions */}
      <div className="shrink-0 px-6 pb-6 pt-2">
        {phase === "reviewing" ? (
          <div className="flex flex-col gap-2">
            <button
              onClick={handleKeep}
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-[13px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]"
              style={{ background: AI_GRADIENT }}
            >
              <Check className="size-4" strokeWidth={2.4} />
              Conservar todos
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleRegenerate}
                className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface text-[12px] font-semibold text-text-secondary transition-colors hover:border-primary/40 hover:text-text-primary active:scale-[0.98]"
              >
                <RefreshCw className="size-3.5" strokeWidth={2.2} />
                Otra propuesta
              </button>
              <button
                onClick={handleModify}
                className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface text-[12px] font-semibold text-text-secondary transition-colors hover:border-primary/40 hover:text-text-primary active:scale-[0.98]"
              >
                <SlidersHorizontal className="size-3.5" strokeWidth={2.2} />
                Modificar
              </button>
            </div>
            <button
              onClick={handleDiscard}
              className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/5 text-[12px] font-semibold text-destructive transition-colors hover:border-destructive/50 hover:bg-destructive/15 active:scale-[0.98]"
            >
              <Trash2 className="size-3.5" strokeWidth={2.2} />
              Descartar
            </button>
          </div>
        ) : (
          <div className="group relative rounded-[22px] bg-surface p-4 z-0 shadow-card transition-shadow focus-within:shadow-[0_0_20px_rgba(45,92,247,0.1)]">
            <MovingBorderBeam
              duration={6000}
              borderWidth={1.5}
              rx={22}
              ry={22}
              colorFrom="hsl(var(--ai-gradient-start))"
              colorTo="hsl(var(--ai-gradient-end))"
            />
            <textarea
              ref={inputRef}
              rows={2}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu mensaje…"
              disabled={phase === "generating"}
              className="relative z-10 min-h-12 w-full resize-none bg-transparent text-[13px] leading-normal text-text-primary outline-none placeholder:text-text-muted disabled:opacity-50"
            />
            <div className="relative z-10 mt-2 flex items-center justify-between">
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-surface text-text-secondary transition-colors hover:bg-background disabled:opacity-50"
                title="Agregar contexto"
                aria-label="Agregar contexto"
                disabled={phase === "generating"}
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
              </button>
              <button
                onClick={handleSubmit}
                disabled={!inputValue.trim() || phase === "generating"}
                className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-50 disabled:hover:translate-y-0"
                style={{ background: AI_GRADIENT }}
                title="Enviar mensaje"
                aria-label="Enviar mensaje"
              >
                <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        )}
        <p className="mt-3 text-center text-[11px] text-text-muted">
          Los objetivos generados son una propuesta. Revísalos y ajústalos.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Burbuja de mensaje
 * ------------------------------------------------------------------ */

function MessageBubble({
  message,
  onChipClick,
}: {
  message: ChatMessage;
  onChipClick: (chip: ChatChip) => void;
}) {
  const isAi = message.role === "ai";

  if (message.kind === "typing") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-2.5"
      >
        <AiBubbleAvatar />
        <div className="rounded-2xl rounded-tl-md bg-ai-mesh-card border border-border/30 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:0ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:150ms]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:300ms]" />
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "flex items-start gap-2.5",
        !isAi && "flex-row-reverse"
      )}
    >
      {isAi ? <AiBubbleAvatar /> : <UserBubbleAvatar />}

      <div
        className={cn(
          "flex max-w-[85%] flex-col gap-2",
          !isAi && "items-end"
        )}
      >
        {/* Texto */}
        {"text" in message && message.text && (
          <div
            className={cn(
              "rounded-2xl px-4 py-3 text-[13px] leading-relaxed",
              isAi
                ? "rounded-tl-md bg-ai-mesh-card border border-border/30 text-text-primary"
                : "rounded-tr-md bg-primary text-white"
            )}
          >
            {message.text}
          </div>
        )}

        {/* Chips */}
        {message.kind === "chips" && (
          <div className="flex flex-wrap gap-1.5">
            {message.chips.map((chip) => (
              <button
                key={chip.value}
                type="button"
                onClick={() => onChipClick(chip)}
                className="h-8 rounded-full border border-border/70 bg-surface px-3.5 text-[11.5px] font-semibold text-text-secondary transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:text-text-primary hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.97]"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 * Sub-componentes
 * ------------------------------------------------------------------ */

function AiBubbleAvatar() {
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
      style={{ background: AI_GRADIENT }}
    >
      <Sparkles className="h-3.5 w-3.5 text-white" strokeWidth={2.2} />
    </span>
  );
}

function UserBubbleAvatar() {
  return (
    <img
      src={CURRENT_USER.avatarUrl}
      alt={CURRENT_USER.name}
      className="h-7 w-7 shrink-0 rounded-lg object-cover"
    />
  );
}



function ActionButton({
  onClick,
  label,
  variant,
}: {
  onClick: () => void;
  label: string;
  variant: "primary" | "secondary" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-xl px-4 text-[12px] font-semibold transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        variant === "primary" &&
          "text-white hover:brightness-110"
              ,
        variant === "secondary" &&
          "border border-border bg-surface text-text-secondary hover:border-primary/40 hover:text-text-primary",
        variant === "danger" &&
          "border border-status-negative/30 bg-status-negative/5 text-status-negative hover:bg-status-negative/10"
      )}
      style={variant === "primary" ? { background: AI_GRADIENT } : undefined}
    >
      {label}
    </button>
  );
}
