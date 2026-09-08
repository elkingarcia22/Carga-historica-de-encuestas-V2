import * as React from "react";
import {
  CheckCircle2,
  Info,
  Target,
  TrendingUp,
  UserCheck,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AttentionAction, AttentionStrip, type AttentionTone } from "@/components/feedback";
import { DeltaPill } from "@/components/survey-analytics/DeltaPill";
import { DialGauge, RingGauge, SHARE_DIAL_ZONES, Sparkline } from "@/components/survey-analytics/pulseCharts";
import { AnimatedNumber, MiniMetricCard, type MiniMetricTone } from "@/components/survey-results/MiniMetricCard";
import {
  NEGATIVE,
  POSITIVE,
  YELLOW,
  deltaTone,
  formatDelta,
  formatPercent,
  toneForParticipation,
  type MetricTone,
} from "@/components/survey-results/favorabilityScale";
import { useObjetivosConfig } from "@/components/objetivos/objetivosConfigStore";
import type { CicloListRow } from "@/components/ciclo-detail";
import {
  NO_FILTERS,
  filtersEqual,
  matchesFilters,
  type CicloFilterableRow,
  type CicloListFilters,
} from "@/components/ciclo-list/cicloListFilters";
import { METRIC_PRESETS, PRESET_ICONS, formatCount, type MetricPreset } from "./homeMetrics";
import { AVANCE_TARGET, buildHomePulse, formatCicloCount, type PulseMetric } from "./homePulse";

interface HomePulseStripProps {
  ciclos: readonly CicloListRow[];
  className?: string;
}

/**
 * The block between the templates shelf and the home tabs: three averaged
 * readings, each drawn as the chart its own scale calls for. The alerts that
 * go with them sit inside the Ciclos tab, right above the list they filter —
 * see `AlertsRow` below.
 *
 * The cards are the same `MiniMetricCard` a ciclo's own tracking view uses, so
 * the home and one ciclo speak one visual language. Avance is a share of a
 * whole, so it gets a ring. Cumplimiento is something you watch move from one
 * ciclo to the next, so it gets a sparkline with the target drawn in. The
 * share of people who already reported lives on a banded 0–100 scale, so it
 * gets a gauge.
 */
/** The ring's stroke color, matching the rings a ciclo's own tracking view
 *  draws — not the cards' generic status palette — so the same reading is the
 *  same green everywhere it appears as a ring. */
const RING_COLOR_BY_TONE: Readonly<Record<MetricTone, string>> = {
  positive: POSITIVE,
  warning: YELLOW,
  negative: NEGATIVE,
};

export function HomePulseStrip({ ciclos, className }: HomePulseStripProps) {
  const config = useObjetivosConfig();
  const progressConfig = React.useMemo(
    () => ({
      estados: config.estados,
      niveles: config.niveles,
      allowNegative: config.allowNegativeResults,
    }),
    [config]
  );
  const pulse = React.useMemo(() => buildHomePulse(ciclos, progressConfig), [ciclos, progressConfig]);

  const avanceTone = pulse.avance.value === null ? null : toneForParticipation(pulse.avance.value);

  return (
    <section aria-label="Pulso de objetivos" className={cn("grid grid-cols-1 gap-3 sm:grid-cols-3", className)}>
      <PulseCard
        icon={Target}
        label="Avance"
        hint="Promedio del avance de las personas de cada ciclo ya iniciado — el mismo cálculo que la vista de seguimiento de un ciclo."
        metric={pulse.avance}
        tone={avanceTone === null ? "brand" : avanceTone}
        color={avanceTone === null ? undefined : RING_COLOR_BY_TONE[avanceTone]}
        chart={
          pulse.avance.value !== null && (
            <RingGauge
              value={pulse.avance.value}
              ariaLabel={`${formatPercent(pulse.avance.value)} de avance promedio`}
            />
          )
        }
      />

      <PulseCard
        icon={TrendingUp}
        label="Objetivos cumplidos"
        hint={`Porcentaje de objetivos asignados que ya llegaron al 100 %. La línea recorre los últimos ciclos por fecha de cierre; la guía punteada marca la meta de ${AVANCE_TARGET} % cuando queda dentro del rango dibujado.`}
        metric={pulse.cumplimiento}
        tone={pulse.cumplimiento.value === null ? "brand" : toneForParticipation(pulse.cumplimiento.value)}
        chartPlacement="bottom"
        chart={
          <Sparkline
            points={pulse.cumplimiento.series}
            target={AVANCE_TARGET}
            // The series keeps its own shape rather than being squashed flat
            // to keep a target it is nowhere near in view; the guide draws
            // itself only when it falls inside the range.
            fitTarget={false}
            format={formatPercent}
            ariaLabel={`Objetivos cumplidos en los últimos ${pulse.cumplimiento.series.length} ciclos`}
          />
        }
      />

      <PulseCard
        icon={UserCheck}
        label="Personas reportando"
        hint="Porcentaje de las personas del ciclo que ya reportaron al menos un avance. El dial va de 0 a 100 %: zona de riesgo bajo 50, en camino de 50 a 79 y en meta desde 80."
        metric={pulse.reporte}
        tone={pulse.reporte.value === null ? "brand" : toneForParticipation(pulse.reporte.value)}
        chart={
          pulse.reporte.value !== null && (
            <DialGauge
              value={pulse.reporte.value}
              min={0}
              max={100}
              zones={SHARE_DIAL_ZONES}
              formatBound={(bound) => `${bound}%`}
              ariaLabel={`${formatPercent(pulse.reporte.value)} de las personas ya reportaron avance`}
            />
          )
        }
      />
    </section>
  );
}

// --- Metric cards ------------------------------------------------------------

/** One averaged reading on the shared card: number, delta against the earlier
 *  ciclos, how many ciclos it is over, and its chart. */
function PulseCard({
  icon,
  label,
  hint,
  metric,
  tone,
  color,
  chart,
  chartPlacement,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  metric: PulseMetric;
  tone: MiniMetricTone;
  /** Overrides the tone palette with the tracking view's own ring colors. */
  color?: string;
  chart: React.ReactNode;
  chartPlacement?: "side" | "bottom";
}) {
  const value = metric.value;
  const delta = value !== null && metric.previous !== null ? value - metric.previous : null;

  return (
    <MiniMetricCard
      icon={icon}
      label={`${label} promedio`}
      tone={value === null ? "neutral" : tone}
      color={value !== null ? color : undefined}
      value={
        value !== null ? (
          <AnimatedNumber value={value} format={formatPercent} />
        ) : (
          <span className="text-text-muted">—</span>
        )
      }
      valueAside={
        delta !== null && (
          <DeltaPill
            size="xs"
            value={delta}
            label={formatDelta(delta)}
            tone={deltaTone(delta)}
            direction={delta > 0.5 ? "up" : delta < -0.5 ? "down" : "flat"}
            className="shrink-0"
          />
        )
      }
      caption={
        value !== null ? `${formatCicloCount(metric.count)} · vs ciclos anteriores` : "Sin ciclos iniciados"
      }
      chart={value !== null ? chart : undefined}
      chartPlacement={chartPlacement}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="img"
            aria-label={`Qué mide ${label} promedio`}
            className="shrink-0 rounded-md p-0.5 text-text-muted transition-colors hover:text-text-primary"
          >
            <Info className="h-3 w-3" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px]">{hint}</TooltipContent>
      </Tooltip>
    </MiniMetricCard>
  );
}

// --- Alerts row --------------------------------------------------------------

const PRESET_TONE: Readonly<Record<NonNullable<MetricPreset["tone"]> | "default", AttentionTone>> = {
  default: "brand",
  brand: "brand",
  warning: "warning",
  negative: "negative",
};

/** Order the alert buttons appear in. */
const ALERT_ORDER: readonly string[] = ["closing", "low"];

/**
 * One notice row: it says how many ciclos need a hand and offers a button per
 * reason. Same presets and the same `matchesFilters`/`filtersEqual` logic the
 * column menus run, so a button's count and the rows its click reveals can
 * never disagree. A reason with nothing behind it is not shown — an alert for
 * zero ciclos is not an alert.
 *
 * Lives inside the Ciclos tab, right above the list it filters — its buttons
 * set the same column filters the table reads.
 */
export function AlertsRow({
  ciclos,
  filters,
  onFiltersChange,
  className,
}: {
  ciclos: readonly CicloFilterableRow[];
  filters: CicloListFilters;
  onFiltersChange: (filters: CicloListFilters) => void;
  className?: string;
}) {
  // Resolved once per render so every button judges the date buckets against
  // the same instant the table does.
  const today = React.useMemo(() => new Date(), []);
  const countFor = (preset: MetricPreset) =>
    ciclos.filter((ciclo) => matchesFilters(ciclo, preset.filters, today)).length;

  const presets = [...METRIC_PRESETS].sort(
    (a, b) => ALERT_ORDER.indexOf(a.id) - ALERT_ORDER.indexOf(b.id)
  );
  // Counted as distinct ciclos: one that is both closing soon and behind on
  // avance is one ciclo to look at, not two.
  const attention = ciclos.filter((ciclo) =>
    presets.some((preset) => matchesFilters(ciclo, preset.filters, today))
  ).length;
  const calm = attention === 0;

  return (
    <AttentionStrip
      label="Alertas de ciclos"
      tone={calm ? "positive" : "warning"}
      icon={calm ? CheckCircle2 : TriangleAlert}
      title={
        calm
          ? "Todo en orden"
          : `${formatCount(attention)} ${attention === 1 ? "ciclo requiere" : "ciclos requieren"} atención`
      }
      detail={
        calm
          ? "Ningún ciclo por cerrar ni con avance bajo"
          : "Toca una alerta para ver solo esos ciclos en la lista"
      }
      className={className}
    >
      {presets.map((preset) => {
        const count = countFor(preset);
        const active = filtersEqual(filters, preset.filters);
        if (count === 0 && !active) return null;
        return (
          <AttentionAction
            key={preset.id}
            icon={PRESET_ICONS[preset.id]}
            label={preset.label}
            hint={preset.hint}
            value={count}
            tone={PRESET_TONE[preset.tone ?? "default"]}
            active={active}
            onClick={() => onFiltersChange(active ? NO_FILTERS : preset.filters)}
          />
        );
      })}
    </AttentionStrip>
  );
}
