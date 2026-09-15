import * as React from "react";
import { GripHorizontal, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { TableHead } from "@/components/ui/table";
import type { ColumnDrag } from "./useColumnDrag";
import type { TableColumnSpec } from "./tableConfigTypes";

/**
 * Un encabezado que se puede agarrar y mover a otro sitio de la fila.
 *
 * El tirador aparece al pasar por encima, pegado al borde superior de la
 * celda: no ocupa sitio en reposo —así ninguna columna se angosta por llevar
 * un asa— y no le disputa el clic a los botones de ordenar y filtrar que ya
 * viven dentro del encabezado.
 *
 * La guía de dónde caería la columna es una línea en el borde por el que se
 * va a soltar, no un hueco que se abre: abrir hueco obliga a recalcular el
 * ancho de toda la tabla en cada píxel del arrastre.
 */
export function DraggableHeaderCell({
  column,
  drag,
  pinned = false,
  className,
  children,
  ref,
  ...props
}: {
  column: TableColumnSpec;
  drag: ColumnDrag;
  /** Cierto cuando la columna está fijada: lo dice con una chincheta. */
  pinned?: boolean;
  className?: string;
  children?: React.ReactNode;
} & Omit<React.ComponentProps<"th">, "children">) {
  const side = drag.dropSideFor(column.id);
  const isDragging = drag.draggingId === column.id;

  return (
    <TableHead
      {...props}
      ref={ref}
      data-drag-cell=""
      {...drag.dropTargetProps(column.id)}
      className={cn(
        // `sticky` en vez de `relative` cuando está fijada: las dos posicionan,
        // así que el tirador y la guía de arrastre siguen anclados a la celda.
        "group select-none",
        pinned ? "sticky z-[1]" : "relative",
        isDragging && "opacity-40",
        side === "before" &&
          "before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary before:content-['']",
        side === "after" &&
          "after:absolute after:inset-y-0 after:right-0 after:w-0.5 after:bg-primary after:content-['']",
        className
      )}
    >
      <span
        {...drag.dragHandleProps(column.id)}
        role="button"
        tabIndex={-1}
        aria-label={`Mover la columna ${column.label}`}
        title={`Mover la columna ${column.label}`}
        className="absolute left-1/2 top-0 flex h-3.5 w-8 -translate-x-1/2 cursor-grab items-center justify-center text-muted-foreground opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-70"
      >
        <GripHorizontal className="h-3 w-3" strokeWidth={2.5} />
      </span>

      {/* La chincheta explica por qué esta columna no se mueve con las demás.
          Sin ella, una columna quieta mientras el resto se desplaza parece un
          fallo de pintado. */}
      {pinned && (
        <Pin
          aria-hidden
          className="pointer-events-none absolute right-1 top-1 h-2.5 w-2.5 text-primary"
          strokeWidth={2.6}
        />
      )}

      {children}
    </TableHead>
  );
}
