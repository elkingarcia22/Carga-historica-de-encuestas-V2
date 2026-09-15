import * as React from "react";
import {
  Building2,
  Layers,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Target,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  IMPACT_KIND_ACCENT,
  type ImpactEdge,
  type ImpactGraph,
  type ImpactNode,
  type ImpactNodeKind,
} from "./personImpactGraph";

/**
 * El lienzo del mapa de impacto de una persona.
 *
 * Es el mismo plano del paso de alineación del constructor —retícula que se
 * mueve con el fondo, tarjetas con su franja de acento, flechas curvas hacia
 * el norte, la barra de zoom abajo a la izquierda— pero de solo lectura: aquí
 * no se decide a qué apunta un objetivo, se lee a qué quedó apuntando y
 * cuánto peso viaja por cada flecha. Por eso no hay puertos que arrastrar ni
 * botones de cortar; lo único que hace un clic es aislar el vecindario de una
 * tarjeta para seguir sus conexiones sin el ruido del resto.
 *
 * No reutiliza `AlignmentCanvas` porque la mitad de ese componente es el
 * gesto de alinear —el puerto, la flecha en el aire, el menú "Alinear"— y
 * apagarlo a base de props dejaría un lienzo lleno de affordances muertas.
 * Reutiliza, en cambio, su gramática visual, que es lo que el lector reconoce.
 */

const PORT_CLEARANCE = 10;
const MIN_ZOOM = 0.3;
const MIN_FIT_ZOOM = 0.5;
const MAX_ZOOM = 1.8;

interface Viewport {
  x: number;
  y: number;
  k: number;
}

interface Point {
  x: number;
  y: number;
}

const KIND_ICON: Readonly<Record<ImpactNodeKind, LucideIcon>> = {
  company: Building2,
  objective: Target,
  person: UserRound,
  origin: Layers,
};

export function PersonImpactCanvas({
  graph,
  fitKey,
  className,
}: {
  graph: ImpactGraph;
  /** Cambia cuando el mapa pasa a ser otro: reencuadra. */
  fitKey: string;
  className?: string;
}) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const [view, setView] = React.useState<Viewport>({ x: 40, y: 24, k: 0.85 });
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [hoverEdgeId, setHoverEdgeId] = React.useState<string | null>(null);
  const pan = React.useRef<{ startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(
    null
  );

  const nodeById = React.useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes]
  );

  // ── Encuadre ─────────────────────────────────────────────────────────────

  const fit = React.useCallback(() => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect || graph.nodes.length === 0) return;
    const minX = Math.min(...graph.nodes.map((node) => node.x));
    const minY = Math.min(...graph.nodes.map((node) => node.y));
    const maxX = Math.max(...graph.nodes.map((node) => node.x + node.width));
    const maxY = Math.max(...graph.nodes.map((node) => node.y + node.height));
    const padding = 40;
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const k = Math.min(
      MAX_ZOOM,
      Math.max(
        MIN_FIT_ZOOM,
        Math.min((rect.width - padding * 2) / width, (rect.height - padding * 2) / height)
      )
    );
    const spareX = rect.width - width * k;
    const spareY = rect.height - height * k;
    setView({
      k,
      x: (spareX > 0 ? spareX / 2 : padding) - minX * k,
      y: (spareY > 0 ? spareY / 2 : padding) - minY * k,
    });
  }, [graph.nodes]);

  const fitRef = React.useRef(fit);
  React.useEffect(() => {
    fitRef.current = fit;
  });
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => fitRef.current());
    return () => cancelAnimationFrame(frame);
  }, [fitKey]);

  // El lienzo se monta dentro de un drawer que todavía está deslizándose:
  // su ancho al primer frame no es el definitivo. Se reencuadra cuando la
  // caja termina de cambiar de tamaño, no solo al abrir.
  React.useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => fitRef.current());
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const zoomBy = (factor: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    setView((current) => {
      const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.k * factor));
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      return { k, x: cx - ((cx - current.x) / current.k) * k, y: cy - ((cy - current.y) / current.k) * k };
    });
  };

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
        return { k, x: px - ((px - current.x) / current.k) * k, y: py - ((py - current.y) / current.k) * k };
      });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  // ── Gestos ───────────────────────────────────────────────────────────────

  const handlePointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0 && event.button !== 1) return;
    pan.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: view.x,
      originY: view.y,
      moved: false,
    };
    viewportRef.current?.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const active = pan.current;
    if (!active) return;
    const dx = event.clientX - active.startX;
    const dy = event.clientY - active.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) active.moved = true;
    setView((current) => ({ ...current, x: active.originX + dx, y: active.originY + dy }));
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    const active = pan.current;
    pan.current = null;
    viewportRef.current?.releasePointerCapture(event.pointerId);
    // Un clic seco sobre el fondo suelta la selección; un arrastre no.
    if (active && !active.moved) setSelectedId(null);
  };

  // ── Pintado ──────────────────────────────────────────────────────────────

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
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={cn(
        "relative h-full w-full cursor-grab touch-none overflow-hidden rounded-xl border border-border/60 bg-surface-subtle active:cursor-grabbing",
        className
      )}
    >
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
          <marker id="impact-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-brand)" />
          </marker>
          <marker id="impact-arrow-carry" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-indigo)" />
          </marker>
          <marker id="impact-arrow-muted" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
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
              isDimmed={relatedIds !== null && !(relatedIds.has(edge.from) && relatedIds.has(edge.to))}
              onHoverChange={(hovered) => setHoverEdgeId(hovered ? edge.id : null)}
            />
          ))}
        </g>
      </svg>

      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
      >
        {graph.nodes.map((node) => (
          <ImpactNodeCard
            key={node.id}
            node={node}
            isSelected={selectedId === node.id}
            isDimmed={relatedIds !== null && !relatedIds.has(node.id)}
            onSelect={() => setSelectedId((current) => (current === node.id ? null : node.id))}
          />
        ))}
      </div>

      <div className="pointer-events-auto absolute bottom-3 left-3 flex items-center gap-1 rounded-xl border border-border/60 bg-surface/95 p-1 shadow-card backdrop-blur">
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
          label="Quitar el foco"
          onClick={() => {
            setSelectedId(null);
            fit();
          }}
        >
          <RotateCcw className="size-4" strokeWidth={2.2} />
        </CanvasButton>
      </div>
    </div>
  );
}

// ── Tarjeta ────────────────────────────────────────────────────────────────

function ImpactNodeCard({
  node,
  isSelected,
  isDimmed,
  onSelect,
}: {
  node: ImpactNode;
  isSelected: boolean;
  isDimmed: boolean;
  onSelect: () => void;
}) {
  const Icon = KIND_ICON[node.kind];
  const accent = IMPACT_KIND_ACCENT[node.kind];
  const isCompany = node.kind === "company";
  const isPerson = node.kind === "person";

  return (
    <div
      data-node-id={node.id}
      className={cn(
        "absolute select-none transition-opacity duration-200",
        isDimmed && !isSelected && "opacity-25",
        node.isMuted && !isSelected && !isDimmed && "opacity-60"
      )}
      style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
    >
      <button
        type="button"
        aria-pressed={isSelected}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onSelect}
        className={cn(
          "relative flex h-full w-full cursor-pointer flex-col justify-center gap-1 overflow-hidden rounded-xl border bg-surface pl-4 pr-3 text-left shadow-card transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          isCompany ? "border-primary/25 bg-primary/[0.04]" : "border-border/70",
          isPerson && "border-[color:var(--color-positive)]/35 bg-[color:var(--color-positive)]/[0.04]",
          node.isMuted && "border-dashed",
          isSelected && "border-primary/60 shadow-drawer"
        )}
      >
        <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] rounded-l-xl" style={{ backgroundColor: accent }} />

        <div className="flex items-center gap-2">
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}
          >
            <Icon className="size-[13px]" strokeWidth={2.3} />
          </span>
          <h4
            className={cn(
              "min-w-0 flex-1 truncate text-[12.5px] font-bold leading-tight tracking-tight text-text-primary",
              (isCompany || isPerson) && "text-[13px]"
            )}
            title={node.title}
          >
            {node.title}
          </h4>
        </div>

        <p className="truncate pl-8 text-[11px] font-medium leading-tight text-text-secondary">{node.subtitle}</p>

        <div className="flex min-w-0 items-center gap-1.5 pl-8">
          {node.badge !== null && (
            <span
              className="shrink-0 whitespace-nowrap rounded-full px-1.5 py-[1px] text-[10px] font-bold tabular-nums"
              style={
                node.isMuted
                  ? { backgroundColor: "color-mix(in srgb, var(--color-text-muted) 12%, transparent)", color: "var(--color-text-muted)" }
                  : { backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`, color: accent }
              }
            >
              {node.badge}
            </span>
          )}
          {node.note !== null && (
            <span className="truncate text-[10px] font-medium text-text-muted">{node.note}</span>
          )}
        </div>

        {/* La barra fina de avance, como la de la tabla: cuánto lleva ese
            objetivo, pintado con el color de su banda de cumplimiento. */}
        {node.progress && (
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-border/40">
            <span
              className="absolute inset-y-0 left-0"
              style={{
                width: `${Math.max(0, Math.min(100, node.progress.percent))}%`,
                backgroundColor: node.progress.colorHex ?? accent,
              }}
            />
          </span>
        )}
      </button>

      {/* Los puertos son solo señal: dicen por dónde entra y sale cada línea. */}
      {node.kind !== "origin" && (
        <span
          aria-hidden
          className="absolute -right-[6px] top-1/2 size-[12px] -translate-y-1/2 rounded-full border-2 border-surface"
          style={{ backgroundColor: `color-mix(in srgb, ${accent} 55%, transparent)` }}
        />
      )}
      {!isCompany && (
        <span
          aria-hidden
          className="absolute -left-[6px] top-1/2 size-[12px] -translate-y-1/2 rounded-full border-2 border-surface"
          style={{ backgroundColor: `color-mix(in srgb, ${accent} 55%, transparent)` }}
        />
      )}
    </div>
  );
}

// ── Flechas ────────────────────────────────────────────────────────────────

function curve(from: Point, to: Point): string {
  const bend = Math.max(60, Math.abs(from.x - to.x) * 0.45);
  return `M ${from.x} ${from.y} C ${from.x - bend} ${from.y}, ${to.x + bend} ${to.y}, ${to.x} ${to.y}`;
}

function curveMidpoint(from: Point, to: Point): Point {
  const bend = Math.max(60, Math.abs(from.x - to.x) * 0.45);
  const c1 = { x: from.x - bend, y: from.y };
  const c2 = { x: to.x + bend, y: to.y };
  return {
    x: (from.x + 3 * c1.x + 3 * c2.x + to.x) / 8,
    y: (from.y + 3 * c1.y + 3 * c2.y + to.y) / 8,
  };
}

const EDGE_PAINT: Readonly<
  Record<ImpactEdge["style"], { stroke: string; marker: string; dash: string | undefined; opacity: number; width: number }>
> = {
  alignment: { stroke: "var(--color-brand)", marker: "impact-arrow", dash: undefined, opacity: 0.6, width: 2 },
  carry: { stroke: "var(--color-indigo)", marker: "impact-arrow-carry", dash: undefined, opacity: 0.4, width: 1.5 },
  membership: { stroke: "var(--color-border-strong)", marker: "impact-arrow-muted", dash: "5 5", opacity: 0.45, width: 1.5 },
};

function EdgeLine({
  edge,
  from,
  to,
  isHovered,
  isDimmed,
  onHoverChange,
}: {
  edge: ImpactEdge;
  from: ImpactNode | undefined;
  to: ImpactNode | undefined;
  isHovered: boolean;
  isDimmed: boolean;
  onHoverChange: (hovered: boolean) => void;
}) {
  if (!from || !to) return null;

  const start = { x: from.x - PORT_CLEARANCE, y: from.y + from.height / 2 };
  const end = { x: to.x + to.width + PORT_CLEARANCE, y: to.y + to.height / 2 };
  const path = curve(start, end);
  const midpoint = curveMidpoint(start, end);
  const paint = edge.isInactive
    ? { ...EDGE_PAINT.membership, dash: "4 5", opacity: 0.35 }
    : EDGE_PAINT[edge.style];

  return (
    <g opacity={isDimmed ? 0.1 : 1}>
      <path
        d={path}
        fill="none"
        stroke={paint.stroke}
        strokeOpacity={isHovered ? 1 : paint.opacity}
        strokeWidth={isHovered ? paint.width + 1 : paint.width}
        strokeDasharray={paint.dash}
        strokeLinecap="round"
        markerEnd={`url(#${paint.marker})`}
      />
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        style={{ pointerEvents: "stroke" }}
        onPointerEnter={() => onHoverChange(true)}
        onPointerLeave={() => onHoverChange(false)}
      />
      {edge.label !== null && (
        <g transform={`translate(${midpoint.x} ${midpoint.y})`} pointerEvents="none">
          <rect
            x={-17}
            y={-10}
            width={34}
            height={20}
            rx={10}
            fill="var(--color-surface)"
            stroke={edge.isInactive ? "var(--color-border)" : "var(--color-brand)"}
            strokeOpacity={edge.isInactive ? 1 : 0.35}
            strokeWidth={1}
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={10}
            fontWeight={700}
            fill={edge.isInactive ? "var(--color-text-muted)" : "var(--color-brand)"}
          >
            {edge.label}
          </text>
        </g>
      )}
    </g>
  );
}

// ── Controles ──────────────────────────────────────────────────────────────

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

/** La leyenda del mapa: un punto por familia de tarjeta. */
export function ImpactLegend({ className }: { className?: string }) {
  const items: readonly { kind: ImpactNodeKind; label: string }[] = [
    { kind: "company", label: "Empresa" },
    { kind: "objective", label: "Objetivo" },
    { kind: "person", label: "Persona" },
    { kind: "origin", label: "Origen" },
  ];
  return (
    <ul
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border/60 bg-surface-subtle px-2.5 py-1.5",
        className
      )}
    >
      {items.map((item) => (
        <li key={item.kind} className="flex items-center gap-1.5 text-[11px] font-semibold text-text-secondary">
          <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: IMPACT_KIND_ACCENT[item.kind] }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
