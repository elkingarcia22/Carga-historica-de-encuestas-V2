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
  ArrowUp,
  Sparkles,
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
  generateObjectiveSet,
  focusLabel,
  type BriefFocus,
} from "./aiObjectiveBrief";
import { type Objective } from "./cicloBuilderTypes";
import {
  DEFAULT_OBJECTIVE_MODEL_RULES,
  type ObjectiveModelId,
  type ObjectiveModelRules,
} from "./objectiveModel";
import {
  createEmptyBrief,
  focusesFromObjectives,
  parseBriefFromMessage,
  mergeBriefUpdate,
  toAiObjectiveBrief,
  type ParsedBrief,
} from "./aiChatParser";
import {
  CONTINUE_VALUE,
  NO_ALIGNMENT_VALUE,
  NO_CHILDREN_VALUE,
  SKIP_BASELINE_VALUE,
  SKIP_LEVER_VALUE,
  WRITE_OWN_VALUE,
  alignmentChips,
  chatChildrenVocab,
  chatGreeting,
  chatVocab,
  companyObjectiveLabel,
  criterionChips,
  criterionQuestion,
  focusChips,
  freeCompanyObjectives,
  missingCriteria,
  workingPhases,
  type ChatChip,
  type ChatContext,
  type CriterionId,
  type ObjectiveScope,
} from "./aiChatQuestions";

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

/* ------------------------------------------------------------------ *
 * Constantes
 * ------------------------------------------------------------------ */

/** Las acciones sobre la propuesta ya generada, como una pregunta más del
 *  chat —chips en una fila, igual que el resto de la conversación— en vez
 *  de una barra de botones aparte que rompía el patrón. */
const REVIEW_CHIPS: readonly ChatChip[] = [
  { label: "Conservar todos", value: "conservar", tone: "primary" },
  { label: "Otra propuesta", value: "regenerar" },
  { label: "Modificar", value: "modificar" },
  { label: "Descartar", value: "descartar", tone: "danger" },
];

const GENERATION_MS = 2800;

/** Cómo se nombra al destinatario cuando nadie pasó un nombre propio. */
const defaultAudience = (scope: ObjectiveScope): string =>
  scope === "empresa" ? "la empresa" : scope === "grupo" ? "el equipo" : "la persona";

/** Las formas de decir "ya está, sigamos" sin elegir la fila que lo dice. */
const isContinueWord = (text: string): boolean =>
  ["seguir", "seguir con estos", "continuar", "listo", "ninguno", "ya", "no"].includes(
    text.toLowerCase().trim()
  );

/**
 * Lo que la IA dice haber hecho: cuántos, de qué cuelgan y qué llevan debajo.
 *
 * Nombrarlo importa porque lo que se generó ya no es solo una lista de
 * títulos: si el modelo pidió resultados clave, están escritos, y si el grupo
 * apunta al norte, ya quedaron colgados. Decirlo evita que alguien abra las
 * tarjetas a revisar si hay que completarlas a mano.
 */
function proposalSummary(
  generated: readonly Objective[],
  brief: ParsedBrief,
  ctx: ChatContext
): string {
  const vocab = chatVocab(ctx);
  const childrenVocab = chatChildrenVocab(ctx);
  const noun = generated.length === 1 ? vocab.objective.toLowerCase() : vocab.objectives.toLowerCase();
  const parts = [`Acabo de proponer ${generated.length} ${noun}`];

  const children = generated[0]?.keyActions.length ?? 0;
  if (children > 0 && childrenVocab.children) {
    parts.push(
      `con ${children} ${childrenVocab.children.toLowerCase()} cada ${vocab.objective.toLowerCase()}`
    );
  }
  if (brief.alignedTo.length > 0) {
    parts.push(
      brief.alignedTo.length === 1
        ? "colgados del objetivo de la empresa que elegiste"
        : `repartidos entre los ${brief.alignedTo.length} objetivos de la empresa que elegiste`
    );
  }

  return `${parts.join(", ")}. Están en la pantalla principal: échales un vistazo allí.`;
}

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
  /**
   * Para quién se escribe. No es cosmético: decide qué se pregunta y en qué
   * orden —el norte de la empresa parte de cero, un grupo parte de ese norte—.
   */
  scope?: ObjectiveScope;
  /** Las reglas del modelo del ciclo. Sin ellas corre como SMART, que es el
   *  constructor de siempre. */
  rules?: ObjectiveModelRules;
  /** Solo para el vocabulario y el nombre del modelo en el saludo: lo que
   *  decide el flujo son las reglas. */
  model?: ObjectiveModelId | null;
  /** El norte ya escrito, para poder colgar de él lo que se genere aquí. */
  companyObjectives?: readonly Objective[];
  /** De quién son estos objetivos, como se diría en voz alta: "Marketing",
   *  "Ana Pérez", "la empresa". */
  audienceLabel?: string;
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
  scope = "empresa",
  rules = DEFAULT_OBJECTIVE_MODEL_RULES,
  model = null,
  companyObjectives = [],
  audienceLabel,
  onRemoveObjectives,
  onWorkingStateChange,
  onKeep,
}: AiObjectiveChatPanelProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = React.useState("");
  const [phase, setPhase] = React.useState<ChatPhase>("chatting");
  const [brief, setBrief] = React.useState<ParsedBrief>(() =>
    createEmptyBrief(mode === "single" ? 1 : null)
  );

  /**
   * Todo lo que el chat sabe antes de hablar. Se arma una vez por apertura:
   * el modelo y el norte no cambian a mitad de una conversación, y recalcularlo
   * en cada render volvería a barajar las opciones que el autor está leyendo.
   */
  const ctx: ChatContext = React.useMemo(
    () => ({
      scope,
      // El norte no lleva nada colgando —la tarjeta de empresa apaga los
      // hijos aunque el modelo los exija (`ObjectiveCardCompact`)—, así que
      // aquí tampoco se preguntan ni se escriben: serían datos invisibles.
      rules: scope === "empresa" ? { ...rules, children: "none" as const } : rules,
      model,
      companyObjectives,
      audienceLabel: audienceLabel ?? defaultAudience(scope),
      maxCount,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope, rules, model, companyObjectives, audienceLabel, maxCount]
  );
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

  // Saludo inicial — sin opciones: la primera respuesta es el contexto del
  // ciclo, y sugerirlo sería poner en boca del autor un ciclo que no es suyo.
  React.useEffect(() => {
    const greeting: TextMessage = {
      id: nextId(),
      role: "ai",
      kind: "text",
      text: chatGreeting(ctx, mode),
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

  /**
   * Un mensaje de la IA, con los tres puntos de "escribiendo" antes —igual
   * que ya hacía `startGeneration`, aquí para el resto de la conversación—.
   * Sin esto cada pregunta aparecía de golpe tras el `setTimeout`, que se lee
   * como una interfaz reaccionando, no como alguien pensando la respuesta.
   */
  const sendAiText = (text: string, delay = 550) => {
    const typingId = addTyping();
    setTimeout(() => {
      removeMessage(typingId);
      addAiText(text);
    }, delay);
  };

  const sendAiChips = (text: string, chips: readonly ChatChip[], delay = 550) => {
    const typingId = addTyping();
    setTimeout(() => {
      removeMessage(typingId);
      addAiChips(text, chips);
      inputRef.current?.focus();
    }, delay);
  };

  /* ---- Generación ---- */

  const startGeneration = async (finalBrief: ParsedBrief) => {
    const run = { cancelled: false };
    runRef.current = run;
    setPhase("generating");

    const typingId = addTyping();

    // Iniciar progreso. Las fases dicen lo que este ciclo de verdad hace:
    // colgar del norte solo cuando hay norte, escribir resultados clave solo
    // cuando el modelo los pide.
    const phases = workingPhases(ctx);
    let progress = 0;
    const detail = mode === "single" ? "Creando un objetivo..." : `Creando objetivos ${scopeLabel}...`;
    onWorkingStateChange?.(true, progress, phases[0], detail);

    const interval = setInterval(() => {
      progress = Math.min(95, progress + 5);
      const step = Math.floor((progress / 100) * phases.length);
      const caption = phases[Math.min(phases.length - 1, Math.max(0, step))];
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
    onWorkingStateChange?.(true, 100, phases[phases.length - 1], detail);
    await new Promise((resolve) => setTimeout(resolve, 450));
    if (run.cancelled) {
      onWorkingStateChange?.(false, 0, "", "");
      return;
    }

    removeMessage(typingId);
    onWorkingStateChange?.(false, 0, "", "");

    // Generar objetivos, ya con la forma que el modelo pide: colgados del
    // norte elegido y con sus resultados clave, acciones o tareas debajo.
    const aiBrief = toAiObjectiveBrief(finalBrief);
    const generated = generateObjectiveSet(aiBrief, {
      useContextAsObjective: mode === "single",
      rules: ctx.rules,
      alignTo: finalBrief.alignedTo,
      childrenCount: finalBrief.childrenCount,
    });

    setGeneratedObjectives(generated);

    // Inyectarlos en la lista real (pantalla principal) para que el usuario los revise allí
    onConfirm(generated);
    setInsertedIds(generated.map((o) => o.id));

    addAiText(`¡Listo! ${proposalSummary(generated, finalBrief, ctx)}`);
    setPhase("reviewing");

    sendAiChips("¿Qué hacemos con ellos?", REVIEW_CHIPS, 350);
  };

  /* ---- Ronda de frentes ---- */

  /**
   * Tras sumar un frente se vuelve a preguntar, venga de la lista o escrito a
   * mano: antes escribirlo saltaba directo a generar, así que quien tenía dos
   * frentes propios solo podía contar el primero.
   */
  const askMoreFocuses = (focuses: readonly string[], addedLabel: string) => {
    sendAiChips(
      `Frente "${addedLabel}" añadido. ¿Quieres agregar otro o seguimos?`,
      [
        {
          label: "Seguir con estos",
          value: CONTINUE_VALUE,
          tone: "primary",
          description: focuses.map(focusLabel).join(", "),
        },
        ...focusChips(ctx, focuses),
      ],
      350
    );
  };

  /** Cierra la ronda de frentes y sigue con lo que falte. */
  const finishFocuses = (current: ParsedBrief) => {
    continueAfter(current, "focuses");
  };

  /* ---- Ronda de alineación ---- */

  /**
   * Igual que los frentes pero sobre el norte: un grupo puede empujar dos
   * objetivos de la empresa a la vez, y obligarlo a elegir uno solo sería
   * inventar una exclusividad que el ciclo no tiene.
   */
  const askMoreAlignment = (picked: readonly string[]) => {
    const labels = picked
      .map((id) => {
        const index = ctx.companyObjectives.findIndex((objective) => objective.id === id);
        return index === -1 ? null : companyObjectiveLabel(ctx.companyObjectives[index], index);
      })
      .filter((label): label is string => label !== null);

    // Sin objetivos libres no hay ronda que seguir: se cierra sola. Se cuentan
    // los objetivos de la empresa, no las filas — "Ninguno" y "Otro" están
    // siempre y harían que la ronda no terminara nunca.
    if (freeCompanyObjectives(ctx, picked) === 0) {
      finishAlignment(brief);
      return;
    }

    const remainingChips = alignmentChips(ctx, picked).filter(
      (chip) => chip.value !== NO_ALIGNMENT_VALUE
    );

    sendAiChips(
      "Anotado. ¿Le aporta a alguno más o seguimos?",
      [
        {
          label: "Seguir con estos",
          value: CONTINUE_VALUE,
          tone: "primary",
          description: labels.join(", "),
        },
        ...remainingChips,
      ],
      350
    );
  };

  /**
   * Cierra la alineación y, de paso, saca los frentes de ella.
   *
   * Es el momento en que el contexto de lo ya escrito paga: los frentes del
   * grupo salen de los objetivos de la empresa a los que apunta, así que la
   * pregunta de frentes desaparece en vez de repetirle al autor algo que la
   * compañía ya decidió dos pasos antes.
   */
  const finishAlignment = (current: ParsedBrief) => {
    const aligned = ctx.companyObjectives.filter((objective) =>
      current.alignedTo.includes(objective.id)
    );
    const derived = current.focuses.length > 0 ? current.focuses : focusesFromObjectives(aligned);
    const next = mergeBriefUpdate(current, { focuses: derived, alignmentAsked: true });
    setBrief(next);
    continueAfter(next, "alignment");
  };

  /** Sigue con lo que falte tras contestar `answered`, o genera si no falta nada. */
  const continueAfter = (current: ParsedBrief, answered: CriterionId) => {
    const remaining = missingCriteria(current, ctx).filter((c) => c !== answered);
    if (remaining.length === 0) {
      sendAiText("¡Perfecto! Tengo todo lo que necesito. Dame un momento…");
      setTimeout(() => void startGeneration(current), 900);
    } else {
      setTimeout(() => askNextCriterion(remaining), 400);
    }
  };

  /* ---- Preguntar criterio faltante ---- */

  const askNextCriterion = (missing: CriterionId[]) => {
    if (missing.length === 0) return;
    const next = missing[0];
    setPendingCriteria(missing);
    sendAiChips(criterionQuestion(next, ctx, brief), criterionChips(next, ctx, brief));
  };

  /* ---- Procesar mensaje del usuario ---- */

  const handleUserMessage = (text: string) => {
    const trimmed = text.trim();
    if (trimmed === "") return;

    addUserText(trimmed);
    setInputValue("");

    // Decirle algo a la IA mientras revisa la propuesta es un pedido de
    // cambio dicho de corrido —"hazlos más agresivos"—, no un ciclo nuevo:
    // se lee como la instrucción que hoy solo aceptaba el chip "Modificar",
    // sin obligar a pasar por su menú primero.
    if (phase === "reviewing") {
      if (insertedIds.length > 0) {
        onRemoveObjectives?.(insertedIds);
        setInsertedIds([]);
      }
      setPhase("chatting");
      setPendingCriteria([]);
      handleInitialMessage(trimmed);
      return;
    }

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

    // Se fusiona con lo que ya se sabía en vez de reemplazarlo: un mensaje
    // posterior —"hazlos más exigentes" durante la revisión, o una segunda
    // frase de contexto— habla de una sola cosa, y machacar el resto del
    // brief con lo que ese mensaje no menciona sería preguntar de nuevo algo
    // que el autor ya había contestado.
    const updatedBrief: ParsedBrief = {
      ...brief,
      count: parsed.count ?? brief.count,
      focuses:
        parsed.focuses.length > 0
          ? [...brief.focuses, ...parsed.focuses.filter((focus) => !brief.focuses.includes(focus))]
          : brief.focuses,
      ambition: parsed.ambition ?? brief.ambition,
      // El contexto es la descripción original del ciclo; una vez contada,
      // un mensaje posterior no la reemplaza.
      context: brief.context.trim() === "" ? parsed.context : brief.context,
    };

    setBrief(updatedBrief);

    const missing = missingCriteria(updatedBrief, ctx);

    if (missing.length === 0) {
      // Todo completo, generar
      sendAiText("¡Perfecto! Tengo todo lo que necesito. Dame un momento…");
      setTimeout(() => void startGeneration(updatedBrief), 900);
    } else {
      // Reconocer lo que entendimos
      const understood: string[] = [];
      if (updatedBrief.focuses.length > 0) {
        // "Frentes" es la palabra del ciclo de la empresa; para un grupo o una
        // persona la misma lista son los temas en los que trabaja.
        const noun = scope === "empresa" ? "frentes" : "temas";
        understood.push(`${noun}: ${updatedBrief.focuses.map(focusLabel).join(", ")}`);
      }
      if (updatedBrief.count !== null) {
        // El plural lo pone el modelo: "Indicador" → "Indicadores", no
        // "Indicadors", que es lo que salía de pegarle una ese al singular.
        const vocab = chatVocab(ctx);
        const noun = updatedBrief.count === 1 ? vocab.objective : vocab.objectives;
        understood.push(`${updatedBrief.count} ${noun.toLowerCase()}`);
      }
      if (updatedBrief.ambition !== null) {
        understood.push(`nivel ${AMBITION_META[updatedBrief.ambition].label.toLowerCase()}`);
      }

      const intro = understood.length > 0
        ? `Genial, ya tengo ${understood.join(" · ")}. Me falta una cosa más:`
        : "¡Gracias! Para que los objetivos queden bien necesito un par de cosas más:";

      sendAiText(intro);
      setTimeout(() => askNextCriterion(missing), 950);
    }
  };

  const handleCriterionAnswer = (text: string) => {
    const currentCriterion = pendingCriteria[0];
    let updatedBrief = { ...brief };

    if (currentCriterion === "alignment") {
      if (text.trim() === NO_ALIGNMENT_VALUE || isContinueWord(text)) {
        finishAlignment(mergeBriefUpdate(updatedBrief, {}));
        return;
      }

      // Escrito a mano: se busca el objetivo de la empresa por su título. Lo
      // que no coincide con ninguno no se descarta, se guarda como contexto —
      // puede ser el nombre interno de una iniciativa que la IA sí puede leer.
      const match = ctx.companyObjectives.find((objective) =>
        objective.title.toLowerCase().includes(text.trim().toLowerCase())
      );
      if (match === undefined) {
        updatedBrief = mergeBriefUpdate(updatedBrief, {
          notes: [updatedBrief.notes, text.trim()].filter(Boolean).join(". "),
        });
        setBrief(updatedBrief);
        finishAlignment(updatedBrief);
        return;
      }

      const picked = updatedBrief.alignedTo.includes(match.id)
        ? updatedBrief.alignedTo
        : [...updatedBrief.alignedTo, match.id];
      updatedBrief = mergeBriefUpdate(updatedBrief, { alignedTo: picked });
      setBrief(updatedBrief);
      askMoreAlignment(picked);
      return;
    }

    if (currentCriterion === "lever") {
      const skipped = text.trim() === SKIP_LEVER_VALUE;
      updatedBrief = mergeBriefUpdate(updatedBrief, {
        lever: skipped ? "" : text.trim(),
        leverAsked: true,
      });
      setBrief(updatedBrief);
      continueAfter(updatedBrief, "lever");
      return;
    }

    if (currentCriterion === "children") {
      const skipped = text.trim() === NO_CHILDREN_VALUE;
      const parsedCount = parseInt(text.replace(/\D/g, ""), 10);
      const count = skipped ? 0 : Number.isNaN(parsedCount) ? null : Math.min(5, parsedCount);

      if (count === null) {
        // Un "sí" suelto vale: la pregunta ya dijo de qué tamaño es el plan.
        const said = text.trim().toLowerCase();
        const agreed = said.startsWith("s") || said.includes("dale") || said.includes("ok");
        if (!agreed) {
          sendAiChips(criterionQuestion("children", ctx, updatedBrief), criterionChips("children", ctx, updatedBrief));
          return;
        }
      }

      updatedBrief = mergeBriefUpdate(updatedBrief, {
        childrenCount: count ?? (ctx.rules.children === "results" ? 3 : 2),
        childrenAsked: true,
      });
      setBrief(updatedBrief);
      continueAfter(updatedBrief, "children");
      return;
    }

    if (currentCriterion === "focuses") {
      if (isContinueWord(text)) {
        finishFocuses(brief);
        return;
      }

      const parsed = parseBriefFromMessage(text);
      const added = parsed.focuses.length > 0 ? parsed.focuses : [text.trim()];
      const newFocuses = [
        ...updatedBrief.focuses,
        ...added.filter((focus) => !updatedBrief.focuses.includes(focus)),
      ];
      updatedBrief = mergeBriefUpdate(updatedBrief, { focuses: newFocuses });
      setBrief(updatedBrief);
      askMoreFocuses(newFocuses, added.map(focusLabel).join(", "));
      return;
    }

    if (currentCriterion === "count") {
      const num = parseInt(text.replace(/\D/g, ""), 10);
      if (!isNaN(num) && num >= 1 && num <= maxCount) {
        updatedBrief = mergeBriefUpdate(updatedBrief, { count: num });
      } else {
        sendAiText(
          `Necesito un número entre 1 y ${maxCount}. ¿Cuántos ${chatVocab(ctx).objectives.toLowerCase()}?`
        );
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
          sendAiChips(
            "No logré identificar el nivel. Elige una de estas opciones:",
            criterionChips("ambition", ctx, updatedBrief)
          );
          return;
        }
      }
    } else if (currentCriterion === "baseline") {
      // Saltarla no es no contestarla: el chip de salto también cuenta como
      // "ya se preguntó", igual que un "no" cuenta como respuesta al norte
      // del ciclo. Cualquier otra frase —incluida la escrita a mano— se
      // guarda tal cual en las notas, que es lo que después lee el generador.
      const skipped = text.trim() === SKIP_BASELINE_VALUE;
      updatedBrief = mergeBriefUpdate(updatedBrief, {
        notes: skipped ? "" : text.trim(),
        baselineAsked: true,
      });
    }

    setBrief(updatedBrief);
    continueAfter(updatedBrief, currentCriterion);
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
    sendAiText("Voy a preparar una nueva propuesta con los mismos criterios…");
    setTimeout(() => void startGeneration(brief), 900);
  };

  const handleModify = () => {
    if (insertedIds.length > 0) {
      onRemoveObjectives?.(insertedIds);
      setInsertedIds([]);
    }
    setPhase("chatting");
    setPendingCriteria([]);
    sendAiChips(
      "¿Qué quieres cambiar?",
      [
        { label: "Metas más exigentes", value: "Quiero que las metas sean más exigentes" },
        { label: "Metas más realistas", value: "Quiero que las metas sean más realistas" },
        { label: "Cambiar los frentes", value: "Quiero cambiar los frentes de los objetivos" },
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
    sendAiText("Descartados. Si cambias de idea, puedes volver a abrir el chat. 👋");
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

      // "Seguir con estos" cierra la ronda que esté abierta: la de frentes o
      // la del norte, que son las dos que admiten varias respuestas.
      if (chip.value === CONTINUE_VALUE) {
        addUserText("Seguir con estos");
        if (current === "alignment") finishAlignment(brief);
        else finishFocuses(brief);
        return;
      }

      if (current === "alignment") {
        addUserText(chip.label);
        if (chip.value === NO_ALIGNMENT_VALUE) {
          finishAlignment(brief);
          return;
        }
        const picked = brief.alignedTo.includes(chip.value)
          ? brief.alignedTo
          : [...brief.alignedTo, chip.value];
        const updated = mergeBriefUpdate(brief, { alignedTo: picked });
        setBrief(updated);
        askMoreAlignment(picked);
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
        askMoreFocuses(newFocuses, chip.label);
        return;
      }

      // Count, ambición, hijos, palanca o punto de partida: una respuesta
      // directa, sin ramas propias.
      addUserText(chip.label);
      handleCriterionAnswer(chip.value);
      return;
    }

    // Sugerencia inicial
    handleUserMessage(chip.value);
  };

  /* ---- Opciones vivas ---- */

  /** Solo la última pregunta espera respuesta: una vez contestada, el hilo
   *  guarda el enunciado y lo elegido, y el panel se vacía. */
  const lastMessage = messages[messages.length - 1];
  const activeChips =
    lastMessage?.kind === "chips" && phase !== "generating" ? lastMessage.chips : null;

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
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>

      {/* Opciones + input: la pregunta viva se contesta aquí abajo, eligiendo
          una fila o escribiendo en el mismo cuadro. Revisando la propuesta el
          cuadro sigue disponible para pedir un cambio de corrido ("hazlos más
          agresivos") sin pasar por el menú. */}
      <div className="shrink-0 px-6 pb-6 pt-2">
        {activeChips && (
          <div className="mb-2">
            <OptionsPanel
              chips={activeChips}
              onChipClick={handleChipClick}
              onWriteSubmit={handleUserMessage}
            />
          </div>
        )}

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
            placeholder={
              activeChips ? "Elige una opción o escribe tu respuesta…" : "Escribe tu mensaje…"
            }
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

function MessageBubble({ message }: { message: ChatMessage }) {
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

      {/* Solo el texto: las opciones de la pregunta viva se contestan desde el
          panel anclado al campo de escribir, no dentro del hilo. */}
      <div className={cn("flex max-w-[85%] flex-col gap-2", !isAi && "items-end")}>
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
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 * Panel de opciones — vive sobre el campo de escribir
 * ------------------------------------------------------------------ */

/**
 * Las respuestas posibles a la pregunta viva, como filas numeradas encima del
 * cuadro de texto: elegir y escribir son la misma acción, así que las dos
 * viven en el mismo sitio en vez de obligar a subir la vista al hilo. El
 * número queda a la derecha de cada fila, como el orden en que se leen —
 * primero qué es la opción, al final cuál tecla la marca.
 */
function OptionsPanel({
  chips,
  onChipClick,
  onWriteSubmit,
}: {
  chips: readonly ChatChip[];
  onChipClick: (chip: ChatChip) => void;
  onWriteSubmit: (text: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="max-h-[42vh] overflow-y-auto overscroll-contain rounded-2xl border border-border/50 bg-surface shadow-card"
    >
      {chips.map((chip, index) =>
        chip.value === WRITE_OWN_VALUE ? (
          <WriteOwnRow key={chip.value} index={index} chip={chip} onSubmit={onWriteSubmit} />
        ) : (
          <OptionRow key={chip.value} index={index} chip={chip} onClick={() => onChipClick(chip)} />
        )
      )}
    </motion.div>
  );
}

function OptionRow({
  index,
  chip,
  onClick,
}: {
  index: number;
  chip: ChatChip;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 border-t border-border/40 px-4 py-3 text-left transition-colors first:border-t-0 focus-visible:outline-none focus-visible:bg-background",
        chip.tone === "danger" ? "hover:bg-destructive/5" : "hover:bg-background"
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            "text-[12.5px] font-semibold leading-snug",
            chip.tone === "danger" ? "text-destructive" : "text-text-primary"
          )}
        >
          {chip.label}
        </span>
        {chip.description && (
          <span className="text-[11.5px] leading-relaxed text-text-secondary">
            {chip.description}
          </span>
        )}
      </span>
      <span
        style={chip.tone === "primary" ? { background: AI_GRADIENT } : undefined}
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold tabular-nums",
          chip.tone === "primary" && "text-white",
          chip.tone === "danger" &&
            "border border-destructive/30 bg-destructive/5 text-destructive",
          !chip.tone && "border border-border/70 bg-background text-text-muted"
        )}
      >
        {index + 1}
      </span>
    </button>
  );
}

/** La fila "Otro": en vez de un botón que contesta de una, trae su propio
 *  campo — la opción y el cómo escribirla viven en el mismo renglón, sin
 *  mandar la vista al cuadro de texto de más abajo. */
function WriteOwnRow({
  index,
  chip,
  onSubmit,
}: {
  index: number;
  chip: ChatChip;
  onSubmit: (text: string) => void;
}) {
  const [value, setValue] = React.useState("");

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
  };

  return (
    <div className="flex flex-col gap-2 border-t border-border/40 px-4 py-3 first:border-t-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12.5px] font-semibold leading-snug text-text-primary">
          {chip.label}
        </span>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-[10px] font-semibold tabular-nums text-text-muted">
          {index + 1}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={chip.placeholder ?? "Escribe tu propia respuesta aquí"}
          className="h-9 min-w-0 flex-1 rounded-lg border border-border/60 bg-background px-3 text-[12.5px] text-text-primary outline-none placeholder:text-text-muted focus:border-primary/40"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white transition-opacity disabled:opacity-40"
          style={{ background: AI_GRADIENT }}
          aria-label="Enviar"
        >
          <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      </div>
    </div>
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
