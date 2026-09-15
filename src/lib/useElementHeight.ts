import * as React from "react";

/**
 * El alto de un elemento, medido en vivo.
 *
 * Sirve para encadenar dos cosas pegadas al hacer scroll: la de abajo tiene
 * que empezar donde termina la de arriba, y ese punto cambia solo —una tira
 * de pestañas que envuelve en una pantalla angosta ya no mide lo mismo—. Un
 * número escrito a mano ahí acierta un día y deja un hueco o un solape al
 * siguiente.
 */
export function useElementHeight(ref: React.RefObject<HTMLElement | null>): number {
  const [height, setHeight] = React.useState(0);

  React.useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const measure = () => setHeight(node.getBoundingClientRect().height);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  return height;
}
