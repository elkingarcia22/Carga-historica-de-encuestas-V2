import * as React from "react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ConfigurableHeaderCells,
  ConfigurableRowCells,
  HeaderSelectAllCheckbox,
  LazyRowsSentinel,
  LazyRowsSummary,
  TableBleedBox,
  TableConfigButton,
  useColumnDrag,
  useLazyRows,
  useTableConfig,
} from "@/components/data-display";
import type { ObjectiveSetKind } from "./cicloBuilderTypes";
import type { AssignmentRow } from "./assignmentRows";
import { assignmentColumns, assignmentTableCells } from "./assignmentTableColumns";

export interface AssignmentRowsTableProps {
  kind: ObjectiveSetKind;
  rows: readonly AssignmentRow[];
  showValidation: boolean;
  selectedRowIds: ReadonlySet<string>;
  onToggleRow: (rowId: string) => void;
  /** Marca o desmarca la lista entera desde la casilla del encabezado. */
  onSetSelection: (rowIds: readonly string[], selected: boolean) => void;
}

/**
 * La lista de corrido: todos los grupos, o todas las personas, en una tabla.
 *
 * La otra vista agrupa por quién comparte objetivos, que es la forma correcta
 * de *editar*; esta es la forma correcta de *buscar*. Son la misma selección
 * —marcar aquí es marcar allá— y las acciones siguen estando en la barra
 * flotante, así que cambiar de vista nunca pierde lo que ya estaba marcado.
 */
export function AssignmentRowsTable({
  kind,
  rows,
  showValidation,
  selectedRowIds,
  onToggleRow,
  onSetSelection,
}: AssignmentRowsTableProps) {
  const isGroup = kind === "grupal";
  const noun = isGroup ? "grupos" : "personas";
  const columns = React.useMemo(() => assignmentColumns(kind), [kind]);
  const config = useTableConfig(`constructor-asignaciones-${kind}`, columns);
  const drag = useColumnDrag({ axis: "x", onReorder: config.moveColumn });
  const lazy = useLazyRows({ total: rows.length, enabled: config.isLazy, step: 25, resetKey: rows });
  const shown = config.isLazy ? rows.slice(0, lazy.count) : rows;
  const cells = React.useMemo(
    () => assignmentTableCells(kind, showValidation),
    [kind, showValidation]
  );

  const allIds = React.useMemo(() => rows.map((row) => row.id), [rows]);
  const selectedHere = allIds.filter((id) => selectedRowIds.has(id)).length;
  const headerState: boolean | "indeterminate" =
    selectedHere === 0 ? false : selectedHere === allIds.length ? true : "indeterminate";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <TableConfigButton config={config} noun={noun} />
      </div>

      <TableBleedBox bleed="-mx-6">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-[52px] pl-6 pr-0">
                <HeaderSelectAllCheckbox
                  state={headerState}
                  disabled={allIds.length === 0}
                  onSelectAll={() => onSetSelection(allIds, true)}
                  onDeselectAll={() => onSetSelection(allIds, false)}
                  align="start"
                  label={`Seleccionar ${isGroup ? "todos los grupos" : "todas las personas"}`}
                />
              </TableHead>
              <ConfigurableHeaderCells
                config={config}
                drag={drag}
                cells={cells}
                className="px-4 py-3 text-[11.5px] font-bold uppercase tracking-wide text-text-secondary"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((row) => {
              const selected = selectedRowIds.has(row.id);
              return (
                <TableRow
                  key={row.id}
                  data-state={selected ? "selected" : undefined}
                  onClick={() => onToggleRow(row.id)}
                  className={cn(
                    "cursor-pointer border-border/60 transition-colors",
                    selected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30"
                  )}
                >
                  <TableCell className="py-3 pl-6 pr-0" onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => onToggleRow(row.id)}
                      aria-label={`Seleccionar ${row.label}`}
                    />
                  </TableCell>
                  <ConfigurableRowCells
                    config={config}
                    cells={cells}
                    row={row}
                    className="px-4 py-3 align-middle"
                  />
                </TableRow>
              );
            })}
            <LazyRowsSentinel lazy={lazy} colSpan={config.columns.length + 1} noun={noun} />
          </TableBody>
        </Table>
      </TableBleedBox>

      {config.isLazy && (
        <LazyRowsSummary lazy={lazy} total={rows.length} noun={noun} className="self-end" />
      )}
    </div>
  );
}
