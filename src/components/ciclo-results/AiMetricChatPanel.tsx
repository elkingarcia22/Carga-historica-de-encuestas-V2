import * as React from "react";
import { motion } from "framer-motion";
import { ArrowUp, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ShellAgentPanelSlot } from "@/components/app-shell";
import { MovingBorderBeam } from "@/components/ui/moving-border-beam";
import { AI_GRADIENT, CURRENT_USER } from "@/components/app-shell/appShellData";
import {
  METRIC_SHAPES,
  describeMetric,
  shapeOf,
  type MetricDefinition,
  type MetricShape,
} from "./metricDefinition";
import {
  EMPTY_BRIEF,
  METRIC_HOME,
  METRIC_QUESTIONS,
  composeMetric,
  composerStages,
  cutLabel,
  questionById,
  shapeReason,
  type MetricBrief,
} from "./metricQuestions";
import {
  isMetricBriefReady,
  missingMetricCriteria,
  parseMetricIntent,
  parseMetricMessage,
  type MetricCriterionId,
} from "./aiMetricChatParser";
import {
  nextCustomMetricId,
  type CustomMetric,
  type MetricWorkingState,
} from "./customMetrics";

/**
 * Crear una métrica conversando, con el reporte al lado.
 *
 * El drawer del compositor tapaba el reporte para preguntar tres cosas y
 * devolvía la métrica dibujada dentro de sí mismo; recién al aceptar aparecía
 * en el resumen. Aquí el panel es un hermano de la columna de contenido —la
 * empuja, no la tapa, igual que el Agente IA del home— y la métrica se monta
 * en el resumen desde el primer intento: se habla a la izquierda y se ve
 * cambiar a la derecha.
 *
 * Eso cambia lo que significa iterar. "Dale tipo anillo" o "ponlo tipo riesgo
 * y alertas" no son otra ronda de formulario: son una frase más en la misma
 * conversación que reescribe la tarjeta que ya se está mirando. Y como el
 * resumen es el único sitio donde vive una métrica de este reporte, no hay
 * nada que preguntar sobre dónde ponerla — se dice y ya está.
 *
 * Lo que sí se pregunta es lo que no se puede adivinar: qué quiere saber, y
 * contra qué se compara. Si el primer mensaje ya lo trae, no se pregunta
 * nada; si trae la mitad, se pregunta solo la otra mitad.
 */

/** Lo que mide el panel abierto — la columna de contenido se angosta esto. */
const PANEL_WIDTH = 400;

/** Lo que tarda el trabajo simulado antes de devolver la métrica. */
const WORK_MS = 2400;
/** Cada cuánto sube la barra del tablero. 2400 / 120 pasa de 95 % holgado. */
const PROGRESS_TICK_MS = 120;
/** El respiro del 100 %, el mismo de la carga masiva y del generador de objetivos. */
const SETTLE_MS = 450;

type ChatRole = "ai" | "user";

interface ChatMessageBase {
  id: string;
  role: ChatRole;
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

interface WorkingMessage extends ChatMessageBase {
  kind: "working";
  stages: readonly string[];
}

/**
 * El resultado: qué quedó montado y qué se puede hacer con ello.
 *
 * No lleva el dibujo de la métrica. La métrica ya está en el resumen, a la
 * derecha y en grande: repetirla aquí en miniatura obligaba a comparar dos
 * versiones de lo mismo y empujaba las acciones fuera de la pantalla.
 */
interface MetricMessage extends ChatMessageBase {
  kind: "metric";
  text: string;
  metric: MetricDefinition;
  reason: string;
}

type ChatMessage = TextMessage | ChipsMessage | WorkingMessage | MetricMessage;

interface ChatChip {
  label: string;
  value: string;
}

/* ------------------------------------------------------------------ *
 * Copys
 * ------------------------------------------------------------------ */

/**
 * El saludo no propone métricas.
 *
 * Tenía tres ejemplos en fichas y se los llevaba la mano: quien entra elige
 * uno porque está ahí, no porque sea lo que necesitaba, y el reporte termina
 * lleno de las tres métricas que sugerimos nosotros. La pregunta se queda
 * abierta a propósito — lo que esa persona vino a resolver es justamente lo
 * que nadie puede adivinar por ella.
 */
const GREETING =
  "👋 Dime qué métrica necesitas para este ciclo. Escríbelo con tus palabras: qué quieres saber y contra qué compararlo.";

const CRITERION_QUESTION: Record<MetricCriterionId, string> = {
  question: "¿Qué quieres saber del ciclo? Elige una o cuéntamelo con tus palabras:",
  cut: "¿Y contra qué lo comparamos?",
};

const QUESTION_CHIPS: readonly ChatChip[] = METRIC_QUESTIONS.map((item) => ({
  label: item.question,
  value: `question:${item.id}`,
}));

const cutChipsFor = (questionId: string): readonly ChatChip[] =>
  questionById(questionId).cutIds.map((cutId) => ({
    label: cutLabel(cutId),
    value: `cut:${cutId}`,
  }));

/** Los cambios concretos que se pueden pedir, cuando alguien elige modificar:
 *  las otras formas que también responden esa pregunta y los otros cortes.
 *  Ofrecer las seis formas siempre sería ofrecer un anillo para "días de
 *  retraso", que no responde nada. */
const modifyChipsFor = (brief: MetricBrief, shape: MetricShape): readonly ChatChip[] => {
  const question = questionById(brief.questionId ?? "");
  const alternatives = question.shapes
    .filter((item) => item !== shape)
    .slice(0, 2)
    .map((item) => ({
      label: `Ponla en ${shapeLabel(item).toLowerCase()}`,
      value: `shape:${item}`,
    }));
  return [
    ...alternatives,
    { label: "Otro corte", value: "ask:cut" },
    { label: "Otra pregunta", value: "ask:question" },
  ];
};

const shapeLabel = (shape: MetricShape): string =>
  METRIC_SHAPES.find((item) => item.id === shape)?.label ?? shape;

let _messageId = 0;
const nextId = (): string => `metric-msg-${++_messageId}`;

/* ------------------------------------------------------------------ *
 * El panel — envoltura que empuja la columna de contenido
 * ------------------------------------------------------------------ */

export interface AiMetricChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cicloName: string;
  /** Publica la métrica en el resumen, o reescribe la que ya está ahí. */
  onPublish: (metric: CustomMetric) => void;
  /** La quita del resumen — el chat la descarta, la tarjeta también puede. */
  onRemove: (id: string) => void;
  /** Una métrica que ya está en el resumen y se quiere seguir ajustando. El
   *  chat abre sobre ella en vez de empezar una conversación nueva. */
  seed?: CustomMetric | null;
  /** Lo que la IA está haciendo, para que el tablero abra el hueco donde la
   *  métrica va a caer. `null` cuando no está trabajando. */
  onWorkingStateChange?: (state: MetricWorkingState | null) => void;
}

export function AiMetricChatPanel({
  open,
  onOpenChange,
  cicloName,
  onPublish,
  onRemove,
  seed = null,
  onWorkingStateChange,
}: AiMetricChatPanelProps) {
  // Cada apertura arranca una conversación nueva: volver a abrirlo con la
  // charla de la métrica anterior a medias no ayuda a nadie. Abrirlo sobre
  // una métrica distinta también remonta —de ahí el id en la llave.
  const [session, setSession] = React.useState({ open, count: 0 });
  if (session.open !== open) {
    setSession({ open, count: open ? session.count + 1 : session.count });
  }

  return (
    <ShellAgentPanelSlot>
      {/* El que anima y angosta la columna de al lado. `overflow-hidden`
          recorta el panel de ancho fijo mientras esto se encoge a 0, en vez
          de reflowear su contenido. */}
      <div
        className="h-full shrink-0 overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ width: open ? PANEL_WIDTH : 0 }}
      >
        <div
          className={cn("h-full", !open && "invisible")}
          style={{ width: PANEL_WIDTH }}
          aria-hidden={!open}
        >
          <MetricChatBody
            key={`${session.count}:${seed?.id ?? "nueva"}`}
            seed={seed}
            cicloName={cicloName}
            onWorkingStateChange={onWorkingStateChange}
            onClose={() => onOpenChange(false)}
            onPublish={onPublish}
            onRemove={onRemove}
          />
        </div>
      </div>
    </ShellAgentPanelSlot>
  );
}

/* ------------------------------------------------------------------ *
 * La conversación
 * ------------------------------------------------------------------ */

/**
 * `reviewing` es el momento en que la métrica ya está montada y el pie del
 * panel deja de ser una caja de texto para ser las cuatro salidas —igual que
 * en la creación de objetivos con IA—. `modifying` es lo que pasa al elegir
 * "Modificar": vuelve el teclado, porque el ajuste fino se pide hablando.
 */
type ChatPhase = "chatting" | "working" | "reviewing" | "modifying";

function MetricChatBody({
  cicloName,
  seed,
  onClose,
  onPublish,
  onRemove,
  onWorkingStateChange,
}: {
  cicloName: string;
  seed: CustomMetric | null;
  onClose: () => void;
  onPublish: (metric: CustomMetric) => void;
  onRemove: (id: string) => void;
  onWorkingStateChange?: (state: MetricWorkingState | null) => void;
}) {
  const [messages, setMessages] = React.useState<ChatMessage[]>(() =>
    seed
      ? [
          {
            id: nextId(),
            role: "ai",
            kind: "metric",
            text: "Esta es la métrica que tienes en el resumen, a la derecha. ¿Qué hacemos con ella?",
            metric: seed.definition,
            reason: seed.reason,
          },
        ]
      : [{ id: nextId(), role: "ai", kind: "text", text: GREETING }]
  );
  const [inputValue, setInputValue] = React.useState("");
  const [phase, setPhase] = React.useState<ChatPhase>(seed ? "reviewing" : "chatting");
  const [brief, setBrief] = React.useState<MetricBrief>(seed ? seed.brief : EMPTY_BRIEF);
  const [pending, setPending] = React.useState<MetricCriterionId | null>(null);
  /** Cuántas veces se pidió otra propuesta: recorre las formas de la pregunta. */
  const [attempt, setAttempt] = React.useState(0);
  /** La métrica publicada en el resumen, si ya hay una. */
  const [metricId, setMetricId] = React.useState<string | null>(seed?.id ?? null);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const runRef = React.useRef<{ cancelled: boolean } | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 80);
    return () => clearTimeout(timer);
  }, [messages]);

  React.useEffect(
    () => () => {
      if (runRef.current) runRef.current.cancelled = true;
      // Cerrar el chat a mitad del trabajo no puede dejar el hueco abierto
      // en el tablero para siempre.
      onWorkingStateChange?.(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /* ---- Mensajes ---- */

  const push = (message: ChatMessage) => setMessages((current) => [...current, message]);

  const aiText = (text: string) => push({ id: nextId(), role: "ai", kind: "text", text });

  const aiChips = (text: string, chips: readonly ChatChip[]) =>
    push({ id: nextId(), role: "ai", kind: "chips", text, chips });

  const userText = (text: string) => push({ id: nextId(), role: "user", kind: "text", text });

  const drop = (id: string) => setMessages((current) => current.filter((item) => item.id !== id));

  /* ---- Publicar ---- */

  /**
   * Arma la métrica y la monta en el resumen.
   *
   * Es la misma ruta la primera vez y en cada ajuste: si ya hay id, el
   * resumen reescribe esa tarjeta en vez de apilar otra.
   */
  const publish = (nextBrief: MetricBrief, nextAttempt: number, intro: string) => {
    const definition = composeMetric(nextBrief, nextAttempt);
    const reason = shapeReason(shapeOf(definition).id);
    const id = metricId ?? nextCustomMetricId();
    setMetricId(id);
    onPublish({ id, definition, brief: nextBrief, reason });

    push({
      id: nextId(),
      role: "ai",
      kind: "metric",
      text: intro,
      metric: definition,
      reason,
    });
    setPhase("reviewing");
  };

  /**
   * El trabajo simulado, con el mismo compás que el generador de objetivos:
   * la barra sube hasta 95 %, salta a 100 %, respira 450 ms y recién entonces
   * aparece el resultado. Y lo dice en los dos sitios a la vez — la burbuja
   * del chat y el hueco del tablero—, que es lo que hace visible *dónde* se
   * está insertando.
   */
  const work = (nextBrief: MetricBrief, nextAttempt: number, intro: string) => {
    const run = { cancelled: false };
    runRef.current = run;
    setPhase("working");

    const stages = composerStages(nextBrief);
    const workingId = nextId();
    push({ id: workingId, role: "ai", kind: "working", stages });

    const detail = metricId ? "Rehaciendo la métrica…" : "Creando la métrica…";
    const report = (progress: number) =>
      onWorkingStateChange?.({
        metricId,
        progress,
        caption: stages[Math.min(stages.length - 1, Math.floor((progress / 100) * stages.length))],
        detail,
      });

    let progress = 0;
    report(progress);
    const interval = window.setInterval(() => {
      if (run.cancelled) return window.clearInterval(interval);
      progress = Math.min(95, progress + 5);
      report(progress);
    }, PROGRESS_TICK_MS);

    window.setTimeout(() => {
      window.clearInterval(interval);
      if (run.cancelled) return onWorkingStateChange?.(null);
      report(100);
      window.setTimeout(() => {
        if (run.cancelled) return onWorkingStateChange?.(null);
        drop(workingId);
        onWorkingStateChange?.(null);
        publish(nextBrief, nextAttempt, intro);
      }, SETTLE_MS);
    }, WORK_MS);
  };

  /* ---- Preguntar lo que falta ---- */

  const ask = (criterion: MetricCriterionId, nextBrief: MetricBrief) => {
    setPending(criterion);
    setPhase("chatting");
    const chips =
      criterion === "question"
        ? QUESTION_CHIPS
        : cutChipsFor(nextBrief.questionId ?? METRIC_QUESTIONS[0].id);
    window.setTimeout(() => aiChips(CRITERION_QUESTION[criterion], chips), 320);
  };

  /**
   * Lo que se hace con un brief después de leer un mensaje o pulsar un chip.
   * Si está completo se dibuja; si no, se pregunta solo lo que falta.
   */
  const advance = (nextBrief: MetricBrief, intro: string) => {
    setBrief(nextBrief);
    if (isMetricBriefReady(nextBrief)) {
      setPending(null);
      setAttempt(0);
      work(nextBrief, 0, intro);
      return;
    }
    const missing = missingMetricCriteria(nextBrief);
    ask(missing[0], nextBrief);
  };

  /* ---- Mensajes del usuario ---- */

  const handleUserMessage = (raw: string) => {
    const text = raw.trim();
    if (text === "" || phase === "working") return;
    userText(text);
    setInputValue("");

    if (phase === "reviewing" || phase === "modifying") {
      handleReview(text);
      return;
    }

    const { brief: nextBrief, found } = parseMetricMessage(text, brief);

    // Nada reconocible: se pregunta con opciones en vez de insistir en texto
    // libre, que es lo que dejaba a la gente escribiendo "quiero ver mejor el
    // avance" tres veces seguidas.
    if (!found.question && !found.cut && nextBrief.questionId === null) {
      aiChips(
        "No logré identificar qué necesitas. Elige por dónde empezamos:",
        QUESTION_CHIPS
      );
      return;
    }

    advance(nextBrief, understoodCopy(nextBrief, found.question));
  };

  /** Un mensaje que llega con la métrica ya dibujada. */
  const handleReview = (text: string) => {
    const intent = parseMetricIntent(text);
    if (intent === "keep") return handleKeep();
    if (intent === "discard") return handleDiscard();
    if (intent === "another") return handleAnother();

    const { brief: nextBrief, found } = parseMetricMessage(text, brief);

    if (found.question || found.cut || found.shape || found.title) {
      setBrief(nextBrief);
      if (!isMetricBriefReady(nextBrief)) {
        // Cambió de pregunta y el corte anterior no le sirve.
        ask("cut", nextBrief);
        return;
      }
      setAttempt(0);
      work(nextBrief, 0, changeCopy(nextBrief, found));
      return;
    }

    aiChips("No estoy seguro de qué cambiar. Puedes pedirme esto:", [
      ...modifyChipsFor(brief, shapeOf(composeMetric(brief, attempt)).id),
    ]);
  };

  /* ---- Acciones ---- */

  const handleKeep = () => {
    aiText(
      `Perfecto. La métrica queda ${METRIC_HOME.toLowerCase()} de ${cicloName}. Si más adelante quieres otra, ábreme de nuevo. 📊`
    );
    window.setTimeout(onClose, 1600);
  };

  const handleAnother = () => {
    const next = attempt + 1;
    setAttempt(next);
    // Pedir otra propuesta vuelve a dejar la forma en manos de la IA: si
    // quedó fijada a mano, recorrer las alternativas no cambiaría nada.
    const nextBrief: MetricBrief = { ...brief, shape: null };
    setBrief(nextBrief);
    work(nextBrief, next, "Le di otra vuelta. Así se ve con otra forma:");
  };

  /** Modificar no pregunta de nuevo desde cero: ofrece los cambios que tienen
   *  sentido sobre lo que ya está dibujado, y el texto libre sigue abierto. */
  const handleModify = () => {
    setPhase("modifying");
    aiChips(
      "¿Qué le cambio? Elige, o dímelo con tus palabras («ponla tipo riesgo y alertas», «mejor por líder»).",
      modifyChipsFor(brief, shapeOf(composeMetric(brief, attempt)).id)
    );
  };

  const handleDiscard = () => {
    if (metricId) onRemove(metricId);
    setMetricId(null);
    setPhase("chatting");
    setPending(null);
    setBrief(EMPTY_BRIEF);
    aiText("Listo, la quité del resumen. Dime qué otra necesitas.");
  };

  /* ---- Chips ---- */

  const handleChip = (chip: ChatChip) => {
    const [kind, value] = chip.value.split(":");

    if (kind === "intent") {
      userText(chip.label);
      if (value === "keep") handleKeep();
      if (value === "another") handleAnother();
      if (value === "modify") handleModify();
      if (value === "discard") handleDiscard();
      return;
    }

    if (kind === "question") {
      userText(chip.label);
      const question = questionById(value);
      const nextBrief: MetricBrief = {
        ...brief,
        questionId: value,
        cutId: brief.cutId && question.cutIds.includes(brief.cutId) ? brief.cutId : null,
        shape: null,
      };
      setPending(null);
      advance(nextBrief, understoodCopy(nextBrief, true));
      return;
    }

    if (kind === "cut") {
      userText(chip.label);
      const nextBrief: MetricBrief = { ...brief, cutId: value };
      setPending(null);
      advance(nextBrief, understoodCopy(nextBrief, false));
      return;
    }

    if (kind === "shape") {
      userText(chip.label);
      const nextBrief: MetricBrief = { ...brief, shape: value as MetricShape };
      setBrief(nextBrief);
      work(nextBrief, attempt, `Hecho, ahora en ${shapeLabel(value as MetricShape).toLowerCase()}:`);
      return;
    }

    if (kind === "ask") {
      userText(chip.label);
      ask(value === "question" ? "question" : "cut", brief);
      return;
    }

    // Sugerencia de arranque: es una frase, entra por la puerta normal.
    handleUserMessage(chip.value);
  };

  /* ---- Envío ---- */

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleUserMessage(inputValue);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-ai-mesh-agent shadow-card">
      <header className="flex shrink-0 items-center gap-3 border-b border-border/20 px-5 py-3.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: AI_GRADIENT }}
        >
          <Sparkles className="h-4 w-4 text-white" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-bold leading-tight text-text-primary">Agente IA</h2>
          <p className="truncate text-[11px] text-text-muted">Crear una métrica de {cicloName}</p>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-black/5 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} onChipClick={handleChip} />
        ))}
      </div>

      <div className="shrink-0 border-t border-border/20 p-4">
        {phase === "reviewing" ? (
          /* Las cuatro salidas, apiladas y a todo el ancho: es el mismo pie
             que cierra la creación de objetivos con IA. Conservar manda —va
             con el degradado y sola en su renglón—, las dos de en medio son
             pares entre sí, y descartar cierra abajo en rojo. */
          <div className="flex flex-col gap-2">
            <button
              onClick={handleKeep}
              className="flex h-11 w-full items-center justify-center rounded-xl text-[13px] font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]"
              style={{ background: AI_GRADIENT }}
            >
              ✓ Conservar
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleAnother}
                className="flex h-10 flex-1 items-center justify-center rounded-xl border border-border bg-surface text-[12px] font-semibold text-text-secondary transition-colors hover:border-primary/40 hover:text-text-primary active:scale-[0.98]"
              >
                🔄 Otra propuesta
              </button>
              <button
                onClick={handleModify}
                className="flex h-10 flex-1 items-center justify-center rounded-xl border border-border bg-surface text-[12px] font-semibold text-text-secondary transition-colors hover:border-primary/40 hover:text-text-primary active:scale-[0.98]"
              >
                ✏️ Modificar
              </button>
            </div>
            <button
              onClick={handleDiscard}
              className="flex h-10 w-full items-center justify-center rounded-xl border border-status-negative/30 bg-status-negative/5 text-[12px] font-semibold text-status-negative transition-colors hover:bg-status-negative/10 active:scale-[0.98]"
            >
              🗑️ Descartar
            </button>
            <p className="mt-1 text-center text-[10px] text-text-muted">
              La métrica queda {METRIC_HOME.toLowerCase()}. Revísala y ajústala.
            </p>
          </div>
        ) : (
        <div className="group relative rounded-2xl bg-surface-muted p-3 transition-shadow focus-within:shadow-[0_0_12px_rgba(45,92,247,0.08)]">
          <MovingBorderBeam
            duration={6000}
            borderWidth={1.5}
            rx={16}
            ry={16}
            colorFrom="hsl(var(--ai-gradient-start))"
            colorTo="hsl(var(--ai-gradient-end))"
          />
          <textarea
            ref={inputRef}
            rows={2}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              phase === "modifying"
                ? "Pídeme un cambio: “dale tipo anillo”, “mejor por líder”…"
                : pending === "cut"
                  ? "Dime contra qué comparamos…"
                  : "Dime qué métrica necesitas…"
            }
            disabled={phase === "working"}
            className="relative z-10 min-h-10 w-full resize-none bg-transparent text-[13px] leading-normal text-text-primary outline-none placeholder:text-text-muted disabled:opacity-50"
          />
          <div className="relative z-10 mt-1 flex items-center justify-end">
            <button
              onClick={() => handleUserMessage(inputValue)}
              disabled={inputValue.trim() === "" || phase === "working"}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-40 disabled:hover:translate-y-0"
              style={{ background: AI_GRADIENT }}
              title="Enviar"
              aria-label="Enviar"
            >
              <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </div>
        </div>
        )}
        {phase !== "reviewing" && (
          <p className="mt-2 text-center text-[10px] text-text-muted">
            {METRIC_HOME} · datos de ejemplo mientras se arma.
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Copys de reconocimiento
 * ------------------------------------------------------------------ */

/** Lo que la IA dice haber entendido antes de ponerse a dibujar. */
function understoodCopy(brief: MetricBrief, questionChanged: boolean): string {
  const question = questionById(brief.questionId ?? "");
  const cut = cutLabel(brief.cutId ?? question.cutIds[0]).toLowerCase();
  return questionChanged
    ? `Entendido: ${question.question.toLowerCase().replace(/[¿?]/g, "")}, por ${cut}. Dame un momento…`
    : `Listo, lo comparo por ${cut}. Dame un momento…`;
}

/** Lo que dice cuando lo que llegó fue un ajuste sobre lo ya dibujado. */
function changeCopy(
  brief: MetricBrief,
  found: { question: boolean; cut: boolean; shape: boolean; title: boolean }
): string {
  if (found.question) return "Cambio de pregunta, entonces. Rearmo la métrica…";
  if (found.cut) return `Va, la corto por ${cutLabel(brief.cutId ?? "").toLowerCase()}…`;
  if (found.shape && brief.shape) return `Hecho, la paso a ${shapeLabel(brief.shape).toLowerCase()}…`;
  return "Ajustando…";
}

/* ------------------------------------------------------------------ *
 * Burbujas
 * ------------------------------------------------------------------ */

function MessageBubble({
  message,
  onChipClick,
}: {
  message: ChatMessage;
  onChipClick: (chip: ChatChip) => void;
}) {
  const isAi = message.role === "ai";

  if (message.kind === "working") {
    return <WorkingBubble stages={message.stages} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn("flex items-start gap-2.5", !isAi && "flex-row-reverse")}
    >
      {isAi ? <AiBubbleAvatar /> : <UserBubbleAvatar />}

      <div className={cn("flex max-w-[85%] flex-col gap-2", !isAi && "items-end")}>
        {message.text && (
          <div
            className={cn(
              "rounded-2xl px-4 py-3 text-[13px] leading-relaxed",
              isAi
                ? "rounded-tl-md border border-border/30 bg-ai-mesh-card text-text-primary"
                : "rounded-tr-md bg-primary text-white"
            )}
          >
            {message.text}
          </div>
        )}

        {message.kind === "metric" && (
          /* Lo único que el resumen no dice de sí mismo: por qué esa forma y
             dónde quedó. El dibujo está a la derecha, en grande, y las
             acciones esperan abajo, en el pie del panel. */
          <p className="rounded-xl border border-border/40 bg-surface/70 px-3 py-2.5 text-[11.5px] leading-relaxed text-text-secondary">
            <span className="font-semibold text-text-primary">
              {describeMetric(message.metric)}.
            </span>{" "}
            {message.reason} Ya está {METRIC_HOME.toLowerCase()}, a la derecha.
          </p>
        )}

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

/**
 * La burbuja que trabaja.
 *
 * Los puntos solos dicen "espera"; las etapas dicen qué se está decidiendo
 * mientras tanto —qué se cruza, qué forma se elige—, que es justo lo que quien
 * pregunta se está ahorrando.
 */
function WorkingBubble({ stages }: { stages: readonly string[] }) {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    const timer = window.setInterval(
      () => setIndex((current) => Math.min(stages.length - 1, current + 1)),
      (WORK_MS + SETTLE_MS) / Math.max(1, stages.length)
    );
    return () => window.clearInterval(timer);
  }, [stages.length]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2.5">
      <AiBubbleAvatar />
      <div className="flex items-center gap-2.5 rounded-2xl rounded-tl-md border border-border/30 bg-ai-mesh-card px-4 py-3">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:0ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:300ms]" />
        </span>
        <span className="text-[12px] font-medium text-text-secondary">{stages[index]}</span>
      </div>
    </motion.div>
  );
}

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
