import * as React from "react";
import { Grid2X2, ListTree } from "lucide-react";
import { MessageSquareText } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/feedback";
import { formatPercent } from "@/components/ciclo-detail";
import { MetricReadingBadge, MetricSummaryCard } from "@/components/survey-results";
import { Sparkline } from "@/components/survey-analytics/pulseCharts";
import { LIFECYCLE_META, LIFECYCLE_ORDER } from "./objectiveLifecycle";
import { AvancePill, LifecycleBar, LifecycleChip } from "./ResultsChips";
import { ResultsDetailCard } from "./ResultsDetailCard";
import { ResultsAxisSelect } from "./ResultsFilterBar";
import { ResultsHeatmap, type HeatmapRowBy } from "./ResultsHeatmap";
import { ResultsTree } from "./ResultsTree";
import { buildResultsTree } from "./buildResultsTree";
import { toneForEstado } from "./resultsTone";
import type { CicloResults, ResultEntry, ResultNode, ResultsAxis, ResultsConfig } from "./resultsModel";
import type { ResultsFiltersState } from "./useResultsFilters";

/**
 * El cumplimiento, en secciones y subsecciones.
 *
 * Arriba, la tarjeta de métrica que abre todas las pestañas del reporte:
 * el número grande, los anillos que lo descomponen —aquí, en qué punto del
 * flujo está cada objetivo— y las tres ramas más rezagadas. Debajo, la
 * tarjeta de detalle con dos lecturas del mismo dato: el outline, que se
 * recorre, y el cuadro, que se compara. Comparten filtros y eje.
 */

export type CumplimientoView = "arbol" | "heatmap";

interface CumplimientoTabProps {
  results: CicloResults;
  entries: readonly ResultEntry[];
  config: ResultsConfig;
  filters: ResultsFiltersState;
  axis: ResultsAxis;
  onAxisChange: (axis: ResultsAxis) => void;
  view: CumplimientoView;
  onViewChange: (view: CumplimientoView) => void;
  heatmapRowBy: HeatmapRowBy;
  onHeatmapRowByChange: (value: HeatmapRowBy) => void;
  onSelectPerson: (personId: string) => void;
}

export function CumplimientoTab({
  results,
  entries,
  config,
  filters,
  axis,
  onAxisChange,
  view,
  onViewChange,
  heatmapRowBy,
  onHeatmapRowByChange,
  onSelectPerson,
}: CumplimientoTabProps) {
  const nodes = React.useMemo(
    () =>
      buildResultsTree(
        axis,
        results.data,
        results.rows,
        entries,
        config,
        results.showsRisk ? results.elapsed : -1
      ),
    [axis, results, entries, config]
  );

  const completados = results.lifecycleCounts.get("completado") ?? 0;
  const metaShare = Math.round((completados / Math.max(1, results.objectiveCount)) * 100);
  const laggingRoots = [...nodes].sort((a, b) => a.percent - b.percent).slice(0, 3);

  return (
    <div className="flex flex-col">
      <MetricSummaryCard
        accentColor={toneForEstado(results.overallEstado).accent}
        title="Cumplimiento general"
        hint={
          <p className="text-[12px] leading-relaxed">
            <strong>Cumplimiento:</strong> promedio ponderado del avance de cada persona que cuenta
            en los resultados. Cada anillo dice cuántos objetivos están en cada punto del flujo.
          </p>
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
        caption={`${completados} de ${results.objectiveCount} objetivos en meta · ${metaShare} %`}
        ringsLabel="Estado de los objetivos"
        ringsTotal={`${results.objectiveCount} en total`}
        rings={LIFECYCLE_ORDER.filter((id) => (results.lifecycleCounts.get(id) ?? 0) > 0).map(
          (id) => {
            const count = results.lifecycleCounts.get(id) ?? 0;
            return {
              id,
              label: LIFECYCLE_META[id].label,
              percentage: Math.round((count / Math.max(1, results.objectiveCount)) * 100),
              color: LIFECYCLE_META[id].colorHex,
              count: String(count),
              active: filters.isOn("lifecycles", id),
              onToggle: () => filters.toggle("lifecycles", id),
            };
          }
        )}
        topAreasTitle={`Top 3 ${axisNoun(axis)} más rezagados`}
        topAreas={laggingRoots.map((node) => ({
          id: node.id,
          label: node.title,
          value: node.percent,
          displayValue: formatPercent(node.percent),
        }))}
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

      <div className="mt-6 min-h-0 flex-1 pb-6">
        <ResultsDetailCard
          title={view === "arbol" ? "Detalle por secciones" : `Detalle del cuadro por ${heatmapRowBy === "area" ? "área" : "asignación"}`}
          count={entries.length}
          controls={
            <>
              {view === "arbol" ? (
                <ResultsAxisSelect axis={axis} onAxisChange={onAxisChange} />
              ) : (
                <>
                  <span className="text-[13px] font-medium text-muted-foreground">Ver por:</span>
                  <Tabs value={heatmapRowBy} onValueChange={(v) => onHeatmapRowByChange(v as HeatmapRowBy)} className="w-auto shrink-0">
                    <TabsList>
                      <TabsTrigger value="area">Área</TabsTrigger>
                      <TabsTrigger value="grupo">Asignación</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </>
              )}
              <CumplimientoViewSwitch value={view} onChange={onViewChange} />
            </>
          }
        >
          {entries.length === 0 ? (
            <div className="rounded-xl border border-border/60 p-8">
              <EmptyState
                icon={MessageSquareText}
                title="Nada que mostrar con estos filtros"
                description="Ningún objetivo del ciclo cumple con lo que está filtrado. Quita algún filtro para volver a ver resultados."
                className="border-none bg-transparent shadow-none"
              />
            </div>
          ) : view === "heatmap" ? (
            <ResultsHeatmap results={results} entries={entries} config={config} rowBy={heatmapRowBy} />
          ) : (
            <ResultsTree
              nodes={nodes}
              onSelectNode={(node) => {
                if (node.kind === "persona" && node.personIds.length === 1) {
                  onSelectPerson(node.personIds[0]);
                }
              }}
              renderMetric={(node, depth) => (
                <>
                  {node.lifecycle ? (
                    <LifecycleChip lifecycle={node.lifecycle} size="sm" />
                  ) : (
                    <LifecycleBar counts={node.lifecycleCounts} width={depth === 1 ? "w-20" : "w-14"} />
                  )}
                  <AvancePill percent={node.percent} estado={node.estado} labeled={depth <= 2} />
                </>
              )}
            />
          )}
        </ResultsDetailCard>
      </div>
    </div>
  );
}

const axisNoun = (axis: ResultsAxis): string =>
  axis === "organizacion" ? "áreas" : axis === "medida" ? "tipos de medida" : "objetivos de empresa";

/** El switch Secciones / Cuadro, con el mismo control segmentado del reporte de encuestas. */
export function CumplimientoViewSwitch({
  value,
  onChange,
}: {
  value: CumplimientoView;
  onChange: (value: CumplimientoView) => void;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as CumplimientoView)} className="w-auto shrink-0">
      <TabsList>
        <TabsTrigger value="arbol">
          <ListTree className="h-3.5 w-3.5" />
          Secciones
        </TabsTrigger>
        <TabsTrigger value="heatmap">
          <Grid2X2 className="h-3.5 w-3.5" />
          Cuadro
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

export type { ResultNode };
