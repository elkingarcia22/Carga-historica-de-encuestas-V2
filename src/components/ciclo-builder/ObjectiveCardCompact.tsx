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
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
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
import { AiGeneratedBadge } from "@/components/ai-interaction";
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
import {
  DEFAULT_OBJECTIVE_MODEL_RULES,
  objectiveChildrenVocab,
  objectiveModelVocab,
  type ObjectiveModelId,
  type ObjectiveModelRules,
} from "./objectiveModel";
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
  /**
   * Las reglas del modelo del ciclo. Deciden qué cuelga del objetivo, cómo
   * se llama y si tiene que colgar de un objetivo de la empresa. Sin ellas
   * corre con las de SMART, que son el constructor de siempre.
   */
  rules?: ObjectiveModelRules;
  /** El modelo del ciclo. Solo pone el nombre de las piezas —un KPI tiene
   *  indicadores, no objetivos—; lo que se exige sale de `rules`. */
  model?: ObjectiveModelId | null;
  /**
   * Esta tarjeta todavía es una propuesta de la IA sin conservar.
   *
   * Se dibuja con el borde degradado del Agente mientras la decisión siga
   * abierta: es lo que separa, de un vistazo, lo que el ciclo ya tenía de lo
   * que acaba de caer en la lista y puede desaparecer con un "Descartar".
   */
  isAiDraft?: boolean;
}

const MAX_TITLE_LENGTH = 150;
const AI_WORK_MS = 1100;
/** Pausa de inactividad antes de destapar el siguiente paso: ni tan corta
 *  que la tarjeta salte a medio número, ni tan larga que se sienta lenta.
 *  Se nota bastante más cuando se encadena varias veces seguidas —como en
 *  la cascada que arma la IA—, así que se queda del lado corto. */
const STEP_REVEAL_DEBOUNCE_MS = 450;

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
  rules = DEFAULT_OBJECTIVE_MODEL_RULES,
  model = null,
  isAiDraft = false,
}: ObjectiveCardCompactProps) {
  const vocab = objectiveModelVocab(model, rules);
  const requireWeight = variant === "assigned";
  // Los objetivos de la empresa son el norte: no cuelgan de nada, así que la
  // regla de alineación no los alcanza aunque el modelo la exija.
  const requireAlignment =
    variant === "assigned" &&
    rules.alignment === "required" &&
    rules.companyObjectives !== "off" &&
    companyObjectives.length > 0;
  // El modelo de la empresa no lleva lo que cuelga (ver `hasActionsStep`),
  // así que tampoco se le exige.
  const cardRules = variant === "company" ? { ...rules, children: "none" as const } : rules;
  const issue = objectiveIssue(objective, {
    requireWeight,
    rules: cardRules,
    requireAlignment,
  });
  const isComplete = issue === null;
  const hasError = showValidation && !isComplete;
  const headingLabel =
    variant === "company" ? `${vocab.objective} de la empresa` : vocab.objective;

  const titleInputRef = React.useRef<HTMLInputElement>(null);
  const ai = useCardAi(objective, onChange, titleInputRef);
  // Lo que le queda disponible a este objetivo dentro de su cupo: es lo que
  // se le asigna una vez el paso de peso queda a la vista, cuando la IA
  // generó de cero. Los objetivos de la empresa no llevan peso, así que no
  // hay nada que asignarles.
  const remainingWeightForAi = requireWeight ? Math.max(0, weightBudget - otherObjectivesWeight) : null;

  const { measure, direction } = objective;
  // Igual que la meta o el piso y el techo: el paso de medida espera una
  // pausa real de escritura antes de destaparse, no cada tecla — si no,
  // "¿Cómo se mide?" saltaría a la vista a mitad de la primera palabra.
  // Mientras la IA está llenando la tarjeta esa espera se apaga (delay 0):
  // su propia cascada ya se paso a paso con sus propias pausas
  // (`STEP_REVEAL_DEBOUNCE_MS` en `useCardAi`), y sumarle esta encima solo
  // duplicaba el silencio entre el título y la medida sin que nada se
  // moviera en pantalla.
  const debouncedTitle = useDebouncedValue(objective.title, ai.isWorking ? 0 : STEP_REVEAL_DEBOUNCE_MS);
  const hasTitle = debouncedTitle.trim() !== "";
  const showMeasureType = hasTitle && ai.phase === "idle";
  const isBoolean = measure === "boolean";
  const showDirection = showMeasureType && measure !== null && !isBoolean;
  const showValues = showDirection && direction !== null;

  const target = parseAmount(objective.targetValue);

  // Los pasos que dependen de tener una meta usable (mínimos y máximos,
  // peso, alineación) esperan una pausa real de escritura antes de
  // aparecer: si se destaparan tecla a tecla, la tarjeta "saltaría" al peso
  // mientras el autor todavía está terminando de escribir el número.
  const debouncedTargetValue = useDebouncedValue(objective.targetValue, STEP_REVEAL_DEBOUNCE_MS);
  const debouncedInitialValue = useDebouncedValue(objective.initialValue, STEP_REVEAL_DEBOUNCE_MS);
  const debouncedTarget = parseAmount(debouncedTargetValue);
  const debouncedDeclaredInitial = parseAmount(debouncedInitialValue);
  const trackIsUsable =
    debouncedTarget !== null &&
    direction !== null &&
    trackBlockingIssue(direction, debouncedTarget, debouncedDeclaredInitial) === null;
  // Si es boolean, asumimos que trackIsUsable siempre será true si ponen meta
  const showTail = (showMeasureType && isBoolean) || (showValues && trackIsUsable);
  const startLine =
    trackIsUsable && debouncedTarget !== null && direction !== null
      ? resolveStartLine(direction, debouncedTarget, debouncedDeclaredInitial)
      : null;
  // Todo lo que cuelga de aquí —rango, peso, alineación, acciones, probar—
  // se apoya en `measure`/`direction`/valores que "Mejorar con IA" no toca
  // y por eso no se limpian con el título: sin este candado seguirían
  // marcando el objetivo de antes como listo mientras la IA todavía está
  // redactando, y esos pasos se quedarían a la vista encima de una tarjeta
  // que se supone que no debería mostrar nada.
  const canSimulate = showMeasureType && (isBoolean || (
    trackIsUsable &&
    measure !== null &&
    direction !== null &&
    startLine !== null &&
    debouncedTarget !== null
  ));
  // Mínimos y máximos entra en el mismo momento que peso: los dos dependen
  // de la misma meta ya asentada. Un objetivo booleano no tiene piso ni
  // techo que preguntar.
  const showRangeStep = canSimulate && !isBoolean;
  const hasAlignmentOptions = companyObjectives.length > 0 || cycleObjectives.length > 0;
  // Los objetivos de la empresa no llevan este paso: ese desglose es propio
  // de objetivos asignados a personas o equipos. Los demás siempre lo tienen,
  // pero no siempre significa lo mismo: donde el modelo no cuelga nada que
  // mida —KPI— son tareas de seguimiento, un plan opcional que no toca el
  // avance, y de ahí que el vocabulario y el interruptor cambien con él.
  const hasActionsStep = variant !== "company";
  const isFollowUpPlan = rules.children === "none";
  const childrenVocab = objectiveChildrenVocab(model ?? null, rules);
  /** Los resultados clave siempre miden el objetivo: no es opcional. */
  const childrenDrive =
    !isFollowUpPlan && (rules.children === "results" || rules.childrenDriveProgress);

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
  // escrito).
  const [rangeAnswered, setRangeAnswered] = React.useState(
    () => objective.rangeEnabled || hasRangeValue || objective.createdByAI
  );
  const handleRangeChoice = (rangeEnabled: boolean) => {
    setRangeAnswered(true);
    onChange({ rangeEnabled });
  };

  // Cuando la IA genera el objetivo de punta a punta, también resuelve
  // mínimos y máximos (que no, por defecto), peso (lo que quede disponible)
  // y alineación (ninguna) — pero no de una, en el mismo instante que el
  // resto: cada uno se contesta solo cuando SU PROPIO paso queda a la
  // vista, más abajo, para que la tarjeta se destape en cascada igual que
  // si un autor real fuera haciendo clic paso por paso. `objective.createdByAI`
  // sólo dice si ESTE objetivo lo generó la IA en algún momento, no si
  // acaba de pasar: se compara contra el valor anterior para no relanzar
  // la cascada cada vez que se re-renderiza.
  const [aiPendingRangeAnswer, setAiPendingRangeAnswer] = React.useState(false);
  const [aiPendingWeight, setAiPendingWeight] = React.useState(false);
  const [aiPendingAlignment, setAiPendingAlignment] = React.useState(false);
  const wasCreatedByAI = React.useRef(objective.createdByAI);
  React.useEffect(() => {
    if (!wasCreatedByAI.current && objective.createdByAI) {
      setAiPendingRangeAnswer(true);
      setAiPendingWeight(true);
      setAiPendingAlignment(true);
    }
    wasCreatedByAI.current = objective.createdByAI;
  }, [objective.createdByAI]);

  // Cada paso siguiente espera su propia pausa de inactividad antes de
  // destaparse — la misma idea que la meta, encadenada: mínimos y máximos
  // no suelta peso hasta que la respuesta (Sí/No, y si Sí, el piso o el
  // techo) deja de cambiar; peso no suelta alineación hasta que su valor
  // deja de moverse; y así hasta probar. Todo de un golpe se sentiría como
  // el mismo salto que el peso apareciendo con la primera tecla de la meta.
  const debouncedRangeAnswered = useDebouncedValue(rangeAnswered, STEP_REVEAL_DEBOUNCE_MS);
  const debouncedRangeChoice = useDebouncedValue(objective.rangeEnabled, STEP_REVEAL_DEBOUNCE_MS);
  // Igual que el par valor inicial/meta: mínimo y máximo comparten un solo
  // reloj de inactividad en vez de uno cada uno. Si cada campo tuviera el
  // suyo, llenar el mínimo y quedarse escribiendo el máximo no alcanzaría a
  // frenar nada — el mínimo, ya asentado, destaparía el peso solo.
  const rangeValuesKey = `${objective.minValue}|${objective.maxValue}`;
  const debouncedRangeValuesKey = useDebouncedValue(rangeValuesKey, STEP_REVEAL_DEBOUNCE_MS);
  // Con "Sí" elegido, piso y techo cuentan como un paquete: mientras falte
  // cualquiera de los dos, el paso sigue abierto — llenar sólo el mínimo no
  // basta para destapar el peso.
  const debouncedHasBothRangeValues =
    debouncedRangeValuesKey === rangeValuesKey &&
    parseAmount(objective.minValue) !== null &&
    parseAmount(objective.maxValue) !== null;
  const rangeSettled = debouncedRangeAnswered && (!debouncedRangeChoice || debouncedHasBothRangeValues);
  // Un objetivo booleano no tiene mínimos y máximos que contestar: el peso
  // le llega directo en cuanto la meta ya está asentada.
  const readyForWeight = isBoolean ? showTail : showRangeStep && rangeSettled;
  const showWeightStep = requireWeight && readyForWeight;

  // El peso no llega en blanco —trae un valor ya repartido—, así que
  // debouncear su cifra tal cual no bastaría: ya estaría "asentada" desde
  // antes de que el paso existiera. Se ancla en cambio al momento en que el
  // paso se destapa —`null` mientras no es así—, para que la espera cuente
  // desde ahí y no desde que se montó la tarjeta.
  const weightSettleKey = showWeightStep ? String(objective.weight) : null;
  // Mientras la IA trabaja, `showWeightStep` se apaga y esta llave cae a
  // `null` aunque el peso en sí no haya cambiado; sin el mismo candado que
  // el título, al terminar tendría que "reasentarse" otros 450ms de la
  // nada, arrastrando el mismo retraso a alineación y acciones que cuelgan
  // de este paso.
  const debouncedWeightSettleKey = useDebouncedValue(weightSettleKey, ai.isWorking ? 0 : STEP_REVEAL_DEBOUNCE_MS);
  const weightSettled = weightSettleKey !== null && debouncedWeightSettleKey === weightSettleKey;
  // Objetivos de la empresa no llevan peso: para ellos ya se pasó esta
  // etapa en cuanto se llegó a la anterior, sin nada propio que esperar.
  const pastWeightStage = requireWeight ? showWeightStep && weightSettled : readyForWeight;
  const showAlignmentStep = pastWeightStage && hasAlignmentOptions;

  // Cada uno de estos tres contesta su propio paso justo cuando ese paso
  // queda a la vista —no antes—, así que la respuesta automática de la IA
  // hereda la misma cascada que un clic real: mínimos y máximos primero,
  // peso después de que eso se asiente, alineación después de que el peso
  // se asiente.
  React.useEffect(() => {
    if (!aiPendingRangeAnswer || !showRangeStep) return;
    setRangeAnswered(true);
    onChange({ rangeEnabled: false, minValue: "", maxValue: "" });
    setAiPendingRangeAnswer(false);
  }, [aiPendingRangeAnswer, showRangeStep, onChange]);

  React.useEffect(() => {
    if (!aiPendingWeight || !showWeightStep || remainingWeightForAi === null) return;
    onChange({ weight: remainingWeightForAi });
    setAiPendingWeight(false);
  }, [aiPendingWeight, showWeightStep, remainingWeightForAi, onChange]);

  React.useEffect(() => {
    if (!aiPendingAlignment || !showAlignmentStep) return;
    onChange({ alignedTo: null });
    setAiPendingAlignment(false);
  }, [aiPendingAlignment, showAlignmentStep, onChange]);

  // Misma idea que el peso: ancla la espera al momento en que el paso de
  // alineación aparece, no a cuándo se creó el objetivo.
  const alignmentSettleKey = showAlignmentStep ? objective.alignedTo ?? "__ninguno__" : null;
  const debouncedAlignmentSettleKey = useDebouncedValue(
    alignmentSettleKey,
    ai.isWorking ? 0 : STEP_REVEAL_DEBOUNCE_MS
  );
  const alignmentSettled =
    alignmentSettleKey !== null && debouncedAlignmentSettleKey === alignmentSettleKey;
  const pastAlignmentStage = hasAlignmentOptions ? showAlignmentStep && alignmentSettled : pastWeightStage;

  // Resultados/acciones clave va después de peso y alineación, no antes:
  // cuelga del objetivo, así que sólo tiene sentido preguntarlo una vez el
  // objetivo en sí —cuánto pesa, de qué depende— ya quedó resuelto.
  const showActionsStep = pastAlignmentStage && hasActionsStep;
  // Igual que el peso: ancla la espera al momento en que el paso de
  // acciones clave aparece, no a cuándo se creó el objetivo.
  const actionsSettleKey = showActionsStep ? JSON.stringify(objective.keyActions) : null;
  const debouncedActionsSettleKey = useDebouncedValue(
    actionsSettleKey,
    ai.isWorking ? 0 : STEP_REVEAL_DEBOUNCE_MS
  );
  const actionsSettled =
    actionsSettleKey !== null && debouncedActionsSettleKey === actionsSettleKey;

  // Probar es el último paso: sólo tiene sentido una vez todo lo anterior
  // —mínimos y máximos, peso, alineación si existe, y resultados/acciones
  // clave si el modelo los lleva— ya se asentó. Aun con todo asentado,
  // espera su propia pausa antes de aparecer.
  const readyToTest = hasActionsStep ? showActionsStep && actionsSettled : pastAlignmentStage;
  // Mismo candado que el título: si la IA está trabajando, esconder no
  // puede esperar los 450ms de siempre, o "Probar objetivo" se quedaría
  // colgado a la vista mientras "Redactando…" ya lo desmintió arriba.
  const showTestStep = useDebouncedValue(readyToTest, ai.isWorking ? 0 : STEP_REVEAL_DEBOUNCE_MS);

  const cardRef = React.useRef<HTMLElement>(null);
  const visibleSteps =
    1 +
    (showMeasureType ? 1 : 0) +
    (showValues ? 1 : 0) +
    (showRangeStep ? 1 : 0) +
    (showWeightStep ? 1 : 0) +
    (showAlignmentStep ? 1 : 0) +
    (showActionsStep ? 1 : 0) +
    (showTestStep ? 1 : 0);

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

  // Mínimos y máximos hace scroll a sí mismo al activarse, y probar al
  // abrirse: cada uno busca su propio bloque en vivo por el texto de su
  // pregunta, en vez de guardar un ref de antemano — el bloque cambia de
  // forma (uno o dos campos, simulador abierto o cerrado) y React lo
  // desmonta y remonta, así que un ref capturado antes puede apuntar
  // todavía a `null` en el primer commit del nuevo bloque.
  const findStep = React.useCallback((text: string): HTMLElement | undefined => {
    const steps = cardRef.current?.querySelectorAll<HTMLElement>("[data-objective-step]");
    return steps ? Array.from(steps).find((step) => step.textContent?.includes(text)) : undefined;
  }, []);

  React.useEffect(() => {
    if (!objective.rangeEnabled) return;
    const timer = setTimeout(() => {
      findStep("Mínimos y máximos de avance")?.scrollIntoView({ behavior: "auto", block: "start" });
    }, 0);
    return () => clearTimeout(timer);
  }, [objective.rangeEnabled, findStep]);

  React.useEffect(() => {
    if (!isSimulating) return;
    const timer = setTimeout(() => {
      findStep("¿Cómo se va a calcular el avance?")?.scrollIntoView({
        behavior: "auto",
        block: "start",
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [isSimulating, findStep]);

  const [wantsDescription, setWantsDescription] = React.useState(!!objective.description);
  const showDescription = wantsDescription || objective.description !== "";

  const setDescriptionShown = (checked: boolean) => {
    if (!checked && objective.description) onChange({ description: "" });
    setWantsDescription(checked);
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
  const rangeStep = stepNumber(showRangeStep);
  const weightStep = stepNumber(showWeightStep);
  const alignmentStep = stepNumber(showAlignmentStep);
  const actionsStep = stepNumber(showActionsStep);
  const testStep = stepNumber(showTestStep);

  return (
    <>
    <article
      ref={cardRef}
      className={cn(
        "rounded-2xl border bg-surface shadow-card transition-colors",
        hasError ? "border-destructive/40" : "border-border/60",
        isExpanded && !hasError && "border-primary/25",
        // El anillo degradado se dibuja encima del borde, así que no hay que
        // apagarlo: mientras la propuesta esté sin conservar manda él.
        isAiDraft && "ai-gradient-ring"
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

              {showRangeStep && !isBoolean && measure !== null && (
                <CompactStep
                  key="range"
                  className="py-4"
                  number={rangeStep}
                  question="¿Quieres poner límites al objetivo?"
                  help="Opcional. El avance será 0 % antes del piso y dejará de sumar al llegar al techo."
                >
                  <div className="flex flex-col gap-2">
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-text-primary">
                      <Gauge className="size-3.5 text-text-secondary" strokeWidth={2} />
                      Mínimos y máximos de avance
                    </span>
                    <RangeChoiceCards
                      value={rangeAnswered ? objective.rangeEnabled : null}
                      onChange={handleRangeChoice}
                    />
                  </div>
                  <AnimatePresence initial={false}>
                    {objective.rangeEnabled && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                        className="overflow-hidden pt-4"
                      >
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
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CompactStep>
              )}

              {showWeightStep && (
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

              {showAlignmentStep && (
                <CompactStep
                  key="alignment"
                  className="py-4"
                  number={alignmentStep}
                  question="¿A qué objetivo contribuye?"
                  help={
                    requireAlignment
                      ? "Este modelo pide que todo objetivo cuelgue de uno de la empresa: sin padre, el objetivo no queda listo."
                      : "La alineación (opcional) muestra el aporte al objetivo general."
                  }
                >
                  <AlignmentSelect
                    value={objective.alignedTo}
                    companyObjectives={companyObjectives}
                    cycleObjectives={cycleObjectives}
                    onChange={(alignedTo) => onChange({ alignedTo })}
                    isRequired={requireAlignment}
                    hasError={showValidation && requireAlignment && objective.alignedTo === null}
                  />
                </CompactStep>
              )}

              {showActionsStep && (
                <CompactStep
                  key="actions"
                  className="py-4"
                  number={actionsStep}
                  question={
                    isFollowUpPlan
                      ? `¿Qué ${childrenVocab.children?.toLowerCase()} quieres dejar anotadas?`
                      : rules.children === "results"
                        ? `¿Qué ${childrenVocab.children?.toLowerCase()} demuestran que llegaste?`
                        : `¿Qué ${childrenVocab.children?.toLowerCase()} llevan a la meta?`
                  }
                  help={
                    isFollowUpPlan
                      ? "Opcional. Este modelo se mide con una sola cifra, así que esto es el plan para sostenerla: no cambia el avance."
                      : rules.childrenRequired
                        ? `Obligatorio en este modelo. ${
                            rules.children === "results"
                              ? "Cada uno lleva su propia métrica y el avance del objetivo sale de ellos."
                              : "El trabajo concreto que mueve la cifra."
                          }`
                        : "Opcional. El trabajo concreto que mueve la cifra; puedes hacer que el avance se calcule con ellas."
                  }
                  aside={
                    objective.keyActions.length > 0 ? (
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums",
                          childrenDrive &&
                            keyActionsTotal(objective.keyActions) !== TOTAL_WEIGHT
                            ? "bg-surface-muted text-text-secondary"
                            : "bg-primary/10 text-primary"
                        )}
                      >
                        {objective.keyActions.length}{" "}
                        {objective.keyActions.length === 1
                          ? childrenVocab.child?.toLowerCase()
                          : childrenVocab.children?.toLowerCase()}
                      </span>
                    ) : undefined
                  }
                >
                  <ObjectiveKeyActionsField
                    actions={objective.keyActions}
                    driveProgress={objective.keyActionsDriveProgress}
                    onChange={(patch) => onChange(patch)}
                    showValidation={showValidation}
                    vocab={childrenVocab}
                    progressMode={
                      rules.children === "results"
                        ? "locked-on"
                        : isFollowUpPlan
                          ? "locked-off"
                          : "choice"
                    }
                  />
                </CompactStep>
              )}

              {showTestStep && measure !== null && (
                <CompactStep
                  key="test"
                  className="py-4"
                  number={testStep}
                  question="¿Cómo se va a calcular el avance?"
                  help="Prueba un resultado de ejemplo y comprueba que el cumplimiento sale como esperas."
                  aside={
                    <SimulateTrigger
                      isSimulating={isSimulating}
                      onToggle={() => setIsSimulating(!isSimulating)}
                    />
                  }
                >
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
                        <ComplianceSimulator
                          layout="compact"
                          measure={measure}
                          direction={direction ?? "increase"}
                          start={startLine?.value ?? 0}
                          target={target ?? 1}
                          min={objective.rangeEnabled ? parseAmount(objective.minValue) : null}
                          max={objective.rangeEnabled ? parseAmount(objective.maxValue) : null}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CompactStep>
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
  /** El botón sigue en modo carga más allá de `phase === "working"`: cubre
   *  también la cascada que rellena medida, dirección y valores después de
   *  esa primera espera. `phase` por sí solo ya no basta para saber si el
   *  botón debe verse ocupado. */
  isWorking: boolean;
  label: string;
  trigger: () => void;
  cancelContext: () => void;
}

/** Con texto ya escrito y la medida todavía sin elegir, ese texto ya es el
 * contexto: genera el objetivo entero a partir de él, igual que si se
 * hubiera pedido aparte. Sólo mejora la redacción sola —sin tocar medida,
 * dirección ni valores— una vez esos pasos ya quedaron contestados, para no
 * pisarle al autor una elección que ya hizo. En blanco, pide la frase de
 * contexto antes de generar. */
function useCardAi(
  objective: Objective,
  onChange: (patch: Partial<Objective>) => void,
  inputRef: React.RefObject<HTMLInputElement | null>
): CardAi {
  const [phase, setPhase] = React.useState<AiPhase>("idle");
  // `phase` vuelve a "idle" en cuanto el título queda escrito —para que
  // "¿Cómo se mide?" pueda destaparse— pero la IA todavía tiene medida y
  // valores por escribir. Esta bandera aparte mantiene el botón en modo
  // carga durante esa cascada, sin bloquear los pasos que ya deberían
  // poder aparecer.
  const [isAutoFilling, setIsAutoFilling] = React.useState(false);

  // La IA tarda un momento y el autor puede seguir escribiendo mientras: se
  // lee el objetivo de cuando termina, no de cuando se pulsó.
  const objectiveRef = React.useRef(objective);
  React.useEffect(() => {
    objectiveRef.current = objective;
  });

  const run = async (mode: "refine" | "generate") => {
    const current = objectiveRef.current;
    if (current.title.trim() === "") return;
    const rawContext = current.title.trim();
    setPhase("working");

    // Limpiar de una vez: mientras la IA redacta —generando o mejorando, en
    // empresa, grupo o colaborador, la misma tarjeta para los tres— no debe
    // quedar nada de la versión anterior a la vista. Lo de abajo ya se
    // esconde solo (`showMeasureType` exige `ai.phase === "idle"`); el
    // título no, así que se vacía aquí para que lo nuevo aparezca en
    // cascada sobre una tarjeta en blanco, no encima de la anterior.
    onChange({ title: "", description: "" });

    await new Promise((resolve) => setTimeout(resolve, AI_WORK_MS));

    if (mode === "generate") {
      const generated = generateObjectiveFromContext(rawContext);
      // El título es lo primero que se contesta —destapa "¿Cómo se mide?"—,
      // y ahí se detiene: escribir medida, dirección y valores en el mismo
      // instante los haría aparecer los tres de un golpe, aunque cada uno
      // viva en un paso propio. Cada pieza espera la misma pausa que un
      // autor real tardaría en leer la pregunta y contestarla. `phase`
      // suelta el candado ya mismo —el botón sigue "ocupado" por
      // `isAutoFilling`, no por `phase`— para que esos pasos puedan ir
      // apareciendo mientras la cascada sigue su curso.
      // Cada llamada repite también lo que ya se contestó antes: si algún
      // `onChange` de más arriba mezcla contra una instantánea vieja del
      // objetivo en vez de contra la más reciente, la del medio se perdería
      // apenas la de después la pisara — llevando siempre el acumulado
      // encima no depende de que eso esté bien resuelto.
      const stage1 = {
        title: generated.title,
        description: generated.description,
        createdByAI: true,
      };
      onChange(stage1);
      setPhase("idle");
      setIsAutoFilling(true);
      await new Promise((resolve) => setTimeout(resolve, STEP_REVEAL_DEBOUNCE_MS));
      const stage2 = { ...stage1, measure: generated.measure, direction: generated.direction };
      onChange(stage2);
      await new Promise((resolve) => setTimeout(resolve, STEP_REVEAL_DEBOUNCE_MS));
      onChange({
        ...stage2,
        initialValue: generated.initialValue,
        targetValue: generated.targetValue,
      });
      setIsAutoFilling(false);
      // Mínimos y máximos, peso y alineación se contestan solos más
      // adelante, cada uno cuando su propio paso queda a la vista (ver los
      // efectos `aiPending*`), continuando esta misma cascada.
      return;
    }
    onChange(refineObjectiveWording(current));
    // `isAutoFilling` no es solo del modo "generate": es la señal de "esto
    // lo acaba de escribir la IA, no lo debounces" que lee `hasTitle` más
    // arriba. Si se apagara junto con `phase` en el mismo tick, el título
    // recién redactado llegaría con `isWorking` ya en falso y el paso de
    // medida —que ya tenía todo escrito, sin nada que regenerar— se
    // quedaría escondido detrás del debounce hasta que ese medio segundo
    // pasara solo.
    setPhase("idle");
    setIsAutoFilling(true);
    await new Promise((resolve) => setTimeout(resolve, STEP_REVEAL_DEBOUNCE_MS));
    setIsAutoFilling(false);
  };

  const isWorking = phase === "working" || isAutoFilling;

  const trigger = () => {
    if (isWorking) return;
    if (phase === "idle" && objective.title.trim() === "") {
      setPhase("context");
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    void run(phase === "context" || objective.measure === null ? "generate" : "refine");
  };

  const label = isWorking
    ? "Redactando…"
    : objective.title.trim() === "" || phase === "context" || objective.measure === null
      ? "Generar con IA"
      : "Mejorar con IA";

  return { phase, isWorking, label, trigger, cancelContext: () => setPhase("idle") };
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
  const isWorking = ai.isWorking;
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
          loading={isWorking}
          disabled={isWorking || (isAskingContext && isEmpty)}
          aria-label={
            isEmpty || isAskingContext || objective.measure === null
              ? "Generar el objetivo con IA a partir del contexto"
              : "Mejorar la redacción del objetivo con IA"
          }
          className={cn(
            "h-10 shrink-0 disabled:cursor-not-allowed",
            // Deshabilitado de verdad (sin texto en el modo contexto) se
            // aprieta con la opacidad de siempre; trabajando no está "apagado",
            // está ocupado — el fondo, el borde y el brillo ya lo dicen, así
            // que el texto se queda con su color normal.
            !isWorking && "disabled:opacity-50"
          )}
        />
      </div>

      {isAskingContext && (
        <p className="text-[12px] leading-relaxed text-text-secondary">
          Escribe en una frase de qué quieres que vaya este objetivo y lo redactamos por ti, con su
          medida y su meta.
        </p>
      )}
    </div>
  );
}

// ── Reglas opcionales y prueba ──────────────────────────────────────────────

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
  isRequired = false,
  hasError = false,
}: {
  value: string | null;
  companyObjectives: readonly Objective[];
  cycleObjectives?: readonly Objective[];
  onChange: (alignedTo: string | null) => void;
  /** El modelo exige objetivo padre: la marca deja de decir "opcional" y
   *  "Sin alineación" deja de ofrecerse como salida. */
  isRequired?: boolean;
  hasError?: boolean;
}) {
  const showLabels = companyObjectives.length > 0 && cycleObjectives.length > 0;

  return (
    <div className="flex flex-col gap-2.5">
      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-text-primary">
        <Link2 className="size-3.5 text-text-secondary" strokeWidth={2} />
        Contribuye a
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10.5px] font-medium",
            isRequired
              ? "bg-primary/10 text-primary"
              : "bg-surface-muted text-muted-foreground"
          )}
        >
          {isRequired ? "Obligatorio" : "Opcional"}
        </span>
      </span>
      <Select
        value={value ?? "none"}
        onValueChange={(next) => onChange(next === "none" ? null : next)}
      >
        <SelectTrigger
          aria-label="Objetivo al que contribuye"
          className={cn(
            "h-10 rounded-md px-3 text-[13px]",
            hasError && "border-destructive focus:border-destructive"
          )}
        >
          <SelectValue placeholder={isRequired ? "Elige un objetivo" : "Sin alineación"} />
        </SelectTrigger>
        <SelectContent position="popper" sideOffset={6} className="w-[var(--radix-select-trigger-width)]">
          {!isRequired && (
            <SelectItem value="none" className="text-[13px]">
              Sin alineación
            </SelectItem>
          )}
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
