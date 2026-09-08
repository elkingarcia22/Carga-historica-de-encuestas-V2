import * as React from "react";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/components/ciclo-detail";
import type { TimelinePoint } from "./resultsModel";

/**
 * Avance real contra calendario, en el tiempo.
 *
 * La referencia dibuja "progreso en el tiempo" como barras sueltas, y unas
 * barras solas no dicen nada: un 40 % en marzo es bueno o malo según cuánto
 * del ciclo llevaba corrido en marzo. Por eso aquí van las dos líneas juntas —
 * lo logrado en sólido, lo esperado punteado— y el área entre ellas es
 * literalmente el atraso. Es la única lectura que hace falta explicar una vez.
 *
 * SVG a mano en vez de una librería: son dos series de doce puntos, y traerse
 * un motor de gráficos para eso cuesta más kilobytes que todo el resto de la
 * pestaña.
 */

const VIEW_W = 640;
const VIEW_H = 180;
const PAD_X = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;

interface ProgressTimelineProps {
  points: readonly TimelinePoint[];
  className?: string;
}

export function ProgressTimeline({ points, className }: ProgressTimelineProps) {
  const [hovered, setHovered] = React.useState<number | null>(null);

  if (points.length < 2) {
    return (
      <div
        className={cn(
          "flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-border/60 px-6 text-center text-[12.5px] text-text-muted",
          className
        )}
      >
        Todavía no hay suficiente historia para dibujar la evolución del ciclo.
      </div>
    );
  }

  // La escala llega hasta 100 o hasta el máximo alcanzado, lo que sea mayor:
  // un ciclo que sobrecumplió no puede salirse del cuadro.
  const top = Math.max(100, ...points.map((point) => point.percent));
  const innerH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  const innerW = VIEW_W - PAD_X * 2;

  const x = (index: number) => PAD_X + (index / (points.length - 1)) * innerW;
  const y = (value: number) => PAD_TOP + innerH - (value / top) * innerH;

  const line = (accessor: (point: TimelinePoint) => number) =>
    points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(accessor(point))}`).join(" ");

  const realPath = line((point) => point.percent);
  const planPath = line((point) => point.elapsed);
  const areaPath = `${realPath} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;

  const active = hovered === null ? points.length - 1 : hovered;
  const activePoint = points[active];
  const gap = Math.round(activePoint.elapsed - activePoint.percent);

  return (
    <figure className={cn("flex min-w-0 flex-col gap-2", className)}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-[11px] font-bold uppercase tracking-wide text-text-secondary">
          Avance vs. calendario
        </span>
        <span className="flex items-center gap-3 text-[11.5px] text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-4 rounded-full bg-primary" />
            Avance real
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-0 w-4 border-t-2 border-dashed border-border-strong"
            />
            Calendario
          </span>
        </span>
      </figcaption>

      <div className="relative">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="h-[180px] w-full overflow-visible"
          role="img"
          aria-label={`Avance del ciclo mes a mes. Último punto: ${formatPercent(
            activePoint.percent
          )} con ${Math.round(activePoint.elapsed)} % del calendario corrido.`}
          onMouseLeave={() => setHovered(null)}
        >
          <defs>
            <linearGradient id="ciclo-timeline-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Referencia del 100 %: la meta, no una línea de rejilla más. */}
          <line
            x1={PAD_X}
            x2={VIEW_W - PAD_X}
            y1={y(100)}
            y2={y(100)}
            className="stroke-border"
            strokeWidth={1}
            strokeDasharray="2 4"
          />
          <text
            x={VIEW_W - PAD_X}
            y={y(100) - 5}
            textAnchor="end"
            className="fill-text-muted text-[9px] font-semibold"
          >
            meta 100 %
          </text>

          <path d={areaPath} fill="url(#ciclo-timeline-fill)" className="text-primary" />
          <path
            d={planPath}
            fill="none"
            className="stroke-text-muted"
            strokeOpacity={0.7}
            strokeWidth={1.5}
            strokeDasharray="5 4"
            strokeLinecap="round"
          />
          <path
            d={realPath}
            fill="none"
            className="stroke-primary"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((point, index) => (
            <g key={point.date}>
              <circle
                cx={x(index)}
                cy={y(point.percent)}
                r={index === active ? 4.5 : 2.5}
                className={cn("fill-surface stroke-primary transition-all", index === active && "drop-shadow")}
                strokeWidth={2.5}
              />
              <text
                x={x(index)}
                y={VIEW_H - 6}
                textAnchor="middle"
                className={cn(
                  "text-[9.5px] font-semibold",
                  index === active ? "fill-text-primary" : "fill-text-muted"
                )}
              >
                {point.label}
              </text>
              {/* Zona de captura: una banda ancha, para no obligar a apuntar
                  al punto exacto. */}
              <rect
                x={x(index) - innerW / (points.length - 1) / 2}
                y={0}
                width={innerW / (points.length - 1)}
                height={VIEW_H}
                fill="transparent"
                onMouseEnter={() => setHovered(index)}
              />
            </g>
          ))}
        </svg>
      </div>

      <p className="text-[12px] text-text-secondary">
        <span className="font-bold text-text-primary">{activePoint.label}</span> ·{" "}
        {formatPercent(activePoint.percent)} de avance con {Math.round(activePoint.elapsed)} % del
        ciclo corrido
        {gap > 2 ? (
          <span className="font-semibold text-status-negative"> · {gap} puntos por debajo</span>
        ) : gap < -2 ? (
          <span className="font-semibold text-status-positive"> · {Math.abs(gap)} puntos por delante</span>
        ) : (
          <span className="font-semibold text-status-positive"> · al día</span>
        )}
      </p>
    </figure>
  );
}
