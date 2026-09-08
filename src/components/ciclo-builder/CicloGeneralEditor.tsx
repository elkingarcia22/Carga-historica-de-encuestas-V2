import { CalendarRange, Info } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { CicloField } from "./CicloField";
import { ObjectiveOptionCard } from "./ObjectiveOptionCard";
import { OBJECTIVE_CREATOR_VISUAL, PERIOD_VISUAL } from "./measureVisual";

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

/**
 * The ciclo's own settings: what it is called, how long it runs and what it is
 * for. Nobody being measured ever reads this form — it is the frame the
 * objectives are hung inside.
 */
export function CicloGeneralEditor({
  draft,
  onChange,
  showValidation = false,
}: CicloGeneralEditorProps) {
  const hasInvalidRange =
    draft.startDate !== "" && draft.endDate !== "" && draft.endDate < draft.startDate;

  const nameError =
    showValidation && draft.name.trim() === "" ? REQUIRED_FIELD_HINT : undefined;
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
          period: "personalizado"
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
  const handleCreatorChange = (objectiveCreator: CicloObjectiveCreator) => {
    if (objectiveCreator === "hr") {
      onChange({ objectiveCreator });
      return;
    }
    onChange({
      objectiveCreator,
      participants: {
        ...draft.participants,
        mode: PARTICIPANT_MODES_BY_CREATOR[objectiveCreator][0],
        groupSegmentBy: objectiveCreator === "leader" ? "leader" : draft.participants.groupSegmentBy,
      },
    });
  };

  return (
    <section className="flex min-w-0 flex-1 flex-col self-start rounded-2xl border border-border/60 bg-surface p-6 shadow-card">
      <header className="mb-5 flex flex-col gap-1.5">
        <h2 className="text-[16px] font-bold tracking-tight text-text-primary">
          Crear ciclo de objetivos
        </h2>
        <p className="text-[13px] text-text-secondary">
          Nombre, periodo y fechas de cumplimiento.
        </p>
      </header>

      <div className="flex flex-col gap-5">
        <CicloField label="Nombre del ciclo" required error={nameError}>
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
        </CicloField>

        {/* Quién escribe los objetivos decide el resto del recorrido: RH se
            salta por completo el paso de participantes, y un líder o un
            colaborador ven ese paso con sus cards en un orden distinto —
            ver `PARTICIPANT_MODES_BY_CREATOR`. */}
        <CicloField
          label="¿Quién va a crear los objetivos?"
          required
          hint="Esto decide si te pedimos elegir participantes, y en qué orden te mostramos las formas de elegirlos."
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
        </CicloField>

        {/* A row of pills rather than a dropdown: there are six options, they
            are mutually exclusive, and picking one has a visible side effect on
            the dates below — worth seeing all at once. */}
        <CicloField
          label="Periodo de tiempo"
          required
          error={periodError}
          hint="Al elegir un periodo calculamos la fecha de cierre por ti. Siempre puedes ajustarla."
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
        </CicloField>

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
          <p className="-mt-2 flex items-start gap-2 text-[12px] leading-relaxed text-text-secondary">
            <CalendarRange className="mt-px size-3.5 shrink-0 text-primary" strokeWidth={2} />
            Calculamos el cierre a partir del periodo{" "}
            <span className="font-semibold text-text-primary">
              {CICLO_PERIOD_LABELS[draft.period!].toLowerCase()}
            </span>
            . Si lo cambias a mano, el periodo pasa a ser una referencia.
          </p>
        )}

        <CicloField
          label="Descripción"
          hint={`Opcional. Máximo ${MAX_CICLO_DESCRIPTION_LENGTH} caracteres.`}
        >
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
            className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2.5 text-[13px] leading-relaxed text-text-primary outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/25 placeholder:text-muted-foreground/70"
          />
        </CicloField>

        <aside className="flex items-start gap-3 rounded-xl border border-border/60 bg-surface-muted/50 px-4 py-3">
          <Info className="mt-0.5 size-4 shrink-0 text-text-secondary" strokeWidth={2} />
          <p className="text-[12px] leading-relaxed text-text-secondary">
            Un ciclo puede agrupar varios objetivos, para varias personas o grupos.
            En los siguientes pasos eliges quién entra, defines los objetivos de la
            empresa y luego los que se asignan.
          </p>
        </aside>
      </div>
    </section>
  );
}
