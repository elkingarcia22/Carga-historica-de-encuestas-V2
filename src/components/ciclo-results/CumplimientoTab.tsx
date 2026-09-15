import * as React from "react";
import { Grid2X2, ListTree } from "lucide-react";
import { MessageSquareText } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/feedback";
import { formatPercent } from "@/components/ciclo-detail";
import { MetricReadingBadge, MetricSummaryCard } from "@/components/survey-results";
import { Sparkline } from "@/components/survey-analytics/pulseCharts";
import { AvancePill, EstadoBar, EstadoLegend, LifecycleChip } from "./ResultsChips";
import { ResultsDetailCard } from "./ResultsDetailCard";
import {
  heatScaleLegend,
  HeatmapCustomize,
  ResultsHeatmap,
  type HeatmapLevel,
} from "./ResultsHeatmap";
import { MeasurementScaleButton } from "@/components/survey-results/MeasurementScaleButton";
import { BREAKDOWN_META, breakdownBars, type BreakdownKey } from "./resultsBreakdown";
import { ResultsTree } from "./ResultsTree";
import { buildResultsTree, resultsTreeTitle } from "./buildResultsTree";
import { toneForEstado } from "./resultsTone";
import type { CicloResults, ResultEntry, ResultNode, ResultsConfig } from "./resultsModel";
import type { ResultsFiltersState } from "./useResultsFilters";

/**
 * El cumplimiento, objetivo por objetivo.
 *
 * Arriba, la tarjeta de métrica que abre todas las pestañas del reporte:
 * el número grande, las barras que lo descomponen —en qué banda de
 * cumplimiento cerró cada objetivo aprobado, las mismas bandas configuradas
 * que "Estado de los objetivos" usa en Resumen— y los tres grupos más
 * rezagados del corte. Debajo, la tarjeta de detalle con dos lecturas del
 * mismo dato: el árbol, que se recorre, y el heatmap, que se compara.
 *
 * Las dos cuelgan del "Ver por" de arriba y de los filtros: no tienen
 * selector propio. Lo tuvieron —un eje con "Organización" y "Tipo de medida"—
 * y era un segundo "Ver por" al lado del global contestando otra cosa.
 */

export type CumplimientoView = "arbol" | "heatmap";

interface CumplimientoTabProps {
  results: CicloResults;
  entries: readonly ResultEntry[];
  config: ResultsConfig;
  filters: ResultsFiltersState;
  view: CumplimientoView;
  onViewChange: (view: CumplimientoView) => void;
  /** El corte elegido arriba: abre cada objetivo de empresa en el árbol y
   *  arma las columnas del heatmap. */
  breakdown: BreakdownKey;
  onSelectPerson: (personId: string) => void;
  /** Los filtros globales, montados en la cabecera de la tarjeta: esta vista
   *  tiene tabla propia, así que ahí es donde el lector los busca. */
  globalControls?: React.ReactNode;
  /** Las fichas de lo que está filtrado, bajo esa misma fila. */
  globalChips?: React.ReactNode;
}

export function CumplimientoTab({
  results,
  entries,
  config,
  filters,
  view,
  onViewChange,
  breakdown,
  onSelectPerson,
  globalControls,
  globalChips,
}: CumplimientoTabProps) {
  const nodes = React.useMemo(
    () =>
      buildResultsTree(
        breakdown,
        results.data,
        results.rows,
        entries,
        config,
        results.showsRisk ? results.elapsed : -1
      ),
    [breakdown, results, entries, config]
  );

  const completados = results.lifecycleCounts.get("completado") ?? 0;
  const metaShare = Math.round((completados / Math.max(1, results.objectiveCount)) * 100);

  /**
   * Los tres grupos más rezagados del corte del "Ver por" de arriba, no de las
   * ramas del árbol de abajo.
   *
   * Antes salían del eje del árbol —"objetivos de empresa"— y contradecían al
   * filtro que el usuario tenía puesto: la barra decía "Ver por: Área" y la
   * tarjeta respondía con objetivos de empresa.
   */
  const laggingGroups = React.useMemo(
    () => breakdownBars(results.scored, breakdown).slice(0, 3),
    [results.scored, breakdown]
  );

  // Los ajustes de presentación del heatmap viven aquí porque su control va en
  // la cabecera de la tarjeta, en la misma fila del switch —una sola barra de
  // controles, como en encuestas, en vez de dos encabezados apilados—.
  const [hiddenLevels, setHiddenLevels] = React.useState<ReadonlySet<HeatmapLevel>>(
    () => new Set()
  );
  const [dimmedBands, setDimmedBands] = React.useState<ReadonlySet<string>>(() => new Set());
  const toggleIn = <T,>(set: ReadonlySet<T>, value: T): ReadonlySet<T> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  return (
    <div className="flex flex-col">
      <MetricSummaryCard
        accentColor={toneForEstado(results.overallEstado).accent}
        title="Cumplimiento general"
        hint={
          <p className="text-[12px] leading-relaxed">
            <strong>Cumplimiento:</strong> promedio ponderado del avance de cada persona que cuenta
            en los resultados. Cada barra es la banda de cumplimiento en la que cerró cada objetivo
            aprobado —las mismas bandas de "Estado de los objetivos" en Resumen.
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
        ringsTotal={`${results.committedCount} aprobados`}
        // Barras y no anillos: son cinco o seis bandas —no los tres niveles
        // del Resumen— y lo que se quiere saber con tantas es cuál manda
        // sobre cuál, que es comparar alturas, no leer seis medidores.
        ringsVariant="bar"
        // Las mismas bandas de cumplimiento configuradas que usa "Estado de
        // los objetivos" en Resumen —no la etapa de aprobación, que es otra
        // pregunta y ya tiene su propia tarjeta de donut en Resumen—.
        // Ninguna se esconde por estar en cero: la que va en cero es la
        // lectura más dura que puede dar un ciclo.
        rings={results.estados.map((estado) => {
          const count = results.estadoCounts.get(estado.id) ?? 0;
          return {
            id: estado.id,
            label: estado.nombre,
            percentage: Math.round((count / Math.max(1, results.committedCount)) * 100),
            color: estado.colorHex,
            count: String(count),
            active: filters.isOn("estados", estado.id),
            interactive: count > 0,
            onToggle: () => filters.toggle("estados", estado.id),
          };
        })}
        topAreasTitle={`Top 3 ${BREAKDOWN_META[breakdown].plural} con menor avance`}
        topAreas={laggingGroups.map((group) => ({
          id: group.id,
          label: group.label,
          value: group.percent,
          displayValue: formatPercent(group.percent),
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
          // "Secciones" era vocabulario de encuestas: un ciclo no tiene
          // secciones, tiene objetivos de empresa que se abren por el corte
          // puesto arriba.
          title={
            view === "arbol"
              ? resultsTreeTitle(breakdown)
              : `Detalle del heatmap por ${BREAKDOWN_META[breakdown].noun}`
          }
          count={entries.length}
          chips={globalChips}
          controls={
            <>
              {globalControls}
              {view === "heatmap" && (
                <HeatmapCustomize
                  hiddenLevels={hiddenLevels}
                  onToggleLevel={(level) => setHiddenLevels((current) => toggleIn(current, level))}
                  onResetLevels={() => setHiddenLevels(new Set())}
                  dimmedBands={dimmedBands}
                  onToggleBand={(id) => setDimmedBands((current) => toggleIn(current, id))}
                  onResetBands={() => setDimmedBands(new Set())}
                />
              )}
              <CumplimientoViewSwitch value={view} onChange={onViewChange} />
              {view === "heatmap" && (
                <MeasurementScaleButton
                  items={heatScaleLegend()}
                  title="Escala de avance"
                  description="Cada celda es el promedio de cumplimiento de ese cruce, y la banda es el tramo en el que cae ese promedio. Los cortes son los mismos con los que el producto lee un avance en el resto del reporte —50 y 80—, con un escalón más en cada extremo para que dos avances bajos no se vean iguales. Una raya gris no es un cero: es que a ese grupo no le asignaron ningún objetivo alineado a esa fila, así que no aplica."
                />
              )}
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
            <ResultsHeatmap
              results={results}
              entries={entries}
              config={config}
              columnBy={breakdown}
              hiddenLevels={hiddenLevels}
              dimmedBands={dimmedBands}
            />
          ) : (
            <>
              {/* La leyenda de la barrita que cada fila lleva al final: son
                  colores sin rótulo, y sin esto no hay forma de saber cuál
                  banda es cuál. */}
              <EstadoLegend estados={results.estados} className="mb-3 justify-end" />
              <ResultsTree
                nodes={nodes}
                onSelectNode={(node) => {
                  if (node.kind === "persona" && node.personIds.length === 1) {
                    onSelectPerson(node.personIds[0]);
                  }
                }}
                renderMetric={(node, depth) => {
                  // Una hoja (un objetivo de una sola persona) ya lleva su
                  // estado en el `AvancePill` —la píldora va teñida por la
                  // banda—, así que solo se le marca la excepción que explica
                  // un 0 %: que todavía no tiene el visto bueno para contar.
                  // Los nodos de arriba, que agrupan varios, sí necesitan el
                  // reparto por banda.
                  const sinAprobar =
                    node.lifecycle === "por-aprobar" || node.lifecycle === "por-ajustar";
                  return (
                    <>
                      {sinAprobar && <LifecycleChip lifecycle={node.lifecycle} size="sm" />}
                      {!node.lifecycle && (
                        <EstadoBar
                          counts={node.estadoCounts}
                          estados={results.estados}
                          width={depth === 1 ? "w-20" : "w-14"}
                        />
                      )}
                      <AvancePill percent={node.percent} estado={node.estado} labeled={depth <= 2} />
                    </>
                  );
                }}
              />
            </>
          )}
        </ResultsDetailCard>
      </div>
    </div>
  );
}

/** El switch Árbol / Heatmap, con el mismo control segmentado del reporte de encuestas. */
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
          Árbol
        </TabsTrigger>
        <TabsTrigger value="heatmap">
          <Grid2X2 className="h-3.5 w-3.5" />
          Heatmap
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

export type { ResultNode };
