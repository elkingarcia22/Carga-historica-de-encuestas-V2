import { ListChecks, UserRound, UsersRound } from "lucide-react";
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

export function assignmentTableCells(
  kind: ObjectiveSetKind,
  showValidation: boolean
): TableColumnCells<AssignmentRow> {
  const isGroup = kind === "grupal";
  const Icon = isGroup ? UsersRound : UserRound;

  return {
    destinatario: {
      headClassName: "min-w-[220px]",
      head: isGroup ? "Grupo" : "Persona",
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
      head: "Agrupación",
      cell: (row) => <AssignmentOriginTag summary={row.summary} />,
    },
    objetivos: {
      headClassName: "w-[120px]",
      head: "Objetivos",
      cell: (row) => (
        <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-text-secondary">
          <ListChecks className="size-3.5 text-text-muted" strokeWidth={2} />
          <span className="tabular-nums">{row.summary.set.objectives.length}</span>
        </span>
      ),
    },
    peso: {
      headClassName: "w-[180px]",
      head: "Peso repartido",
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
      head: "Estado",
      cell: (row) => (
        <AssignmentStatusPill issue={row.summary.issue} showValidation={showValidation} />
      ),
    },
  };
}
