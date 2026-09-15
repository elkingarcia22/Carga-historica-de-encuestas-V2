import * as React from "react";

/**
 * Arrastrar y soltar una columna, con la misma implementación para los dos
 * sitios donde se puede hacer: los encabezados de la tabla y la lista del
 * panel de configuración. Uno es horizontal y el otro vertical; lo único que
 * cambia entre ellos es contra qué eje se mide "antes" o "después".
 *
 * Arrastre nativo del navegador y no una librería: mover una columna es un
 * gesto de tres eventos, y meter una dependencia de 30 kB para eso cuesta más
 * de lo que resuelve. El tirador es el que lleva `draggable`, no toda la
 * celda, para no competir con los botones de ordenar y filtrar que viven
 * dentro del encabezado.
 */

export type DropSide = "before" | "after";

export interface ColumnDrag {
  /** La columna que se está arrastrando, o null. */
  draggingId: string | null;
  /** Va en el tirador. */
  dragHandleProps: (id: string) => React.HTMLAttributes<HTMLElement> & { draggable: true };
  /** Va en la celda o la fila completa: es el blanco del soltar. */
  dropTargetProps: (id: string) => React.HTMLAttributes<HTMLElement>;
  /** Por qué lado caería ahora mismo, para pintar la guía. */
  dropSideFor: (id: string) => DropSide | null;
}

export function useColumnDrag({
  axis,
  onReorder,
}: {
  axis: "x" | "y";
  onReorder: (sourceId: string, targetId: string, before: boolean) => void;
}): ColumnDrag {
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<{ id: string; side: DropSide } | null>(null);

  const clear = () => {
    setDraggingId(null);
    setOver(null);
  };

  return {
    draggingId,

    dragHandleProps: (id) => ({
      draggable: true,
      onDragStart: (event: React.DragEvent<HTMLElement>) => {
        event.dataTransfer.effectAllowed = "move";
        // Algún navegador exige que haya datos para iniciar el arrastre.
        event.dataTransfer.setData("text/plain", id);
        // La imagen que se arrastra es la columna entera y no el tirador
        // suelto: así se ve qué se está moviendo.
        const cell = (event.currentTarget as HTMLElement).closest<HTMLElement>("[data-drag-cell]");
        if (cell) {
          const box = cell.getBoundingClientRect();
          event.dataTransfer.setDragImage(cell, event.clientX - box.left, event.clientY - box.top);
        }
        setDraggingId(id);
      },
      onDragEnd: clear,
    }),

    dropTargetProps: (id) => ({
      onDragOver: (event: React.DragEvent<HTMLElement>) => {
        if (!draggingId || draggingId === id) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const box = event.currentTarget.getBoundingClientRect();
        const side: DropSide =
          axis === "x"
            ? event.clientX < box.left + box.width / 2
              ? "before"
              : "after"
            : event.clientY < box.top + box.height / 2
              ? "before"
              : "after";
        setOver((current) =>
          current?.id === id && current.side === side ? current : { id, side }
        );
      },
      onDragLeave: (event: React.DragEvent<HTMLElement>) => {
        // Salir hacia un hijo no es salir: sin esto la guía parpadea al pasar
        // sobre el texto del encabezado.
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setOver((current) => (current?.id === id ? null : current));
      },
      onDrop: (event: React.DragEvent<HTMLElement>) => {
        event.preventDefault();
        const source = draggingId ?? event.dataTransfer.getData("text/plain");
        const side = over?.id === id ? over.side : "before";
        if (source && source !== id) onReorder(source, id, side === "before");
        clear();
      },
    }),

    dropSideFor: (id) => (draggingId && over?.id === id ? over.side : null),
  };
}
