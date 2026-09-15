import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/status-badge";
import { FilterSortHeader, SortOnlyHeader } from "@/components/data-display/TableHeaderControls";
import type { TableColumnCells, TableColumnSpec } from "@/components/data-display/table-config";
import { useAnimatedValue } from "@/lib/useAnimatedValue";
import type { CicloRow } from "@/mocks/ciclos";
import { CICLO_ESTADOS, CICLO_PERIODOS } from "@/mocks/ciclos";
import { CicloDateCell } from "./CicloDateCell";
import { CICLO_ACTIONS_BY_ESTADO } from "./cicloListActions";
import { parseCicloDate, startOfToday } from "./cicloListDates";
import {
  CLOSE_BUCKETS,
  PROGRESS_BUCKETS,
  mapEstadoToStatusState,
  type CicloListFilters,
} from "./cicloListFilters";

/**
 * Las columnas de la lista de ciclos del home, fuera de la pantalla que las
 * pinta.
 *
 * La pantalla ya lleva dos tablas, el rail, los diálogos y los filtros: meter
 * ahí dentro el encabezado y la celda de cada columna la volvía ilegible. Aquí
 * cada columna se dice una sola vez —su título y su dato juntos— y la pantalla
 * solo decide en qué orden salen.
 */

export const CICLOS_COLUMNS: readonly TableColumnSpec[] = [
  { id: "seleccion", label: "Selección", fixed: true },
  { id: "nombre", label: "Nombre" },
  { id: "periodo", label: "Periodo" },
  { id: "fechaInicio", label: "Fecha inicio" },
  { id: "fechaCierre", label: "Fecha cierre" },
  { id: "estado", label: "Estado" },
  { id: "numObjetivos", label: "# objetivos" },
  { id: "avance", label: "Avance" },
];

/**
 * El avance de un ciclo: la barra lo llena, la cifra lo dice.
 *
 * La barra se topa en 100 % y la cifra no —un ciclo puede pasarse ("125 %"), y
 * una barra que creciera más allá de su carril rompería la columna—, así que
 * lo que se pasa se cuenta con palabras.
 */
export function CicloAvanceCell({ progreso, avance }: { progreso: number; avance: string }) {
  const animated = useAnimatedValue(progreso, 1000);
  return (
    <div className="flex items-center justify-end gap-3">
      <Progress
        value={Math.min(animated, 100)}
        className="h-1.5 w-28 shrink-0 [&>div]:transition-none"
      />
      <span className="min-w-[52px] text-right text-[12px] font-medium tabular-nums text-text-secondary">
        {avance}
      </span>
    </div>
  );
}

export interface CiclosCellsDeps {
  sortKey: string;
  onSort: (key: string) => void;
  filters: CicloListFilters;
  onToggleFilter: (key: keyof CicloListFilters, value: string) => void;
  onClearFilter: (key: keyof CicloListFilters) => void;
  /** La fila cuya fecha de cierre se está cambiando en sitio, si hay alguna. */
  dateEditCicloId: string | null;
  onSaveCloseDate: (ciclo: CicloRow, date: Date) => void;
  onCancelCloseDate: () => void;
  /** Abrir el ciclo: al constructor si es borrador, a resultados si no. */
  onOpenCiclo: (ciclo: CicloRow) => void;
}

export function ciclosTableCells(deps: CiclosCellsDeps): TableColumnCells<CicloRow> {
  const {
    sortKey,
    onSort,
    filters,
    onToggleFilter,
    onClearFilter,
    dateEditCicloId,
    onSaveCloseDate,
    onCancelCloseDate,
    onOpenCiclo,
  } = deps;

  const textCell = "py-3 px-4 text-text-secondary text-[13px]";

  return {
    nombre: {
      head: (
        <SortOnlyHeader
          label="Nombre"
          sortActive={sortKey === "nombre"}
          onSort={() => onSort("nombre")}
        />
      ),
      cellClassName: "py-3 px-4 font-bold text-[13px]",
      cell: (ciclo) => (
        <button
          onClick={(event) => {
            event.stopPropagation();
            onOpenCiclo(ciclo);
          }}
          // Un ciclo sin resultados que leer y que no es borrador no lleva a
          // ninguna parte: su nombre se queda como texto.
          disabled={
            dateEditCicloId === ciclo.id ||
            (!CICLO_ACTIONS_BY_ESTADO[ciclo.estado]?.includes("results") &&
              ciclo.estado !== "Borrador")
          }
          className="text-left text-text-primary transition-colors hover:text-primary hover:underline disabled:cursor-default disabled:no-underline disabled:hover:text-text-primary"
        >
          {ciclo.nombre}
        </button>
      ),
    },

    periodo: {
      head: (
        <FilterSortHeader
          label="Periodo"
          options={CICLO_PERIODOS}
          selected={new Set(filters.periodo)}
          onToggleFilter={(value) => onToggleFilter("periodo", value)}
          onClearFilter={() => onClearFilter("periodo")}
          sortActive={sortKey === "periodo"}
          onSort={() => onSort("periodo")}
        />
      ),
      cellClassName: textCell,
      cell: (ciclo) => ciclo.periodo,
    },

    fechaInicio: {
      head: (
        <SortOnlyHeader
          label="Fecha inicio"
          sortActive={sortKey === "fechaInicio"}
          onSort={() => onSort("fechaInicio")}
        />
      ),
      cellClassName: textCell,
      cell: (ciclo) => ciclo.fechaInicio,
    },

    fechaCierre: {
      head: (
        <FilterSortHeader
          label="Fecha cierre"
          options={CLOSE_BUCKETS}
          selected={new Set(filters.close)}
          onToggleFilter={(value) => onToggleFilter("close", value)}
          onClearFilter={() => onClearFilter("close")}
          sortActive={sortKey === "fechaCierre"}
          onSort={() => onSort("fechaCierre")}
        />
      ),
      cellClassName: "px-4 py-3 text-text-secondary text-[13px]",
      cell: (ciclo) => {
        if (dateEditCicloId !== ciclo.id) return ciclo.fechaCierre;
        // Un ciclo no puede cerrar antes de empezar, ni en el pasado.
        const today = startOfToday();
        const start = parseCicloDate(ciclo.fechaInicio);
        return (
          <CicloDateCell
            value={ciclo.fechaCierre}
            minDate={start && start > today ? start : today}
            onCancel={onCancelCloseDate}
            onSave={(date) => onSaveCloseDate(ciclo, date)}
          />
        );
      },
    },

    estado: {
      head: (
        <FilterSortHeader
          label="Estado"
          options={CICLO_ESTADOS}
          selected={new Set(filters.estado)}
          onToggleFilter={(value) => onToggleFilter("estado", value)}
          onClearFilter={() => onClearFilter("estado")}
          sortActive={sortKey === "estado"}
          onSort={() => onSort("estado")}
        />
      ),
      cellClassName: "py-3 px-4",
      cell: (ciclo) => (
        <StatusBadge
          state={mapEstadoToStatusState(ciclo.estado)}
          labels={{ [mapEstadoToStatusState(ciclo.estado)]: ciclo.estado }}
        />
      ),
    },

    numObjetivos: {
      // Ni se ordena ni se filtra: es el recuento que acompaña al nombre.
      head: (
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          # objetivos
        </span>
      ),
      cellClassName: textCell,
      cell: (ciclo) => ciclo.numObjetivos,
    },

    avance: {
      headClassName: "w-[200px]",
      head: (
        <FilterSortHeader
          label="Avance"
          options={PROGRESS_BUCKETS}
          selected={new Set(filters.progress)}
          onToggleFilter={(value) => onToggleFilter("progress", value)}
          onClearFilter={() => onClearFilter("progress")}
          sortActive={sortKey === "progreso"}
          onSort={() => onSort("progreso")}
          align="right"
        />
      ),
      cellClassName: "py-3 px-4",
      cell: (ciclo) => <CicloAvanceCell progreso={ciclo.progreso} avance={ciclo.avance} />,
    },
  };
}
