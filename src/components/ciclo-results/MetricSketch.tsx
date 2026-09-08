import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/survey-analytics/pulseCharts";
import { DonutChart, RankedBarList, shareColor } from "@/components/survey-analytics/compositionCharts";
import {
  dimensionOf,
  measureOf,
  shapeOf,
  type MetricDefinition,
} from "./metricDefinition";

/**
 * La métrica, dibujada mientras se arma.
 *
 * Es la pieza que hace que el formulario sirva: alguien elige "cumplimiento
 * por líder en barras" y ve, ahí mismo, cuatro barras con nombres de líderes
 * y porcentajes. Si eso no era lo que tenía en la cabeza, cambia una opción y
 * vuelve a mirar —en vez de crear la métrica y descubrirlo después.
 *
 * Los datos son de mentira a propósito y lo dice en la propia tarjeta: no es
 * un reporte, es la forma del reporte.
 */

const DEMO_PERCENTS = [38, 62, 77, 91];
const DEMO_COLORS = ["#4F46E5", "#0EA5E9", "#8B5CF6", "#14B8A6"];

export function MetricSketch({ metric }: { metric: MetricDefinition }) {
  const shape = shapeOf(metric);
  const measure = measureOf(metric);
  const dimension = dimensionOf(metric);
  const labels = dimension.examples;

  return (
    <figure className="m-0 overflow-hidden rounded-xl border border-border/60 bg-surface">
      <figcaption className="flex items-center justify-between gap-3 border-b border-border/50 bg-surface-muted/50 px-3.5 py-2">
        <span className="min-w-0 truncate text-[12px] font-semibold text-text-primary">
          {metric.title.trim() || measure.label}
        </span>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Datos de ejemplo
        </span>
      </figcaption>
      <div className="px-3.5 py-3.5">
        {shape.id === "kpi" && <KpiSketch measureLabel={measure.label} value={measure.sample(3)} />}
        {shape.id === "barras" && (
          <RankedBarList
            bars={labels.map((label, index) => ({
              id: label,
              label,
              percent: DEMO_PERCENTS[index],
              // La barra siempre se llena con el porcentaje de ejemplo, pero
              // la cifra de la derecha es la medida que se pidió: si dice
              // "días de retraso", ahí se lee "24 d" y no "38 %".
              valueLabel: measure.sample(index),
              color: shareColor(DEMO_PERCENTS[index]),
            }))}
            format={(percent) => `${percent} %`}
          />
        )}
        {shape.id === "anillo" && (
          <div className="flex items-center gap-4">
            <DonutChart
              slices={labels.slice(0, 4).map((label, index) => ({
                id: label,
                label,
                value: DEMO_PERCENTS[index],
                color: DEMO_COLORS[index],
              }))}
              size={104}
              thickness={13}
              // El hueco del anillo no repite un valor de un tramo: dice qué
              // es el anillo entero. Poner ahí "91 %" cuando los tramos son
              // porcentajes haría creer que el total suma 91.
              centerValue="100 %"
              centerLabel="del total"
              ariaLabel={`Vista previa: ${measure.label} por ${dimension.label}`}
            />
            <ul className="flex min-w-0 flex-1 flex-col gap-1">
              {labels.slice(0, 4).map((label, index) => (
                <li key={label} className="flex items-center gap-2 text-[12px] text-text-secondary">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: DEMO_COLORS[index] }}
                  />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  <span className="shrink-0 font-bold tabular-nums text-text-primary">
                    {measure.sample(index)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {shape.id === "linea" && (
          <div className="flex flex-col gap-1">
            <Sparkline
              points={["Ago", "Sep", "Oct", "Nov", "Dic"].map((name, index) => ({
                id: name,
                name,
                value: [22, 41, 55, 72, 88][index],
              }))}
              target={100}
              format={(value) => `${value} %`}
              ariaLabel={`Vista previa: ${measure.label} en el tiempo`}
              height={72}
              showPoints
              fitTarget={false}
            />
            <p className="text-[11px] font-medium text-text-muted">
              {measure.label} · un punto por {dimension.label.toLowerCase()}
            </p>
          </div>
        )}
        {shape.id === "tabla" && <TableSketch labels={labels} dimension={dimension.label} measure={measure} />}
        {shape.id === "mapa" && <HeatmapSketch labels={labels} />}
      </div>
    </figure>
  );
}

function KpiSketch({ measureLabel, value }: { measureLabel: string; value: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-semibold text-text-muted">{measureLabel}</p>
        <p className="mt-1 text-[34px] font-extrabold leading-none tracking-tight tabular-nums text-text-primary">
          {value}
        </p>
      </div>
      <span className="rounded-md bg-status-positive/10 px-2 py-1 text-[11px] font-bold text-status-positive">
        +6 pts
      </span>
    </div>
  );
}

function TableSketch({
  labels,
  dimension,
  measure,
}: {
  labels: readonly string[];
  dimension: string;
  measure: { label: string; sample: (index: number) => string };
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/50">
      <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-border/50 bg-surface-muted/60 px-3 py-1.5">
        <span className="truncate text-[10.5px] font-bold uppercase tracking-wider text-text-muted">
          {dimension}
        </span>
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-text-muted">
          {measure.label}
        </span>
      </div>
      {labels.map((label, index) => (
        <div
          key={label}
          className={cn(
            "grid grid-cols-[1fr_auto] gap-3 px-3 py-1.5 text-[12px]",
            index < labels.length - 1 && "border-b border-border/40"
          )}
        >
          <span className="truncate text-text-secondary">{label}</span>
          <span className="font-bold tabular-nums text-text-primary">{measure.sample(index)}</span>
        </div>
      ))}
    </div>
  );
}

function HeatmapSketch({ labels }: { labels: readonly string[] }) {
  const cells = [
    [92, 78, 61, 44],
    [70, 88, 52, 36],
    [48, 66, 84, 58],
    [34, 55, 72, 90],
  ];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-[64px_repeat(4,1fr)] items-center gap-1">
        <span />
        {["Ago", "Sep", "Oct", "Nov"].map((month) => (
          <span key={month} className="text-center text-[10px] font-semibold text-text-muted">
            {month}
          </span>
        ))}
      </div>
      {labels.map((label, row) => (
        <div key={label} className="grid grid-cols-[64px_repeat(4,1fr)] items-center gap-1">
          <span className="truncate text-[10.5px] font-medium text-text-secondary">{label}</span>
          {cells[row].map((value, column) => (
            <span
              key={column}
              title={`${label} · ${value} %`}
              className="flex h-6 items-center justify-center rounded text-[10.5px] font-bold tabular-nums text-white/95"
              style={{ backgroundColor: shareColor(value), opacity: 0.55 + (value / 100) * 0.45 }}
            >
              {value}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
