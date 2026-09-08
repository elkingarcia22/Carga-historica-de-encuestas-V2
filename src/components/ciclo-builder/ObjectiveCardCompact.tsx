import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpDown,
  BookmarkPlus,
  Check,
  CheckCheck,
  ChevronUp,
  CircleDashed,
  FlaskConical,
  Gauge,
  Link2,
  Ruler,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { AddObjectiveToBankDrawer } from "./AddObjectiveToBankDrawer";
import { ObjectiveOptionCard } from "./ObjectiveOptionCard";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AiGeneratedBadge, AILoader } from "@/components/ai-interaction";
import { InlineDeleteConfirm } from "./InlineDeleteConfirm";
import { AiTriggerButton } from "./AiObjectiveControls";
import { generateObjectiveFromContext, refineObjectiveWording } from "./aiObjectiveGenerator";
import { ObjectiveValuesField } from "./ObjectiveValuesField";
import { ProgressRangeField } from "./ProgressRangeField";
import { ObjectiveWeightField } from "./ObjectiveWeightField";
import { ObjectiveKeyActionsField } from "./ObjectiveKeyActionsField";
import { ComplianceSimulator } from "./ComplianceSimulator";
import {
  BooleanOutcomeChips,
  BooleanOutcomeNote,
  CompactStep,
  DirectionSegment,
  FieldLabel,
  MeasureChips,
} from "./ObjectiveCompactPickers";
import {
  MEASURE_META,
  formatRawValue,
  keyActionsTotal,
  objectiveIssue,
  parseAmount,
  TOTAL_WEIGHT,
  type Objective,
} from "./cicloBuilderTypes";
import { resolveStartLine, trackBlockingIssue } from "./complianceRules";
import type { ObjectiveScope } from "./objectiveBankTypes";

interface ObjectiveCardCompactProps {
  objective: Objective;
  /** 1-based position, used for the "Objetivo N" heading. */
  position: number;
  /**
   * Company objectives frame the ciclo and carry no weight; assigned ones are
   * what a person is scored on, so they do — and they can point back at a
   * company objective.
   */
  variant: "company" | "assigned";
  /** A quién se le pondría este objetivo — es lo que "Guardar en el banco"
   *  necesita para clasificarlo, y la tarjeta ya lo sabe por el paso en el
   *  que vive. */
  scope: ObjectiveScope;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onChange: (patch: Partial<Objective>) => void;
  onRemove: () => void;
  canRemove: boolean;
  showValidation: boolean;
  /** Sum of every *other* assigned objective's weight. */
  otherObjectivesWeight?: number;
  /** Cuánto reparte la asignación que contiene este objetivo: 100 %, o el
   *  cupo que le quedó al compartir a su gente con otra asignación. */
  weightBudget?: number;
  /** Offered as alignment targets on the assigned variant. */
  companyObjectives?: readonly Objective[];
  /** Offered as alignment targets from within the same cycle. */
  cycleObjectives?: readonly Objective[];
}

const MAX_TITLE_LENGTH = 150;
const AI_WORK_MS = 1100;

type AiPhase = "idle" | "context" | "working";

/**
 * La tarjeta de objetivo: qué se quiere lograr, cómo se mide, hacia dónde,
 * de dónde a dónde, peso — agrupado en cuatro bloques con controles de una
 * línea, la ayuda de cada pregunta detrás de un icono. Mínimos y máximos es
 * un sí/no: decir que sí despliega sus campos; decir que no ofrece la otra
 * salida, probar el objetivo con un resultado de ejemplo vía "Probar
 * objetivo" — las dos son alternativas, no viven a la vez. Los bloques van
 * numerados y su ayuda queda siempre a la vista, no detrás de un icono.
 *
 * Los pasos van apareciendo a medida que se contesta el anterior.
 */
export function ObjectiveCardCompact({
  objective,
  position,
  variant,
  scope,
  isExpanded,
  onToggleExpanded,
  onChange,
  onRemove,
  canRemove,
  showValidation,
  otherObjectivesWeight = 0,
  weightBudget = TOTAL_WEIGHT,
  companyObjectives = [],
  cycleObjectives = [],
}: ObjectiveCardCompactProps) {
  const requireWeight = variant === "assigned";
  const issue = objectiveIssue(objective, { requireWeight });
  const isComplete = issue === null;
  const hasError = showValidation && !isComplete;
  const headingLabel = variant === "company" ? "Objetivo de la empresa" : "Objetivo";

  const titleInputRef = React.useRef<HTMLInputElement>(null);
  const ai = useCardAi(objective, onChange, titleInputRef);

  const { measure, direction } = objective;
  const hasTitle = objective.title.trim() !== "";
  const showMeasureType = hasTitle && ai.phase === "idle";
  const isBoolean = measure === "boolean";
  const showDirection = showMeasureType && measure !== null && !isBoolean;
  const showValues = showDirection && direction !== null;

  const target = parseAmount(objective.targetValue);
  const declaredInitial = parseAmount(objective.initialValue);
  const trackIsUsable =
    target !== null &&
    direction !== null &&
    trackBlockingIssue(direction, target, declaredInitial) === null;
  // Si es boolean, asumimos que trackIsUsable siempre será true si ponen meta
  const showTail = (showMeasureType && isBoolean) || (showValues && trackIsUsable);
  // Los objetivos de la empresa no llevan el paso de acciones clave: ese
  // desglose es propio de objetivos asignados a personas o equipos.
  const showActionsStep = showTail && variant !== "company";
  const startLine =
    trackIsUsable && target !== null && direction !== null
      ? resolveStartLine(direction, target, declaredInitial)
      : null;
  const canSimulate = isBoolean || (
    trackIsUsable &&
    measure !== null &&
    direction !== null &&
    startLine !== null &&
    target !== null
  );

  const cardRef = React.useRef<HTMLElement>(null);
  const hasAlignmentOptions = companyObjectives.length > 0 || cycleObjectives.length > 0;
  const visibleSteps =
    1 +
    (showMeasureType ? 1 : 0) +
    (showValues ? 1 : 0) +
    (showActionsStep ? 1 : 0) +
    (showTail && requireWeight ? 1 : 0) +
    (showTail && requireWeight && hasAlignmentOptions ? 1 : 0) +
    (canSimulate ? 1 : 0);

  const scrollToNewestStep = React.useCallback(() => {
    const steps = cardRef.current?.querySelectorAll("[data-objective-step]");
    steps?.[steps.length - 1]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  React.useEffect(() => {
    if (!isExpanded || visibleSteps === 0) return;
    const timer = setTimeout(scrollToNewestStep, 90);
    return () => clearTimeout(timer);
  }, [isExpanded, visibleSteps, scrollToNewestStep]);

  // Una tarjeta en blanco se abre para que se escriba en ella de una: si ya
  // tiene título, es que se expandió para revisarla, no para empezarla, y
  // ahí no hay que robarle el foco a lo que el autor esté haciendo.
  React.useEffect(() => {
    if (!isExpanded || objective.title.trim() !== "") return;
    requestAnimationFrame(() => titleInputRef.current?.focus());
    // Sólo importa el momento en que se abre, no cada letra que se escriba
    // después — de lo contrario el foco volvería a saltar en cada tecla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

  const [wantsDescription, setWantsDescription] = React.useState(!!objective.description);
  const showDescription = wantsDescription || objective.description !== "";

  const setDescriptionShown = (checked: boolean) => {
    if (!checked && objective.description) onChange({ description: "" });
    setWantsDescription(checked);
  };

  const [isSimulating, setIsSimulating] = React.useState(false);
  // Con el rango activado, probar sólo tiene algo que decir una vez hay un
  // piso o un techo puestos — antes de eso, un resultado de ejemplo se
  // comportaría igual que sin rango, y ofrecerlo sería una promesa vacía.
  const hasRangeValue =
    parseAmount(objective.minValue) !== null || parseAmount(objective.maxValue) !== null;
  // Ninguna de las dos tarjetas —Sí, No— empieza marcada: `rangeEnabled` por
  // sí solo no distingue "todavía no se ha preguntado" de "ya contestó que
  // no", así que esta bandera lo hace. Arranca contestada sólo si el
  // objetivo ya trae algo de esa respuesta (activado, o con un valor ya
  // escrito); vive aquí y no en `RulesAndTestBlocks` para sobrevivir a que
  // la tarjeta se contraiga y se vuelva a abrir.
  const [rangeAnswered, setRangeAnswered] = React.useState(
    () => objective.rangeEnabled || hasRangeValue
  );
  const handleRangeChoice = (rangeEnabled: boolean) => {
    setRangeAnswered(true);
    onChange({ rangeEnabled });
  };

  const [isPendingDelete, setIsPendingDelete] = React.useState(false);
  const isBlank = objective.title.trim() === "" && objective.measure === null;
  const handleRemoveClick = () => (isBlank ? onRemove() : setIsPendingDelete(true));

  // Lo que hace falta para guardar en el banco es más corto que "completo":
  // el peso y la alineación son cosas de este ciclo, no del objetivo en sí,
  // así que un objetivo sin ellas ya se puede guardar.
  const canSaveToBank =
    objective.title.trim() !== "" && measure !== null && (isBoolean || direction !== null);
  const [isSavingToBank, setIsSavingToBank] = React.useState(false);

  let stepCount = 0;
  const stepNumber = (isVisible: boolean) => (isVisible ? ++stepCount : undefined);
  const titleStep = stepNumber(true);
  const measureStep = stepNumber(showMeasureType);
  const valuesStep = stepNumber(showValues);
  const actionsStep = stepNumber(showActionsStep);
  const weightStep = stepNumber(showTail && requireWeight);
  const alignmentStep = stepNumber(showTail && requireWeight && hasAlignmentOptions);
  const rulesStep = stepNumber(canSimulate);

  return (
    <>
    <article
      ref={cardRef}
      className={cn(
        "rounded-2xl border bg-surface shadow-card transition-colors",
        hasError ? "border-destructive/40" : "border-border/60",
        isExpanded && !hasError && "border-primary/25"
      )}
    >
      <header
        className={cn(
          "sticky top-0 z-10 flex items-start gap-3 rounded-t-2xl bg-surface px-5",
          isExpanded ? "py-3" : "py-4",
          isExpanded ? "border-b border-border/60" : "rounded-b-2xl"
        )}
      >
        {isPendingDelete ? (
          <InlineDeleteConfirm
            ariaLabel={`Confirmar eliminación de ${objective.title.trim() || `${headingLabel} ${position}`}`}
            message={
              objective.title.trim()
                ? `Se eliminará "${objective.title.trim()}" y toda su configuración. Esta acción no se puede deshacer.`
                : "Se eliminará este objetivo y toda su configuración. Esta acción no se puede deshacer."
            }
            onCancel={() => setIsPendingDelete(false)}
            onConfirm={onRemove}
          />
        ) : (
          <>
            <button
              type="button"
              onClick={onToggleExpanded}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Contraer objetivo" : "Expandir objetivo"}
              className="mt-0.5 shrink-0 rounded-lg p-1 text-muted-foreground/60 transition-all hover:bg-border/30 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <ChevronUp
                className={cn("h-4 w-4 transition-transform duration-300", !isExpanded && "rotate-180")}
                strokeWidth={2.5}
              />
            </button>

            <StatusBadge isComplete={isComplete} hasError={hasError} />

            <div className="min-w-0 flex-1">
              <div className="flex h-6 items-center gap-1.5 px-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70">
                  {headingLabel} {position}
                </p>
                {objective.createdByAI && <AiGeneratedBadge />}
              </div>

              {!isExpanded && (
                <>
                  <input
                    value={objective.title}
                    onChange={(event) =>
                      onChange({ title: event.target.value.slice(0, MAX_TITLE_LENGTH) })
                    }
                    placeholder={`${headingLabel} ${position}`}
                    aria-label="Título del objetivo"
                    aria-invalid={showValidation && objective.title.trim() === ""}
                    className={cn(
                      "w-full cursor-text rounded-lg bg-transparent px-1.5 py-0.5 text-[14px] font-bold tracking-tight text-text-primary outline-none transition-colors hover:bg-border/30 focus:bg-border/40 placeholder:text-muted-foreground/70",
                      showValidation && objective.title.trim() === "" && "ring-1 ring-destructive/40"
                    )}
                  />
                  <CompactSummary objective={objective} showWeight={requireWeight} issue={issue} />
                </>
              )}
            </div>

            <div className="mt-0.5 flex shrink-0 items-center gap-2">
              {canSaveToBank && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setIsSavingToBank(true)}
                      aria-label={`Guardar ${headingLabel.toLowerCase()} ${position} en el banco`}
                      className="flex size-[26px] shrink-0 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                      <BookmarkPlus className="size-3.5" strokeWidth={2} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Guardar en el banco</TooltipContent>
                </Tooltip>
              )}
              {canRemove && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleRemoveClick}
                      aria-label={`Eliminar ${headingLabel.toLowerCase()} ${position}`}
                      className="flex size-[26px] shrink-0 items-center justify-center rounded-md border border-destructive/30 bg-destructive/5 text-destructive transition-all hover:border-destructive/50 hover:bg-destructive/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/30"
                    >
                      <Trash2 className="size-3.5" strokeWidth={2} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Eliminar</TooltipContent>
                </Tooltip>
              )}
            </div>
          </>
        )}
      </header>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col divide-y divide-border/50 border-t border-border/60 px-5">
              <CompactStep
                className="py-4"
                number={titleStep}
                question="¿Qué quieres lograr?"
                help="Escríbelo como se lo contarías a la persona: un resultado concreto, no una tarea."
              >
                <TitleRow
                  objective={objective}
                  ai={ai}
                  inputRef={titleInputRef}
                  showValidation={showValidation}
                  onChange={onChange}
                />
                {ai.phase === "idle" && (
                  <label className="flex w-fit cursor-pointer items-center gap-2 text-[12px] font-medium text-text-primary">
                    <Switch
                      checked={showDescription}
                      onCheckedChange={setDescriptionShown}
                      className="data-[state=checked]:bg-status-positive"
                    />
                    <span>Añadir descripción</span>
                  </label>
                )}
                {showDescription && ai.phase === "idle" && (
                  <textarea
                    value={objective.description}
                    onChange={(event) => onChange({ description: event.target.value })}
                    rows={2}
                    placeholder="Descripción: contexto, cómo se va a medir, de dónde sale el dato."
                    aria-label="Descripción del objetivo"
                    className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2.5 text-[13px] leading-relaxed text-text-primary outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/25 placeholder:text-muted-foreground/70"
                  />
                )}
              </CompactStep>

              {showMeasureType && (
                <CompactStep
                  key="measure"
                  className="py-4"
                  number={measureStep}
                  question="¿Cómo se mide y hacia dónde tiene que moverse?"
                  help="Cómo se medirá el avance y hacia dónde debe moverse el número."
                >
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:col-span-2">
                      <FieldLabel icon={Ruler} required>
                        Tipo de medida
                      </FieldLabel>
                      <MeasureChips
                        value={measure}
                        hasError={showValidation && measure === null}
                        onChange={(next) =>
                          onChange(
                            next === measure
                              ? { measure: next }
                              : {
                                  measure: next,
                                  direction: next === "boolean" ? null : objective.direction,
                                }
                          )
                        }
                      />
                    </div>

                    {showDirection && measure !== null && (
                      <motion.div
                        key="direction"
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="flex min-w-0 flex-1 flex-col gap-1.5"
                      >
                        <FieldLabel
                          icon={ArrowUpDown}
                          required
                          help="No siempre “más” es mejor: en costos o rotación, lo bueno es que el número baje."
                        >
                          Dirección
                        </FieldLabel>
                        <DirectionSegment
                          value={direction}
                          hasError={showValidation && direction === null}
                          onChange={(next) => onChange({ direction: next })}
                        />
                      </motion.div>
                    )}

                    {isBoolean && (
                      <motion.div
                        key="boolean"
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="flex min-w-0 flex-1 flex-col gap-1.5"
                      >
                        <FieldLabel icon={CheckCheck}>Resultado al cierre</FieldLabel>
                        <BooleanOutcomeChips />
                      </motion.div>
                    )}
                  </div>
                  {isBoolean && <BooleanOutcomeNote />}
                </CompactStep>
              )}

              {showValues && measure !== null && (
                <CompactStep
                  key="values"
                  className="py-4"
                  number={valuesStep}
                  question={isBoolean ? "¿Cuál es la meta?" : "¿De dónde partes y a dónde quieres llegar?"}
                  help={isBoolean ? "El resultado esperado para dar por cumplido el objetivo." : "Con estos dos números calculamos el avance mientras el ciclo está abierto."}
                >
                  <ObjectiveValuesField
                    measure={measure}
                    direction={direction ?? "increase"}
                    initialValue={objective.initialValue}
                    targetValue={objective.targetValue}
                    showValidation={showValidation}
                    onChange={(patch) => onChange(patch)}
                  />
                </CompactStep>
              )}

              {showActionsStep && (
                <CompactStep
                  key="actions"
                  className="py-4"
                  number={actionsStep}
                  question="¿Qué acciones clave llevan a la meta?"
                  help="Opcional. El trabajo concreto que mueve la cifra; puedes hacer que el avance se calcule con ellas."
                  aside={
                    objective.keyActions.length > 0 ? (
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums",
                          objective.keyActionsDriveProgress &&
                            keyActionsTotal(objective.keyActions) !== TOTAL_WEIGHT
                            ? "bg-surface-muted text-text-secondary"
                            : "bg-primary/10 text-primary"
                        )}
                      >
                        {objective.keyActions.length}{" "}
                        {objective.keyActions.length === 1 ? "acción" : "acciones"}
                      </span>
                    ) : undefined
                  }
                >
                  <ObjectiveKeyActionsField
                    actions={objective.keyActions}
                    driveProgress={objective.keyActionsDriveProgress}
                    onChange={(patch) => onChange(patch)}
                    showValidation={showValidation}
                  />
                </CompactStep>
              )}

              {showTail && requireWeight && (
                <CompactStep
                  key="weight"
                  className="py-4"
                  number={weightStep}
                  question="¿Cuánto pesa este objetivo?"
                  help="El peso define su impacto en el ciclo."
                >
                  <ObjectiveWeightField
                    weight={objective.weight}
                    otherObjectivesWeight={otherObjectivesWeight}
                    showValidation={showValidation}
                    budget={weightBudget}
                    onChange={(weight) => onChange({ weight })}
                  />
                </CompactStep>
              )}

              {showTail && requireWeight && hasAlignmentOptions && (
                <CompactStep
                  key="alignment"
                  className="py-4"
                  number={alignmentStep}
                  question="¿A qué objetivo contribuye?"
                  help="La alineación (opcional) muestra el aporte al objetivo general."
                >
                  <AlignmentSelect
                    value={objective.alignedTo}
                    companyObjectives={companyObjectives}
                    cycleObjectives={cycleObjectives}
                    onChange={(alignedTo) => onChange({ alignedTo })}
                  />
                </CompactStep>
              )}

              {canSimulate && measure !== null && (
                <RulesAndTestBlocks
                  key="tools"
                  cardRef={cardRef}
                  stepNumber={rulesStep!}
                  rangeEnabled={objective.rangeEnabled}
                  rangeAnswered={rangeAnswered}
                  onRangeChoice={handleRangeChoice}
                  hasRangeValue={hasRangeValue}
                  isSimulating={isSimulating}
                  onSimulatingChange={setIsSimulating}
                  rangeFields={
                    isBoolean ? null : (
                      <ProgressRangeField
                        embedded
                        measure={measure}
                        direction={direction!}
                        initialValue={objective.initialValue}
                        targetValue={objective.targetValue}
                        enabled={objective.rangeEnabled}
                        minValue={objective.minValue}
                        maxValue={objective.maxValue}
                        onChange={(patch) => onChange(patch)}
                      />
                    )
                  }
                  simulator={
                    <ComplianceSimulator
                      layout="compact"
                      measure={measure}
                      direction={direction ?? "increase"}
                      start={startLine?.value ?? 0}
                      target={target ?? 1}
                      min={objective.rangeEnabled ? parseAmount(objective.minValue) : null}
                      max={objective.rangeEnabled ? parseAmount(objective.maxValue) : null}
                    />
                  }
                />
              )}

              {hasError && (
                <p className="my-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] font-medium text-destructive">
                  {issue}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
    {canSaveToBank && (
      <AddObjectiveToBankDrawer
        open={isSavingToBank}
        onOpenChange={setIsSavingToBank}
        objective={objective}
        scope={scope}
      />
    )}
    </>
  );
}

// ── IA de la tarjeta ────────────────────────────────────────────────────────

interface CardAi {
  phase: AiPhase;
  label: string;
  trigger: () => void;
  cancelContext: () => void;
}

/** Con texto ya escrito mejora la redacción; en blanco, pide una frase de
 * contexto y redacta el objetivo entero. */
function useCardAi(
  objective: Objective,
  onChange: (patch: Partial<Objective>) => void,
  inputRef: React.RefObject<HTMLInputElement | null>
): CardAi {
  const [phase, setPhase] = React.useState<AiPhase>("idle");

  // La IA tarda un momento y el autor puede seguir escribiendo mientras: se
  // lee el objetivo de cuando termina, no de cuando se pulsó.
  const objectiveRef = React.useRef(objective);
  React.useEffect(() => {
    objectiveRef.current = objective;
  });

  const run = async (mode: "refine" | "generate") => {
    if (objectiveRef.current.title.trim() === "") return;
    setPhase("working");
    await new Promise((resolve) => setTimeout(resolve, AI_WORK_MS));

    const current = objectiveRef.current;
    if (mode === "generate") {
      const generated = generateObjectiveFromContext(current.title.trim());
      onChange({
        title: generated.title,
        description: generated.description,
        measure: generated.measure,
        direction: generated.direction,
        initialValue: generated.initialValue,
        targetValue: generated.targetValue,
        createdByAI: true,
      });
    } else {
      onChange(refineObjectiveWording(current));
    }
    setPhase("idle");
  };

  const trigger = () => {
    if (phase === "working") return;
    if (phase === "idle" && objective.title.trim() === "") {
      setPhase("context");
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    void run(phase === "context" ? "generate" : "refine");
  };

  const label =
    phase === "working"
      ? "Redactando…"
      : objective.title.trim() === "" || phase === "context"
        ? "Generar con IA"
        : "Mejorar con IA";

  return { phase, label, trigger, cancelContext: () => setPhase("idle") };
}

function TitleRow({
  objective,
  ai,
  inputRef,
  showValidation,
  onChange,
}: {
  objective: Objective;
  ai: CardAi;
  inputRef: React.RefObject<HTMLInputElement | null>;
  showValidation: boolean;
  onChange: (patch: Partial<Objective>) => void;
}) {
  const isAskingContext = ai.phase === "context";
  const isWorking = ai.phase === "working";
  const isEmpty = objective.title.trim() === "";

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          value={objective.title}
          onChange={(event) => onChange({ title: event.target.value.slice(0, MAX_TITLE_LENGTH) })}
          onKeyDown={(event) => {
            if (!isAskingContext) return;
            if (event.key === "Enter") {
              event.preventDefault();
              ai.trigger();
            } else if (event.key === "Escape") {
              ai.cancelContext();
            }
          }}
          disabled={isWorking}
          placeholder={
            isAskingContext
              ? "Cuéntanos de qué va: por ejemplo, la satisfacción de los clientes de soporte"
              : "Por ejemplo: Aumentar las ventas del canal digital"
          }
          aria-label={isAskingContext ? "Contexto para que la IA redacte el objetivo" : "Título del objetivo"}
          aria-invalid={showValidation && isEmpty}
          className={cn(
            "h-10 min-w-0 flex-1 rounded-md border bg-surface px-3 text-[13px] text-text-primary outline-none transition-all focus:ring-2 placeholder:text-muted-foreground/70 disabled:opacity-60",
            isAskingContext
              ? "border-ai-gradient-start/50 focus:border-ai-gradient-start focus:ring-ai-gradient-start/20"
              : showValidation && isEmpty
                ? "border-destructive focus:border-destructive focus:ring-destructive/25"
                : "border-border focus:border-primary focus:ring-primary/25"
          )}
        />
        <AiTriggerButton
          label={ai.label}
          onClick={ai.trigger}
          disabled={isWorking || (isAskingContext && isEmpty)}
          aria-label={
            isEmpty || isAskingContext
              ? "Generar el objetivo con IA a partir del contexto"
              : "Mejorar la redacción del objetivo con IA"
          }
          className="h-10 shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {isAskingContext && (
        <p className="text-[12px] leading-relaxed text-text-secondary">
          Escribe en una frase de qué quieres que vaya este objetivo y lo redactamos por ti, con su
          medida y su meta.
        </p>
      )}

      {isWorking && (
        <AILoader
          variant="inline"
          label={isAskingContext ? "Redactando el objetivo…" : "Mejorando la redacción…"}
        />
      )}
    </div>
  );
}

// ── Reglas opcionales y prueba ──────────────────────────────────────────────

interface RulesAndTestBlocksProps {
  /** El `<article>` de la tarjeta entera: sirve para buscar el paso en vivo
   * al momento de hacer scroll, en vez de guardar un ref al `CompactStep` de
   * antemano — ese `CompactStep` cambia de forma entre "piso y techo
   * apagado" y "encendido" (un solo bloque vs. dos), así que React lo
   * desmonta y remonta, y un ref guardado con anticipación puede apuntar
   * todavía a `null` en el primer commit del nuevo bloque. */
  cardRef: React.RefObject<HTMLElement | null>;
  rangeEnabled: boolean;
  /** Si ya se contestó la pregunta al menos una vez. `rangeEnabled` por sí
   * solo no distingue "todavía sin contestar" de "contestó que no" —los dos
   * son `false`—, así que mientras esto sea falso ninguna de las dos
   * tarjetas se pinta marcada y no se ofrece probar. */
  rangeAnswered: boolean;
  onRangeChoice: (enabled: boolean) => void;
  /** Si ya hay un piso o un techo escrito. Con el rango activado, probar
   * sólo se habilita una vez esto es cierto — antes, no hay nada distinto
   * que comprobar. */
  hasRangeValue: boolean;
  isSimulating: boolean;
  onSimulatingChange: (value: boolean) => void;
  rangeFields: React.ReactNode;
  simulator: React.ReactNode;
  /** Número del bloque. La prueba, cuando está abierta, ocupa el siguiente. */
  stepNumber: number;
}

/**
 * Los dos controles opcionales que cierran la tarjeta.
 *
 * Mínimos y máximos es un sí/no explícito, no un interruptor: decir que sí
 * despliega `rangeFields`, y "Probar objetivo" se habilita en cuanto queda
 * escrito un piso o un techo — antes de eso no hay nada distinto que
 * comprobar. Decir que no habilita probar de inmediato, como la salida
 * contraria: sin rango propio, un resultado de ejemplo es la única forma de
 * ver cómo se comporta el avance. Una línea separa las dos preguntas cuando
 * las dos existen, y el botón "Probar objetivo" / "Ocultar prueba" vive
 * siempre en el mismo sitio —a la derecha de su propio encabezado—, ofrecido
 * o ya abierto: abrir o cerrar la prueba nunca le mueve el lugar.
 */
function RulesAndTestBlocks({
  cardRef,
  rangeEnabled,
  rangeAnswered,
  onRangeChoice,
  hasRangeValue,
  isSimulating,
  onSimulatingChange,
  rangeFields,
  simulator,
  stepNumber,
}: RulesAndTestBlocksProps) {
  // Busca el paso EN VIVO en el momento de hacer scroll, por su texto, en vez
  // de guardar un ref al `CompactStep` de antemano: ese bloque cambia de
  // forma entre "piso y techo apagado" (uno) y "encendido" (dos, y con
  // "Probar objetivo" en uno de ellos), así que React lo desmonta y remonta
  // — un ref capturado con anticipación puede seguir apuntando a `null` en
  // el primer commit del nuevo bloque, y el scroll no ocurre nunca. Buscar
  // por `cardRef` (el `<article>`, estable durante toda la vida de la
  // tarjeta) no tiene ese problema.
  const findStep = (text: string): HTMLElement | undefined => {
    const steps = cardRef.current?.querySelectorAll<HTMLElement>("[data-objective-step]");
    return steps ? Array.from(steps).find((step) => step.textContent?.includes(text)) : undefined;
  };

  // `setTimeout` y no `requestAnimationFrame`: rAF sólo se dispara con la
  // pestaña visible y en primer plano — en fondo (u oculta) el navegador lo
  // congela indefinidamente, y entonces el scroll nunca llega a ocurrir. Un
  // `setTimeout(0)` corre igual, sin esa condición, y sigue siendo la
  // siguiente vuelta del bucle de eventos — imperceptible, muy lejos del
  // medio segundo que se sentía como demora con la espera anterior.
  React.useEffect(() => {
    if (!isSimulating) return;
    const timer = setTimeout(() => {
      findStep("¿Cómo se va a calcular el avance?")?.scrollIntoView({
        behavior: "auto",
        block: "start",
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [isSimulating]);

  React.useEffect(() => {
    if (!rangeEnabled) return;
    const timer = setTimeout(() => {
      findStep("Mínimos y máximos de avance")?.scrollIntoView({ behavior: "auto", block: "start" });
    }, 0);
    return () => clearTimeout(timer);
  }, [rangeEnabled]);

  // Probar sólo tiene algo que ofrecer una vez la pregunta de rango tiene
  // respuesta, y sólo si esa respuesta fue "No" (un resultado de ejemplo es
  // la única vista posible) o, habiendo dicho "Sí", ya hay un piso o un techo
  // escrito. Un objetivo booleano no tiene rango que preguntar, así que para
  // él probar está disponible siempre.
  const canOfferSimulate = rangeAnswered && (!rangeEnabled || hasRangeValue);
  const showProbarBlock = rangeFields ? canOfferSimulate : true;

  const rangeToggle = (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-text-primary">
        <Gauge className="size-3.5 text-text-secondary" strokeWidth={2} />
        Mínimos y máximos de avance
      </span>
      <RangeChoiceCards value={rangeAnswered ? rangeEnabled : null} onChange={onRangeChoice} />
    </div>
  );

  // El botón de probar vive siempre como el `aside` del encabezado de su
  // propio paso —a la altura de la pregunta, no en una fila propia debajo—,
  // ofrecido o ya abierto: abrir o cerrar la prueba nunca le mueve el lugar.
  const simulateTrigger = (
    <SimulateTrigger isSimulating={isSimulating} onToggle={() => onSimulatingChange(!isSimulating)} />
  );

  const renderSimulateBody = () => (
    <AnimatePresence initial={false}>
      {isSimulating && (
        <motion.div
          key="simulator"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="overflow-hidden"
        >
          {simulator}
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Piso/techo y prueba son dos preguntas más de la conversación, con su
  // enunciado y su explicación siempre a la vista. La línea entre las dos
  // preguntas la pone el propio `divide-y` del contenedor que las agrupa
  // junto al resto de pasos de la tarjeta.
  return (
    <>
      {rangeFields && (
        <CompactStep
          className="py-4"
          number={stepNumber}
          question="¿Quieres poner límites al objetivo?"
          help="Opcional. El avance será 0 % antes del piso y dejará de sumar al llegar al techo."
        >
          {rangeToggle}
          <AnimatePresence initial={false}>
            {rangeEnabled && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="overflow-hidden pt-4"
              >
                {rangeFields}
              </motion.div>
            )}
          </AnimatePresence>
        </CompactStep>
      )}

      {showProbarBlock && (
        <CompactStep
          className="py-4"
          number={rangeFields ? stepNumber + 1 : stepNumber}
          question="¿Cómo se va a calcular el avance?"
          help="Prueba un resultado de ejemplo y comprueba que el cumplimiento sale como esperas."
          aside={simulateTrigger}
        >
          {renderSimulateBody()}
        </CompactStep>
      )}
    </>
  );
}

/**
 * Sí / No como dos tarjetas, igual que el resto de las preguntas de la
 * tarjeta (medida, dirección) en vez de un interruptor. `value` en `null`
 * —todavía sin contestar— deja las dos sin marcar; ninguna arranca
 * seleccionada por defecto, así que la primera respuesta es siempre un
 * clic real, no algo que ya venía puesto.
 */
function RangeChoiceCards({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (value: boolean) => void;
}) {
  const OPTIONS: readonly [label: string, tagline: string, val: boolean, icon: typeof Check][] = [
    ["Sí", "Quiero definir un piso o un techo", true, Check],
    ["No", "El avance va directo a la meta", false, X],
  ];

  return (
    <div role="radiogroup" aria-label="¿Quieres poner un piso y un techo al avance?" className="grid grid-cols-2 gap-2 max-w-md">
      {OPTIONS.map(([label, tagline, val, Icon]) => (
        <ObjectiveOptionCard
          key={label}
          icon={Icon}
          size="compact"
          label={label}
          tagline={tagline}
          isSelected={value === val}
          onClick={() => onChange(val)}
        />
      ))}
    </div>
  );
}

/**
 * El botón "Probar objetivo" / "Ocultar prueba", compartido por la oferta
 * (cuando el simulador está cerrado) y el propio header del panel (cuando ya
 * está abierto) — un único control para las dos direcciones del mismo toggle.
 */
function SimulateTrigger({
  isSimulating,
  onToggle,
}: {
  isSimulating: boolean;
  onToggle: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          layout
          type="button"
          onClick={onToggle}
          aria-expanded={isSimulating}
          transition={{ layout: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }}
          className={cn(
            "relative flex h-8 shrink-0 items-center gap-1.5 overflow-hidden rounded-lg border px-2.5 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.98]",
            isSimulating
              ? "border-primary/30 text-primary"
              : "border-border text-text-secondary hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
          )}
        >
          {/* El color es la señal principal de que algo pasó: el fondo entra
              en un azul intenso y baja hasta el tinte de reposo
              (`probarActivateFlash` en globals.css), en vez de saltar directo
              del blanco al tinte tenue. Se vuelve a montar cada vez que se
              activa —isSimulating && ...— así que el flash se repite en cada
              toggle, no sólo la primera vez. */}
          {isSimulating && (
            <span
              aria-hidden
              className="absolute inset-0 rounded-lg"
              style={{ animation: "probarActivateFlash 550ms ease-out both" }}
            />
          )}
          <motion.span
            key={isSimulating ? "flask-on" : "flask-off"}
            initial={{ scale: 0.4, rotate: isSimulating ? -30 : 30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 16 }}
            className="relative z-10 flex shrink-0"
          >
            <FlaskConical className="size-3.5" strokeWidth={2.2} />
          </motion.span>
          <span className="relative z-10 grid">
            {/* Las dos etiquetas ocupan la misma celda de grid y se cruzan en
                fundido: el texto no salta de golpe de una a otra. */}
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={isSimulating ? "hide" : "show"}
                initial={{ opacity: 0, y: isSimulating ? 4 : -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: isSimulating ? -4 : 4 }}
                transition={{ duration: 0.16 }}
                className="col-start-1 row-start-1"
              >
                {isSimulating ? "Ocultar prueba" : "Probar objetivo"}
              </motion.span>
            </AnimatePresence>
          </span>
        </motion.button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Comprueba qué cumplimiento daría un resultado de ejemplo.
      </TooltipContent>
    </Tooltip>
  );
}

// ── Piezas del header ───────────────────────────────────────────────────────

function StatusBadge({ isComplete, hasError }: { isComplete: boolean; hasError: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg shadow-card",
        isComplete
          ? "border border-status-positive/30 bg-status-positive/10 text-status-positive shadow-none"
          : hasError
            ? "bg-destructive/10 text-destructive"
            : "bg-surface-muted text-muted-foreground"
      )}
    >
      {isComplete ? (
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      ) : (
        <CircleDashed className="h-3.5 w-3.5" strokeWidth={2.2} />
      )}
    </span>
  );
}

function AlignmentSelect({
  value,
  companyObjectives,
  cycleObjectives = [],
  onChange,
}: {
  value: string | null;
  companyObjectives: readonly Objective[];
  cycleObjectives?: readonly Objective[];
  onChange: (alignedTo: string | null) => void;
}) {
  const showLabels = companyObjectives.length > 0 && cycleObjectives.length > 0;

  return (
    <div className="flex flex-col gap-2.5">
      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-text-primary">
        <Link2 className="size-3.5 text-text-secondary" strokeWidth={2} />
        Contribuye a
        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
          Opcional
        </span>
      </span>
      <Select
        value={value ?? "none"}
        onValueChange={(next) => onChange(next === "none" ? null : next)}
      >
        <SelectTrigger
          aria-label="Objetivo al que contribuye"
          className="h-10 rounded-md px-3 text-[13px]"
        >
          <SelectValue placeholder="Sin alineación" />
        </SelectTrigger>
        <SelectContent position="popper" sideOffset={6} className="w-[var(--radix-select-trigger-width)]">
          <SelectItem value="none" className="text-[13px]">
            Sin alineación
          </SelectItem>
          {companyObjectives.length > 0 && (
            <SelectGroup>
              {showLabels && (
                <SelectLabel className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">
                  De la empresa
                </SelectLabel>
              )}
              {companyObjectives.map((company, index) => (
                <SelectItem key={company.id} value={company.id} className="text-[13px]">
                  {company.title.trim() || `Objetivo de la empresa ${index + 1}`}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
          {cycleObjectives.length > 0 && (
            <SelectGroup>
              {showLabels && (
                <SelectLabel className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">
                  Del ciclo
                </SelectLabel>
              )}
              {cycleObjectives.map((cycleObj, index) => (
                <SelectItem key={cycleObj.id} value={cycleObj.id} className="text-[13px]">
                  {cycleObj.title.trim() || `Objetivo ${index + 1}`}
                </SelectItem>
              ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

/** La línea cerrada: qué se decidió, sin abrir la tarjeta. */
function CompactSummary({
  objective,
  showWeight,
  issue,
}: {
  objective: Objective;
  showWeight: boolean;
  issue: string | null;
}) {
  const { measure, direction } = objective;

  if (measure === null) {
    return (
      <span className="mt-0.5 block px-1.5 text-[12px] text-muted-foreground">
        {issue ?? "Sin configurar"}
      </span>
    );
  }

  const from = formatRawValue(objective.initialValue, measure);
  const to = formatRawValue(objective.targetValue, measure);
  const Icon = direction === "decrease" ? TrendingDown : TrendingUp;

  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 px-1.5 text-[12px] text-text-secondary">
      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-secondary">
        {MEASURE_META[measure].label}
      </span>
      {measure !== "boolean" && direction !== null && (
        <span className="flex items-center gap-1">
          <Icon
            className={cn(
              "size-3.5",
              direction === "increase" ? "text-status-positive" : "text-status-info"
            )}
            strokeWidth={2.2}
          />
          {from && to ? (
            <span className="tabular-nums">
              {from} → {to}
            </span>
          ) : (
            <span>{direction === "increase" ? "Aumentar" : "Reducir"}</span>
          )}
        </span>
      )}
      {showWeight && objective.weight > 0 && (
        <span className="font-semibold tabular-nums text-text-primary">Peso {objective.weight} %</span>
      )}
      {issue && <span className="text-destructive">· {issue}</span>}
    </span>
  );
}
