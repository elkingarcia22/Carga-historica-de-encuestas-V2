import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  DonutChart,
  MeterList,
  RankedBarList,
  WaffleGrid,
  type CompositionSlice,
  type RankedBar,
} from "@/components/survey-analytics/compositionCharts";
import type { FilterKey, ResultsFiltersState } from "./useResultsFilters";

/**
 * Las tarjetas con las que se lee el panorama del ciclo.
 *
 * Todas comparten la misma anatomía —título, cifra del total, la línea que
 * explica qué se está mirando y debajo el gráfico— y cambian solo en la forma
 * del gráfico, elegida por lo que cada reparto es: un flujo por etapas, un
 * total con un tramo dominante, un reparto casi parejo, o el mismo indicador
 * comparado entre áreas. Seis barras apiladas idénticas eran seis tarjetas que
 * el ojo dejaba de leer a la tercera.
 *
 * Cada tramo de cada tarjeta enciende su filtro y se lo lleva a las demás
 * pestañas; la tarjeta no sabe cuál, solo recibe su `filterKey`.
 *
 * Ningún estado configurado desaparece por estar en cero. "Riesgo alto: 0" es
 * una lectura —y de las buenas—; esconderlo hace creer que ese estado no
 * existe y deja al lector sin saber cuántos hay en total.
 */

export interface Segment {
  id: string;
  label: string;
  color: string;
  count: number;
}

/** El armazón común: cabecera y contenido. Nadie dibuja su propia tarjeta. */
export function SummaryPanel({
  title,
  hint,
  total,
  aside,
  children,
  className,
}: {
  title: string;
  hint: string;
  /** La cifra sobre la que se reparte todo lo de dentro. */
  total?: number;
  /** Al otro extremo de la cabecera —una lectura corta o un control chico. */
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-border/60 bg-surface p-5 shadow-card",
        className
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-bold text-text-primary">{title}</h3>
            {total !== undefined && (
              <Badge variant="neutral" className="h-5 px-1.5 text-[11px] font-semibold tabular-nums">
                {total}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-[11px] font-medium text-text-muted">{hint}</p>
        </div>
        {aside}
      </header>
      <div className="flex min-h-0 flex-1 flex-col justify-center">{children}</div>
    </article>
  );
}

function EmptyPanel() {
  return <p className="py-6 text-center text-[12px] text-text-muted">Sin datos todavía.</p>;
}

/**
 * Los tramos de un reparto listos para cualquiera de los gráficos.
 *
 * Devuelve todos los estados, incluidos los que van en cero: la geometría de
 * cada gráfico decide si los dibuja (el anillo no, la cuadrícula les da cero
 * celdas), pero la leyenda los lista siempre.
 */
function useSlices(
  segments: readonly Segment[],
  filters: ResultsFiltersState,
  filterKey: FilterKey
): { slices: CompositionSlice[]; sum: number; anyActive: boolean } {
  const slices = segments.map((segment) => ({
    id: segment.id,
    label: segment.label,
    value: segment.count,
    color: segment.color,
    active: filters.isOn(filterKey, segment.id),
  }));
  return {
    slices,
    sum: slices.reduce((acc, slice) => acc + slice.value, 0),
    anyActive: (filters.filters[filterKey] as ReadonlySet<string>).size > 0,
  };
}

interface DistributionProps {
  title: string;
  hint: string;
  total: number;
  segments: readonly Segment[];
  filters: ResultsFiltersState;
  filterKey: FilterKey;
}

/**
 * Un flujo por etapas, como un medidor por etapa.
 *
 * Las etapas del ciclo de vida de un objetivo se comparan entre sí —¿hay más
 * atascados en aprobación que corriendo?—, y eso es justo lo que una barra
 * apilada borra al fundirlas en un solo trazo.
 */
export function FlowDistribution({
  title,
  hint,
  total,
  segments,
  filters,
  filterKey,
}: DistributionProps) {
  const { slices, sum, anyActive } = useSlices(segments, filters, filterKey);
  return (
    <SummaryPanel title={title} hint={hint} total={total}>
      {sum === 0 ? (
        <EmptyPanel />
      ) : (
        <MeterList
          slices={slices}
          total={sum}
          dimInactive={anyActive}
          onSelect={(id) => filters.toggle(filterKey, id)}
        />
      )}
    </SummaryPanel>
  );
}

/**
 * Un reparto con un tramo que manda, como anillo con la cifra en el centro.
 *
 * El riesgo es ese caso: un 86 % que copa la lectura y tres astillas. El
 * centro se queda con el titular —cuánto está sano— y los tramos pequeños
 * siguen siendo visibles como arcos en vez de quedar en tres milímetros al
 * final de una barra.
 */
export function DonutDistribution({
  title,
  hint,
  total,
  segments,
  filters,
  filterKey,
  headline,
}: DistributionProps & {
  /** El tramo que va al centro del anillo, por id. */
  headline: { id: string; label: string };
}) {
  const { slices, sum, anyActive } = useSlices(segments, filters, filterKey);
  const headlineCount = segments.find((segment) => segment.id === headline.id)?.count ?? 0;

  return (
    <SummaryPanel title={title} hint={hint} total={total}>
      {sum === 0 ? (
        <EmptyPanel />
      ) : (
        // Lado a lado solo cuando la tarjeta es ancha: a un tercio de 1024 px
        // el anillo dejaba a la leyenda 150 px y "En periodo de prueba" se
        // recortaba a una letra. Debajo, la leyenda tiene toda la tarjeta.
        <div className="flex flex-col items-center gap-4 xl:flex-row">
          <DonutChart
            slices={slices}
            centerValue={`${Math.round((headlineCount / Math.max(1, sum)) * 100)} %`}
            centerLabel={headline.label}
            ariaLabel={`${title}. ${slices.map((slice) => `${slice.label}: ${slice.value}`).join(", ")}`}
            dimInactive={anyActive}
            onSelect={(id) => filters.toggle(filterKey, id)}
          />
          <SegmentLegend
            slices={slices}
            sum={sum}
            anyActive={anyActive}
            onSelect={(id) => filters.toggle(filterKey, id)}
          />
        </div>
      )}
    </SummaryPanel>
  );
}

/**
 * Un reparto casi parejo, como cuadrícula de cien celdas.
 *
 * Con cuatro tipos de medida repartidos en 21/30/18/30 no hay nada que
 * estimar: se cuentan celdas. Una barra apilada aquí pedía comparar cuatro
 * tramos de largo parecido, que es el trabajo que un gráfico debería ahorrar.
 *
 * Va a lo ancho de la fila y con la leyenda al lado: a un tercio de pantalla
 * las celdas quedaban en cinco píxeles y la leyenda a dos columnas se cortaba
 * antes de nombrar las cuatro medidas.
 */
export function WaffleDistribution({
  title,
  hint,
  total,
  segments,
  filters,
  filterKey,
}: DistributionProps) {
  const { slices, sum, anyActive } = useSlices(segments, filters, filterKey);
  return (
    <SummaryPanel
      title={title}
      hint={hint}
      total={total}
      aside={<span className="shrink-0 text-[10.5px] font-medium text-text-muted">1 celda = 1 %</span>}
    >
      {sum === 0 ? (
        <EmptyPanel />
      ) : (
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-8">
          <div className="min-w-0 flex-1 lg:max-w-[680px]">
            <WaffleGrid
              slices={slices}
              ariaLabel={`${title}. ${slices.map((slice) => `${slice.label}: ${slice.value}`).join(", ")}`}
              dimInactive={anyActive}
              onSelect={(id) => filters.toggle(filterKey, id)}
            />
          </div>
          <div className="w-full shrink-0 lg:w-[300px]">
            <SegmentLegend
              slices={slices}
              sum={sum}
              anyActive={anyActive}
              onSelect={(id) => filters.toggle(filterKey, id)}
            />
          </div>
        </div>
      )}
    </SummaryPanel>
  );
}

/**
 * La leyenda pulsable que acompaña al anillo y a la cuadrícula: el color, el
 * nombre, la cifra exacta y su porcentaje.
 *
 * Un tramo en cero se lista igual, apagado y sin ser pulsable: filtrar por un
 * estado que no le pasó a nadie deja la vista vacía, que no es una respuesta.
 */
function SegmentLegend({
  slices,
  sum,
  anyActive,
  onSelect,
}: {
  slices: readonly CompositionSlice[];
  sum: number;
  anyActive: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="flex w-full min-w-0 flex-col gap-0.5 xl:flex-1">
      {slices.map((slice) => {
        const row = (
          <>
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: slice.color }}
            />
            <span className="min-w-0 flex-1 truncate">{slice.label}</span>
            <span className="shrink-0 font-bold tabular-nums">{slice.value}</span>
            <span className="w-11 shrink-0 whitespace-nowrap text-right tabular-nums text-text-muted">
              {Math.round((slice.value / Math.max(1, sum)) * 100)} %
            </span>
          </>
        );

        if (slice.value === 0) {
          return (
            <li
              key={slice.id}
              className="flex w-full items-center gap-2 px-1.5 py-1 text-left text-[12px] text-text-muted opacity-60"
            >
              {row}
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
                "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[12px] transition-colors",
                slice.active
                  ? "bg-primary/[0.08] font-semibold text-primary"
                  : "text-text-secondary hover:bg-muted/60 hover:text-text-primary",
                anyActive && !slice.active && "opacity-60"
              )}
            >
              {row}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Por qué punta de la lista se entra: la que va peor o la que va mejor. */
export type AreaSort = "rezagadas" | "mejores";

const AREA_ROWS = 6;

/**
 * El avance de cada área en barras horizontales, entrando por el extremo que
 * se quiera mirar.
 *
 * Es la única tarjeta del resumen que compara el mismo indicador entre cosas
 * distintas en vez de repartir un total. "Más rezagadas" responde por dónde
 * está el problema; "Mejor avance" responde a quién copiarle, que es la otra
 * mitad de la pregunta y la que la lista ordenada en un solo sentido escondía.
 */
export function AreaRanking({
  bars,
  hint,
  reference,
  filters,
}: {
  /** Todas las áreas, ordenadas de menor a mayor avance. La tarjeta se queda
   *  con la punta que corresponda; el recorte es suyo porque depende de por
   *  cuál extremo se esté entrando. */
  bars: readonly RankedBar[];
  hint: string;
  reference?: { value: number; label: string };
  filters: ResultsFiltersState;
}) {
  const [sort, setSort] = React.useState<AreaSort>("rezagadas");
  const anyActive = filters.filters.areas.size > 0;

  const visible =
    sort === "rezagadas" ? bars.slice(0, AREA_ROWS) : [...bars].reverse().slice(0, AREA_ROWS);
  const hidden = Math.max(0, bars.length - visible.length);
  const edge = visible[visible.length - 1];

  return (
    <SummaryPanel
      title="Avance por área"
      hint={hint}
      total={bars.length}
      aside={
        bars.length > 1 && (
          <div className="flex shrink-0 rounded-lg bg-muted/60 p-0.5" role="radiogroup" aria-label="Orden">
            <SortOption label="Más rezagadas" active={sort === "rezagadas"} onSelect={() => setSort("rezagadas")} />
            <SortOption label="Mejor avance" active={sort === "mejores"} onSelect={() => setSort("mejores")} />
          </div>
        )
      }
    >
      {bars.length === 0 ? (
        <EmptyPanel />
      ) : (
        <div className="flex flex-col gap-2.5">
          <RankedBarList
            bars={visible}
            reference={reference}
            format={(percent) => `${Math.round(percent)} %`}
            dimInactive={anyActive}
            onSelect={(id) => filters.toggle("areas", id)}
          />
          {hidden > 0 && edge && (
            <p className="text-[11px] font-medium text-text-muted">
              {hidden} {hidden === 1 ? "área más" : "áreas más"}{" "}
              {sort === "rezagadas" ? "por encima" : "por debajo"} del {Math.round(edge.percent)} %.
            </p>
          )}
        </div>
      )}
    </SummaryPanel>
  );
}

function SortOption({
  label,
  active,
  onSelect,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={cn(
        "rounded-[6px] px-2 py-1 text-[11px] font-semibold transition-colors",
        active
          ? "bg-surface text-text-primary shadow-sm"
          : "text-text-muted hover:text-text-primary"
      )}
    >
      {label}
    </button>
  );
}

/** El azul normal de los gráficos: ninguna de las tres cifras que enmarcan
 *  el número grande viene de un estado configurado —a diferencia del riesgo,
 *  el nivel o el estado del objetivo—, así que ninguna se gana un color
 *  propio. */
const STAT_CARD_COLOR = "var(--color-brand)";

/**
 * Una de las tres cifras que enmarcan el número grande.
 *
 * Lleva su propio medidor porque las tres son la misma clase de dato —una
 * parte de un total— y verlo es más rápido que dividir dos cifras a ojo.
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  total,
  share,
  hint,
  color = STAT_CARD_COLOR,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  /** Se muestra tras el valor, en gris, cuando el dato es "x de y". */
  total?: string;
  /** 0–100. Lo que llena el medidor. */
  share: number;
  hint: string;
  /** Por defecto el azul de marca. Solo se pasa otro color cuando la cifra
   *  representa un estado configurado con su propio color. */
  color?: string;
}) {
  return (
    <article className="flex items-start gap-3.5 rounded-2xl border border-border/60 bg-surface p-5 shadow-card">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
      >
        <Icon className="size-4" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold text-text-primary">{label}</p>
        <p className="mt-1 flex items-baseline gap-1 text-[24px] font-extrabold leading-none tracking-tight text-text-primary tabular-nums">
          {value}
          {total && <span className="text-[15px] font-bold text-text-muted">/ {total}</span>}
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted dark:bg-white/10">
            <span
              className="pulse-bar-grow block h-full origin-left rounded-full"
              style={{ width: `${Math.max(2, Math.min(100, share))}%`, backgroundColor: color }}
            />
          </span>
          <span className="shrink-0 text-[11px] font-bold tabular-nums" style={{ color }}>
            {Math.round(share)} %
          </span>
        </div>
        <p className="mt-1.5 text-[11px] font-medium text-text-muted">{hint}</p>
      </div>
    </article>
  );
}
