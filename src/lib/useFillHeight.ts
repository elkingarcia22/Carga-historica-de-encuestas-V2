import * as React from "react";

/**
 * El alto que le queda a un bloque para terminar justo donde termina la
 * pantalla, medido en vivo.
 *
 * Sirve para que una tabla larga haga su propio scroll —con el encabezado
 * quieto y el paginador siempre a la vista— en vez de estirar la página. La
 * regla es "o uno o el otro": si el bloque acepta este alto, la página entera
 * cabe y no hay un segundo scroll compitiendo con el de la tabla.
 *
 * Un `calc(100vh - 23rem)` escrito a mano acierta en el monitor donde se
 * escribió y falla en todos los demás: la constante tiene que adivinar la
 * concha de la app, las pestañas, las fichas de filtros activos y el alto de
 * la cabecera de la tarjeta, y cualquiera de esos cambia de alto solo. Aquí
 * no se adivina nada: se mide el contenedor con scroll, dónde empieza el
 * bloque dentro de él y todo lo que queda por debajo hasta el final.
 *
 * El cálculo ignora a propósito el scroll actual —mide desde el principio del
 * contenido, no desde lo que se ve— para que el resultado sea el alto con el
 * que todo cabe de una vez.
 *
 * Se vuelve a medir cuando cambia de tamaño la ventana o cualquiera de los
 * dos extremos de la cuenta, siempre dentro de un `requestAnimationFrame`
 * para no encadenar una medición con la que la propia medición provoca.
 */

/**
 * Si no queda ni esto, no se acota: una tabla de dos filas es peor que una
 * página que baja, y además el tope dejaría dos scrolls a la vez —el de la
 * tabla y el de la página, que seguiría sin caber—.
 */
const MIN_HEIGHT = 240;

/**
 * Todo lo que queda por debajo del bloque hasta el final del contenedor con
 * scroll: el paginador, los espacios entre hermanos y los rellenos de abajo
 * de cada envoltorio por el camino.
 *
 * Se suma hermano por hermano en vez de restar `contenedor.bottom -
 * bloque.bottom`. La diferencia importa cuando una tarjeta se estira para
 * llenar la pantalla: ese sobrante no es hermano de nadie, así que por este
 * camino no entra en la cuenta. Restando rectángulos sí entraría, el
 * siguiente alto saldría más corto todavía y la medición se perseguiría a sí
 * misma hasta dejar la tabla en nada.
 */
function reserveBelow(node: HTMLElement, boundary: HTMLElement): number {
  let total = 0;
  let current: HTMLElement = node;

  while (current !== boundary && current.parentElement) {
    const parent = current.parentElement;
    const styles = getComputedStyle(parent);
    const gap = parseFloat(styles.rowGap) || 0;

    let sibling = current.nextElementSibling;
    while (sibling) {
      total += sibling.getBoundingClientRect().height + gap;
      sibling = sibling.nextElementSibling;
    }

    // El relleno del propio contenedor con scroll se descuenta aparte —suele
    // estar reservado para la barra flotante—, así que aquí solo cuentan los
    // de los envoltorios intermedios. El borde de abajo de cada uno también
    // ocupa: sin contarlo sobra un par de píxeles y aparece un segundo
    // scroll de dos píxeles, que es peor que uno de doscientos.
    if (parent !== boundary) {
      total += parseFloat(styles.paddingBottom) || 0;
      total += parseFloat(styles.borderBottomWidth) || 0;
    }
    current = parent;
  }

  return total;
}

/** El primer antepasado que de verdad hace scroll vertical. */
function findScroller(node: HTMLElement): HTMLElement | null {
  let parent = node.parentElement;
  while (parent) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === "auto" || overflowY === "scroll") return parent;
    parent = parent.parentElement;
  }
  return null;
}

/**
 * @param min Lo mínimo que hace falta para que valga la pena acotar. Si no
 *   queda tanto, devuelve `undefined`: el bloque se queda a su alto natural y
 *   la página vuelve a ser la que baja —un solo scroll, como debe ser—.
 */
export function useFillHeight(
  ref: React.RefObject<HTMLElement | null>,
  min: number = MIN_HEIGHT
): number | undefined {
  const [height, setHeight] = React.useState<number>();

  React.useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const scroller = findScroller(node);
    let frame = 0;

    const measure = () => {
      frame = 0;
      const box = node.getBoundingClientRect();
      const boundary = scroller ?? document.documentElement;
      const below = reserveBelow(node, boundary);

      const styles = getComputedStyle(boundary);
      // El relleno inferior del contenedor está reservado para la barra
      // flotante de acciones: llegar hasta ahí dejaría el paginador debajo.
      const reserved = parseFloat(styles.paddingBottom) || 0;
      const start = box.top - boundary.getBoundingClientRect().top + boundary.scrollTop;
      const available = Math.round(boundary.clientHeight - reserved - start - below);

      setHeight(available >= min ? available : undefined);
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();

    const observer = new ResizeObserver(schedule);
    if (scroller) observer.observe(scroller);
    observer.observe(node.parentElement ?? node);
    window.addEventListener("resize", schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [ref, min]);

  return height;
}
