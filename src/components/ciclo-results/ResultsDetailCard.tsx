import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useElementHeight } from "@/lib/useElementHeight";

/** Lo que la cabecera de la tarjeta deja libre por arriba (`top-3`). */
const CARD_HEAD_TOP = 12;

/**
 * La tarjeta que contiene el detalle de una pestaña.
 *
 * Es la misma anatomía de "Detalle por secciones" en el reporte de encuestas:
 * una tarjeta blanca con su título y el conteo en un badge a la izquierda, los
 * controles de esa vista a la derecha, y debajo el contenido. La cabecera se
 * queda pegada al hacer scroll dentro de la tarjeta, para que los controles
 * con los que se llegó a un punto sigan a mano al bajar.
 *
 * Los controles viven aquí y no en una barra suelta sobre la página porque la
 * página ya tiene dos: las pestañas y la barra de acciones. Una tercera franja
 * flotante compite con ambas y no pertenece a ninguna.
 */
export function ResultsDetailCard({
  title,
  count,
  controls,
  chips,
  wide = false,
  children,
}: {
  title: string;
  count?: number;
  /** Ver por, Filtros, el switch de vista… en ese orden, de izquierda a derecha. */
  controls?: React.ReactNode;
  /** Las fichas de filtros activos, bajo la fila de controles. */
  chips?: React.ReactNode;
  /**
   * Cierto cuando lo de dentro puede ser más ancho que la pantalla —una tabla
   * de ocho columnas—: entonces la tarjeta crece con ello y es la página la
   * que se desplaza de lado, en vez de que la tabla se salga por el borde
   * derecho de una tarjeta que se quedó corta. Es lo que hace la lista de
   * ciclos del home (`w-fit min-w-full`).
   */
  wide?: boolean;
  children: React.ReactNode;
}) {
  /*
   * La cabecera se queda pegada arriba; lo que va debajo y también se pega
   * —el encabezado de una tabla larga— tiene que empezar justo donde ella
   * termina. Su alto se mide y viaja como `--results-sticky-top`, igual que
   * `--home-sticky-top` en la lista de ciclos: escrito a mano, uno de los dos
   * deja un hueco o un solape en cuanto la fila de controles envuelve.
   */
  const headRef = React.useRef<HTMLDivElement>(null);
  const headHeight = useElementHeight(headRef);

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border/60 bg-surface p-4 shadow-card",
        wide && "w-fit min-w-full"
      )}
      style={
        { "--results-sticky-top": `${CARD_HEAD_TOP + headHeight}px` } as React.CSSProperties
      }
    >
      <div ref={headRef} className="sticky top-3 z-30 -mt-4 bg-surface pb-2 pt-4">
        <div className="flex flex-wrap items-center gap-4 pb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-bold text-text-primary">{title}</h3>
            {count !== undefined && (
              <Badge variant="neutral" className="h-5 px-1.5 text-[11px] font-semibold tabular-nums">
                {count}
              </Badge>
            )}
          </div>
          {controls && <div className="ml-auto flex items-center justify-end gap-3">{controls}</div>}
        </div>
        {chips}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}
