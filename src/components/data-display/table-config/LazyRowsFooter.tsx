import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { LazyRows } from "./useLazyRows";

/**
 * El final de una tabla que carga al bajar: las filas fantasma que anuncian lo
 * que viene y el contador que dice por dónde va.
 *
 * Un esqueleto y no una línea con un spinner porque lo que hay debajo del
 * pliegue son filas, y eso es lo que tiene que aparecer: al llegar al final se
 * ve el mismo pentagrama de la tabla en gris, y encima caen los datos. Con una
 * sola línea de carga el salto era de nada a veinticinco filas, y por un
 * instante el hueco se leía como filas en blanco.
 */

const format = (value: number): string => new Intl.NumberFormat("es-CO").format(value);

/** Cuántas filas fantasma como mucho: las justas para decir "sigue", sin
 *  estirar la página por algo que se va a reemplazar en un parpadeo. */
const MAX_GHOST_ROWS = 4;

/**
 * El ancho de cada barra, por posición de columna.
 *
 * Desiguales a propósito: cuatro barras idénticas se leen como una rejilla
 * decorativa, y escalonadas se leen como texto que todavía no llegó.
 */
const BAR_WIDTHS = ["w-2/3", "w-1/2", "w-3/4", "w-2/5", "w-3/5", "w-1/2", "w-4/5", "w-1/3"];

/** Va como últimas filas del `<tbody>`, después de las que ya se cargaron. */
export function LazyRowsSentinel({
  lazy,
  colSpan,
  noun,
}: {
  lazy: LazyRows;
  colSpan: number;
  noun: string;
}) {
  const { count, hasMore, remaining, attachSentinel, loadMore } = lazy;
  if (!hasMore) return null;

  const ghosts = Math.min(remaining, MAX_GHOST_ROWS);

  return (
    <>
      {Array.from({ length: ghosts }, (_, row) => (
        <tr
          // La `key` con el tramo cargado monta filas nuevas cada vez que
          // crece: el observador se rehace y vuelve a preguntar aunque el
          // centinela siguiera a la vista, que es cuando se queda callado.
          key={`${count}:${row}`}
          aria-hidden
          // Solo la primera lleva el centinela; las demás son relleno visual.
          ref={row === 0 ? attachSentinel : undefined}
          className="border-b border-border/60"
        >
          {Array.from({ length: colSpan }, (_, column) => (
            <td key={column} className="px-4 py-3.5">
              {column === 0 ? (
                <Skeleton className="size-4 rounded-xs" />
              ) : (
                <Skeleton
                  className={cn("h-4", BAR_WIDTHS[column % BAR_WIDTHS.length])}
                  // Escalonadas también en el tiempo: las cuatro filas
                  // latiendo a la vez parecen un parpadeo del navegador.
                  style={{ animationDelay: `${row * 120}ms` }}
                />
              )}
            </td>
          ))}
        </tr>
      ))}

      {/* Tabular nunca llega hasta aquí —el foco pasa por los controles, no
          por el final del `tbody`—, así que con el teclado el resto de la
          lista sería inalcanzable sin esto. */}
      <tr>
        <td colSpan={colSpan} className="p-0">
          <button type="button" onClick={loadMore} className="sr-only focus:not-sr-only focus:block focus:w-full focus:py-3 focus:text-center focus:text-[12px] focus:font-semibold focus:text-primary">
            Cargar más {noun}
          </button>
        </td>
      </tr>
    </>
  );
}

/** El contador del pie, en lugar del paginador. */
export function LazyRowsSummary({
  lazy,
  total,
  noun,
  className,
}: {
  lazy: LazyRows;
  total: number;
  noun: string;
  className?: string;
}) {
  return (
    <p className={cn("text-[12px] text-muted-foreground", className)}>
      {total === 0 ? `0 ${noun}` : `${format(lazy.count)} de ${format(total)} ${noun}`}
    </p>
  );
}
