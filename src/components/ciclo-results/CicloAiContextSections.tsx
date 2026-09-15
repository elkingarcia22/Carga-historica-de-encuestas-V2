import * as React from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  EyeOff,
  MessageSquare,
  Paperclip,
  ShieldAlert,
  Split,
  UserX,
} from "lucide-react";
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
import { ConfidenceChip } from "./CicloInsightList";
import type { GapCut, GovernanceReading, InsightAction } from "./cicloInsights";

/**
 * Los dos bloques que cierran la lectura: dónde se abre la diferencia entre
 * equipos, y si el ciclo se está llevando bien como proceso.
 *
 * El segundo no habla de resultados en absoluto y por eso existe aparte: un
 * ciclo puede ir en 80 % y estar mal llevado —aprobaciones que nadie firma,
 * avances sin una sola línea de contexto, todo el registro amontonado el día
 * del corte—. Eso no aparece en ningún promedio y es justo lo que decide si
 * el ciclo siguiente va a servir para algo.
 */

// ── Brechas entre equipos ──────────────────────────────────────────────────

interface GapsSectionProps {
  gaps: readonly GapCut[];
  numbering: number;
  onAction: (action: InsightAction) => void;
}

export function CicloAiGapsSection({ gaps, numbering, onAction }: GapsSectionProps) {
  const [openId, setOpenId] = React.useState<string | null>(gaps[0]?.id ?? null);

  return (
    <AiSectionCard
      numbering={numbering}
      heading="Brechas entre equipos"
      question="por dónde se abre la diferencia que el promedio esconde"
      meta={<AiSectionMeta count={gaps.length} unit="corte" unitPlural="cortes" />}
    >
      {gaps.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-text-secondary">
          Ningún corte tiene dos grupos con muestra suficiente, así que no hay brecha que se pueda
          sostener.
        </p>
      ) : (
        <>
          <p className="text-[12.5px] leading-relaxed text-text-secondary">
            Cada corte parte el ciclo de otra manera y reporta la distancia entre su grupo más
            alto y el más bajo. Los grupos con menos de cinco casos quedan fuera: ahí uno solo
            mueve el promedio veinte puntos.
          </p>

          <table className={AI_TABLE}>
            <thead className={AI_THEAD}>
              <tr className={AI_THEAD_ROW}>
                <th className="w-10 px-4 py-2.5 text-center">#</th>
                <th className="py-2.5">Corte</th>
                <th className="w-[110px] py-2.5 text-right">Grupos</th>
                <th className="w-[120px] py-2.5 text-right">Promedio</th>
                <th className="w-[110px] py-2.5 pr-4 text-right">Brecha</th>
                <th className="w-10 py-2.5 pr-4" aria-label="Detalle" />
              </tr>
            </thead>
            <tbody className={AI_TBODY}>
              {gaps.map((cut, index) => {
                const open = openId === cut.id;
                return (
                  <React.Fragment key={cut.id}>
                    <tr
                      role="button"
                      tabIndex={0}
                      aria-expanded={open}
                      onClick={() => setOpenId(open ? null : cut.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setOpenId(open ? null : cut.id);
                        }
                      }}
                      className={cn(AI_ROW, open && "bg-primary/[0.03]")}
                    >
                      <td className={AI_RANK_CELL}>{index + 1}</td>
                      <td className={AI_TITLE_CELL}>
                        {cut.label}
                        <span className="block text-[11px] font-medium text-muted-foreground">
                          {cut.omitted.length > 0
                            ? `${cut.omitted.length} sin muestra suficiente`
                            : "Todos los grupos con muestra suficiente"}
                        </span>
                      </td>
                      <td className="py-3 text-right text-[13px] tabular-nums text-text-secondary">
                        {cut.covered}
                      </td>
                      <td className="py-3 text-right text-[13px] font-semibold tabular-nums text-text-primary">
                        {formatPercent(cut.average)}
                      </td>
                      <td className="py-3 pr-4 text-right text-[13px] font-bold tabular-nums text-text-primary">
                        {cut.spread} pts
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
                        <td colSpan={6} className="px-4 py-4">
                          <div className="flex flex-col gap-4">
                            {cut.best && cut.worst && (
                              <div className="flex flex-col gap-2">
                                <AiSubHeading icon={Split}>Los dos extremos</AiSubHeading>
                                <div className={AI_DETAIL_PANEL}>
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <span className="flex items-center gap-2 text-[12px] text-text-secondary">
                                      <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-red-700 dark:bg-red-500/15 dark:text-red-300">
                                        {formatPercent(cut.worst.percent)}
                                      </span>
                                      {cut.worst.label}
                                      <span className="text-muted-foreground">
                                        · {cut.worst.size} {cut.unit}
                                      </span>
                                    </span>
                                    <span className="flex items-center gap-2 text-[12px] text-text-secondary">
                                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                                        {formatPercent(cut.best.percent)}
                                      </span>
                                      {cut.best.label}
                                      <span className="text-muted-foreground">
                                        · {cut.best.size} {cut.unit}
                                      </span>
                                    </span>
                                    <span className="text-[12px] font-bold tabular-nums text-text-primary">
                                      {cut.spread} pts
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {cut.laggards.length > 0 && (
                              <div className="flex flex-col gap-2">
                                <AiSubHeading icon={ArrowRight}>
                                  Grupos por debajo del promedio del corte
                                </AiSubHeading>
                                <table className={AI_TABLE}>
                                  <thead className={AI_THEAD}>
                                    <tr className={AI_THEAD_ROW}>
                                      <th className="w-10 px-4 py-2 text-center">#</th>
                                      <th className="py-2">Grupo</th>
                                      <th className="w-[110px] py-2 text-right capitalize">
                                        {cut.unit}
                                      </th>
                                      <th className="w-[110px] py-2 text-right">Diferencia</th>
                                      <th className="w-[110px] py-2 pr-4 text-right">Avance</th>
                                    </tr>
                                  </thead>
                                  <tbody className={AI_TBODY}>
                                    {cut.laggards.map((group, position) => (
                                      <tr key={group.label} className={AI_ROW_STATIC}>
                                        <td className={AI_RANK_CELL}>{position + 1}</td>
                                        <td className={AI_TITLE_CELL}>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              onAction({
                                                label: group.label,
                                                tab: "cumplimiento",
                                                filter: { key: cut.key, value: group.label },
                                              })
                                            }
                                            className="text-left hover:text-primary hover:underline"
                                          >
                                            {group.label}
                                          </button>
                                        </td>
                                        <td className="py-2.5 text-right text-[12.5px] tabular-nums text-text-secondary">
                                          {group.size}
                                        </td>
                                        <td className="py-2.5 text-right text-[12.5px] font-semibold tabular-nums text-red-600 dark:text-red-400">
                                          {group.diff} pts
                                        </td>
                                        <td className="py-2.5 pr-4 text-right text-[12.5px] font-semibold tabular-nums text-text-primary">
                                          {formatPercent(group.percent)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-2">
                              <ConfidenceChip level={cut.confidence} />
                              {cut.omitted.length > 0 && (
                                <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-surface px-2 py-1 text-[11px] font-medium text-text-secondary">
                                  <EyeOff className="h-3 w-3 text-muted-foreground" strokeWidth={2} />
                                  {cut.omitted.length} sin muestra: {" "}
                                  {cut.omitted
                                    .slice(0, 4)
                                    .map((group) => `${group.label} (${group.size})`)
                                    .join(", ")}
                                  {cut.omitted.length > 4 && "…"}
                                </span>
                              )}
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

// ── Cómo se está llevando el ciclo ─────────────────────────────────────────

/** Una barra de reparto con su leyenda, del ancho del bloque. */
function ShareBar({
  segments,
}: {
  segments: readonly { id: string; label: string; count: number; color: string }[];
}) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  if (total === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        {segments.map((segment) => (
          <span
            key={segment.id}
            className="h-full"
            style={{
              width: `${(segment.count / total) * 100}%`,
              backgroundColor: segment.color,
            }}
            title={`${segment.label}: ${segment.count}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {segments.map((segment) => (
          <span key={segment.id} className="flex items-center gap-1.5 text-[11.5px] text-text-secondary">
            <span
              aria-hidden
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: segment.color }}
            />
            {segment.label}
            <span className="font-semibold tabular-nums text-text-primary">{segment.count}</span>
            <span className="text-muted-foreground tabular-nums">
              {Math.round((segment.count / total) * 100)} %
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

interface GovernanceSectionProps {
  governance: GovernanceReading;
  numbering: number;
  onAction: (action: InsightAction) => void;
}

export function CicloAiGovernanceSection({
  governance,
  numbering,
  onAction,
}: GovernanceSectionProps) {
  const { approval, conversation, rhythm, coverage } = governance;
  const blocked = approval.porAprobar + approval.porAjustar;
  const issues =
    (blocked > 0 ? 1 : 0) +
    (conversation.mudos > 0 ? 1 : 0) +
    (rhythm.monthEndShare >= 40 ? 1 : 0) +
    (coverage.sinObjetivos > 0 ? 1 : 0);

  return (
    <AiSectionCard
      numbering={numbering}
      heading="Cómo se está llevando el ciclo"
      question="lo que no aparece en ningún promedio y decide si el próximo sirve"
      meta={<AiSectionMeta count={issues} unit="señal" unitPlural="señales" />}
    >
      {/* Aprobación */}
      <div className="flex flex-col gap-2.5">
        <AiSubHeading
          icon={CheckCircle2}
          trailing={
            blocked > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-auto gap-1 px-2 py-0.5 text-[11.5px] text-primary hover:bg-primary/5"
                onClick={() =>
                  onAction({
                    label: "bloqueados",
                    tab: "cumplimiento",
                    filter: { key: "lifecycles", value: "por-aprobar" },
                  })
                }
              >
                Ver los bloqueados
                <ArrowRight className="h-3 w-3" strokeWidth={2.2} />
              </Button>
            ) : undefined
          }
        >
          Revisión del líder
        </AiSubHeading>
        <div className={AI_DETAIL_PANEL}>
          <ShareBar
            segments={[
              { id: "aprobados", label: "Aprobados", count: approval.aprobados, color: "#22C55E" },
              { id: "por-aprobar", label: "Por aprobar", count: approval.porAprobar, color: "#F59E0B" },
              { id: "por-ajustar", label: "Devueltos", count: approval.porAjustar, color: "#EF4444" },
            ]}
          />
          <p className="mt-3 text-[12px] leading-relaxed text-text-secondary">
            {blocked === 0
              ? "Todos los objetivos pasaron la revisión, así que ninguna cifra del reporte está diluida por objetivos que nadie podía mover."
              : `${blocked} objetivos siguen en manos de la revisión y cuentan como cero en todos los promedios de esta vista.`}
          </p>
        </div>
      </div>

      {/* Conversación */}
      <div className="flex flex-col gap-2.5">
        <AiSubHeading icon={MessageSquare}>Conversación alrededor del avance</AiSubHeading>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <GovernanceStat
            icon={MessageSquare}
            value={`${conversation.conComentario}`}
            label="con al menos un comentario"
            hint={`de ${conversation.conAvance} objetivos con avance`}
          />
          <GovernanceStat
            icon={ShieldAlert}
            tone={conversation.mudos > 0 ? "warning" : "neutral"}
            value={`${conversation.mudos}`}
            label="avanzan sin una sola línea"
            hint="cifras sin explicación de por qué se movieron"
          />
          <GovernanceStat
            icon={Paperclip}
            value={`${conversation.conEvidencia}`}
            label="con evidencia adjunta"
            hint="archivos que respaldan lo reportado"
          />
        </div>
      </div>

      {/* Ritmo */}
      <div className="flex flex-col gap-2.5">
        <AiSubHeading icon={Clock}>Cuándo se reporta</AiSubHeading>
        <div className={AI_DETAIL_PANEL}>
          <div className="flex flex-col gap-1.5">
            <DetailLine
              label="Hora punta"
              value={`${rhythm.peakHour} concentra el ${rhythm.peakHourShare} % de los registros`}
            />
            <DetailLine
              label="Día punta"
              value={`${rhythm.peakWeekday}, con el ${rhythm.peakWeekdayShare} % de los registros`}
            />
            <DetailLine
              label="Cierre de mes"
              value={`${rhythm.monthEndShare} % de los ${rhythm.updates} registros cae en los últimos cinco días del mes`}
            />
          </div>
          {rhythm.monthEndShare >= 40 && (
            <p className="mt-3 text-[12px] leading-relaxed text-text-secondary">
              Un seguimiento que solo existe el día del corte no sirve para corregir: cuando la
              cifra aparece, el mes ya pasó.
            </p>
          )}
        </div>
      </div>

      {/* Cobertura */}
      {(coverage.sinObjetivos > 0 || coverage.noCuentan > 0 || coverage.inactivos > 0) && (
        <div className="flex flex-col gap-2.5">
          <AiSubHeading icon={UserX}>Quién queda fuera de estas cifras</AiSubHeading>
          <div className={AI_DETAIL_PANEL}>
            <div className="flex flex-col gap-1.5">
              {coverage.sinObjetivos > 0 && (
                <DetailLine
                  label="Sin objetivos"
                  value={`${coverage.sinObjetivos} personas del alcance no aparecen en ninguna asignación`}
                />
              )}
              {coverage.noCuentan > 0 && (
                <DetailLine
                  label="No cuentan"
                  value={`${coverage.noCuentan} participantes quedan fuera de promedios y ranking por su estado`}
                />
              )}
              {coverage.inactivos > 0 && (
                <DetailLine
                  label="Objetivos inactivos"
                  value={`${coverage.inactivos} objetivos puntuales están excluidos del ponderado`}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </AiSectionCard>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 text-[11px] leading-relaxed text-text-secondary">
      <span className="font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-text-primary">{value}</span>
    </p>
  );
}

function GovernanceStat({
  icon: Icon,
  value,
  label,
  hint,
  tone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  value: string;
  label: string;
  hint: string;
  tone?: "neutral" | "warning";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border px-4 py-3.5",
        tone === "warning"
          ? "border-amber-200/70 bg-amber-50/50 dark:border-amber-800/40 dark:bg-amber-500/5"
          : "border-border/60 bg-muted/30"
      )}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        {label}
      </span>
      <span className="text-[22px] font-bold leading-none tabular-nums text-text-primary">
        {value}
      </span>
      <span className="text-[11px] leading-relaxed text-text-secondary">{hint}</span>
    </div>
  );
}
