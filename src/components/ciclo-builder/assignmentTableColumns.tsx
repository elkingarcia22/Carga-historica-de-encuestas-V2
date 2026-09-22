import { ListChecks, UserRound, UsersRound } from "lucide-react";
import { FilterMenu, SortableHeader, type SortDir, type SortKey } from "@/components/survey-builder/CollaboratorTableParts";
import type { TableColumnCells, TableColumnSpec } from "@/components/data-display";
import type { ObjectiveSetKind } from "./cicloBuilderTypes";
import type { AssignmentRow } from "./assignmentRows";
import {
  AssignmentOriginTag,
  AssignmentStatusPill,
  AssignmentWeightMeter,
} from "./assignmentPieces";

/**
 * Las columnas de la vista en lista: un grupo (o una persona) por fila, sin
 * acordeón de por medio.
 *
 * Es la lectura que el acordeón no da: "¿está Marketing en el ciclo, y con
 * cuántos objetivos?" no debería obligar a abrir agrupaciones hasta
 * encontrarlo. A cambio pierde el agrupamiento, así que la agrupación de la
 * que viene cada fila es una columna más —con cuántos la comparte incluido—,
 * porque sigue siendo lo que decide a quién le cambia el objetivo una edición.
 */

export const assignmentColumns = (kind: ObjectiveSetKind): readonly TableColumnSpec[] => [
  { id: "seleccion", label: "Selección", fixed: true },
  { id: "destinatario", label: kind === "grupal" ? "Grupo" : "Persona" },
  { id: "agrupacion", label: "Agrupación" },
  { id: "objetivos", label: "Objetivos" },
  { id: "peso", label: "Peso repartido" },
  { id: "estado", label: "Estado" },
];


export type AssignmentSortKey = "destinatario" | "objetivos" | "peso";

export interface AssignmentCellsDeps {
  sortKey: AssignmentSortKey | null;
  sortDir: SortDir;
  onToggleSort: (key: AssignmentSortKey) => void;
  agrupaciones: readonly string[];
  agrupacionFilter: ReadonlySet<string>;
  onToggleAgrupacion: (value: string) => void;
  onClearAgrupacion: () => void;
  estados: readonly string[];
  estadoFilter: ReadonlySet<string>;
  onToggleEstado: (value: string) => void;
  onClearEstado: () => void;
}

export function assignmentTableCells(
  kind: ObjectiveSetKind,
  showValidation: boolean,
  deps: AssignmentCellsDeps
): TableColumnCells<AssignmentRow> {
  const isGroup = kind === "grupal";
  const Icon = isGroup ? UsersRound : UserRound;

  return {
    destinatario: {
      headClassName: "min-w-[220px]",
      head: (
        <SortableHeader
          label={isGroup ? "Grupo" : "Persona"}
          active={deps.sortKey === "destinatario"}
          direction={deps.sortDir}
          onToggle={() => deps.onToggleSort("destinatario")}
        />
      ),
      cell: (row) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            <Icon className="size-4" strokeWidth={2.2} />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[13px] font-bold text-text-primary">{row.label}</span>
            <span className="truncate text-[11px] font-medium text-text-muted">{row.hint}</span>
          </span>
        </span>
      ),
    },
    agrupacion: {
      headClassName: "min-w-[170px]",
      head: (
        <FilterMenu
          label="Agrupación"
          options={deps.agrupaciones}
          selected={deps.agrupacionFilter}
          onToggle={deps.onToggleAgrupacion}
          onClear={deps.onClearAgrupacion}
        />
      ),
      cell: (row) => <AssignmentOriginTag summary={row.summary} />,
    },
    objetivos: {
      headClassName: "w-[120px]",
      head: (
        <SortableHeader
          label="Objetivos"
          active={deps.sortKey === "objetivos"}
          direction={deps.sortDir}
          onToggle={() => deps.onToggleSort("objetivos")}
        />
      ),
      cell: (row) => (
        <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-text-secondary">
          <ListChecks className="size-3.5 text-text-muted" strokeWidth={2} />
          <span className="tabular-nums">{row.summary.set.objectives.length}</span>
        </span>
      ),
    },
    peso: {
      headClassName: "w-[180px]",
      head: (
        <SortableHeader
          label="Peso repartido"
          active={deps.sortKey === "peso"}
          direction={deps.sortDir}
          onToggle={() => deps.onToggleSort("peso")}
        />
      ),
      cell: (row) => (
        <AssignmentWeightMeter
          weight={row.summary.weight}
          budget={row.summary.budget}
          showValidation={showValidation}
        />
      ),
    },
    estado: {
      headClassName: "min-w-[150px]",
      head: (
        <FilterMenu
          label="Estado"
          options={deps.estados}
          selected={deps.estadoFilter}
          onToggle={deps.onToggleEstado}
          onClear={deps.onClearEstado}
        />
      ),
      cell: (row) => (
        <AssignmentStatusPill issue={row.summary.issue} showValidation={showValidation} />
      ),
    },
  };
}
