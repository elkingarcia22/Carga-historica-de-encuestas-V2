import * as React from "react";
import {
  CheckCircle2,
  Lightbulb,
  MessageSquareText,
  PenLine,
  TriangleAlert,
  UserPlus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AttentionAction, AttentionStrip } from "@/components/feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPercent, formatLongDate } from "@/components/ciclo-detail";
import { MetricReadingBadge, MetricSummaryCard } from "@/components/survey-results";
import { Sparkline } from "@/components/survey-analytics/pulseCharts";
import { LIFECYCLE_META, LIFECYCLE_ORDER } from "./objectiveLifecycle";
import { toneForEstado } from "./resultsTone";
import { RISK_META, RISK_ORDER, type CicloResults } from "./resultsModel";
import type { FilterKey, ResultsFiltersState } from "./useResultsFilters";

/**
 * El panorama del ciclo.
 *
 * La referencia pone diez donuts del mismo tamaño en una grilla: nada manda y
 * el lector no sabe por dónde empezar. Aquí hay jerarquía — un número grande,
 * tres que lo enmarcan, tres distribuciones que lo explican — y todo tramo de
 * toda distribución es un filtro que se lleva a las demás pestañas. Un gráfico
 * que no se puede pulsar en una herramienta de análisis es un adorno.
 *
 * Lo que la referencia trata como métricas y no lo son —"15 colaboradores sin
 * objetivos", "112 por aprobar"— sube a la franja de pendientes: son acciones,
 * y una acción escondida entre tarjetas de lectura no se ejecuta nunca.
 */

interface ResumenTabProps {
  results: CicloResults;
  filters: ResultsFiltersState;
  onOpenPending: (kind: "sin-objetivos" | "por-aprobar" | "por-ajustar") => void;
  onSuggestMetric: () => void;
}

export function ResumenTab({
  results,
  filters,
  onOpenPending,
  onSuggestMetric,
}: ResumenTabProps) {
  const laggingAreas = React.useMemo(() => {
    const byArea = new Map<string, number[]>();
    results.scored.forEach((row) => {
      const bucket = byArea.get(row.area);
      if (bucket) bucket.push(row.percent);
      else byArea.set(row.area, [row.percent]);
    });
    return [...byArea.entries()]
      .filter(([, percents]) => percents.length >= 3)
      .map(([area, percents]) => ({
        id: area,
        label: area,
        value: percents.reduce((a, b) => a + b, 0) / percents.length,
      }))
      .sort((a, b) => a.value - b.value)
      .slice(0, 3)
      .map((item) => ({ ...item, displayValue: formatPercent(item.value) }));
  }, [results.scored]);
  const porAprobar = results.lifecycleCounts.get("por-aprobar") ?? 0;
  const porAjustar = results.lifecycleCounts.get("por-ajustar") ?? 0;
  // Objetivos y personas suman en la misma cifra porque "pendiente" es lo que
  // tienen en común; cada botón dice de qué es el suyo.
  const pendientes = porAprobar + porAjustar + results.withoutObjectives.length;
  const completados = results.lifecycleCounts.get("completado") ?? 0;
  const excluded = results.rows.length - results.scored.length;

  /*
   * Las secciones salen como hermanas sueltas, no dentro de un contenedor
   * propio: la pantalla ya envuelve la pestaña en `.cascade-enter`, que
   * escalona a sus hijos directos. Montar encima una cascada de
   * framer-motion sería la segunda animación sobre las mismas filas que la
   * vista de seguimiento ya aprendió a no hacer.
   */
  return (
    <>
      {/* ── La tarjeta de métrica que abre todas las pestañas del reporte ── */}
      <MetricSummaryCard
        accentColor={toneForEstado(results.overallEstado).accent}
        title="Avance general del ciclo"
        hint={
          <div className="flex flex-col gap-2 text-[12px] leading-relaxed">
            <p>
              <strong>Avance general:</strong> promedio del cumplimiento ponderado de las personas que
              cuentan en los resultados{excluded > 0 && ` (${excluded} quedan fuera por su estado de participante)`}.
            </p>
            <p>Cada anillo es una persona por nivel de desempeño; pulsarlo filtra el resto de la vista.</p>
          </div>
        }
        bigValue={formatPercent(results.overallPercent)}
        bigValueBadge={
          results.overallEstado && (
            <MetricReadingBadge
              tone={toneForEstado(results.overallEstado).tone}
              label={results.overallEstado.nombre}
            />
          )
        }
        caption={
          results.showsRisk
            ? `${Math.round(results.elapsed)} % del calendario corrido · ${results.daysLeft} ${results.daysLeft === 1 ? "día restante" : "días restantes"} · ${RISK_META[results.risk].label}`
            : `Cerró el ${formatLongDate(`${results.data.endDate}T12:00:00`)} · ${results.scored.length} personas`
        }
        ringsLabel="Niveles de desempeño"
        ringsTotal={`${results.scored.length} personas`}
        rings={[...results.nivelCounts.entries()]
          .filter(([, count]) => count > 0)
          .map(([id, count]) => {
            const nivel = results.rows.find((row) => row.nivel?.id === id)?.nivel;
            return {
              id,
              label: nivel?.nombre ?? id,
              percentage: Math.round((count / Math.max(1, results.scored.length)) * 100),
              color: nivel?.colorHex ?? "#CBD5E1",
              count: String(count),
              active: filters.isOn("niveles", id),
              onToggle: () => filters.toggle("niveles", id),
            };
          })}
        topAreasTitle="Top 3 áreas más rezagadas"
        topAreas={laggingAreas}
        chartTitle="Avance en el tiempo"
        chart={
          <Sparkline
            points={results.timeline.map((point) => ({
              id: point.date,
              name: point.label,
              value: point.percent,
            }))}
            target={100}
            format={formatPercent}
            ariaLabel="Avance del ciclo mes a mes"
            height={56}
            showPoints
            fitTarget={false}
          />
        }
      />

      {/* ── Pendientes: acciones, no métricas ──
          En la franja de avisos del home, no en tres banderolas teñidas a lo
          ancho: eran el único bloque de la pantalla con fondo de color, y
          apiladas empujaban las cifras del ciclo media pantalla hacia abajo.
          Ahora es una fila —cuántos pendientes hay— con un botón por motivo,
          y lo que cada banderola explicaba en línea lo dice el tooltip de su
          botón, igual que las alertas de la lista de ciclos. */}
      {pendientes > 0 && (
        <AttentionStrip
          label="Pendientes del ciclo"
          icon={TriangleAlert}
          title={`${pendientes} ${pendientes === 1 ? "pendiente" : "pendientes"} por resolver`}
          detail="Toca un pendiente para ver a quién le toca y avisarle"
        >
          {porAprobar > 0 && (
            <AttentionAction
              icon={CheckCircle2}
              label="Por aprobar"
              hint="Objetivos escritos y enviados que esperan el visto bueno de su líder. No arrancan hasta que lo tengan."
              value={porAprobar}
              tone="brand"
              onClick={() => onOpenPending("por-aprobar")}
            />
          )}
          {porAjustar > 0 && (
            <AttentionAction
              icon={PenLine}
              label="Devueltos"
              hint="Su líder pidió cambios y volvieron a manos de quien los escribió. Tampoco cuentan hasta que se reenvíen."
              value={porAjustar}
              tone="warning"
              onClick={() => onOpenPending("por-ajustar")}
            />
          )}
          {results.withoutObjectives.length > 0 && (
            <AttentionAction
              icon={UserPlus}
              label="Sin objetivos"
              hint="Personas de un grupo que sí recibió objetivos, pero a las que no les asignaron ninguno. Mientras sigan así no entran en ningún promedio."
              value={results.withoutObjectives.length}
              tone="neutral"
              onClick={() => onOpenPending("sin-objetivos")}
            />
          )}
        </AttentionStrip>
      )}

      {/* ── Los tres que enmarcan el número grande ── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Cifras del ciclo">
        <StatCard
          icon={Users}
          label="Reportaron avance"
          value={`${results.peopleWithProgress} / ${results.scored.length}`}
          hint={`${results.peopleCount} personas en el ciclo`}
        />
        <StatCard
          icon={CheckCircle2}
          label="Objetivos en meta"
          value={`${completados} / ${results.objectiveCount}`}
          hint={`${Math.round((completados / Math.max(1, results.objectiveCount)) * 100)} % del total`}
        />
        <StatCard
          icon={MessageSquareText}
          label="Objetivos con conversación"
          value={`${results.commentedCount}`}
          hint={`${
            results.objectiveCount - results.commentedCount
          } avanzan sin un solo comentario`}
        />
      </section>

      {/* ── Distribuciones: cada tramo es un filtro ── */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3" aria-label="Distribuciones">
        <DistributionPanel
          title="Estado de los objetivos"
          hint="En qué punto del flujo está cada objetivo."
          total={results.objectiveCount}
          filters={filters}
          filterKey="lifecycles"
          segments={LIFECYCLE_ORDER.map((id) => ({
            id,
            label: LIFECYCLE_META[id].label,
            color: LIFECYCLE_META[id].colorHex,
            count: results.lifecycleCounts.get(id) ?? 0,
          }))}
        />
        <DistributionPanel
          title="Niveles de desempeño"
          hint="Con qué calificación va cerrando cada persona."
          total={results.scored.length}
          filters={filters}
          filterKey="niveles"
          segments={[...results.nivelCounts.entries()].map(([id, count]) => {
            const nivel = results.rows.find((row) => row.nivel?.id === id)?.nivel;
            return { id, label: nivel?.nombre ?? id, color: nivel?.colorHex ?? "#CBD5E1", count };
          })}
        />
        {/* Un ciclo cerrado no tiene riesgo que mostrar, así que el estado de
            los participantes —que sí sigue explicando el resultado— sube a
            ocupar ese lugar en vez de dejar un hueco en la fila. */}
        {results.showsRisk ? (
          <DistributionPanel
            title="Riesgo"
            hint="Avance comparado con el calendario ya corrido."
            total={results.scored.length}
            filters={filters}
            filterKey="risks"
            segments={RISK_ORDER.map((id) => ({
              id,
              label: RISK_META[id].label,
              color: RISK_META[id].colorHex,
              count: results.riskCounts.get(id) ?? 0,
            }))}
          />
        ) : (
          <ParticipantesPanel results={results} filters={filters} />
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3" aria-label="Composición del ciclo">
        {results.showsRisk && <ParticipantesPanel results={results} filters={filters} />}
        <DistributionPanel
          title="Tipo de medida"
          hint="Con qué se está midiendo el ciclo."
          total={results.objectiveCount}
          filters={filters}
          filterKey="measures"
          segments={results.measureMix.map((share, index) => ({
            id: share.measure,
            label: share.label,
            color: ["#4F46E5", "#0EA5E9", "#8B5CF6", "#14B8A6"][index % 4],
            count: share.count,
          }))}
        />

        <article className="flex flex-col justify-between gap-4 rounded-2xl border border-dashed border-border bg-muted/20 p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface text-primary shadow-card">
              <Lightbulb className="size-4" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-text-primary">¿Qué te gustaría medir?</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-text-secondary">
                Si el reporte que necesitas no está aquí, dinos cuál es y lo construimos.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onSuggestMetric} className="w-full text-[12.5px]">
            Sugerir una métrica
          </Button>
        </article>
      </section>
    </>
  );
}

/** El reparto de estados del participante, que aparece en una fila o en otra
 *  según el ciclo tenga riesgo que mostrar. */
function ParticipantesPanel({
  results,
  filters,
}: {
  results: CicloResults;
  filters: ResultsFiltersState;
}) {
  return (
    <DistributionPanel
      title="Estado de los participantes"
      hint="Los que no cuentan quedan fuera de promedios y rankings."
      total={results.peopleCount}
      filters={filters}
      filterKey="estadosParticipante"
      segments={[...results.estadoParticipanteCounts.entries()].map(([id, count]) => {
        const estado = results.rows.find((row) => row.estadoParticipante?.id === id)
          ?.estadoParticipante;
        return { id, label: estado?.nombre ?? id, color: estado?.colorHex ?? "#CBD5E1", count };
      })}
    />
  );
}

function StatCard({
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
    <article className="flex items-start gap-3.5 rounded-2xl border border-border/60 bg-surface p-5 shadow-card">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground">
        <Icon className="size-4" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold text-text-primary">{label}</p>
        <p className="mt-1 text-[24px] font-extrabold leading-none tracking-tight text-text-primary tabular-nums">
          {value}
        </p>
        <p className="mt-1.5 text-[11px] font-medium text-text-muted">{hint}</p>
      </div>
    </article>
  );
}

interface Segment {
  id: string;
  label: string;
  color: string;
  count: number;
}

/**
 * Una distribución como barra apilada más su leyenda, y toda ella pulsable.
 *
 * Barra apilada y no donut: comparar dos tramos de un anillo obliga a estimar
 * ángulos, comparar dos tramos de una barra es mirar cuál es más largo. Y la
 * leyenda ya trae la cifra exacta, que es lo que el donut nunca da.
 */
function DistributionPanel({
  title,
  hint,
  total,
  segments,
  filters,
  filterKey,
}: {
  title: string;
  hint: string;
  total: number;
  segments: readonly Segment[];
  filters: ResultsFiltersState;
  filterKey: FilterKey;
}) {
  const visible = segments.filter((segment) => segment.count > 0);
  const sum = visible.reduce((acc, segment) => acc + segment.count, 0);
  const anyActive = (filters.filters[filterKey] as ReadonlySet<string>).size > 0;

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-surface p-5 shadow-card">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-bold text-text-primary">{title}</h3>
            <Badge variant="neutral" className="h-5 px-1.5 text-[11px] font-semibold tabular-nums">
              {total}
            </Badge>
          </div>
          <p className="mt-0.5 text-[11px] font-medium text-text-muted">{hint}</p>
        </div>
      </header>

      {sum === 0 ? (
        <p className="py-4 text-center text-[12px] text-text-muted">Sin datos todavía.</p>
      ) : (
        <>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-border/40">
            {visible.map((segment) => {
              const active = filters.isOn(filterKey, segment.id);
              return (
                <button
                  key={segment.id}
                  type="button"
                  onClick={() => filters.toggle(filterKey, segment.id)}
                  title={`${segment.label}: ${segment.count}`}
                  aria-pressed={active}
                  className={cn(
                    "h-full cursor-pointer transition-all duration-300 hover:brightness-110",
                    anyActive && !active && "opacity-30"
                  )}
                  style={{ flexGrow: segment.count, backgroundColor: segment.color }}
                />
              );
            })}
          </div>

          <ul className="flex flex-col gap-0.5">
            {visible.map((segment) => {
              const active = filters.isOn(filterKey, segment.id);
              return (
                <li key={segment.id}>
                  <button
                    type="button"
                    onClick={() => filters.toggle(filterKey, segment.id)}
                    aria-pressed={active}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[12px] transition-colors",
                      active
                        ? "bg-primary/[0.08] font-semibold text-primary"
                        : "text-text-secondary hover:bg-muted/60 hover:text-text-primary",
                      anyActive && !active && "opacity-60"
                    )}
                  >
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: segment.color }}
                    />
                    <span className="min-w-0 flex-1 truncate">{segment.label}</span>
                    <span className="shrink-0 tabular-nums font-bold">{segment.count}</span>
                    <span className="w-10 shrink-0 text-right tabular-nums text-text-muted">
                      {Math.round((segment.count / sum) * 100)} %
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </article>
  );
}
