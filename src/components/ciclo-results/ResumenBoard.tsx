import * as React from "react";
import { motion } from "framer-motion";
import { GripHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * El resumen como tablero, no como página fija.
 *
 * El orden de estas tarjetas es una opinión —de lo que obliga a actuar hoy a
 * lo que solo da contexto— y es un buen punto de partida, pero deja de serlo
 * en cuanto alguien se arma su propia métrica: lo que esa persona vino a
 * mirar no tiene por qué quedar sexto. Aquí cada tarjeta se agarra de su asa
 * y se suelta donde debía estar.
 *
 * Y se mueve en los dos ejes, no en filas enteras: el tablero es una rejilla
 * de seis columnas y cada pieza declara cuánto ocupa —un tercio, media, todo
 * el ancho—, así que soltar una pieza entre dos de la misma fila la coloca
 * **al lado** y soltarla más abajo la coloca **debajo**. Mover bloques
 * enteros obligaba a mover tres tarjetas para reordenar una.
 *
 * El tablero no conoce las tarjetas: recibe las piezas como hijos con su
 * `id` y su ancho, y solo decide en qué orden salen. Así ninguna tarjeta
 * tiene que saber que vive en un tablero, y sumar una al resumen sigue
 * siendo escribir una `<section>` más.
 *
 * Una pieza que todavía no está en el orden guardado —una métrica recién
 * creada, el hueco donde la IA está trabajando— sale **donde fue declarada**,
 * pegada a su vecina, y no al final: aparecer abajo del todo es aparecer
 * fuera de pantalla.
 *
 * El arrastre va con eventos de puntero y no con el arrastre nativo del
 * navegador: el nativo pinta un fantasma que no se parece a la tarjeta,
 * ignora el táctil y no deja reordenar en vivo. Aquí las piezas se reacomodan
 * mientras se arrastra, que es lo que hace que el tablero se sienta como algo
 * que se mueve y no como un formulario de posiciones.
 */

/** Cuánto ocupa una pieza en la rejilla de seis columnas. */
export type BoardSpan = 2 | 3 | 6;

/** Las seis columnas del tablero. Los anchos declarados son fracciones de
 *  esto: 2 = un tercio, 3 = media, 6 = todo. */
const COLUMNS = 6;

/**
 * Cuánto ocupa de verdad una pieza, según lo ancho que esté el tablero.
 *
 * No se puede resolver con los cortes de Tailwind: miden el ancho de la
 * ventana, y aquí lo que cambia es el ancho de la *columna* —abrir el chat
 * del Agente IA la angosta 400 px sin que la ventana se entere—. Un tercio de
 * esa columna angosta son 120 px, que no es una tarjeta: es una ruina.
 */
function resolveSpan(span: BoardSpan, width: number): number {
  // Los cortes salen del ancho mínimo con el que una tarjeta sigue siendo
  // legible: un tercio no baja de ~220 px, una media no baja de ~200 px.
  if (width >= 680) return span;
  if (width >= 420) return span === 2 ? 3 : COLUMNS;
  return COLUMNS;
}

/**
 * Los anchos definitivos: ninguna fila deja columnas vacías.
 *
 * Los anchos declarados son una intención —"esta va a un tercio"—, pero el
 * orden lo decide quien arrastra, y una fila de media + un tercio deja una
 * columna muerta al borde derecho. Aquí se reparte lo que sobra entre las
 * piezas de esa fila, empezando por la última, así que el tablero siempre
 * llega de lado a lado sin importar cómo lo hayan reordenado.
 */
function fillRows(spans: readonly number[]): number[] {
  const filled = [...spans];
  let start = 0;
  let sum = 0;

  const close = (end: number) => {
    let rest = COLUMNS - sum;
    for (let i = end - 1; rest > 0; i -= 1) {
      if (i < start) i = end - 1;
      filled[i] += 1;
      rest -= 1;
    }
  };

  for (let i = 0; i < filled.length; i += 1) {
    if (sum + filled[i] > COLUMNS) {
      close(i);
      start = i;
      sum = 0;
    }
    sum += filled[i];
  }
  if (filled.length > 0) close(filled.length);
  return filled;
}

/** Franja contra el borde del scroll donde arrastrar también hace scroll. */
const EDGE_PX = 90;

/** Cuánto tiene que moverse el puntero antes de recalcular el sitio. Sin
 *  esto, la propia reacomodación cambia las medidas bajo el cursor y las
 *  piezas se quedan vibrando entre dos posiciones. */
const SETTLE_PX = 8;

export interface ResumenBoardBlockProps {
  /** Estable entre renders: es lo que se guarda en el orden. */
  id: string;
  /** Cómo se llama esta pieza cuando se la mueve — lo lee el asa y el lector
   *  de pantalla. */
  label: string;
  /** Un tercio, media o todo el ancho. Por defecto, todo. */
  span?: BoardSpan;
  /** Una pieza que no se puede mover (el hueco de trabajo de la IA, que dura
   *  dos segundos y no es de nadie). */
  fixed?: boolean;
  /**
   * Convierte la pieza en el título de una subsección.
   *
   * Un tablero de trece tarjetas sueltas no se lee: hay que entrar tarjeta
   * por tarjeta para descubrir de qué va cada una. Los títulos agrupan a las
   * que responden la misma pregunta —"¿va a llegar?", "¿dónde se está
   * jugando el ciclo?"— y le devuelven al resumen el orden de lectura que el
   * tablero, al volverse móvil, había dejado en manos de quien arrastra.
   *
   * Es una pieza más: ocupa el ancho completo, se arrastra, y lo que quede
   * debajo hasta el siguiente título pertenece a ella. Así reordenar una
   * tarjeta la cambia de grupo sin más ceremonia.
   */
  heading?: string;
  /** La línea bajo el título: qué se responde en este grupo. */
  hint?: string;
  children?: React.ReactNode;
}

/** Declara una pieza del tablero. No dibuja nada por su cuenta. */
export function ResumenBoardBlock({ children }: ResumenBoardBlockProps) {
  return <>{children}</>;
}

type BlockElement = React.ReactElement<ResumenBoardBlockProps>;

const isBlock = (node: React.ReactNode): node is BlockElement =>
  React.isValidElement(node) && node.type === ResumenBoardBlock;

/**
 * Ordena las piezas declaradas según el orden guardado.
 *
 * Las que no están en él heredan el sitio de la anterior más un pelo, que es
 * lo que las deja pegadas a la vecina con la que se escribieron.
 */
function sortBlocks(blocks: readonly BlockElement[], order: readonly string[]): BlockElement[] {
  let last = -1;
  let drift = 0;
  const rank = new Map<string, number>();

  blocks.forEach((block) => {
    const index = order.indexOf(block.props.id);
    if (index >= 0) {
      rank.set(block.props.id, index);
      last = index;
      drift = 0;
      return;
    }
    drift += 1;
    rank.set(block.props.id, last + drift / 1000);
  });

  return [...blocks].sort(
    (a, b) => (rank.get(a.props.id) ?? 0) - (rank.get(b.props.id) ?? 0)
  );
}

export function ResumenBoard({
  order,
  onOrderChange,
  children,
}: {
  order: readonly string[];
  /** El orden completo y ya resuelto, con todas las piezas que hay ahora. */
  onOrderChange: (next: string[]) => void;
  children: React.ReactNode;
}) {
  const blocks = React.useMemo(
    () => sortBlocks(React.Children.toArray(children).filter(isBlock), order),
    [children, order]
  );

  const [dragging, setDragging] = React.useState<string | null>(null);
  /** Lo ancho que está el tablero, que no es lo ancho que está la ventana. */
  const [width, setWidth] = React.useState(1200);
  /** Las piezas montadas, para medir por dónde va el puntero. */
  const nodes = React.useRef(new Map<string, HTMLElement>());
  const root = React.useRef<HTMLDivElement>(null);
  const scroller = React.useRef<HTMLElement | null>(null);
  /** Dónde está el puntero y desde dónde se calculó el último sitio. */
  const pointer = React.useRef({ x: 0, y: 0 });
  const settled = React.useRef({ x: 0, y: 0 });
  /**
   * El gesto, en crudo.
   *
   * `grab` es dónde se agarró y `shift` lo que hay que compensar cada vez que
   * la pieza cambia de sitio o la página se mueve bajo ella: sin esa
   * compensación, la tarjeta salta al hueco nuevo y se despega del cursor —
   * que es exactamente lo que hacía que el movimiento se viera instantáneo y
   * no arrastrado.
   */
  const held = React.useRef<HTMLElement[]>([]);
  const grab = React.useRef({ x: 0, y: 0 });
  const shift = React.useRef({ x: 0, y: 0 });
  /** El bucle que arrima la página cuando el puntero se queda contra el borde. */
  const frame = React.useRef<number | null>(null);
  const dragRef = React.useRef<string | null>(null);

  const ids = blocks.map((block) => block.props.id);
  const spans = fillRows(
    blocks.map((block) =>
      block.props.heading ? COLUMNS : resolveSpan(block.props.span ?? 6, width)
    )
  );

  /**
   * Lo último que se renderizó, para el arrastre.
   *
   * El bucle se programa una vez al agarrar la pieza y sigue vivo mientras
   * dura el gesto, así que lee de aquí y no de las variables de aquel render:
   * con el orden viejo en la mano, cada cuadro deshacía el movimiento del
   * anterior y la pieza se quedaba temblando en su sitio.
   */
  const live = React.useRef({ ids, blocks, onOrderChange });
  React.useEffect(() => {
    live.current = { ids, blocks, onOrderChange };
  });

  React.useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /**
   * Dónde termina la sección que empieza en `from`: en el siguiente título, o
   * al final del tablero.
   */
  const runEnd = (list: readonly BlockElement[], from: number): number => {
    for (let i = from + 1; i < list.length; i += 1) {
      if (list[i].props.heading) return i;
    }
    return list.length;
  };

  /**
   * Los sitios donde puede caer una sección entera.
   *
   * Solo los bordes: el principio del tablero, el arranque de cada sección y
   * el final. Dejar soltar una sección en mitad de otra la partiría en dos, y
   * partir una sección es justo lo que un título promete que no va a pasar.
   */
  const sectionBoundaries = (list: readonly BlockElement[]): number[] => {
    // La cabecera del reporte —el número grande, los avisos, los filtros— no
    // se mueve, así que tampoco es un sitio donde se pueda meter una sección
    // por encima. El primer borde válido es el primer bloque que sí se mueve.
    const first = list.findIndex((block) => !block.props.fixed);
    const start = first < 0 ? list.length : first;
    const marks = [start];
    list.forEach((block, index) => {
      if (block.props.heading && index > start) marks.push(index);
    });
    marks.push(list.length);
    return marks;
  };

  /** Deja la pieza en esa posición de la lista. */
  const moveTo = (id: string, index: number) => {
    const current = live.current.ids;
    const from = current.indexOf(id);
    if (from < 0 || from === index) return;
    const next = [...current];
    next.splice(from, 1);
    next.splice(index > from ? index - 1 : index, 0, id);
    if (next.every((value, i) => value === current[i])) return;
    live.current.onOrderChange(next);
  };

  /**
   * En qué posición de la lista cae el puntero.
   *
   * Se lee la rejilla como se lee un texto: la primera pieza que empieza
   * *después* del puntero —una fila más abajo, o más a la derecha dentro de
   * la misma fila— marca el hueco. Es una cuenta directa sobre la posición
   * del puntero, no un intercambio con la vecina, así que arrastrar hacia los
   * lados coloca al lado y arrastrar hacia abajo coloca debajo, con la misma
   * regla.
   */
  const indexAt = (x: number, y: number): number => {
    const list = live.current.blocks;
    for (let i = 0; i < list.length; i += 1) {
      const rect = nodes.current.get(list[i].props.id)?.getBoundingClientRect();
      if (!rect) continue;
      if (y < rect.top) return i;
      if (y <= rect.bottom && x < rect.left + rect.width / 2) return i;
    }
    return list.length;
  };

  /** La tarjeta, pegada al cursor. Se escribe directo en el estilo porque es
   *  un gesto continuo: pasarlo por el estado de React lo volvería a atar al
   *  ritmo de los renders. */
  const draw = () => {
    if (held.current.length === 0) return;
    const dx = pointer.current.x - grab.current.x + shift.current.x;
    const dy = pointer.current.y - grab.current.y + shift.current.y;
    // Arrastrar un título mueve la sección entera, así que la sección entera
    // tiene que moverse con el cursor: si solo viajara el título, el gesto
    // diría que se está moviendo una línea de texto y al soltar aparecerían
    // cuatro tarjetas donde nadie las vio caer.
    held.current.forEach((node) => {
      node.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.015)`;
    });
  };

  /** Lo que se movió el hueco bajo la tarjeta se descuenta del arrastre, para
   *  que la tarjeta no se mueva del sitio donde la tiene el cursor. */
  const compensate = (before: DOMRect | undefined, after: DOMRect | undefined) => {
    if (!before || !after) return;
    shift.current = {
      x: shift.current.x - (after.left - before.left),
      y: shift.current.y - (after.top - before.top),
    };
    draw();
  };

  const rectOf = (id: string) => nodes.current.get(id)?.getBoundingClientRect();

  /**
   * Mueve la sección que encabeza `id` —el título y todo lo que cuelga de él—
   * al borde de sección más cercano al puntero.
   *
   * Arrastrar un título no debería mover solo el título: lo que se agarra es
   * el grupo, y lo que se espera al soltarlo es ver "¿Va a llegar?" completa
   * arriba de "Cómo van los objetivos", no sus cuatro tarjetas desperdigadas.
   */
  const moveSection = (id: string) => {
    const list = live.current.blocks;
    const current = live.current.ids;
    const from = current.indexOf(id);
    if (from < 0) return;
    const end = runEnd(list, from);

    const index = indexAt(pointer.current.x, pointer.current.y);
    const target = sectionBoundaries(list)
      // Soltar la sección dentro de sí misma no es un movimiento.
      .filter((mark) => mark <= from || mark >= end)
      .reduce((best, mark) => (Math.abs(mark - index) < Math.abs(best - index) ? mark : best));
    if (target === from) return;

    const run = current.slice(from, end);
    const rest = [...current.slice(0, from), ...current.slice(end)];
    rest.splice(target <= from ? target : target - run.length, 0, ...run);
    if (rest.every((value, i) => value === current[i])) return;

    const before = rectOf(id);
    live.current.onOrderChange(rest);
    window.requestAnimationFrame(() => compensate(before, rectOf(id)));
  };

  const reposition = (id: string) => {
    const list = live.current.blocks;
    const from = live.current.ids.indexOf(id);
    if (list[from]?.props.heading) return moveSection(id);

    const index = indexAt(pointer.current.x, pointer.current.y);
    const target = list[index];
    // El hueco de trabajo de la IA no es un sitio donde soltar nada.
    if (target?.props.fixed) return;
    // Si el sitio calculado es el que ya ocupa, no hay nada que mover — y no
    // hay que compensar nada. (Insertar en `from + 1` la deja donde está.)
    if (index === from || index === from + 1) return;
    const before = rectOf(id);
    moveTo(id, index);
    // El hueco nuevo existe recién en el cuadro siguiente: `live` se
    // actualiza en un efecto, así que preguntarle ahora devolvería el orden
    // viejo.
    window.requestAnimationFrame(() => compensate(before, rectOf(id)));
  };

  /** El contenedor que hace scroll, sea cual sea: el tablero no debería
   *  saberse de memoria el `data-slot` de la pantalla que lo monta. */
  const findScroller = (): HTMLElement | null => {
    let node = root.current?.parentElement ?? null;
    while (node) {
      const overflow = getComputedStyle(node).overflowY;
      if ((overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  };

  /** Un cuadro del arrastre: solo arrima la página contra el borde. El
   *  recolocado va en el propio movimiento del puntero. */
  const tick = (id: string) => {
    if (dragRef.current !== id) return;
    const box = scroller.current;
    if (box) {
      const rect = box.getBoundingClientRect();
      const top = pointer.current.y - rect.top;
      const bottom = rect.bottom - pointer.current.y;
      const step =
        top < EDGE_PX
          ? -Math.max(4, (EDGE_PX - top) / 3)
          : bottom < EDGE_PX
            ? Math.max(4, (EDGE_PX - bottom) / 3)
            : 0;
      if (step !== 0) {
        // La página se mueve bajo la tarjeta, así que lo que se desplazó el
        // hueco se descuenta en el acto: si no, la tarjeta se va quedando
        // atrás mientras el tablero corre.
        const before = rectOf(id);
        box.scrollTop += step;
        compensate(before, rectOf(id));
        reposition(id);
      }
    }
    frame.current = window.requestAnimationFrame(() => tick(id));
  };

  const startDrag = (id: string) => (event: React.PointerEvent<HTMLButtonElement>) => {
    // `preventDefault` evita que el arrastre seleccione texto de la tarjeta,
    // pero también se lleva el foco que el botón recibiría solo — y sin foco
    // el asa no responde a las flechas, que es la única forma de mover una
    // pieza sin ratón.
    event.preventDefault();
    event.currentTarget.focus();
    try {
      // Capturar el puntero es lo que deja seguir el arrastre aunque el
      // cursor se salga del asa. Si el navegador no puede, el arrastre sigue
      // funcionando mientras el puntero no se despegue.
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* sin captura */
    }
    pointer.current = { x: event.clientX, y: event.clientY };
    settled.current = pointer.current;
    grab.current = pointer.current;
    shift.current = { x: 0, y: 0 };

    const list = live.current.blocks;
    const from = live.current.ids.indexOf(id);
    const run = list[from]?.props.heading
      ? live.current.ids.slice(from, runEnd(list, from))
      : [id];
    held.current = run
      .map((blockId) => nodes.current.get(blockId)?.firstElementChild as HTMLElement | undefined)
      .filter((node): node is HTMLElement => node !== undefined);
    held.current.forEach((node) => {
      node.style.transition = "none";
      node.style.willChange = "transform";
    });
    dragRef.current = id;
    setDragging(id);
    scroller.current = findScroller();
    frame.current = window.requestAnimationFrame(() => tick(id));
  };

  const onDragMove = (id: string) => (event: React.PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current !== id) return;
    pointer.current = { x: event.clientX, y: event.clientY };
    draw();
    const moved =
      Math.abs(pointer.current.x - settled.current.x) +
      Math.abs(pointer.current.y - settled.current.y);
    if (moved < SETTLE_PX) return;
    settled.current = pointer.current;
    reposition(id);
  };

  const endDrag = () => {
    if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    frame.current = null;
    dragRef.current = null;
    // Soltar no teletransporta: lo que se arrastró cae a su hueco con la
    // misma curva con la que las otras piezas se apartaron.
    held.current.forEach((node) => {
      node.style.transition = "transform 260ms cubic-bezier(0.16, 1, 0.3, 1)";
      node.style.transform = "";
      window.setTimeout(() => {
        node.style.transition = "";
        node.style.willChange = "";
      }, 300);
    });
    held.current = [];
    setDragging(null);
  };

  React.useEffect(
    () => () => {
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    },
    []
  );

  /** Mover con el teclado: el asa es un botón y responde a las flechas. En una
   *  rejilla, "izquierda" y "derecha" son el mismo paso que "arriba" y
   *  "abajo" —una posición en la lista—, porque es la lista la que decide si
   *  la pieza cae al lado o debajo. */
  const nudge = (id: string, delta: number) => {
    const from = ids.indexOf(id);
    if (from < 0) return;

    if (blocks[from].props.heading) {
      // Un título salta de borde en borde, llevándose su sección.
      const end = runEnd(blocks, from);
      const marks = sectionBoundaries(blocks).filter((mark) => mark <= from || mark >= end);
      const at = marks.indexOf(delta > 0 ? end : from);
      const target = marks[at + (delta > 0 ? 1 : -1)];
      if (target === undefined) return;
      const run = ids.slice(from, end);
      const rest = [...ids.slice(0, from), ...ids.slice(end)];
      rest.splice(target <= from ? target : target - run.length, 0, ...run);
      onOrderChange(rest);
      return;
    }

    const to = from + delta;
    if (to < 0 || to >= ids.length) return;
    if (blocks[to].props.fixed) return;
    moveTo(id, delta > 0 ? to + 1 : to);
  };

  /**
   * Cuando lo que se arrastra es un título, todo lo que cuelga de él viaja
   * con la sección. Se marca en pantalla para que quede claro **qué** se está
   * moviendo antes de soltarlo: sin eso, arrastrar un título parece mover una
   * línea de texto y no cuatro tarjetas.
   */
  const draggingIndex = dragging ? ids.indexOf(dragging) : -1;
  const travelling =
    draggingIndex >= 0 && blocks[draggingIndex]?.props.heading
      ? new Set(ids.slice(draggingIndex, runEnd(blocks, draggingIndex)))
      : null;

  return (
    <div
      ref={root}
      className={cn("grid gap-4", dragging && "select-none")}
      style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}
    >
      {blocks.map((block, index) => {
        const { id, label, fixed, heading, hint } = block.props;
        const span = spans[index];
        const isDragging = dragging === id;
        const isTravelling = !isDragging && travelling?.has(id) === true;

        return (
          /*
           * Dos capas por pieza: fuera el hueco —lo que la rejilla coloca y
           * lo que se mide—, dentro la tarjeta, que es la que se mueve con el
           * cursor. Separarlas es lo que deja medir el hueco sin que la
           * transformación del arrastre ensucie la medida.
           *
           * `layout` anima el cambio de hueco de las *otras* piezas: son ellas
           * las que se apartan. La que se arrastra lo apaga —ya la está
           * moviendo el cursor— y así el salto de su hueco es instantáneo y la
           * compensación cuadra al píxel.
           */
          <motion.div
            key={id}
            ref={(node: HTMLDivElement | null) => {
              if (node) nodes.current.set(id, node);
              else nodes.current.delete(id);
            }}
            data-block-id={id}
            layout={!isDragging && !isTravelling}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            style={{ gridColumn: `span ${span} / span ${span}` }}
            className="flex min-w-0 flex-col"
          >
            <div
              className={cn(
                // La pieza estira su tarjeta hasta el alto de la fila: en una
                // rejilla las vecinas comparten alto, y una tarjeta que no
                // llega deja un escalón en blanco bajo ella.
                "group/block relative flex flex-1 flex-col rounded-2xl [&>*:last-child]:flex-1",
                isDragging
                  ? "z-30 shadow-[0_24px_50px_-20px_rgba(15,23,42,0.45)] ring-2 ring-primary/40"
                  : "transition-shadow duration-200",
                isTravelling &&
                  "z-20 shadow-[0_18px_40px_-22px_rgba(15,23,42,0.4)] ring-2 ring-primary/30"
              )}
            >
              {!fixed && (
                <button
                  type="button"
                  onPointerDown={startDrag(id)}
                  onPointerMove={onDragMove(id)}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                  onLostPointerCapture={endDrag}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
                      event.preventDefault();
                      nudge(id, -1);
                    }
                    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
                      event.preventDefault();
                      nudge(id, 1);
                    }
                  }}
                  title={
                    heading
                      ? `Mover la sección “${label}” con sus tarjetas — arrastra, o usa las flechas`
                      : `Mover “${label}” — arrastra, o usa las flechas`
                  }
                  aria-label={
                    heading
                      ? `Mover la sección “${label}” en el tablero`
                      : `Mover “${label}” en el tablero`
                  }
                  /*
                   * Una pastilla centrada sobre el borde de arriba, no un icono
                   * suelto en la esquina: la esquina ya es de la tarjeta —ahí
                   * viven su franja de color y sus propios botones— y el asa se
                   * leía como parte del contenido. Aparece al pasar por encima
                   * y desaparece sola, así que no le quita nada al gráfico.
                   */
                  className={cn(
                    "absolute -top-1.5 left-1/2 z-20 flex h-5 w-8 -translate-x-1/2 touch-none items-center justify-center",
                    "rounded-full border border-border/70 bg-surface text-text-muted shadow-sm",
                    "cursor-grab transition-all hover:text-text-primary hover:shadow-card active:cursor-grabbing",
                    "opacity-0 group-hover/block:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                    isDragging && "cursor-grabbing text-primary opacity-100"
                  )}
                >
                  <GripHorizontal className="size-3.5" strokeWidth={2.2} />
                </button>
              )}

              {heading ? (
                <header className="flex min-w-0 flex-col gap-0.5 pb-0.5 pt-2">
                  <h3 className="text-[13px] font-bold tracking-tight text-text-primary">
                    {heading}
                  </h3>
                  {hint && (
                    <p className="text-[11.5px] leading-relaxed text-text-muted">{hint}</p>
                  )}
                  <span aria-hidden className="mt-1.5 h-px w-full bg-border/70" />
                </header>
              ) : (
                block
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
