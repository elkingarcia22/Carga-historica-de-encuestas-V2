import * as React from "react";
import { CalendarRange, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { DualDateRangePicker } from "@/components/date";
import {
  CICLO_OBJECTIVE_CREATOR_LABELS,
  CICLO_OBJECTIVE_CREATOR_TAGLINES,
  CICLO_PERIOD_LABELS,
  CICLO_PERIOD_MONTHS,
  MAX_CICLO_DESCRIPTION_LENGTH,
  PARTICIPANT_MODES_BY_CREATOR,
  type CicloDraft,
  type CicloObjectiveCreator,
  type CicloPeriod,
} from "./cicloBuilderTypes";
import { GuidedStep } from "./GuidedStep";
import { ObjectiveOptionCard } from "./ObjectiveOptionCard";
import { ObjectiveModelPicker } from "./ObjectiveModelPicker";
import { OBJECTIVE_CREATOR_VISUAL, PERIOD_VISUAL } from "./measureVisual";
import {
  OBJECTIVE_MODELS_ENABLED,
  OBJECTIVE_MODEL_META,
  type ObjectiveModelId,
  type ObjectiveModelRules,
} from "./objectiveModel";

interface CicloGeneralEditorProps {
  draft: CicloDraft;
  onChange: (patch: Partial<CicloDraft>) => void;
  /** True once the author tried to leave with required fields still empty. */
  showValidation?: boolean;
}

const REQUIRED_FIELD_HINT = "Completa este campo";

const PERIOD_OPTIONS = Object.keys(CICLO_PERIOD_LABELS) as CicloPeriod[];
const OBJECTIVE_CREATOR_OPTIONS = Object.keys(
  CICLO_OBJECTIVE_CREATOR_LABELS
) as CicloObjectiveCreator[];
const PERIOD_DAYS: Record<CicloPeriod, string> = {
  mes: "30 días",
  bimestre: "60 días",
  trimestre: "90 días",
  semestre: "180 días",
  anio: "365 días",
  personalizado: "A medida",
};

/**
 * Las preguntas del paso, en orden. El modelo va segundo porque recomienda
 * las dos siguientes: quién escribe y cuánto dura.
 *
 * La descripción no está en la lista a propósito: es opcional, y una
 * pregunta opcional al final del hilo se lee como un trámite más. Vive como
 * un interruptor bajo el nombre, que es de lo que habla.
 */
const STEP_NAME = 1;
const STEP_MODEL = 2;
const STEP_CREATOR = 3;
const STEP_PERIOD = 4;
const STEP_DATES = 5;
const TOTAL_STEPS = STEP_DATES;

/** Lo que espera el paso antes de abrir la pregunta siguiente. */
const REVEAL_DELAY_MS = 280;

/** `yyyy-mm-dd` ⇄ Date, kept local so the draft stays plainly serialisable. */
function parseISODate(value: string): Date | null {
  if (value === "") return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function toISODate(date: Date | undefined | null): string {
  if (!date) return "";
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Adds whole months and steps back a day, so a "Trimestre" starting on the 1st
 * of January closes on the 31st of March rather than the 1st of April — a
 * ciclo is a closed window, and the author counts it in whole months.
 */
function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
  next.setDate(next.getDate() - 1);
  return next;
}

/** Un borrador que llega con todo puesto: se está reabriendo, no armando. */
function isDraftAnswered(draft: CicloDraft): boolean {
  return (
    draft.name.trim() !== "" &&
    (!OBJECTIVE_MODELS_ENABLED || draft.objectiveModel !== null) &&
    draft.period !== null &&
    draft.startDate !== "" &&
    draft.endDate !== "" &&
    draft.endDate >= draft.startDate
  );
}

/**
 * El ciclo: cómo se llama, con qué modelo se escriben sus objetivos, quién
 * los escribe y entre qué fechas. Nadie a quien se mida lee nunca este
 * formulario — es el marco del que cuelgan los objetivos.
 *
 * Se presenta como la tarjeta de objetivo y como el generador con IA: una
 * pregunta numerada a la vez, y la siguiente aparece —subiendo y
 * enfocándose— en cuanto el autor contesta la anterior. No en cuanto el
 * borrador tiene un valor: en cuanto el autor *elige*. Es la diferencia
 * entre cinco preguntas y una sola pantalla llena de campos que ya venían
 * rellenos, y es también lo que deja ver la consecuencia de cada respuesta
 * antes de pedir la siguiente.
 */
export function CicloGeneralEditor({
  draft,
  onChange,
  showValidation = false,
}: CicloGeneralEditorProps) {
  const sectionRef = React.useRef<HTMLElement>(null);

  // La foto del borrador al abrir, tomada una sola vez: si ya venía
  // contestado —se está editando un ciclo, o se vuelve a este paso— no hay
  // nada que revelar y se abre entero.
  const [arrivedAnswered] = React.useState(() => isDraftAnswered(draft));

  const answeredSteps = React.useMemo(() => {
    if (draft.name.trim() === "") return 0;
    if (OBJECTIVE_MODELS_ENABLED && draft.objectiveModel === null) return STEP_NAME;
    if (draft.objectiveCreator === null) return STEP_MODEL;
    if (draft.period === null) return STEP_CREATOR;
    // Las fechas son la última pregunta: no hay nada que abrir después.
    return STEP_PERIOD;
  }, [draft.name, draft.objectiveModel, draft.period, draft.objectiveCreator]);

  const [revealedByAnswers, setRevealedByAnswers] = React.useState(() =>
    arrivedAnswered ? TOTAL_STEPS : 1
  );
  // Intentar continuar con algo sin responder abre el paso entero: el aviso
  // nombra lo que falta, y lo que falta tiene que poder verse.
  const revealed = showValidation ? TOTAL_STEPS : revealedByAnswers;
  const initialRevealed = React.useRef(revealed);

  // Una pregunta por vez. Mientras se escribe el nombre el temporizador se
  // reinicia en cada tecla, así la siguiente no salta a media palabra.
  React.useEffect(() => {
    const target = Math.min(TOTAL_STEPS, answeredSteps + 1);
    if (revealed >= target) return;
    const timer = setTimeout(
      () => setRevealedByAnswers((current) => Math.min(target, current + 1)),
      REVEAL_DELAY_MS
    );
    return () => clearTimeout(timer);
  }, [answeredSteps, revealed]);

  // Traer a la vista lo que acaba de aparecer, igual que hace la tarjeta de
  // objetivo. No en el primer render: ahí nadie ha respondido nada todavía.
  React.useEffect(() => {
    if (revealed === initialRevealed.current) return;
    const timer = setTimeout(() => {
      const steps = sectionRef.current?.querySelectorAll("[data-objective-step]");
      steps?.[steps.length - 1]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 90);
    return () => clearTimeout(timer);
  }, [revealed]);

  // La descripción es opcional y casi nunca se usa, así que no ocupa sitio
  // hasta que alguien la pide. Un ciclo que ya la trae la muestra abierta.
  const [wantsDescription, setWantsDescription] = React.useState(
    () => draft.description !== ""
  );
  const showDescription = wantsDescription || draft.description !== "";
  const setDescriptionShown = (checked: boolean) => {
    if (!checked && draft.description !== "") onChange({ description: "" });
    setWantsDescription(checked);
  };

  const hasInvalidRange =
    draft.startDate !== "" && draft.endDate !== "" && draft.endDate < draft.startDate;

  const nameError =
    showValidation && draft.name.trim() === "" ? REQUIRED_FIELD_HINT : undefined;
  const modelError =
    showValidation && OBJECTIVE_MODELS_ENABLED && draft.objectiveModel === null
      ? "Elige un modelo"
      : undefined;
  const periodError =
    showValidation && draft.period === null ? REQUIRED_FIELD_HINT : undefined;
  const startDateError =
    showValidation && draft.startDate === "" ? REQUIRED_FIELD_HINT : undefined;
  const endDateError = hasInvalidRange
    ? "El cierre no puede ser antes del inicio"
    : showValidation && draft.endDate === ""
      ? REQUIRED_FIELD_HINT
      : undefined;

  /**
   * Picking a preset period is a statement about length, so it answers the
   * closing date too — leaving the author to compute "start + 3 months minus a
   * day" by hand would be asking them to repeat what they just said.
   */
  const applyPeriod = (period: CicloPeriod) => {
    const months = CICLO_PERIOD_MONTHS[period];
    const start = parseISODate(draft.startDate);
    if (months === null || start === null) {
      onChange({ period });
      return;
    }
    onChange({ period, endDate: toISODate(addMonths(start, months)) });
  };

  const handleDateChange = ({
    startDate,
    endDate,
  }: {
    startDate: Date | undefined;
    endDate: Date | undefined;
  }) => {
    const months = draft.period ? CICLO_PERIOD_MONTHS[draft.period] : null;

    // A new start date under a preset period moves the close with it, for the
    // same reason picking the preset filled it in the first place.
    if (months !== null && startDate && toISODate(startDate) !== draft.startDate) {
      onChange({
        startDate: toISODate(startDate),
        endDate: toISODate(addMonths(startDate, months)),
      });
      return;
    }

    // If the end date changed manually and it no longer matches the preset...
    if (months !== null && startDate && endDate) {
      const expectedEndDate = toISODate(addMonths(startDate, months));
      if (toISODate(endDate) !== expectedEndDate) {
        onChange({
          startDate: toISODate(startDate),
          endDate: toISODate(endDate),
          period: "personalizado",
        });
        return;
      }
    }

    onChange({ startDate: toISODate(startDate), endDate: toISODate(endDate) });
  };

  const isPresetPeriod =
    draft.period !== null && CICLO_PERIOD_MONTHS[draft.period] !== null;

  /**
   * Cambiar de creador también adelanta el paso de participantes al método
   * que le corresponde por defecto —el primero de su orden en
   * `PARTICIPANT_MODES_BY_CREATOR`— para que, al llegar a ese paso, ya esté
   * abierto en el modo que tiene sentido para ese creador en vez de quedarse
   * en "Toda la empresa" sin importar quién escribe los objetivos. Para
   * "Líder" eso es "Por grupos", ya agrupado por líder en vez del área por
   * defecto. Sigue siendo un valor de partida, no un bloqueo — el autor lo
   * puede cambiar libremente dentro del propio paso. RH no tiene entrada en
   * esa tabla porque nunca llega al paso.
   */
  const creatorPatch = (objectiveCreator: CicloObjectiveCreator): Partial<CicloDraft> => {
    if (objectiveCreator === "hr" || objectiveCreator === "custom") return { objectiveCreator };
    return {
      objectiveCreator,
      participants: {
        ...draft.participants,
        mode: PARTICIPANT_MODES_BY_CREATOR[objectiveCreator][0],
        groupSegmentBy: objectiveCreator === "leader" ? "leader" : draft.participants.groupSegmentBy,
      },
    };
  };

  const handleCreatorChange = (objectiveCreator: CicloObjectiveCreator) => {
    onChange(creatorPatch(objectiveCreator));
  };

  /**
   * Elegir un modelo arrastra dos cosas y nada más: quién escribe, cuando el
   * modelo lo da por sentado (MBO nace del acuerdo entre líder y
   * colaborador), y si el norte de la empresa entra o no.
   *
   * Lo que *no* hace es poner el periodo: el modelo tiene una recomendación
   * —OKR por trimestre, KPI por mes— y la dice en la pregunta de duración,
   * pero dejarla ya marcada convertía esa pregunta en una card seleccionada
   * que el autor nunca eligió.
   *
   * Lo que tampoco hace es decidir entre quiénes se reparte. Un ciclo puede
   * repartir por grupos, por persona o las dos cosas a la vez, y eso se
   * resuelve al repartir los objetivos —dos pasos más adelante—, no aquí:
   * un modelo que apagara "por persona" cerraría una puerta que el propio
   * constructor abre después.
   */
  const handleModelChange = (objectiveModel: ObjectiveModelId, modelRules: ObjectiveModelRules) => {
    const modelCreator = OBJECTIVE_MODEL_META[objectiveModel].creator;
    const creator =
      modelCreator !== null && modelCreator !== draft.objectiveCreator
        ? creatorPatch(modelCreator)
        : {};
    const useCompanyObjectives =
      modelRules.companyObjectives === "off"
        ? false
        : modelRules.companyObjectives === "required"
          ? true
          : draft.useCompanyObjectives;

    onChange({ objectiveModel, modelRules, ...creator, useCompanyObjectives });
  };

  const modelMeta = draft.objectiveModel ? OBJECTIVE_MODEL_META[draft.objectiveModel] : null;
  const suggestedPeriodLabel =
    modelMeta && draft.objectiveModel !== "custom"
      ? CICLO_PERIOD_LABELS[modelMeta.suggestedPeriod].toLowerCase()
      : null;
  const creatorFixedByModel =
    modelMeta !== null &&
    modelMeta.creator !== null &&
    modelMeta.creator === draft.objectiveCreator;

  // Sin el selector de modelo las preguntas siguientes se corren un número.
  const stepNumber = (step: number) =>
    OBJECTIVE_MODELS_ENABLED || step < STEP_MODEL ? step : step - 1;
  const isRevealed = (step: number) => revealed >= step;

  return (
    <section
      ref={sectionRef}
      className="flex min-w-0 flex-1 flex-col self-start rounded-2xl border border-border/60 bg-surface p-6 shadow-card"
    >
      <header className="mb-5 flex flex-col gap-1.5">
        <h2 className="text-[16px] font-bold tracking-tight text-text-primary">
          Crear ciclo de objetivos
        </h2>
        <p className="text-[13px] text-text-secondary">
          Nombre, modelo de objetivos, periodo y fechas de cumplimiento.
        </p>
      </header>

      <div className="flex flex-col gap-6">
        <GuidedStep
          number={stepNumber(STEP_NAME)}
          question="¿Cómo se va a llamar el ciclo?"
          help="El nombre con el que este ciclo aparece en la lista y en los objetivos de cada participante."
        >
          <input
            value={draft.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="Por ejemplo: Objetivos comerciales Q1"
            aria-label="Nombre del ciclo"
            aria-invalid={!!nameError}
            // Primer campo del primer paso: al entrar al constructor —o al
            // volver a este paso— ya se puede escribir sin un click extra.
            autoFocus
            className={cn(
              "h-10 w-full rounded-md border bg-surface px-3 text-[13px] text-text-primary outline-none transition-all focus:ring-2 placeholder:text-muted-foreground/70",
              nameError
                ? "border-destructive focus:border-destructive focus:ring-destructive/25"
                : "border-border focus:border-primary focus:ring-primary/25"
            )}
          />
          <StepError message={nameError} />

          {/* La descripción cuelga del nombre porque es lo mismo dicho con
              más palabras, y es el mismo interruptor que la tarjeta de
              objetivo usa para la suya. */}
          <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-[12px] font-medium text-text-primary">
            <Switch
              checked={showDescription}
              onCheckedChange={setDescriptionShown}
              className="data-[state=checked]:bg-status-positive"
            />
            <span>Añadir descripción</span>
          </label>

          {showDescription && (
            <textarea
              value={draft.description}
              onChange={(event) =>
                onChange({
                  description: event.target.value.slice(0, MAX_CICLO_DESCRIPTION_LENGTH),
                })
              }
              maxLength={MAX_CICLO_DESCRIPTION_LENGTH}
              rows={3}
              placeholder="Explica en una o dos frases para qué existe este ciclo."
              aria-label="Descripción del ciclo"
              className="mt-2 w-full resize-y rounded-md border border-border bg-surface px-3 py-2.5 text-[13px] leading-relaxed text-text-primary outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/25 placeholder:text-muted-foreground/70"
            />
          )}
        </GuidedStep>

        {/* El modelo va antes que el creador y el periodo porque habla de los
            dos: MBO fija al líder, OKR recomienda trimestre, KPI mes. */}
        {OBJECTIVE_MODELS_ENABLED && isRevealed(STEP_MODEL) && (
          <GuidedStep
            number={STEP_MODEL}
            question="¿Con qué modelo se van a escribir los objetivos?"
            help="El modelo decide qué le pedimos a cada objetivo y cómo se conecta con el resto. Siempre puedes ajustarlo."
          >
            <ObjectiveModelPicker
              model={draft.objectiveModel}
              rules={draft.modelRules}
              onChange={handleModelChange}
              error={modelError}
            />
          </GuidedStep>
        )}

        {/* Quién escribe los objetivos decide el resto del recorrido: RH se
            salta por completo el paso de participantes, y un líder o un
            colaborador ven ese paso con sus cards en un orden distinto —
            ver `PARTICIPANT_MODES_BY_CREATOR`. */}
        {isRevealed(STEP_CREATOR) && (
          <GuidedStep
            number={stepNumber(STEP_CREATOR)}
            question="¿Quién va a crear los objetivos?"
            help={
              creatorFixedByModel && modelMeta
                ? `${modelMeta.label} nace del acuerdo entre líder y colaborador, por eso te proponemos ${draft.objectiveCreator ? CICLO_OBJECTIVE_CREATOR_LABELS[draft.objectiveCreator].toLowerCase() : ""}. Puedes cambiarlo.`
                : "Esto decide si te pedimos elegir participantes, y en qué orden te mostramos las formas de elegirlos."
            }
          >
            <div className="grid grid-cols-3 gap-2">
              {OBJECTIVE_CREATOR_OPTIONS.map((option) => (
                <ObjectiveOptionCard
                  key={option}
                  {...OBJECTIVE_CREATOR_VISUAL[option]}
                  align="center"
                  label={CICLO_OBJECTIVE_CREATOR_LABELS[option]}
                  tagline={CICLO_OBJECTIVE_CREATOR_TAGLINES[option]}
                  isSelected={draft.objectiveCreator === option}
                  onClick={() => handleCreatorChange(option)}
                  className="min-h-[92px] p-2.5"
                />
              ))}
            </div>
          </GuidedStep>
        )}

        {/* A row of pills rather than a dropdown: there are six options, they
            are mutually exclusive, and picking one has a visible side effect on
            the dates below — worth seeing all at once. */}
        {isRevealed(STEP_PERIOD) && (
          <GuidedStep
            number={stepNumber(STEP_PERIOD)}
            question="¿Cuánto dura el ciclo?"
            help={
              suggestedPeriodLabel && modelMeta
                ? `${modelMeta.label} suele correr por ${suggestedPeriodLabel}. Al elegir un periodo calculamos la fecha de cierre por ti.`
                : "Al elegir un periodo calculamos la fecha de cierre por ti. Siempre puedes ajustarla."
            }
          >
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {PERIOD_OPTIONS.map((option) => (
                <ObjectiveOptionCard
                  key={option}
                  {...PERIOD_VISUAL[option]}
                  align="center"
                  label={CICLO_PERIOD_LABELS[option]}
                  tagline={PERIOD_DAYS[option]}
                  isSelected={draft.period === option}
                  onClick={() => applyPeriod(option)}
                  hasError={Boolean(periodError)}
                  className="min-h-[92px] p-2.5"
                />
              ))}
            </div>
            <StepError message={periodError} />
          </GuidedStep>
        )}

        {isRevealed(STEP_DATES) && (
          <GuidedStep
            number={stepNumber(STEP_DATES)}
            question="¿Entre qué fechas corre?"
            help="El cierre sale del periodo que elegiste. Si lo mueves a mano, el periodo pasa a ser una referencia."
          >
            <DualDateRangePicker
              startDate={parseISODate(draft.startDate)}
              endDate={parseISODate(draft.endDate)}
              startLabel="Fecha de inicio"
              endLabel="Fecha de cierre"
              startError={startDateError}
              endError={endDateError}
              locale="es"
              onChange={handleDateChange}
              autoCloseOnStartSelect={isPresetPeriod}
            />

            {isPresetPeriod && draft.startDate !== "" && (
              <p className="mt-2 flex items-start gap-2 text-[12px] leading-relaxed text-text-secondary">
                <CalendarRange className="mt-px size-3.5 shrink-0 text-primary" strokeWidth={2} />
                Calculamos el cierre a partir del periodo{" "}
                <span className="font-semibold text-text-primary">
                  {CICLO_PERIOD_LABELS[draft.period!].toLowerCase()}
                </span>
                . Si lo cambias a mano, el periodo pasa a ser una referencia.
              </p>
            )}

            <aside className="mt-4 flex items-start gap-3 rounded-xl border border-border/60 bg-surface-muted/50 px-4 py-3">
              <Info className="mt-0.5 size-4 shrink-0 text-text-secondary" strokeWidth={2} />
              <p className="text-[12px] leading-relaxed text-text-secondary">
                Un ciclo puede agrupar varios objetivos, para varias personas o grupos.
                En los siguientes pasos eliges quién entra, defines los objetivos de la
                empresa y luego los que se asignan.
              </p>
            </aside>
          </GuidedStep>
        )}
      </div>
    </section>
  );
}

/** El error del paso, bajo su control. `GuidedStep` no tiene ranura propia
 *  para esto: la pregunta ya dice qué se pide, el error dice qué falta. */
function StepError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="mt-1.5 block text-[12px] text-destructive">{message}</span>;
}
