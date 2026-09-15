import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, LayoutGrid, PenLine, Plus, RotateCcw, Sparkles, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { toneChip } from "@/lib/tone";
import { AiAnalyzingState, AiSparkGlyph } from "@/components/ai-interaction";
import { GuidedStep } from "@/components/ciclo-builder";
import { AI_GRADIENT } from "@/components/app-shell/appShellData";
import { DrawerShell } from "@/components/overlays/DrawerShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MetricSketch } from "./MetricSketch";
import { shapeOf, type MetricDefinition } from "./metricDefinition";
import {
  EMPTY_BRIEF,
  METRIC_HOME,
  METRIC_QUESTIONS,
  composeMetric,
  cutLabel,
  isBriefReady,
  questionById,
  shapeReason,
  stageCopy,
  suggestedTitle,
  type MetricBrief,
  type MetricQuestion,
} from "./metricQuestions";

/**
 * Crear una métrica, preguntando en vez de configurando.
 *
 * La versión anterior de esta pantalla era un formulario de cinco secciones
 * con el vocabulario de quien construye gráficos —medida, dimensión, forma,
 * dónde vive— y una vista previa al lado que se actualizaba con cada cambio.
 * Estaba bien armada y era completa; el problema era el punto de partida:
 * nadie llega al reporte pensando "cumplimiento por líder en barras", llega
 * pensando "¿quién va más atrasado?".
 *
 * Así que aquí se responden tres preguntas cortas —qué quieres saber, contra
 * qué se compara, y cómo lo llamas y para qué lo quieres—, la IA hace el
 * trabajo con el mismo compás que
 * la carga masiva de objetivos (barra hasta el 95 %, salto al 100 %, un
 * respiro y el resultado), y lo que aparece al final es la métrica ya
 * dibujada, con una línea que explica por qué esa forma y no otra. Se agrega,
 * se pide otra propuesta o se vuelve a los criterios.
 *
 * Del formulario anterior se conservan los dos campos de texto que las
 * opciones cerradas no pueden dar —el nombre, que es como lo llama quien lo
 * pide, y el para qué, que es el único contexto que la IA no puede deducir de
 * la pregunta— y se elimina el paso de "dónde vive": una métrica de este
 * reporte se crea en el resumen del ciclo y en ningún otro sitio, así que
 * preguntarlo era ofrecer una decisión que no existe. Ahora se enuncia.
 *
 * Los pasos se abren de a uno, según se van respondiendo, con el mismo
 * `GuidedStep` de la creación de objetivos con IA: preguntar el corte antes
 * de saber la pregunta es pedirle a alguien que elija el eje de un gráfico
 * que todavía no existe.
 */

/** Lo que tarda el trabajo simulado, sin contar el respiro del 100 %. */
const COMPOSE_MS = 2200;

type ComposerPhase = "criterios" | "working" | "resultado";

export function MetricComposerDrawer({
  open,
  onOpenChange,
  cicloName,
  onSubmit,
  footerSlot,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cicloName: string;
  onSubmit: (metric: MetricDefinition) => void;
  /** Un control extra a la izquierda del pie — lo usa el conmutador que deja
   *  volver al formulario anterior. */
  footerSlot?: React.ReactNode;
}) {
  // Cada apertura empieza de cero: una métrica a medio armar de la vez
  // anterior confundiría a quien vuelve a abrirlo por otra cosa.
  const [session, setSession] = React.useState({ open, count: 0 });
  if (session.open !== open) {
    setSession({ open, count: open ? session.count + 1 : session.count });
  }

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title="Crear una métrica"
      description={`Dinos qué te falta saber de ${cicloName} y la armamos.`}
      size="3xl"
      disablePadding
    >
      <MetricComposerBody
        key={session.count}
        onClose={() => onOpenChange(false)}
        onSubmit={onSubmit}
        footerSlot={footerSlot}
      />
    </DrawerShell>
  );
}

function MetricComposerBody({
  onClose,
  onSubmit,
  footerSlot,
}: {
  onClose: () => void;
  onSubmit: (metric: MetricDefinition) => void;
  footerSlot?: React.ReactNode;
}) {
  const [phase, setPhase] = React.useState<ComposerPhase>("criterios");
  const [brief, setBrief] = React.useState<MetricBrief>(EMPTY_BRIEF);
  const [progress, setProgress] = React.useState(0);
  /** Cuántas veces se pidió otra propuesta: recorre las formas de la pregunta. */
  const [attempt, setAttempt] = React.useState(0);
  const [metric, setMetric] = React.useState<MetricDefinition | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const runRef = React.useRef<{ cancelled: boolean } | null>(null);

  // Si el drawer se cierra a mitad de una composición, lo que quedaba en
  // vuelo no debe escribir al volver.
  React.useEffect(
    () => () => {
      if (runRef.current) runRef.current.cancelled = true;
    },
    []
  );

  const patch = (next: Partial<MetricBrief>) =>
    setBrief((current) => ({ ...current, ...next }));

  const question = brief.questionId ? questionById(brief.questionId) : null;
  const ready = isBriefReady(brief);

  /**
   * Elegir otra pregunta borra el corte anterior.
   *
   * Los cortes que se ofrecen dependen de la pregunta, así que quedarse con
   * "mes" al pasar a "¿quién va más atrasado?" dejaría el paso 2 respondido
   * con algo que ya no está en la lista. Y no se preselecciona ninguno: si
   * el paso 2 llegara contestado, el 3 se abriría en el mismo instante y los
   * tres pasos caerían de golpe — que es exactamente el formulario de una
   * sola pantalla del que esto se está separando.
   *
   * La excepción es la pregunta que solo admite un corte ("mes a mes" no se
   * puede mirar por otra cosa): ahí sí se contesta sola y el paso ni
   * siquiera se muestra, porque una pregunta con una única respuesta posible
   * no es una pregunta.
   */
  const pickQuestion = (next: MetricQuestion) =>
    patch({
      questionId: next.id,
      cutId:
        next.cutIds.length === 1
          ? next.cutIds[0]
          : next.id === brief.questionId
            ? brief.cutId
            : null,
    });

  /**
   * El nombre se escribe solo hasta que alguien lo escribe.
   *
   * Un campo vacío en el paso 3 obliga a inventarle nombre a algo que
   * todavía no se ha visto, y lo que sale de ahí son títulos como "métrica
   * 2". Así que llega propuesto desde la pregunta y el corte, y se sigue
   * actualizando al cambiarlos — hasta el primer tecleo, que es cuando el
   * nombre pasa a ser de quien lo escribió y ya no se toca.
   */
  const [titleTouched, setTitleTouched] = React.useState(false);
  const proposed = suggestedTitle(brief);
  React.useEffect(() => {
    if (titleTouched || proposed === "") return;
    setBrief((current) => ({ ...current, title: proposed }));
  }, [proposed, titleTouched]);

  /**
   * Arma la métrica.
   *
   * Lleva el mismo compás que la carga masiva de objetivos y que la creación
   * de objetivos con IA: la barra sube sola hasta el 95 %, el trabajo real
   * termina, salta al 100 % y solo entonces cambia de pantalla. Que las
   * esperas del producto se sientan iguales es el punto.
   */
  const compose = async (nextAttempt: number) => {
    const run = { cancelled: false };
    runRef.current = run;

    setAttempt(nextAttempt);
    setProgress(0);
    setPhase("working");

    const interval = setInterval(() => {
      setProgress((current) => (current >= 95 ? current : current + 5));
    }, 110);

    await new Promise((resolve) => setTimeout(resolve, COMPOSE_MS));
    clearInterval(interval);
    if (run.cancelled) return;

    setProgress(100);
    // Un respiro en el 100 % antes de cambiar de pantalla: sin él la barra
    // llena no llega a verse y el salto parece un corte.
    await new Promise((resolve) => setTimeout(resolve, 420));
    if (run.cancelled) return;

    setMetric(composeMetric(brief, nextAttempt));
    setPhase("resultado");
  };

  /** Vuelve a los criterios con lo ya respondido puesto: "cambiar criterios"
   *  es retocar, no empezar de nuevo. */
  const backToBrief = () => {
    if (runRef.current) runRef.current.cancelled = true;
    setPhase("criterios");
  };

  // Cada paso que se abre se lleva la vista consigo. Va al paso y no al final
  // del panel porque lo que hay que ver es la pregunta, no el hueco debajo.
  const needsCut = (question?.cutIds.length ?? 0) > 1;
  const stepCount = 1 + (question && needsCut ? 1 : 0) + (brief.cutId ? 1 : 0);
  React.useEffect(() => {
    if (phase !== "criterios" || stepCount < 2) return;
    const timer = setTimeout(() => {
      const steps = scrollRef.current?.querySelectorAll("[data-objective-step]");
      steps?.[steps.length - 1]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 90);
    return () => clearTimeout(timer);
  }, [phase, stepCount]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      <div ref={scrollRef} className="relative flex flex-1 flex-col overflow-y-auto p-4">
        {phase === "criterios" && (
          <div className="flex flex-col gap-6">
            <GuidedStep
              number={1}
              question="¿Qué quieres saber?"
              help="La pregunta que hoy no puedes responder mirando este reporte."
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Qué quieres saber">
                {METRIC_QUESTIONS.map((item) => (
                  <QuestionCard
                    key={item.id}
                    item={item}
                    selected={brief.questionId === item.id}
                    onSelect={() => pickQuestion(item)}
                  />
                ))}
              </div>
            </GuidedStep>

            {question && needsCut && (
              <GuidedStep
                number={2}
                question="¿Comparado contra qué?"
                help="El corte con el que se agrupa la respuesta. Solo salen los que responden esta pregunta."
              >
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Comparado contra qué">
                  {question.cutIds.map((cutId) => (
                    <OptionChip
                      key={cutId}
                      label={cutLabel(cutId)}
                      selected={brief.cutId === cutId}
                      onSelect={() => patch({ cutId })}
                    />
                  ))}
                </div>
              </GuidedStep>
            )}

            {brief.cutId && (
              <GuidedStep
                number={needsCut ? 3 : 2}
                question="¿Cómo la llamas y para qué la quieres?"
                help="El nombre ya viene propuesto. El para qué es lo único que no podemos deducir: es lo que va a leer la IA."
              >
                <div className="flex flex-col gap-3.5">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-text-secondary">
                      Nombre de la métrica
                    </span>
                    <Input
                      value={brief.title}
                      onChange={(event) => {
                        setTitleTouched(true);
                        patch({ title: event.target.value });
                      }}
                      placeholder="Ej. Avance promedio por líder"
                      className="border-border/60 bg-surface text-[13px]"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-text-secondary">
                      ¿Para qué la vas a usar?{" "}
                      <span className="font-medium text-text-muted">(opcional)</span>
                    </span>
                    <Textarea
                      value={brief.detail}
                      onChange={(event) => patch({ detail: event.target.value })}
                      placeholder="Qué decisión tomarías con este dato, o qué estás haciendo hoy a mano para conseguirlo."
                      rows={3}
                      className="resize-none border-border/60 bg-surface text-[13px]"
                    />
                  </label>
                  {/* No es una opción: es dónde va a quedar. Enunciarlo evita
                      que alguien busque el selector que antes había aquí. */}
                  <p className="flex items-center gap-2 rounded-lg bg-surface-muted/60 px-2.5 py-2 text-[11.5px] leading-relaxed text-text-secondary">
                    <LayoutGrid className="size-3.5 shrink-0 text-text-muted" strokeWidth={2} />
                    Se va a crear {METRIC_HOME.toLowerCase()}, junto a las demás.
                  </p>
                </div>
              </GuidedStep>
            )}
          </div>
        )}

        {phase === "working" && (
          <AiAnalyzingState
            title="Armando tu métrica"
            progress={progress}
            detail={stageCopy(brief, progress)}
            caption={question?.question}
            className="flex-1"
          />
        )}

        {phase === "resultado" && metric && (
          <MetricResult
            metric={metric}
            context={brief.detail.trim()}
            onRename={(title) => setMetric({ ...metric, title })}
          />
        )}
      </div>

      {/* Barra de acciones a sangre, igual que el resto de drawers. Cambia lo
          que ofrece según la fase — en medio del trabajo no hay nada que
          decidir salvo abandonarlo. */}
      <footer className="sticky bottom-0 mt-auto flex shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-surface px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {footerSlot}
          <p className="min-w-0 truncate text-[11.5px] font-medium text-text-muted">
            {phase === "criterios" && !question && "Elige una pregunta para empezar."}
            {phase === "criterios" && question && !brief.cutId && "Falta contra qué se compara."}
            {phase === "criterios" &&
              brief.cutId &&
              !ready &&
              "Ponle un nombre para poder crearla."}
            {phase === "criterios" && ready && question?.question}
            {phase === "working" && "Esto toma un momento."}
            {/* En el resultado no va resumen: la métrica está dibujada justo
                arriba y repetirla en una línea que además se corta —el pie
                lleva tres botones— no aporta nada. */}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {phase === "criterios" && (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                disabled={!ready}
                onClick={() => void compose(0)}
                className={cn(
                  "gap-2 border-transparent text-primary-foreground shadow-ai-premium transition-opacity hover:opacity-90",
                  !ready && "shadow-none"
                )}
                style={ready ? { background: AI_GRADIENT } : undefined}
              >
                <Sparkles className="h-4 w-4" strokeWidth={2.5} />
                Crear con IA
              </Button>
            </>
          )}

          {phase === "working" && (
            <Button variant="outline" onClick={backToBrief}>
              Cancelar
            </Button>
          )}

          {phase === "resultado" && metric && (
            <>
              <Button variant="ghost" onClick={backToBrief}>
                <SlidersHorizontal className="h-4 w-4" strokeWidth={2} />
                Cambiar criterios
              </Button>
              <Button variant="outline" onClick={() => void compose(attempt + 1)}>
                <RotateCcw className="h-4 w-4" strokeWidth={2} />
                Otra propuesta
              </Button>
              <Button
                onClick={() => {
                  onSubmit(metric);
                  onClose();
                }}
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Agregar al reporte
              </Button>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}

/**
 * La métrica ya armada.
 *
 * Llega dibujada y con nombre puesto — no hay un campo vacío esperando a que
 * alguien lo llene, porque a estas alturas el sistema sabe más de la métrica
 * que quien la pidió. El nombre sigue siendo editable, pero como un retoque
 * y no como un requisito: es lo único que no se puede deducir de la pregunta.
 */
function MetricResult({
  metric,
  context,
  onRename,
}: {
  metric: MetricDefinition;
  /** El "para qué" que se escribió en el paso 3, si se escribió. */
  context: string;
  onRename: (title: string) => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const shape = shapeOf(metric);

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={`${metric.shape}-${metric.dimensionId}`}
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 14, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: prefersReducedMotion ? 0.2 : 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col gap-3"
      >
        <section className="overflow-hidden rounded-2xl border border-border bg-ai-mesh-card shadow-card">
          <header className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white shadow-drawer"
              style={{ background: AI_GRADIENT }}
            >
              <Sparkles className="size-[18px]" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold leading-tight text-text-primary">
                Esto es lo que armamos
              </p>
              <p className="text-[12px] leading-snug text-text-secondary">
                Retoca el nombre si quieres. Todo lo demás ya quedó decidido.
              </p>
            </div>
          </header>

          <div className="flex flex-col gap-3.5 p-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-text-secondary">Nombre de la métrica</span>
              <Input
                value={metric.title}
                onChange={(event) => onRename(event.target.value)}
                className="border-border/60 bg-surface text-[13px]"
              />
            </label>

            <MetricSketch metric={metric} />

            {/* Por qué esa forma. Sin esta línea la elección se lee como un
                capricho del sistema y lo primero que hace cualquiera es
                cambiarla por la que ya tenía en la cabeza. */}
            <p className="flex items-start gap-2 rounded-xl bg-surface-muted/60 px-3 py-2.5 text-[11.5px] leading-relaxed text-text-secondary">
              <AiSparkGlyph size={15} />
              <span>
                <span className="font-semibold text-text-primary">Elegimos {shape.label.toLowerCase()}. </span>
                {shapeReason(metric.shape)}
              </span>
            </p>

            {/* Lo que se escribió en el paso 3, devuelto tal cual: es la
                prueba de que el texto libre sirvió para algo y no se quedó
                en un campo que nadie leyó. */}
            {context !== "" && (
              <p className="flex items-start gap-2 rounded-xl border border-border/50 bg-surface px-3 py-2.5 text-[11.5px] leading-relaxed text-text-secondary">
                <PenLine className="mt-px size-3.5 shrink-0 text-text-muted" strokeWidth={2} />
                <span>
                  <span className="font-semibold text-text-primary">Con lo que nos contaste: </span>
                  {context}
                </span>
              </p>
            )}
          </div>
        </section>

        {/* Dónde vive no es una decisión, así que no es una tarjeta con
            opciones: es una línea que dice dónde va a quedar. */}
        <p className="flex items-center gap-2 rounded-xl border border-border/60 bg-surface px-3.5 py-2.5 text-[12px] text-text-secondary shadow-card">
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-md"
            style={toneChip("warning")}
          >
            <LayoutGrid className="size-3.5" strokeWidth={2} />
          </span>
          <span>
            Se va a crear <span className="font-semibold text-text-primary">{METRIC_HOME.toLowerCase()}</span>, junto a las demás.
          </span>
        </p>
      </motion.div>
    </AnimatePresence>
  );
}

function QuestionCard({
  item,
  selected,
  onSelect,
}: {
  item: MetricQuestion;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "relative flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors",
        selected
          ? "border-primary/60 bg-primary/[0.06]"
          : "border-border/60 bg-surface hover:border-border hover:bg-muted/40"
      )}
    >
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-border/40"
        style={toneChip(item.tone)}
      >
        <Icon className="size-3.5" strokeWidth={2} />
      </span>
      <span className="min-w-0 pr-4">
        <span
          className={cn(
            "block text-[12.5px] font-semibold leading-tight",
            selected ? "text-primary" : "text-text-primary"
          )}
        >
          {item.question}
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug text-text-muted">{item.hint}</span>
      </span>
      {selected && (
        <span className="absolute right-2.5 top-2.5 flex size-4 items-center justify-center rounded-full bg-primary text-white">
          <Check className="size-2.5" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

function OptionChip({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "rounded-full border px-3 py-1 text-[11.5px] font-medium transition-colors",
        selected
          ? "border-primary/60 bg-primary/10 text-primary"
          : "border-border bg-surface text-text-secondary hover:text-text-primary"
      )}
    >
      {label}
    </button>
  );
}
