import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/status-badge";
import {
  FilterSortHeader,
  SortOnlyHeader,
  type TableColumnCells,
  type TableColumnSpec,
} from "@/components/data-display";
import { useAnimatedValue } from "@/lib/useAnimatedValue";
import { CLOSE_BUCKETS, PROGRESS_BUCKETS, type SurveyListFilters } from "./surveyListFilters";
import { SurveyDateCell, type DateEditMode } from "./SurveyDateCell";
import { parseSurveyDate, startOfToday } from "./surveyListDates";
import {
  mapVariantToState,
  statusVariant,
  type SurveyListRow,
  type SurveySortKey,
} from "./surveyListRows";

/**
 * Las columnas de la lista de encuestas, fuera del componente que las pinta.
 *
 * Cada columna se dice una sola vez —su título y su dato juntos— y la tabla
 * solo decide en qué orden salen. Lo que depende de la fila que se está
 * editando se resuelve aquí leyendo `dateEdit`, en vez de bajar media docena
 * de banderas hasta la fila.
 */

export interface SurveyCellsDeps {
  /** `null` mientras nadie ha ordenado: ninguna columna sale marcada. */
  sort: { key: SurveySortKey | null; ascending: boolean };
  toggleSort: (key: SurveySortKey) => void;
  filters: SurveyListFilters;
  toggleColumn: (key: keyof SurveyListFilters, value: string) => void;
  clearColumn: (key: keyof SurveyListFilters) => void;
  availableTypes: readonly string[];
  availableStatuses: readonly string[];
  /** La fila con una fecha abierta, si hay alguna. */
  dateEdit: { surveyId: string; mode: DateEditMode } | null | undefined;
  onOpenSurvey: (id: string) => void;
  onDateEditStart?: (id: string, mode: DateEditMode) => void;
  onDateEditSave?: (id: string, date: Date) => void;
  onDateEditCancel?: () => void;
}

export const SURVEY_COLUMNS: readonly TableColumnSpec[] = [
  { id: "seleccion", label: "Selección", fixed: true },
  { id: "name", label: "Nombre" },
  { id: "type", label: "Tipo" },
  { id: "status", label: "Estado" },
  { id: "startDate", label: "Inicio" },
  { id: "endDate", label: "Cierre" },
  { id: "participants", label: "Participantes" },
  { id: "progress", label: "Avance" },
];


/**
 * El suelo de la fecha de cierre: una encuesta no puede cerrar antes de
 * abrirse, ni en el pasado mientras siga recogiendo. Reabrir va más lejos —un
 * cierre "hoy" la abriría y la cerraría de una vez—, así que el primer día
 * útil es mañana.
 */
function closeDateFloorOf(survey: SurveyListRow, mode: DateEditMode): Date {
  const today = startOfToday();
  if (mode === "reopen") {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }
  const start = parseSurveyDate(survey.startDate);
  return start && start > today ? start : today;
}

/** El avance de una encuesta, con su propia animación de llegada. */
function SurveyProgressCell({ progress }: { progress: number }) {
  const animated = useAnimatedValue(progress, 1000);
  return (
    <div className="flex items-center justify-end gap-3">
      <Progress value={animated} className="h-1.5 w-32 shrink-0 [&>div]:transition-none" />
      <span className="min-w-[44px] text-right text-[12px] tabular-nums text-text-secondary">
        {Math.round(animated)}%
      </span>
    </div>
  );
}



/**
 * Cada columna dicha una sola vez: su encabezado y su celda.
 *
 * Lo que depende de la fila que se está editando —qué celda se convierte en
 * calendario, qué botones se apagan— se resuelve aquí dentro leyendo
 * `dateEdit`, en vez de bajar media docena de banderas hasta la fila.
 */
export function surveyTableCells(deps: SurveyCellsDeps): TableColumnCells<SurveyListRow> {
  const {
    sort,
    toggleSort,
    filters,
    toggleColumn,
    clearColumn,
    availableTypes,
    availableStatuses,
    dateEdit,
    onOpenSurvey,
    onDateEditStart,
    onDateEditSave,
    onDateEditCancel,
  } = deps;

  return {
  name: {
    // Sin embudo: cada nombre es único, así que una lista de casillas con
    // todos sería la tabla otra vez. Para eso está el buscador.
    headClassName: "w-[30%] px-0 py-3.5",
    head: (
      <SortOnlyHeader
        label="Nombre"
        sortActive={sort.key === "name"}
        onSort={() => toggleSort("name")}
      />
    ),
    cellClassName: "py-3",
    cell: (survey) => (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onOpenSurvey(survey.id);
        }}
        // Navigating away mid-edit would silently drop the date being picked.
        disabled={dateEdit?.surveyId === survey.id}
        className="truncate text-left text-[13px] font-semibold text-text-primary transition-colors hover:text-primary hover:underline disabled:cursor-default disabled:no-underline disabled:hover:text-text-primary"
      >
        {survey.name}
      </button>
    ),
  },
  type: {
    headClassName: "w-[13%] px-0 py-3.5",
    head: (
      <FilterSortHeader
        label="Tipo"
        options={availableTypes}
        selected={new Set(filters.type)}
        onToggleFilter={(value) => toggleColumn("type", value)}
        onClearFilter={() => clearColumn("type")}
        sortActive={sort.key === "type"}
        onSort={() => toggleSort("type")}
      />
    ),
    cellClassName: "py-3 text-[13px] text-muted-foreground",
    cell: (survey) => <span className="block truncate">{survey.type}</span>,
  },
  status: {
    headClassName: "w-[14%] px-0 py-3.5",
    head: (
      <FilterSortHeader
        label="Estado"
        options={availableStatuses}
        selected={new Set(filters.status)}
        onToggleFilter={(value) => toggleColumn("status", value)}
        onClearFilter={() => clearColumn("status")}
        sortActive={sort.key === "status"}
        onSort={() => toggleSort("status")}
      />
    ),
    cellClassName: "py-3",
    cell: (survey) => (
      <StatusBadge
        state={mapVariantToState(statusVariant(survey))}
        labels={{ [mapVariantToState(statusVariant(survey))]: survey.status }}
      />
    ),
  },
  startDate: {
    headClassName: "w-[110px] px-2 py-3.5",
    head: (
      <SortOnlyHeader
        label="Inicio"
        sortActive={sort.key === "startDate"}
        onSort={() => toggleSort("startDate")}
      />
    ),
    cellClassName: "px-2 py-3 text-[13px] tabular-nums text-muted-foreground",
    cell: (survey) => {
      const mode = dateEdit?.surveyId === survey.id ? dateEdit.mode : null;
      if (mode === "editStartDate") {
        return (
          <SurveyDateCell
            value={survey.startDate}
            mode={mode}
            minDate={new Date(0)}
            onSave={(date) => onDateEditSave?.(survey.id, date)}
            onCancel={() => onDateEditCancel?.()}
          />
        );
      }
      return (
        <button
          type="button"
          className="w-full rounded text-left outline-none transition-colors hover:text-primary focus-visible:ring-1 focus-visible:ring-primary disabled:pointer-events-none"
          onClick={(event) => {
            event.stopPropagation();
            onDateEditStart?.(survey.id, "editStartDate");
          }}
          disabled={mode !== null}
        >
          {survey.startDate}
        </button>
      );
    },
  },
  endDate: {
    headClassName: "w-[110px] px-2 py-3.5",
    head: (
      <FilterSortHeader
        label="Cierre"
        options={CLOSE_BUCKETS}
        selected={new Set(filters.close)}
        onToggleFilter={(value) => toggleColumn("close", value)}
        onClearFilter={() => clearColumn("close")}
        sortActive={sort.key === "endDate"}
        onSort={() => toggleSort("endDate")}
      />
    ),
    cellClassName: "px-2 py-3 text-[13px] tabular-nums text-muted-foreground",
    cell: (survey) => {
      const mode = dateEdit?.surveyId === survey.id ? dateEdit.mode : null;
      if (mode === "editEndDate" || mode === "reopen" || mode === "editDates") {
        return (
          <SurveyDateCell
            value={survey.endDate}
            mode={mode}
            minDate={closeDateFloorOf(survey, mode)}
            onSave={(date) => onDateEditSave?.(survey.id, date)}
            onCancel={() => onDateEditCancel?.()}
          />
        );
      }
      return (
        <button
          type="button"
          className="w-full rounded text-left outline-none transition-colors hover:text-primary focus-visible:ring-1 focus-visible:ring-primary disabled:pointer-events-none"
          onClick={(event) => {
            event.stopPropagation();
            onDateEditStart?.(survey.id, "editEndDate");
          }}
          disabled={mode !== null}
        >
          {survey.endDate}
        </button>
      );
    },
  },
  participants: {
    headClassName: "w-[90px] px-2 py-3.5 text-right",
    head: (
      <SortOnlyHeader
        label="Part."
        sortActive={sort.key === "participants"}
        onSort={() => toggleSort("participants")}
        align="right"
      />
    ),
    cellClassName: "px-2 py-3 text-right text-[13px] font-semibold tabular-nums text-text-primary",
    cell: (survey) => survey.participants,
  },
  progress: {
    headClassName: "w-[220px] py-3.5 pl-0 pr-7",
    head: (
      <FilterSortHeader
        label="Avance"
        options={PROGRESS_BUCKETS}
        selected={new Set(filters.progress)}
        onToggleFilter={(value) => toggleColumn("progress", value)}
        onClearFilter={() => clearColumn("progress")}
        sortActive={sort.key === "progress"}
        onSort={() => toggleSort("progress")}
        align="right"
      />
    ),
    cellClassName: "w-[220px] py-3 pr-7",
    cell: (survey) => <SurveyProgressCell progress={survey.progress} />,
  },
  };
}
