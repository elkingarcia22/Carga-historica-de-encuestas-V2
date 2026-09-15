import * as React from "react";

/**
 * Las filas que se cargan al bajar, en vez de por páginas.
 *
 * Es el modo de fábrica de todas las tablas: leer una lista larga es bajar, no
 * ir y volver de un paginador. La paginación sigue viva —a un clic en
 * "Configurar"— porque hay lecturas que sí quieren un tamaño fijo y saber en
 * qué página van.
 *
 * El centinela es una fila real al final del `<tbody>`, no un `div` flotante:
 * dentro de una tabla cualquier otra cosa se sale del flujo y el navegador la
 * reubica fuera.
 */

/**
 * El primer antepasado que de verdad hace scroll vertical, o `null` para la
 * ventana.
 *
 * Hay que dárselo al observador como `root` y no dejarlo en la ventana: el
 * `rootMargin` ensancha la raíz, no las cajas con scroll que haya por el
 * camino. Con la raíz en la ventana, un centinela diecisiete píxeles por
 * debajo del borde de la tabla no intersecta —lo recorta la caja, no la
 * ventana—, así que no hay adelanto ninguno: la tabla carga su primer tramo,
 * se queda quieta con apenas setenta píxeles de scroll y parece completa.
 */
function findScroller(node: HTMLElement): HTMLElement | null {
  let parent = node.parentElement;
  while (parent) {
    const { overflowY } = getComputedStyle(parent);
    /*
     * Que desborde de verdad, no solo que lo declare. Un envoltorio con
     * `overflow-x: auto` —el del componente `Table`, sin ir más lejos— sale
     * con `overflow-y: auto` calculado aunque no tenga alto acotado: el CSS
     * fuerza el otro eje en cuanto uno deja de ser `visible`. Tomarlo como
     * raíz sería tomar una caja que no recorta nada, el centinela estaría
     * siempre dentro y la tabla se cargaría entera de un tirón.
     */
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      parent.scrollHeight > parent.clientHeight
    ) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

export interface LazyRows {
  /** Cuántas filas mostrar. En paginación es el total: no recorta nada. */
  count: number;
  hasMore: boolean;
  /** Cuántas faltan por cargar. Es lo que dibuja el esqueleto del final. */
  remaining: number;
  /** Va en la fila centinela del final del `<tbody>`. */
  attachSentinel: (node: HTMLTableRowElement | null) => (() => void) | void;
  loadMore: () => void;
}

export function useLazyRows({
  total,
  enabled,
  step = 25,
  /** Cambia cuando cambia lo que se lista —filtros, orden, búsqueda— y la
   *  carga vuelve a empezar: seguir en la fila 300 de otra lista no significa
   *  nada. */
  resetKey,
}: {
  total: number;
  enabled: boolean;
  step?: number;
  resetKey?: unknown;
}): LazyRows {
  const [limit, setLimit] = React.useState(step);

  /*
   * Volver al primer tramo cuando cambia lo que se lista, ajustado durante el
   * render y no en un efecto: un efecto pintaría primero las trescientas filas
   * de la lista anterior y las quitaría después, que es justo el salto que se
   * quiere evitar.
   */
  const [seen, setSeen] = React.useState<{ key: unknown; step: number }>({
    key: resetKey,
    step,
  });
  if (!Object.is(seen.key, resetKey) || seen.step !== step) {
    setSeen({ key: resetKey, step });
    setLimit(step);
  }

  const count = enabled ? Math.min(limit, total) : total;
  const hasMore = enabled && count < total;

  const loadMore = React.useCallback(() => setLimit((current) => current + step), [step]);

  /*
   * Una ref de función y no un objeto: el observador se monta cuando la fila
   * entra al DOM y se desconecta en la limpieza, sin un efecto que tenga que
   * adivinar si el nodo ya está puesto.
   *
   * Que el centinela se vuelva a montar en cada tramo lo resuelve su `key` en
   * el componente que lo pinta: cuando el tramo crece, la fila puede seguir a
   * la vista sin volver a cruzar el umbral, y un observador solo avisa en los
   * cruces.
   */
  const attachSentinel = React.useCallback(
    (node: HTMLTableRowElement | null) => {
      if (!node || !hasMore) return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) loadMore();
        },
        // Un margen por delante para que el siguiente tramo ya esté puesto
        // cuando el centinela llega al borde y la lectura no se corte. La
        // raíz es la caja que de verdad hace scroll aquí; ver `findScroller`.
        { root: findScroller(node), rootMargin: "240px" }
      );
      observer.observe(node);
      return () => observer.disconnect();
    },
    [hasMore, loadMore]
  );

  return { count, hasMore, remaining: Math.max(0, total - count), attachSentinel, loadMore };
}
