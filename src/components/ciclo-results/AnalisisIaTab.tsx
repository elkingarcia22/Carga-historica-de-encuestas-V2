import * as React from "react";
import { motion } from "framer-motion";
import { RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { cascadeContainer } from "@/lib/cascadeAnimation";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/feedback";
import { AiAnalyzingState } from "@/components/ai-interaction";
import { formatPercent } from "@/components/ciclo-detail";
import { MetricSummaryCard } from "@/components/survey-results";
import { MeasurementScaleButton } from "@/components/survey-results/MeasurementScaleButton";
import {
  InsightConfidenceFilter,
  useConfidenceFilter,
} from "@/components/survey-results/InsightConfidenceFilter";
import {
  CONFIDENCE_ORDER,
  type InsightConfidence,
} from "@/components/survey-results/insightConfidence";
import { CICLO_CONFIDENCE_LEGEND } from "./cicloConfidence";
import { Sparkline } from "@/components/survey-analytics/pulseCharts";
import { buildCicloAnalysis, type InsightAction, type InsightKind } from "./cicloInsights";
import { CicloInsightList, type InsightGroup } from "./CicloInsightList";
import { CicloAiFocusSection, CicloAiStrengthsSection } from "./CicloAiWeightSections";
import { CicloAiGapsSection, CicloAiGovernanceSection } from "./CicloAiContextSections";
import type { CicloResults, PersonResultRow, ResultEntry } from "./resultsModel";
import type { ResultsFiltersState } from "./useResultsFilters";

/**
 * La lectura que la IA hace del ciclo, en el chasis del propio reporte.
 *
 * Las otras cuatro pestañas están armadas igual: las cifras de cabecera como
 * una tarjeta de métrica, y debajo una sola superficie con su barra pegajosa
 * sobre un esquema plegable. Esta pestaña era un banner y dos tarjetas
 * sueltas —una forma que no aparece en ningún otro sitio del reporte—, así
 * que el análisis se leía como otro producto pegado al final en vez de como
 * la última vista del mismo.
 *
 * Lo que cambió con la forma es el contenido. Un ciclo de objetivos no se
 * analiza como una encuesta: aquí nadie respondió nada, aquí alguien se
 * comprometió a mover una cifra y el calendario lleva un rato corriendo. Las
 * preguntas propias —¿va a llegar?, ¿de qué depende?, ¿dónde se abre?, ¿se
 * está llevando bien?— viven en `cicloInsights`, que las deriva de los mismos
 * números de las demás pestañas: no hay una segunda fuente de verdad que
 * pueda contradecir a la tabla de al lado.
 */

interface AnalisisIaTabProps {
  results: CicloResults;
  rows: readonly PersonResultRow[];
  entries: readonly ResultEntry[];
  filters: ResultsFiltersState;
  onGoTo: (tab: "cumplimiento" | "colaboradores" | "ranking") => void;
}

const formatCount = (value: number) => new Intl.NumberFormat("es-CO").format(value);

/** Las tres preguntas con las que un lector llega, en el orden en que llega. */
const KIND_META: Readonly<Record<InsightKind, { heading: string; question: string }>> = {
  finding: { heading: "Hallazgos", question: "qué está pasando en este ciclo" },
  risk: { heading: "Riesgos", question: "qué está en juego si nadie lo atiende" },
  recommendation: { heading: "Qué hacer", question: "por dónde abrir el plan" },
};

const KIND_ORDER: readonly InsightKind[] = ["finding", "risk", "recommendation"];

const RING_COLOR: Readonly<Record<InsightKind, string>> = {
  finding: "var(--color-brand)",
  risk: "#EF4444",
  recommendation: "#22C55E",
};

/** Cuánto tarda el re-análisis simulado. */
const REANALYSIS_STEP_MS = 400;

const LOADER_STEPS = [
  "Leyendo avances y comparándolos con el calendario…",
  "Repartiendo el peso del ciclo entre áreas y equipos…",
  "Buscando brechas entre cortes con muestra suficiente…",
  "Revisando aprobaciones, comentarios y ritmo de reporte…",
] as const;

export function AnalisisIaTab({ results, rows, entries, filters, onGoTo }: AnalisisIaTabProps) {
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [kindFilter, setKindFilter] = React.useState<ReadonlySet<InsightKind>>(new Set());
  const confidence = useConfidenceFilter();

  const analysis = React.useMemo(
    () => buildCicloAnalysis(results, rows, entries),
    [results, rows, entries]
  );

  const toggleKind = (kind: InsightKind) => {
    setKindFilter((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  /*
   * El análisis se deriva de forma síncrona; la espera solo existe para que el
   * estado que la función real sí va a tener —"esto toma un momento"— se vea
   * en la interfaz.
   */
  React.useEffect(() => {
    if (!isAnalyzing) return;
    let current = 0;
    const interval = setInterval(() => {
      current += Math.floor(Math.random() * 8) + 4;
      if (current >= 100) {
        clearInterval(interval);
        setProgress(100);
        window.setTimeout(() => {
          setIsAnalyzing(false);
          setProgress(0);
        }, 700);
      } else {
        setProgress(current);
      }
    }, REANALYSIS_STEP_MS);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  /** Lleva al lector a la vista que responde lo que acaba de pulsar. */
  const runAction = React.useCallback(
    (action: InsightAction) => {
      filters.clearAll();
      if (action.filter) filters.toggle(action.filter.key, action.filter.value);
      onGoTo(action.tab);
    },
    [filters, onGoTo]
  );

  const counts = React.useMemo(() => {
    const total = analysis.insights.length;
    const byKind = (kind: InsightKind) =>
      analysis.insights.filter((insight) => insight.kind === kind).length;
    const byConfidence = Object.fromEntries(
      CONFIDENCE_ORDER.map((level) => [
        level,
        analysis.insights.filter((insight) => insight.confidence === level).length,
      ])
    ) as Record<InsightConfidence, number>;

    return {
      total,
      finding: byKind("finding"),
      risk: byKind("risk"),
      recommendation: byKind("recommendation"),
      byConfidence,
      solidShare: total > 0 ? Math.round((byConfidence.high / total) * 100) : 0,
    };
  }, [analysis]);

  const visibleGroups = React.useMemo<readonly InsightGroup[]>(
    () =>
      KIND_ORDER.map((kind) => ({
        id: kind,
        heading: KIND_META[kind].heading,
        question: KIND_META[kind].question,
        items: analysis.insights.filter(
          (insight) =>
            insight.kind === kind &&
            confidence.levels.has(insight.confidence) &&
            (kindFilter.size === 0 || kindFilter.has(insight.kind))
        ),
      })).filter((group) => group.items.length > 0),
    [analysis, confidence.levels, kindFilter]
  );

  const visibleCount = visibleGroups.reduce((sum, group) => sum + group.items.length, 0);
  const nextNumbering = visibleGroups.length;

  /*
   * La columna de la derecha de la tarjeta nunca se queda en blanco. Lo normal
   * es que muestre los focos que más resultado ponen en juego; cuando el ciclo
   * va tan parejo que ninguno se descuelga, muestra los grupos más rezagados
   * del corte que más se abre, que es la única otra cosa que hay que mirar.
   */
  const topAreas = React.useMemo(() => {
    if (analysis.focus.length > 0) {
      return analysis.focus.slice(0, 3).map((row) => ({
        id: row.id,
        label: row.label,
        value: row.weightShare,
        displayValue: `${row.weightShare} % del peso`,
      }));
    }
    const widest = analysis.gaps[0];
    if (!widest) return [];
    return widest.laggards.slice(0, 3).map((group) => ({
      id: `${widest.id}:${group.label}`,
      label: group.label,
      value: Math.abs(group.diff),
      displayValue: `${group.diff} pts`,
    }));
  }, [analysis]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      {/* La misma fila de cabecera con la que abren las otras pestañas: de qué
          está hecha la lectura, para saber su tamaño antes de entrar en ella. */}
      <MetricSummaryCard
        accentColor="bg-primary"
        title="Lecturas de la IA"
        hint={
          <div className="flex flex-col gap-3 leading-relaxed">
            <p className="text-[12px]">
              <strong>Análisis con IA:</strong>
              <br />
              Lecturas generadas a partir de los mismos números de las demás pestañas de este
              ciclo.
            </p>
          </div>
        }
        bigValue={formatCount(counts.total)}
        caption={`${counts.solidShare} % con confiabilidad alta`}
        ringsLabel="Qué contiene la lectura"
        ringsTotal={`${formatCount(counts.total)} en total`}
        rings={KIND_ORDER.map((kind) => ({
          id: kind,
          label: KIND_META[kind].heading,
          percentage: Math.round((counts[kind] / Math.max(counts.total, 1)) * 100),
          color: RING_COLOR[kind],
          count: formatCount(counts[kind]),
          active: kindFilter.has(kind),
          onToggle: () => toggleKind(kind),
        }))}
        topAreasTitle={
          analysis.focus.length > 0
            ? "Top 3 focos con más resultado en juego"
            : "Top 3 grupos por debajo del promedio"
        }
        topAreas={topAreas}
        chartTitle="Avance en el tiempo"
        chart={
          <Sparkline
            points={results.timeline.map((point) => ({
              id: point.date,
              name: point.label,
              value: point.percent,
            }))}
            format={(value) => formatPercent(value)}
            ariaLabel="Avance del ciclo en el tiempo"
            height={56}
            showPoints
            fitTarget={false}
          />
        }
      />

      {/* pb-20: la barra flotante de la pantalla se posa sobre los últimos ~80px. */}
      <div className="min-h-0 flex-1 pb-20">
        <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-surface p-4 shadow-card">
          {/* La misma barra pegajosa que usan Cumplimiento y Colaboradores. */}
          <div className="sticky top-3 z-30 -mt-4 bg-surface pb-2 pt-4">
            <div className="flex flex-wrap items-center gap-4 pb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-[13px] font-bold text-text-primary">Lectura de la IA</h3>
                <Badge
                  variant="neutral"
                  className="h-5 px-1.5 text-[11px] font-semibold tabular-nums"
                >
                  {visibleCount}
                </Badge>
              </div>

              <div className="ml-auto flex items-center justify-end gap-3">
                <InsightConfidenceFilter filter={confidence} counts={counts.byConfidence} />
                <ReanalyzeChip
                  isAnalyzing={isAnalyzing}
                  onClick={() => {
                    setProgress(0);
                    setIsAnalyzing(true);
                  }}
                />
                <MeasurementScaleButton
                  items={CICLO_CONFIDENCE_LEGEND}
                  title="Confiabilidad de la lectura"
                  description="Cada lectura dice qué tan directa es la cifra en la que se apoya, y sobre cuánta gente descansa. Alta sale de un número del ciclo sobre un corte grande; media es una comparación razonable; baja es un indicio sobre pocas personas."
                />
              </div>
            </div>
          </div>

          {isAnalyzing ? (
            <AiAnalyzingState
              title="Generando nuevo análisis"
              progress={progress}
              detail="Procesando el ciclo"
              caption={LOADER_STEPS[Math.min(LOADER_STEPS.length - 1, Math.floor(progress / 25))]}
            />
          ) : (
            <>
              <AnalysisSummary summary={analysis.summary} />

              {/* Una sola cascada compartida: cada bloque llega en su turno en
                  vez de aparecer toda la pila como un bloque. */}
              <motion.div
                className="flex flex-col gap-6"
                initial="hidden"
                animate="show"
                variants={cascadeContainer}
              >
                {visibleGroups.length === 0 ? (
                  <EmptyState
                    icon={Sparkles}
                    title="Sin lecturas con esta confiabilidad"
                    description="Ninguna lectura de este ciclo cae en las bandas seleccionadas. Vuelve a marcarlas en «Confiabilidad» para ver el análisis completo."
                    className="border-none bg-transparent shadow-none"
                  />
                ) : (
                  <CicloInsightList groups={visibleGroups} onAction={runAction} />
                )}

                {/* Los cuatro bloques propios del ciclo. Con un filtro de tipo
                    puesto desaparecen: el lector pidió ver un tipo de lectura,
                    no el informe completo. */}
                {kindFilter.size === 0 && (
                  <>
                    <CicloAiFocusSection
                      focus={analysis.focus}
                      numbering={nextNumbering + 1}
                      elapsed={results.showsRisk ? results.elapsed : null}
                      onAction={runAction}
                    />
                    <CicloAiStrengthsSection
                      strengths={analysis.strengths}
                      numbering={nextNumbering + 2}
                      onAction={runAction}
                    />
                    <CicloAiGapsSection
                      gaps={analysis.gaps}
                      numbering={nextNumbering + 3}
                      onAction={runAction}
                    />
                    <CicloAiGovernanceSection
                      governance={analysis.governance}
                      numbering={nextNumbering + 4}
                      onAction={runAction}
                    />
                  </>
                )}
              </motion.div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * El resumen ejecutivo como una franja sobre el esquema.
 *
 * El mismo sitio —y el mismo fondo apagado— que el Resumen le da a su franja
 * de pendientes: una referencia fija por la que el lector pasa camino al
 * detalle, no un panel que se queda con el tercio superior de la pantalla.
 */
function AnalysisSummary({ summary }: { summary: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/30 px-6 py-5">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-semibold leading-none text-text-secondary">
        <Sparkles className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
        Resumen general
        <span className="ml-auto text-[11px] font-medium text-muted-foreground">
          Generado a partir de los resultados de este ciclo
        </span>
      </span>

      <p className="max-w-5xl text-[13px] leading-[1.75] text-text-primary">{summary}</p>
    </div>
  );
}

/** El botón de rehacer el análisis, con el borde degradado de la IA. */
function ReanalyzeChip({
  isAnalyzing,
  onClick,
}: {
  isAnalyzing: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isAnalyzing}
      className="group relative flex h-9 shrink-0 items-center gap-1.5 overflow-hidden rounded-lg border border-border bg-surface px-3 text-[13px] font-semibold text-text-primary transition-colors hover:border-transparent disabled:opacity-60"
    >
      <span
        aria-hidden
        className="absolute inset-0 -z-10 bg-ai-gradient opacity-0 transition-opacity duration-300 group-hover:opacity-10"
      />
      <RefreshCw
        className={cn("h-3.5 w-3.5 text-ai-gradient", isAnalyzing && "animate-spin")}
        strokeWidth={2.2}
      />
      {isAnalyzing ? "Analizando…" : "Re-analizar"}
    </button>
  );
}
