import * as React from "react";
import { cn } from "@/lib/utils";
import { TableCell } from "@/components/ui/table";
import { DraggableHeaderCell } from "./DraggableHeaderCell";
import type { TableConfig } from "./useTableConfig";
import type { ColumnDrag } from "./useColumnDrag";
import type { TableColumnCells } from "./tableConfigTypes";

/**
 * Los dos fragmentos que convierten una lista de columnas en tabla: la fila
 * de encabezados y las celdas de una fila.
 *
 * Están aquí y no copiados en cada tabla porque son exactamente lo mismo en
 * todas —recorrer `config.columns` y sacar su mitad del diccionario—, y ese
 * recorrido es el único sitio donde el orden se aplica de verdad. Una tabla
 * que lo escribiera por su cuenta podría olvidarse de las columnas ocultas o
 * de las fijadas.
 *
 * La columna fija —la casilla de selección— no pasa por aquí: se pinta antes,
 * a mano, porque no se mueve ni se oculta. Y se va por debajo de las fijadas
 * como cualquier otra: quien fija "Colaborador" quiere ver el nombre, no la
 * casilla.
 */

/**
 * Lee lo que mide cada columna de la fila de encabezados.
 *
 * Del DOM y no de las clases porque los anchos son porcentajes —`w-[30%]`,
 * `w-[11rem]`— y hasta que la tabla no está puesta nadie sabe cuántos píxeles
 * son. Es lo que permite que dos columnas fijadas se apilen en vez de taparse.
 */
function readWidths(row: HTMLElement): Record<string, number> {
  const widths: Record<string, number> = {};
  row.querySelectorAll<HTMLElement>("[data-col-id]").forEach((cell) => {
    const id = cell.dataset.colId;
    if (id) widths[id] = cell.getBoundingClientRect().width;
  });
  return widths;
}

export function ConfigurableHeaderCells<T>({
  config,
  drag,
  cells,
  className,
}: {
  config: TableConfig;
  drag: ColumnDrag;
  cells: TableColumnCells<T>;
  /** Lo que la tabla pone en todos sus encabezados. */
  className?: string;
}) {
  const { reportWidths } = config;

  /*
   * Va en el primer encabezado y mide desde su `<tr>`: un fragmento no tiene
   * nodo propio al que agarrarse. Se remide cuando la fila cambia de ancho
   * —al abrir el rail, al cambiar de ventana— para que las fijadas sigan
   * apiladas donde toca.
   */
  const measure = React.useCallback(
    (node: HTMLElement | null) => {
      const row = node?.parentElement;
      if (!row) return;
      const update = () => reportWidths(readWidths(row));
      update();
      const observer = new ResizeObserver(update);
      observer.observe(row);
      return () => observer.disconnect();
    },
    [reportWidths]
  );

  return (
    <>
      {config.columns.map((column, index) => {
        const left = config.pinnedOffset(column.id);
        return (
          <DraggableHeaderCell
            key={column.id}
            column={column}
            drag={drag}
            data-col-id={column.id}
            pinned={left !== undefined}
            ref={index === 0 ? measure : undefined}
            style={left === undefined ? undefined : { left }}
            className={cn(
              className,
              cells[column.id]?.headClassName,
              left !== undefined && "table-pinned-head"
            )}
          >
            {cells[column.id]?.head}
          </DraggableHeaderCell>
        );
      })}
    </>
  );
}

export function ConfigurableRowCells<T>({
  config,
  cells,
  row,
  className,
}: {
  config: TableConfig;
  cells: TableColumnCells<T>;
  row: T;
  /** Lo que la tabla pone en todas sus celdas. */
  className?: string;
}) {
  return (
    <>
      {config.columns.map((column) => {
        const left = config.pinnedOffset(column.id);
        return (
          <TableCell
            key={column.id}
            style={left === undefined ? undefined : { left }}
            className={cn(
              className,
              cells[column.id]?.cellClassName,
              left !== undefined && "sticky z-[1] table-pinned-cell"
            )}
          >
            {cells[column.id]?.cell(row)}
          </TableCell>
        );
      })}
    </>
  );
}
