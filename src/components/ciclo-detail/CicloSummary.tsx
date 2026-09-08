import * as React from "react";
import { CalendarRange, Hourglass, Target, UsersRound } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { cascadeContainer, cascadeItem } from "@/lib/cascadeAnimation";
import { CICLO_PERIOD_LABELS } from "@/components/ciclo-builder";
import {
  getEstadoBadgeConfig,
  type NivelDesempenoConfig,
  type ObjetivoEstadoConfig,
} from "@/components/objetivos/objetivosConfigStore";
import type { CicloDetailData } from "./cicloDetailTypes";
import {
  daysUntil,
  elapsedShare,
  estadosForStatus,
  formatLongDate,
  formatPercent,
  type CicloSummaryStats,
} from "./cicloProgress";
import { DistributionBar, EstadoChip, NivelChip } from "./StatusChips";
import { formatCount } from "./tableUtils";

/**
 * La cabecera de la vista: cómo va el ciclo antes de mirar a nadie en
 * particular. Cuatro paneles con jerarquía distinta —el avance general manda,
 * los demás lo explican— en vez de cuatro tarjetas iguales en fila.
 */
export function CicloSummary({
  data,
  stats,
  estados,
  niveles,
}: {
  data: CicloDetailData;
  stats: CicloSummaryStats;
  estados: readonly ObjetivoEstadoConfig[];
  niveles: readonly NivelDesempenoConfig[];
}) {
  const remaining = daysUntil(data.endDate);
  const elapsed = elapsedShare(data.startDate, data.endDate);
  const overallBadge = stats.overallEstado ? getEstadoBadgeConfig(stats.overallEstado) : null;

  return (
    <motion.section
      variants={cascadeContainer}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-4"
      aria-label="Resumen del ciclo"
    >
      <motion.div variants={cascadeItem} className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-text-secondary">
        <span className="inline-flex items-center gap-1.5">
          <CalendarRange className="size-3.5 text-text-muted" strokeWidth={2.2} />
          <span className="font-semibold text-text-primary">{CICLO_PERIOD_LABELS[data.period]}</span>
          <span aria-hidden>·</span>
          {formatLongDate(`${data.startDate}T12:00:00`)} – {formatLongDate(`${data.endDate}T12:00:00`)}
        </span>
        {data.status === "live" && (
          <span className="inline-flex items-center gap-1.5">
            <Hourglass className="size-3.5 text-text-muted" strokeWidth={2.2} />
            {remaining > 0
              ? `${remaining} ${remaining === 1 ? "día restante" : "días restantes"}`
              : "Cierra hoy"}
          </span>
        )}
        {data.description && (
          <span className="basis-full text-text-muted sm:basis-auto sm:truncate sm:max-w-[60ch]" title={data.description}>
            {data.description}
          </span>
        )}
      </motion.div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Avance general */}
        <motion.article
          variants={cascadeItem}
          className="relative flex flex-col justify-between gap-5 overflow-hidden rounded-2xl border border-border/60 bg-surface p-6 shadow-card lg:col-span-5"
        >
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute -right-10 -top-10 size-40 rounded-full opacity-[0.12] blur-2xl",
              overallBadge?.barBg ?? "bg-primary"
            )}
          />
          <header className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-text-secondary">
                Avance general del ciclo
              </p>
              <p className="mt-1 text-[12px] text-text-muted">
                Promedio ponderado de {formatCount(stats.peopleCount)} colaboradores
              </p>
            </div>
            <EstadoChip estado={stats.overallEstado} />
          </header>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <span className="flex items-baseline gap-1">
              <span
                className={cn(
                  "text-[44px] font-black leading-none tabular-nums tracking-tight",
                  overallBadge?.iconColor ?? "text-primary"
                )}
              >
                {formatPercent(stats.overallPercent).replace(" %", "")}
              </span>
              <span className="text-[18px] font-bold text-muted-foreground/60">%</span>
            </span>
            <div className="flex flex-col items-end gap-1 text-right">
              <span className="text-[11px] font-bold uppercase tracking-wide text-text-secondary">
                Nivel de desempeño
              </span>
              <NivelChip nivel={stats.overallNivel} className="text-[13px]" />
            </div>
          </div>

          <NivelScale niveles={niveles} percent={stats.overallPercent} />

          {data.status === "live" && (
            <p className="flex items-center gap-2 text-[11.5px] text-text-muted">
              <span className="relative h-1 w-24 overflow-hidden rounded-full bg-border/50">
                <span className="absolute inset-y-0 left-0 rounded-full bg-text-muted/60" style={{ width: `${elapsed}%` }} />
              </span>
              {Math.round(elapsed)} % del calendario transcurrido
            </p>
          )}
        </motion.article>

        {/* Colaboradores + objetivos */}
        <motion.article
          variants={cascadeItem}
          className="flex flex-col gap-5 rounded-2xl border border-border/60 bg-surface p-6 shadow-card lg:col-span-3"
        >
          <Stat
            icon={UsersRound}
            label="Colaboradores"
            value={formatCount(stats.peopleCount)}
            hint={`${formatCount(stats.peopleWithProgress)} con avance · ${formatCount(stats.peopleCount - stats.peopleWithProgress)} sin reportar`}
          />
          <span aria-hidden className="h-px w-full bg-border/60" />
          <Stat
            icon={Target}
            label="Objetivos asignados"
            value={formatCount(stats.objectiveCount)}
            hint={`${formatCount(stats.achievedObjectives)} cumplidos · ${stats.groupCount} ${stats.groupCount === 1 ? "grupo" : "grupos"}${stats.individualCount > 0 ? ` · ${stats.individualCount} individuales` : ""}`}
          />
        </motion.article>

        {/* Distribución por estado */}
        <motion.article
          variants={cascadeItem}
          className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-surface p-6 shadow-card lg:col-span-4"
        >
          <header>
            <p className="text-[11px] font-bold uppercase tracking-wide text-text-secondary">
              Colaboradores por estado
            </p>
            <p className="mt-1 text-[12px] text-text-muted">Según los rangos configurados en el módulo</p>
          </header>
          <EstadoBreakdown estados={estadosForStatus(estados, data.status)} counts={stats.estadoCounts} />
        </motion.article>
      </div>
    </motion.section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-[18px]" strokeWidth={2.2} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-text-secondary">{label}</p>
        <p className="mt-0.5 text-[26px] font-black leading-none tabular-nums tracking-tight text-text-primary">
          {value}
        </p>
        <p className="mt-1.5 text-[12px] leading-snug text-text-muted">{hint}</p>
      </div>
    </div>
  );
}

/**
 * La escala de niveles con la marca del avance actual encima: el mismo dibujo
 * del drawer de configuración, así lo que allí se definió se reconoce aquí.
 */
function NivelScale({
  niveles,
  percent,
}: {
  niveles: readonly NivelDesempenoConfig[];
  percent: number;
}) {
  const sorted = [...niveles].sort((a, b) => a.minPorcentaje - b.minPorcentaje);
  if (sorted.length === 0) return null;
  const min = sorted[0].minPorcentaje;
  const max = Math.max(sorted[sorted.length - 1].maxPorcentaje, 100);
  const marker = Math.max(0, Math.min(100, ((Math.min(percent, max) - min) / (max - min)) * 100));

  return (
    <div className="flex flex-col gap-2">
      <div className="relative pt-2">
        <span
          aria-hidden
          className="absolute top-0 z-10 -translate-x-1/2 transition-[left] duration-500 ease-out"
          style={{ left: `${marker}%` }}
        >
          <span className="block size-0 border-x-[5px] border-t-[6px] border-x-transparent border-t-text-primary" />
        </span>
        <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full">
          {sorted.map((nivel) => (
            <span
              key={nivel.id}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{
                flexGrow: Math.max(1, nivel.maxPorcentaje - nivel.minPorcentaje),
                backgroundColor: nivel.colorHex,
              }}
              title={`${nivel.nombre}: ${nivel.minPorcentaje} % a ${nivel.maxPorcentaje} %`}
            />
          ))}
        </div>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {sorted.map((nivel) => (
          <li key={nivel.id} className="inline-flex items-center gap-1.5 text-[11px] text-text-secondary">
            <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: nivel.colorHex }} />
            <span className="font-semibold text-text-primary">{nivel.nombre}</span>
            <span className="tabular-nums text-text-muted">
              {nivel.minPorcentaje}–{nivel.maxPorcentaje} %
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EstadoBreakdown({
  estados,
  counts,
}: {
  estados: readonly ObjetivoEstadoConfig[];
  counts: Map<string, number>;
}) {
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const segments = estados.map((estado) => ({
    id: estado.id,
    label: estado.nombre,
    count: counts.get(estado.id) ?? 0,
    color: estado.colorHex,
  }));
  const visible = segments.filter((segment) => segment.count > 0);

  return (
    <div className="flex flex-col gap-3">
      <DistributionBar segments={segments} height="h-2.5" />
      {visible.length === 0 ? (
        <p className="text-[12px] text-text-muted">Todavía nadie ha reportado avance.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
          {visible.map((segment) => (
            <li key={segment.id} className="flex items-center justify-between gap-2 text-[12px]">
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
                <span className="truncate text-text-secondary">{segment.label}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="font-bold text-text-primary">{formatCount(segment.count)}</span>
                <span className="ml-1 text-text-muted">
                  {total > 0 ? `${Math.round((segment.count / total) * 100)} %` : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
