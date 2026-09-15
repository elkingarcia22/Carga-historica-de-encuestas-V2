import * as React from "react";
import { ArrowRight, ChevronRight, Gauge, Scale, Sparkles, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatPercent } from "@/components/ciclo-detail";
import {
  AI_DETAIL_PANEL,
  AI_RANK_CELL,
  AI_ROW,
  AI_ROW_STATIC,
  AI_TABLE,
  AI_TBODY,
  AI_THEAD,
  AI_THEAD_ROW,
  AI_TITLE_CELL,
  AiSectionCard,
  AiSectionMeta,
  AiSubHeading,
} from "@/components/survey-results/AiSectionCard";
import { CONFIDENCE_STYLES } from "@/components/survey-results/insightConfidence";
import { CICLO_CONFIDENCE_MEANING } from "./cicloConfidence";
import { ConfidenceChip } from "./CicloInsightList";
import type { FocusRow, InsightAction, StrengthRow } from "./cicloInsights";

/**
 * Los dos bloques que un ciclo de objetivos tiene y una encuesta no puede
 * tener: dónde está el *peso* del resultado, y qué parte del ciclo lo está
 * sosteniendo.
 *
 * En una medición de clima todas las respuestas valen lo mismo. Aquí no: cada
 * objetivo carga un porcentaje del ciclo de quien lo lleva, así que "el área
 * con el porcentaje más bajo" y "el área donde más resultado está en juego"
 * son dos áreas distintas casi siempre. Ordenar por la primera es lo que hace
 * que un plan atienda lo ruidoso en vez de lo caro.
 */

const SEVERITY_STYLE = {
  alta: { background: "#FEE2E2", border: "#FCA5A5", foreground: "#B91C1C", dot: "#EF4444" },
  media: { background: "#FEF3C7", border: "#FCD34D", foreground: "#B45309", dot: "#F59E0B" },
  baja: { background: "#DBEAFE", border: "#93C5FD", foreground: "#1D4ED8", dot: "#3B82F6" },
} as const;

function SeverityChip({ severity }: { severity: FocusRow["severity"] }) {
  const style = SEVERITY_STYLE[severity];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize leading-none"
      style={{
        backgroundColor: style.background,
        borderColor: style.border,
        color: style.foreground,
      }}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.dot }} />
      {severity}
    </span>
  );
}

/**
 * La brecha contra el calendario, que en un ciclo puede ir en los dos sentidos.
 *
 * Un menos rojo pintado sobre un foco que va por delante es una mentira
 * tipográfica: el bloque ordena por peso en juego, no por atraso, así que aquí
 * entran focos al día y hay que decirlo con esa palabra.
 */
function GapCell({ gap }: { gap: number }) {
  if (gap > 0) {
    return (
      <span className="text-[13px] font-bold tabular-nums text-red-600 dark:text-red-400">
        −{gap} pts
      </span>
    );
  }
  if (gap < 0) {
    return (
      <span className="text-[13px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
        +{Math.abs(gap)} pts
      </span>
    );
  }
  return <span className="text-[12.5px] font-medium text-muted-foreground">Al día</span>;
}

/** Una cifra con su rótulo, dentro del panel que abre una fila. */
function DetailFact({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 text-[11px] leading-relaxed text-text-secondary">
      <span className="font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-text-primary">{value}</span>
    </p>
  );
}

// ── Dónde está el peso ─────────────────────────────────────────────────────

interface FocusSectionProps {
  focus: readonly FocusRow[];
  numbering: number;
  /** Qué tanto del calendario ha corrido; null en un ciclo cerrado. */
  elapsed: number | null;
  onAction: (action: InsightAction) => void;
}

export function CicloAiFocusSection({ focus, numbering, elapsed, onAction }: FocusSectionProps) {
  const [openId, setOpenId] = React.useState<string | null>(focus[0]?.id ?? null);
  const carga = focus.reduce((sum, row) => sum + row.weightShare, 0);

  return (
    <AiSectionCard
      numbering={numbering}
      heading="Dónde está el peso"
      question="qué parte del resultado depende de lo que no se mueve"
      meta={<AiSectionMeta count={focus.length} unit="foco" unitPlural="focos" />}
    >
      {focus.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-text-secondary">
          Ningún foco del ciclo combina atraso con peso suficiente como para leerse aparte del
          promedio.
        </p>
      ) : (
        <>
          <p className="text-[12.5px] leading-relaxed text-text-secondary">
            Ordenados por lo que ponen en juego —el peso del ciclo que cargan, por los puntos de
            atraso y el peso propio que todavía no se mueve—, no por lo bajo que sea su
            porcentaje. Entre los {focus.length} cargan el{" "}
            <strong className="font-semibold text-text-primary">{carga} %</strong> del peso del
            ciclo.
          </p>

          <table className={AI_TABLE}>
            <thead className={AI_THEAD}>
              <tr className={AI_THEAD_ROW}>
                <th className="w-10 px-4 py-2.5 text-center">#</th>
                <th className="py-2.5">Foco</th>
                <th className="w-[100px] py-2.5 text-right">Peso</th>
                <th className="w-[100px] py-2.5 text-right">Quieto</th>
                <th className="w-[110px] py-2.5 text-right">Avance</th>
                <th className="w-[110px] py-2.5 text-right">Brecha</th>
                <th className="w-[120px] py-2.5 pr-4 text-right">Severidad</th>
                <th className="w-10 py-2.5 pr-4" aria-label="Detalle" />
              </tr>
            </thead>
            <tbody className={AI_TBODY}>
              {focus.map((row, index) => {
                const open = openId === row.id;
                return (
                  <React.Fragment key={row.id}>
                    <tr
                      role="button"
                      tabIndex={0}
                      aria-expanded={open}
                      onClick={() => setOpenId(open ? null : row.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setOpenId(open ? null : row.id);
                        }
                      }}
                      className={cn(AI_ROW, open && "bg-primary/[0.03]")}
                    >
                      <td className={AI_RANK_CELL}>{index + 1}</td>
                      <td className={AI_TITLE_CELL}>
                        {row.label}
                        <span className="block text-[11px] font-medium text-muted-foreground">
                          {row.sublabel}
                        </span>
                      </td>
                      <td className="py-3 text-right text-[13px] font-semibold tabular-nums text-text-primary">
                        {row.weightShare} %
                      </td>
                      <td className="py-3 text-right text-[13px] font-semibold tabular-nums text-text-secondary">
                        {row.stalledShare} %
                      </td>
                      <td className="py-3 text-right text-[13px] font-semibold tabular-nums text-text-primary">
                        {formatPercent(row.percent)}
                      </td>
                      <td className="py-3 text-right">
                        <GapCell gap={row.gap} />
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <SeverityChip severity={row.severity} />
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <ChevronRight
                          className={cn(
                            "ml-auto h-4 w-4 text-muted-foreground/60 transition-transform duration-200",
                            open && "rotate-90"
                          )}
                          strokeWidth={2}
                        />
                      </td>
                    </tr>

                    {open && (
                      <tr className="bg-muted/30">
                        <td colSpan={8} className="px-4 py-4">
                          <div className="flex flex-col gap-3">
                            <div className={AI_DETAIL_PANEL}>
                              <div className="flex flex-col gap-1.5">
                                <DetailFact
                                  label={
                                    elapsed === null ? "Distancia al promedio" : "Distancia al calendario"
                                  }
                                  value={
                                    elapsed === null
                                      ? `${formatPercent(row.percent)}, ${Math.abs(row.gap)} puntos ${row.gap > 0 ? "por debajo" : "por encima"} del ciclo`
                                      : `${formatPercent(row.percent)} frente a ${Math.round(elapsed)} % del calendario corrido`
                                  }
                                />
                                <DetailFact
                                  label="Alcance"
                                  value={`${row.people} personas · ${row.objectives} objetivos`}
                                />
                                <DetailFact
                                  label="Peso quieto"
                                  value={`${row.stalledShare} % de su propio peso sin ningún avance reportado`}
                                />
                                <DetailFact
                                  label="Confiabilidad"
                                  value={`${CONFIDENCE_STYLES[row.confidence].label} — ${CICLO_CONFIDENCE_MEANING[row.confidence].toLowerCase()}`}
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-surface px-2 py-1 text-[11px] font-medium text-text-secondary">
                                <Scale className="h-3 w-3 text-muted-foreground" strokeWidth={2} />
                                {row.weightShare} % del peso del ciclo
                              </span>
                              <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-surface px-2 py-1 text-[11px] font-medium text-text-secondary">
                                <Gauge className="h-3 w-3 text-muted-foreground" strokeWidth={2} />
                                {row.stalledShare} % de ese peso, quieto
                              </span>
                              <ConfidenceChip level={row.confidence} />

                              <Button
                                variant="ghost"
                                size="sm"
                                className="ml-auto gap-1 text-[12px] text-primary hover:bg-primary/5"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onAction({
                                    label: row.label,
                                    tab: "cumplimiento",
                                    filter: { key: "areas", value: row.filterValue },
                                  });
                                }}
                              >
                                Ver en Cumplimiento
                                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.2} />
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </AiSectionCard>
  );
}

// ── Lo que sostiene el ciclo ───────────────────────────────────────────────

interface StrengthsSectionProps {
  strengths: readonly StrengthRow[];
  numbering: number;
  onAction: (action: InsightAction) => void;
}

export function CicloAiStrengthsSection({ strengths, numbering, onAction }: StrengthsSectionProps) {
  return (
    <AiSectionCard
      numbering={numbering}
      heading="Lo que sostiene el ciclo"
      question="en qué apoyarse y a quién preguntarle cómo lo hizo"
      meta={
        <AiSectionMeta count={strengths.length} unit="apoyo" unitPlural="apoyos" />
      }
    >
      {strengths.length === 0 ? (
        <p className="flex items-center gap-2 text-[13px] leading-relaxed text-text-secondary">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
          Ningún corte se despega lo suficiente del promedio como para usarlo de referencia.
        </p>
      ) : (
        <>
          <p className="text-[12.5px] leading-relaxed text-text-secondary">
            Cortes que van por encima del promedio del ciclo con muestra suficiente para que la
            diferencia signifique algo. Son la respuesta a «¿y esto ya lo resolvió alguien acá
            dentro?».
          </p>

          <table className={AI_TABLE}>
            <thead className={AI_THEAD}>
              <tr className={AI_THEAD_ROW}>
                <th className="w-10 px-4 py-2.5 text-center">#</th>
                <th className="py-2.5">Apoyo</th>
                <th className="w-[110px] py-2.5 text-right">Personas</th>
                <th className="w-[110px] py-2.5 text-right">Avance</th>
                <th className="w-[130px] py-2.5 text-right">vs. promedio</th>
                <th className="w-[130px] py-2.5 pr-4 text-right">Confiabilidad</th>
              </tr>
            </thead>
            <tbody className={AI_TBODY}>
              {strengths.map((row, index) => (
                <tr key={row.id} className={AI_ROW_STATIC}>
                  <td className={AI_RANK_CELL}>{index + 1}</td>
                  <td className={AI_TITLE_CELL}>
                    <button
                      type="button"
                      onClick={() =>
                        onAction({
                          label: row.label,
                          tab: "cumplimiento",
                          filter: { key: row.filterKey, value: row.filterValue },
                        })
                      }
                      className="text-left hover:text-primary hover:underline"
                    >
                      {row.label}
                    </button>
                    <span className="block text-[11px] font-medium text-muted-foreground">
                      {row.sublabel}
                    </span>
                  </td>
                  <td className="py-3 text-right text-[13px] tabular-nums text-text-secondary">
                    {row.people}
                  </td>
                  <td className="py-3 text-right text-[13px] font-semibold tabular-nums text-text-primary">
                    {formatPercent(row.percent)}
                  </td>
                  <td className="py-3 text-right text-[13px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    +{row.delta} pts
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <ConfidenceChip level={row.confidence} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={AI_DETAIL_PANEL}>
            <AiSubHeading icon={Target}>Para qué sirve este bloque</AiSubHeading>
            <p className="mt-1.5 text-[12px] leading-relaxed text-text-secondary">
              Un ciclo de objetivos rara vez falla por falta de ideas: falla porque la que
              funcionó se quedó en un equipo. Estos cortes son los que ya resolvieron lo que el
              resto todavía tiene abierto.
            </p>
          </div>
        </>
      )}
    </AiSectionCard>
  );
}
