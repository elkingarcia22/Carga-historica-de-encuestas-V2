import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * La familia de "composición": cuatro formas de responder de qué está hecho
 * un total.
 *
 * Existen porque un tablero armado con seis barras apiladas iguales no es un
 * tablero, es una lista con colores: nada manda, nada se distingue y el ojo
 * deja de leer a la tercera. Cada forma de aquí sirve a una pregunta distinta
 * y por eso vale la variedad —no al contrario—:
 *
 * - `MeterList`     · un total que va por etapas ordenadas (un flujo).
 * - `DonutChart`    · un total con un tramo que manda y el resto en astillas.
 * - `WaffleGrid`    · un total repartido casi en partes iguales, en unidades.
 * - `RankedBarList` · comparar magnitudes entre muchos ítems, ya ordenados.
 *
 * Todas son puras y todas son pulsables: reciben `activeId`/`onSelect` y quien
 * las use decide qué filtra cada tramo. Un gráfico que no se puede pulsar en
 * una herramienta de análisis es un adorno.
 */

export interface CompositionSlice {
  id: string;
  label: string;
  value: number;
  color: string;
  /** Está seleccionado como filtro. */
  active?: boolean;
}

/** Los tres tramos con los que el producto lee un porcentaje de avance —los
 *  mismos cortes que el dial de participación y la columna "% Avance". */
export function shareColor(percent: number): string {
  if (percent >= 80) return "#22C55E";
  if (percent >= 50) return "#F59E0B";
  return "#EF4444";
}

/** Reparte `total` en 100 celdas sin perder ni inventar ninguna: parte entera
 *  primero y las que sobran a los restos más grandes. Redondear cada tramo por
 *  su cuenta daría 99 o 101 celdas y la cuadrícula se vería incompleta. */
function largestRemainder(values: readonly number[], cells: number): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return values.map(() => 0);
  const exact = values.map((value) => (value / total) * cells);
  const floors = exact.map(Math.floor);
  let left = cells - floors.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, rest: value - Math.floor(value) }))
    .sort((a, b) => b.rest - a.rest);
  for (const { index } of order) {
    if (left <= 0) break;
    floors[index] += 1;
    left -= 1;
  }
  return floors;
}

// --- Donut -------------------------------------------------------------------

const DONUT_GAP = 2.5;

/**
 * Los tramos de un total como arcos de un mismo anillo, con la cifra que
 * importa en el hueco del centro.
 *
 * Se dibuja con `stroke-dasharray` sobre círculos —no con sectores— para que
 * cada arco abra desde cero al montar, igual que los anillos del resto de la
 * app, y para que el hueco entre tramos sea siempre el mismo grosor.
 */
export function DonutChart({
  slices,
  centerValue,
  centerLabel,
  ariaLabel,
  size = 132,
  thickness = 15,
  dimInactive = false,
  onSelect,
}: {
  slices: readonly CompositionSlice[];
  /** La lectura que va en el centro; el anillo no la repite en su leyenda. */
  centerValue?: string;
  centerLabel?: string;
  ariaLabel: string;
  size?: number;
  thickness?: number;
  /** Hay algún tramo activo, así que los demás se apagan. */
  dimInactive?: boolean;
  onSelect?: (id: string) => void;
}) {
  const [drawn, setDrawn] = React.useState(false);
  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => setDrawn(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const center = size / 2;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  let cursor = 0;
  // Un tramo en cero no se dibuja: darle el mínimo de un píxel pintaría una
  // rayita para un estado que no le pasó a nadie. Sigue existiendo en la
  // leyenda, que es donde toca leer "riesgo alto: 0".
  const arcs = slices
    .filter((slice) => slice.value > 0)
    .map((slice) => {
      const share = total <= 0 ? 0 : slice.value / total;
      const start = cursor;
      cursor += share;
      // Un tramo diminuto se queda sin arco si le quitamos el hueco completo,
      // así que el hueco nunca se come más de la mitad de lo que mide.
      const length = share * circumference;
      const gap = Math.min(DONUT_GAP, length / 2);
      return { slice, start, length: Math.max(1, length - gap) };
    });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={ariaLabel}
      className="shrink-0"
    >
      <g transform={`rotate(-90 ${center} ${center})`}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          className="stroke-muted dark:stroke-white/10"
        />
        {arcs.map(({ slice, start, length }) => (
          <circle
            key={slice.id}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={slice.color}
            strokeWidth={thickness}
            strokeDasharray={`${drawn ? length : 0} ${circumference}`}
            strokeDashoffset={-start * circumference}
            onClick={onSelect ? () => onSelect(slice.id) : undefined}
            className={cn(
              "pulse-ring-draw transition-opacity duration-300",
              onSelect && "cursor-pointer hover:opacity-80",
              dimInactive && !slice.active && "opacity-30"
            )}
          >
            <title>{`${slice.label} · ${slice.value}`}</title>
          </circle>
        ))}
      </g>
      {(centerValue || centerLabel) && (
        <g className="pulse-fade-in">
          {centerValue && (
            <text
              x={center}
              y={centerLabel ? center - 3 : center}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-text-primary text-[21px] font-extrabold tabular-nums"
            >
              {centerValue}
            </text>
          )}
          {centerLabel && (
            <text
              x={center}
              y={center + 15}
              textAnchor="middle"
              className="fill-text-muted text-[9.5px] font-semibold"
            >
              {centerLabel}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}

// --- Waffle ------------------------------------------------------------------

const WAFFLE_COLS = 20;
const WAFFLE_ROWS = 5;

/**
 * Cien celdas repartidas entre los tramos: cada celda es un punto porcentual
 * del total.
 *
 * Para el reparto casi parejo, donde una barra apilada obliga a comparar
 * cuatro tramos de longitudes parecidas. Aquí no hay que estimar nada: se
 * cuentan celdas, y las cuatro filas y media dicen "esto es el 100 %" sin
 * escribirlo.
 */
export function WaffleGrid({
  slices,
  ariaLabel,
  dimInactive = false,
  onSelect,
}: {
  slices: readonly CompositionSlice[];
  ariaLabel: string;
  dimInactive?: boolean;
  onSelect?: (id: string) => void;
}) {
  const counts = largestRemainder(slices.map((slice) => slice.value), WAFFLE_COLS * WAFFLE_ROWS);
  const cells = slices.flatMap((slice, index) =>
    Array.from({ length: counts[index] }, () => slice)
  );

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="grid w-full gap-[3px]"
      style={{
        gridTemplateColumns: `repeat(${WAFFLE_COLS}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${WAFFLE_ROWS}, 1fr)`,
      }}
    >
      {cells.map((slice, index) => (
        <button
          key={index}
          type="button"
          disabled={!onSelect}
          onClick={onSelect ? () => onSelect(slice.id) : undefined}
          title={`${slice.label} · ${slice.value}`}
          // El escalonado sale del índice y no de una clase por celda: cien
          // reglas de animación para cien cuadros no las quiere nadie.
          style={{ backgroundColor: slice.color, animationDelay: `${300 + index * 5}ms` }}
          className={cn(
            "pulse-fade-in aspect-square rounded-[2.5px] transition-opacity duration-300",
            onSelect && "cursor-pointer hover:opacity-70",
            dimInactive && !slice.active && "opacity-25"
          )}
        />
      ))}
    </div>
  );
}

// --- Meter list --------------------------------------------------------------

/**
 * Un medidor por etapa, uno debajo de otro: nombre, barra hasta su parte del
 * total, cifra y porcentaje.
 *
 * Para un total que avanza por etapas —por aprobar, por iniciar, en progreso,
 * completado—: la barra apilada las junta en un solo trazo y borra justo lo
 * que importa, que son cinco magnitudes que se comparan entre sí. Las barras
 * se miden contra el tramo más grande, no contra el total, para que el 7 % no
 * quede como un hilo invisible al lado del 45 %.
 *
 * Una etapa en cero se queda en la lista con la barra vacía y sin ser
 * pulsable: que a nadie le haya pasado es información, y esconderla haría
 * creer que la etapa no existe. Filtrar por ella no llevaría a ninguna parte.
 */
export function MeterList({
  slices,
  total,
  dimInactive = false,
  onSelect,
}: {
  slices: readonly CompositionSlice[];
  total: number;
  dimInactive?: boolean;
  onSelect?: (id: string) => void;
}) {
  const peak = Math.max(1, ...slices.map((slice) => slice.value));

  return (
    <ul className="flex flex-col gap-2">
      {slices.map((slice) => {
        const share = total <= 0 ? 0 : Math.round((slice.value / total) * 100);
        const content = (
          <>
            <span className="flex items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="truncate text-[12px] font-medium">{slice.label}</span>
              </span>
              <span className="shrink-0 text-[12px] tabular-nums">
                <span className="font-bold text-text-primary">{slice.value}</span>
                <span className="ml-1.5 font-medium text-text-muted">{share} %</span>
              </span>
            </span>
            <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-muted dark:bg-white/10">
              <span
                className="pulse-bar-grow block h-full origin-left rounded-full"
                style={{
                  width: slice.value === 0 ? "0%" : `${Math.max(2, (slice.value / peak) * 100)}%`,
                  backgroundColor: slice.color,
                }}
              />
            </span>
          </>
        );

        if (!onSelect || slice.value === 0) {
          return (
            <li
              key={slice.id}
              className={cn("text-text-secondary", slice.value === 0 && "opacity-55")}
            >
              {content}
            </li>
          );
        }
        return (
          <li key={slice.id}>
            <button
              type="button"
              onClick={() => onSelect(slice.id)}
              aria-pressed={slice.active}
              className={cn(
                "-mx-1.5 flex w-[calc(100%+0.75rem)] flex-col rounded-lg px-1.5 py-1 text-left transition-colors",
                slice.active
                  ? "bg-primary/[0.08] text-primary"
                  : "text-text-secondary hover:bg-muted/60 hover:text-text-primary",
                dimInactive && !slice.active && "opacity-60"
              )}
            >
              {content}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// --- Ranked bars -------------------------------------------------------------

export interface RankedBar {
  id: string;
  label: string;
  /** 0–100. La barra se mide contra la escala completa, no contra el máximo:
   *  media pantalla de barras casi llenas es la lectura correcta cuando todo
   *  el mundo va bien. */
  percent: number;
  /** Segunda línea de la etiqueta —cuánta gente hay detrás del promedio. */
  detail?: string;
  /** La cifra de la derecha, cuando lo que se mide no es el porcentaje que
   *  llena la barra: días, personas, una calificación. Sin esto se formatea
   *  `percent`, que es el caso normal. */
  valueLabel?: string;
  color: string;
  active?: boolean;
}

/**
 * Una barra horizontal por ítem, ya ordenadas por quien las manda.
 *
 * Para comparar el mismo indicador entre muchas cosas —el avance de cada
 * área—: en horizontal caben nombres largos sin girar el texto, y ordenadas
 * de peor a mejor la primera fila es el titular.
 */
export function RankedBarList({
  bars,
  reference,
  format,
  dimInactive = false,
  onSelect,
}: {
  bars: readonly RankedBar[];
  /** Una guía vertical punteada —el calendario corrido, la meta— contra la
   *  que se lee cada barra. */
  reference?: { value: number; label: string };
  format: (percent: number) => string;
  dimInactive?: boolean;
  onSelect?: (id: string) => void;
}) {
  return (
    <div className="relative flex flex-col gap-1">
      {reference && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 z-10 w-0 border-l border-dashed border-text-muted/50"
          style={{ left: `calc(38% + (100% - 38%) * ${Math.min(100, Math.max(0, reference.value)) / 100})` }}
          title={reference.label}
        />
      )}
      {bars.map((bar) => {
        const row = (
          <>
            <span className="w-[38%] shrink-0 pr-2">
              <span className="block truncate text-[12px] font-medium leading-tight">{bar.label}</span>
              {bar.detail && (
                <span className="block truncate text-[10.5px] leading-tight text-text-muted">
                  {bar.detail}
                </span>
              )}
            </span>
            <span className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted dark:bg-white/10">
              <span
                className="pulse-bar-grow absolute inset-y-0 left-0 origin-left rounded-full"
                style={{
                  width: `${Math.max(1.5, Math.min(100, bar.percent))}%`,
                  backgroundColor: bar.color,
                }}
              />
            </span>
            <span className="ml-2 max-w-[88px] shrink-0 truncate text-right text-[12px] font-bold tabular-nums text-text-primary">
              {bar.valueLabel ?? format(bar.percent)}
            </span>
          </>
        );

        if (!onSelect) {
          return (
            <div key={bar.id} className="flex items-center text-text-secondary">
              {row}
            </div>
          );
        }
        return (
          <button
            key={bar.id}
            type="button"
            onClick={() => onSelect(bar.id)}
            aria-pressed={bar.active}
            className={cn(
              "-mx-1.5 flex items-center rounded-lg px-1.5 py-1 text-left transition-colors",
              bar.active
                ? "bg-primary/[0.08] text-primary"
                : "text-text-secondary hover:bg-muted/60 hover:text-text-primary",
              dimInactive && !bar.active && "opacity-60"
            )}
          >
            {row}
          </button>
        );
      })}
    </div>
  );
}
