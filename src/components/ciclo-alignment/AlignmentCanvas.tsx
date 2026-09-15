import * as React from "react";
import { Maximize2, Minus, Plus, RotateCcw, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlignmentNodeCard, type CompanyOption } from "./AlignmentNodeCard";
import {
  companyIdOfNode,
  type AlignmentEdge,
  type AlignmentGraph,
  type AlignmentNode,
  type ObjectiveRef,
} from "./alignmentGraph";

export interface NodePosition {
  x: number;
  y: number;
}

export type NodePositions = Readonly<Record<string, NodePosition>>;

interface AlignmentCanvasProps {
  graph: AlignmentGraph;
  companyOptions: readonly CompanyOption[];
  /** Lo que el autor movió a mano en visitas anteriores al paso. */
  initialPositions: NodePositions;
  /** Se avisa al soltar, no en cada píxel: mover una tarjeta no es un cambio
   *  del ciclo, es una preferencia de lectura. */
  onPositionsCommit: (positions: NodePositions) => void;
  /** El ID de la tarjeta seleccionada (controlado desde afuera). */
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
  /** Elementos adicionales para la barra flotante. */
  actions?: React.ReactNode;
  /** Alinea (o desalinea, con `null`) los objetivos que una tarjeta lleva. */
  onAlign: (refs: readonly ObjectiveRef[], companyObjectiveId: string | null) => void;
  /** Cambia cuando el mapa pasa a ser otro: reencuadra. */
  fitKey: string;
}

const PORT_CLEARANCE = 13;
const MIN_ZOOM = 0.25;
/** El encuadre automático no baja de aquí: un mapa entero pero ilegible no
 *  es un encuadre, es una miniatura. Por debajo de este zoom se prefiere
 *  enseñar la esquina de arriba y dejar que el autor recorra el resto. */
const MIN_FIT_ZOOM = 0.45;
const MAX_ZOOM = 1.8;
const GRID = 8;

interface Viewport {
  x: number;
  y: number;
  k: number;
}

type Gesture =
  | { type: "pan"; startX: number; startY: number; originX: number; originY: number }
  | { type: "node"; id: string; grabX: number; grabY: number; moved: boolean }
  | { type: "link"; sourceId: string };

/**
 * El lienzo: un plano infinito con las tarjetas encima y las flechas debajo.
 *
 * Se mueve arrastrando el fondo, se acerca con la rueda o con los controles,
 * y se conecta arrastrando desde el puerto de una tarjeta hasta un objetivo
 * de la empresa. Las flechas van en un `<svg>` por debajo de la capa de
 * tarjetas —HTML para lo que se lee y se enfoca, SVG para lo que se curva—
 * y ambas capas comparten la misma transformación, así que nunca se separan.
 */
export function AlignmentCanvas({
  graph,
  companyOptions,
  initialPositions,
  onPositionsCommit,
  selectedId,
  onSelectId,
  actions,
  onAlign,
  fitKey,
}: AlignmentCanvasProps) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const [view, setView] = React.useState<Viewport>({ x: 40, y: 24, k: 0.85 });
  const [positions, setPositions] = React.useState<NodePositions>(initialPositions);
  const [hoverEdgeId, setHoverEdgeId] = React.useState<string | null>(null);
  const [link, setLink] = React.useState<{ sourceId: string; x: number; y: number } | null>(null);
  const [dropTargetId, setDropTargetId] = React.useState<string | null>(null);
  const gesture = React.useRef<Gesture | null>(null);

  // Las tarjetas colocadas: la posición por defecto del grafo, salvo que el
  // autor la haya movido.
  const nodes = React.useMemo<AlignmentNode[]>(
    () =>
      graph.nodes.map((node) => {
        const moved = positions[node.id];
        return moved ? { ...node, x: moved.x, y: moved.y } : node;
      }),
    [graph.nodes, positions]
  );

  const nodeById = React.useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes]
  );

  const toWorld = React.useCallback(
    (clientX: number, clientY: number): NodePosition => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - view.x) / view.k,
        y: (clientY - rect.top - view.y) / view.k,
      };
    },
    [view]
  );

  // ── Encuadre ─────────────────────────────────────────────────────────────

  const fit = React.useCallback(() => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect || nodes.length === 0) return;
    const minX = Math.min(...nodes.map((node) => node.x));
    const minY = Math.min(...nodes.map((node) => node.y));
    const maxX = Math.max(...nodes.map((node) => node.x + node.width));
    const maxY = Math.max(...nodes.map((node) => node.y + node.height));
    const padding = 48;
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const k = Math.min(
      MAX_ZOOM,
      Math.max(
        MIN_FIT_ZOOM,
        Math.min(
          (rect.width - padding * 2) / width,
          (rect.height - padding * 2) / height
        )
      )
    );
    // Lo que quepa se centra; lo que no, arranca pegado al margen, porque
    // centrar un mapa más alto que el lienzo esconde su principio.
    const spareX = rect.width - width * k;
    const spareY = rect.height - height * k;
    setView({
      k,
      x: (spareX > 0 ? spareX / 2 : padding) - minX * k,
      y: (spareY > 0 ? spareY / 2 : padding) - minY * k,
    });
  }, [nodes]);

  // Un nivel nuevo es un mapa nuevo: se encuadra solo, porque heredar el
  // encuadre del anterior deja al autor mirando un trozo vacío del plano.
  // `fit` queda fuera de las dependencias a propósito: cambia con cada
  // arrastre de tarjeta, y reencuadrar en mitad de un arrastre sería mover
  // el suelo bajo los pies del autor. `fitKey` dice cuándo el mapa es otro.
  const fitRef = React.useRef(fit);
  React.useEffect(() => {
    fitRef.current = fit;
  });
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => fitRef.current());
    return () => cancelAnimationFrame(frame);
  }, [fitKey]);

  const zoomBy = (factor: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    setView((current) => {
      const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.k * factor));
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      return {
        k,
        x: cx - ((cx - current.x) / current.k) * k,
        y: cy - ((cy - current.y) / current.k) * k,
      };
    });
  };

  // La rueda tiene que poder cancelarse para que la página no se lleve el
  // scroll, y React solo registra listeners pasivos: va a mano.
  React.useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      setView((current) => {
        const factor = Math.exp(-event.deltaY * 0.0016);
        const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.k * factor));
        return {
          k,
          x: px - ((px - current.x) / current.k) * k,
          y: py - ((py - current.y) / current.k) * k,
        };
      });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  // ── Gestos ───────────────────────────────────────────────────────────────

  const beginGesture = (event: React.PointerEvent, next: Gesture) => {
    gesture.current = next;
    viewportRef.current?.setPointerCapture(event.pointerId);
  };

  const handleBackgroundPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0 && event.button !== 1) return;
    // Un popover de una tarjeta se pinta en un portal —fuera de este div—
    // pero sigue siendo hijo suyo en el árbol de React, así que su
    // `pointerdown` llega hasta aquí. Sin este corte, el lienzo captura el
    // puntero y se queda con el `mouseup`: el menú se abre y no responde a
    // nada. El DOM es la única fuente fiable de qué está dentro del plano.
    const element = viewportRef.current;
    if (element && event.target instanceof Node && !element.contains(event.target)) return;
    beginGesture(event, {
      type: "pan",
      startX: event.clientX,
      startY: event.clientY,
      originX: view.x,
      originY: view.y,
    });
    onSelectId(null);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const active = gesture.current;
    if (!active) return;

    if (active.type === "pan") {
      setView((current) => ({
        ...current,
        x: active.originX + (event.clientX - active.startX),
        y: active.originY + (event.clientY - active.startY),
      }));
      return;
    }

    const world = toWorld(event.clientX, event.clientY);

    if (active.type === "node") {
      active.moved = true;
      setPositions((current) => ({
        ...current,
        [active.id]: {
          x: Math.round((world.x - active.grabX) / GRID) * GRID,
          y: Math.round((world.y - active.grabY) / GRID) * GRID,
        },
      }));
      return;
    }

    setLink({ sourceId: active.sourceId, x: world.x, y: world.y });
    setDropTargetId(companyNodeAt(nodes, world));
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    const active = gesture.current;
    gesture.current = null;
    viewportRef.current?.releasePointerCapture(event.pointerId);
    if (!active) return;

    if (active.type === "node") {
      if (active.moved) onPositionsCommit(positions);
      else onSelectId(selectedId === active.id ? null : active.id);
      return;
    }

    if (active.type === "link") {
      const world = toWorld(event.clientX, event.clientY);
      const targetNodeId = companyNodeAt(nodes, world);
      const companyId = targetNodeId === null ? null : companyIdOfNode(targetNodeId);
      const source = nodeById.get(active.sourceId);
      if (companyId !== null && source) onAlign(source.objectiveRefs, companyId);
      setLink(null);
      setDropTargetId(null);
      // Al soltar se devuelve el mapa entero: la tarjeta se resaltó para
      // seguir el gesto, y dejarla resaltada apaga todo lo demás justo
      // cuando el autor va a por la siguiente.
      onSelectId(null);
    }
  };

  // ── Pintado ──────────────────────────────────────────────────────────────

  const isLinking = link !== null;
  const linkSource = link === null ? null : nodeById.get(link.sourceId) ?? null;

  /** Con algo seleccionado, el mapa se queda en su vecindario. */
  const relatedIds = React.useMemo(() => {
    if (selectedId === null) return null;
    const related = new Set<string>([selectedId]);
    graph.edges.forEach((edge) => {
      if (edge.from === selectedId) related.add(edge.to);
      if (edge.to === selectedId) related.add(edge.from);
    });
    return related;
  }, [selectedId, graph.edges]);

  return (
    <div
      ref={viewportRef}
      onPointerDown={handleBackgroundPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative h-full w-full cursor-grab touch-none overflow-hidden rounded-2xl border border-border/60 bg-surface-subtle active:cursor-grabbing"
    >
      {/* Retícula: el plano se mueve con ella, así el desplazamiento se ve. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(circle, color-mix(in srgb, var(--color-border) 70%, transparent) 1px, transparent 1px)",
          backgroundSize: `${24 * view.k}px ${24 * view.k}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
      />

      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <marker
            id="alignment-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-brand)" />
          </marker>
          <marker
            id="alignment-arrow-muted"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-border-strong)" />
          </marker>
        </defs>

        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {graph.edges.map((edge) => (
            <EdgeLine
              key={edge.id}
              edge={edge}
              from={nodeById.get(edge.from)}
              to={nodeById.get(edge.to)}
              isHovered={hoverEdgeId === edge.id}
              isDimmed={
                relatedIds !== null && !(relatedIds.has(edge.from) && relatedIds.has(edge.to))
              }
              onHoverChange={(hovered) => setHoverEdgeId(hovered ? edge.id : null)}
              onCut={() => onAlign(edge.refs, null)}
            />
          ))}

          {link !== null && linkSource !== null && (
            <path
              d={curve(
                { x: linkSource.x - PORT_CLEARANCE, y: linkSource.y + linkSource.height / 2 },
                { x: link.x, y: link.y }
              )}
              fill="none"
              stroke="var(--color-brand)"
              strokeWidth={2.5 / view.k}
              strokeDasharray={`${6 / view.k} ${5 / view.k}`}
              strokeLinecap="round"
            />
          )}
        </g>
      </svg>

      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
      >
        {nodes.map((node) => (
          <AlignmentNodeCard
            key={node.id}
            node={node}
            isSelected={selectedId === node.id}
            isDimmed={relatedIds !== null && !relatedIds.has(node.id)}
            isDropCandidate={isLinking && node.kind === "company"}
            isDropHovered={dropTargetId === node.id}
            isLinkSource={link?.sourceId === node.id}
            companyOptions={companyOptions}
            onSelect={() => onSelectId(selectedId === node.id ? null : node.id)}
            onPointerDownCard={(event) => {
              if (event.button !== 0) return;
              event.stopPropagation();
              const world = toWorld(event.clientX, event.clientY);
              beginGesture(event, {
                type: "node",
                id: node.id,
                grabX: world.x - node.x,
                grabY: world.y - node.y,
                moved: false,
              });
            }}
            onStartLink={(event) => {
              if (event.button !== 0) return;
              event.stopPropagation();
              const world = toWorld(event.clientX, event.clientY);
              beginGesture(event, { type: "link", sourceId: node.id });
              setLink({ sourceId: node.id, x: world.x, y: world.y });
              onSelectId(node.id);
            }}
            onAlign={(companyObjectiveId) => onAlign(node.objectiveRefs, companyObjectiveId)}
            onUnalign={() => onAlign(node.objectiveRefs, null)}
          />
        ))}
      </div>

      <div className="pointer-events-auto absolute bottom-3 left-3 flex items-center gap-1 rounded-xl border border-border/60 bg-surface/95 p-1 shadow-card backdrop-blur">
        {actions && (
          <>
            {actions}
            <span aria-hidden className="mx-0.5 h-5 w-px bg-border/70" />
          </>
        )}
        <CanvasButton label="Alejar" onClick={() => zoomBy(1 / 1.25)}>
          <Minus className="size-4" strokeWidth={2.4} />
        </CanvasButton>
        <span className="min-w-[42px] text-center text-[11px] font-bold tabular-nums text-text-secondary">
          {Math.round(view.k * 100)} %
        </span>
        <CanvasButton label="Acercar" onClick={() => zoomBy(1.25)}>
          <Plus className="size-4" strokeWidth={2.4} />
        </CanvasButton>
        <span aria-hidden className="mx-0.5 h-5 w-px bg-border/70" />
        <CanvasButton label="Ajustar a la pantalla" onClick={fit}>
          <Maximize2 className="size-4" strokeWidth={2.2} />
        </CanvasButton>
        <CanvasButton
          label="Reorganizar tarjetas"
          onClick={() => {
            setPositions({});
            onPositionsCommit({});
            requestAnimationFrame(fit);
          }}
        >
          <RotateCcw className="size-4" strokeWidth={2.2} />
        </CanvasButton>
      </div>
    </div>
  );
}

function CanvasButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClick}
          className="flex size-7 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

/** La curva entre dos puntos: horizontal en las puntas, para que entre y
 *  salga perpendicular a la tarjeta en vez de en diagonal. */
function curve(from: NodePosition, to: NodePosition): string {
  const bend = Math.max(60, Math.abs(from.x - to.x) * 0.45);
  return `M ${from.x} ${from.y} C ${from.x - bend} ${from.y}, ${to.x + bend} ${to.y}, ${to.x} ${to.y}`;
}

/** El punto medio real de esa curva (t = 0.5), donde vive el botón de cortar. */
function curveMidpoint(from: NodePosition, to: NodePosition): NodePosition {
  const bend = Math.max(60, Math.abs(from.x - to.x) * 0.45);
  const c1 = { x: from.x - bend, y: from.y };
  const c2 = { x: to.x + bend, y: to.y };
  return {
    x: (from.x + 3 * c1.x + 3 * c2.x + to.x) / 8,
    y: (from.y + 3 * c1.y + 3 * c2.y + to.y) / 8,
  };
}

function EdgeLine({
  edge,
  from,
  to,
  isHovered,
  isDimmed,
  onHoverChange,
  onCut,
}: {
  edge: AlignmentEdge;
  from: AlignmentNode | undefined;
  to: AlignmentNode | undefined;
  isHovered: boolean;
  isDimmed: boolean;
  onHoverChange: (hovered: boolean) => void;
  onCut: () => void;
}) {
  if (!from || !to) return null;

  // Las puntas se quedan a un pelo de las tarjetas: pegadas al borde, el
  // puerto (un círculo de 14 px) se traga la punta de flecha y la línea
  // parece cortada en seco en vez de apuntar a algo.
  const start = { x: from.x - PORT_CLEARANCE, y: from.y + from.height / 2 };
  const end = { x: to.x + to.width + PORT_CLEARANCE, y: to.y + to.height / 2 };
  const path = curve(start, end);
  const midpoint = curveMidpoint(start, end);
  const width = 1.4 + Math.min(edge.strength, 8) * 0.35;

  return (
    <g opacity={isDimmed ? 0.12 : 1}>
      <path
        d={path}
        fill="none"
        stroke={edge.removable ? "var(--color-brand)" : "var(--color-border-strong)"}
        strokeOpacity={edge.removable ? (isHovered ? 1 : 0.55) : 0.4}
        strokeWidth={isHovered ? width + 1 : width}
        strokeDasharray={edge.removable ? undefined : "5 5"}
        strokeLinecap="round"
        markerEnd={`url(#${edge.removable ? "alignment-arrow" : "alignment-arrow-muted"})`}
      />
      {/* Franja invisible: acertarle a una línea de 2 px con el ratón no es
          una interacción, es puntería. */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        style={{ pointerEvents: "stroke" }}
        onPointerEnter={() => onHoverChange(true)}
        onPointerLeave={() => onHoverChange(false)}
        onPointerDown={(event) => event.stopPropagation()}
      />

      {edge.strength > 1 && (
        <g transform={`translate(${midpoint.x} ${midpoint.y})`} pointerEvents="none">
          <circle r={11} fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth={1} />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={10}
            fontWeight={700}
            fill="var(--color-text-secondary)"
          >
            {edge.strength}
          </text>
        </g>
      )}

      {isHovered && edge.removable && (
        <g
          transform={`translate(${midpoint.x} ${midpoint.y - (edge.strength > 1 ? 26 : 0)})`}
          style={{ pointerEvents: "auto", cursor: "pointer" }}
          onPointerEnter={() => onHoverChange(true)}
          onPointerLeave={() => onHoverChange(false)}
          onPointerDown={(event) => {
            event.stopPropagation();
            onCut();
          }}
        >
          <circle r={11} fill="var(--color-negative)" />
          <X x={-6} y={-6} width={12} height={12} stroke="white" strokeWidth={3} />
        </g>
      )}
    </g>
  );
}

/** El objetivo de empresa bajo un punto del plano, si hay alguno. */
function companyNodeAt(nodes: readonly AlignmentNode[], point: NodePosition): string | null {
  const hit = nodes.find(
    (node) =>
      node.kind === "company" &&
      point.x >= node.x &&
      point.x <= node.x + node.width &&
      point.y >= node.y &&
      point.y <= node.y + node.height
  );
  return hit?.id ?? null;
}
