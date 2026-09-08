import { CalendarClock, MessageSquareText, Paperclip, Target, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { DrawerShell } from "@/components/overlays";
import {
  ComplianceBar,
  EstadoChip,
  InitialsAvatar,
  NivelChip,
  formatDateTime,
  formatPercent,
  formatRelativeDate,
} from "@/components/ciclo-detail";
import { MEASURE_META } from "@/components/ciclo-builder";
import { LifecycleChip, ParticipanteChip, RiskChip } from "./ResultsChips";
import { LIFECYCLE_META } from "./objectiveLifecycle";
import type { PersonResultRow, ResultEntry } from "./resultsModel";

/**
 * La ficha de una persona.
 *
 * Es la misma jerarquía de la pestaña de cumplimiento recortada a alguien:
 * sus objetivos, uno debajo del otro, cada uno con lo que reportó y con la
 * conversación alrededor. Reusar la forma no es ahorro de código, es lo que
 * hace que el lector reconozca dónde está sin tener que releer los rótulos.
 *
 * Todo abierto de entrada: aquí se lee de corrido, no se busca.
 */

export function PersonResultSheet({
  row,
  showsRisk,
  open,
  onOpenChange,
}: {
  row: PersonResultRow | null;
  showsRisk: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title={row?.collaborator.name ?? "Colaborador"}
      description={
        row ? `${row.area} · ${row.leader} · ${row.groupLabel}` : undefined
      }
      size="2xl"
      className="!w-[38vw] !max-w-[52rem] !min-w-[34rem] gap-0 !bg-background"
      disablePadding
    >
      {row && (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-background px-4 py-4">
          <section className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-surface p-5 shadow-card">
            <div className="flex items-start gap-3.5">
              <InitialsAvatar name={row.collaborator.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold text-text-primary">
                  {row.collaborator.name}
                </p>
                <p className="truncate text-[12px] text-text-muted">{row.collaborator.email}</p>
              </div>
              <ParticipanteChip estado={row.estadoParticipante} />
            </div>

            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-t border-border/60 pt-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-text-secondary">
                  Avance ponderado
                </p>
                <p className="mt-0.5 text-[34px] font-black leading-none tabular-nums text-text-primary">
                  {formatPercent(row.percent)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <EstadoChip estado={row.estado} />
                <NivelChip nivel={row.nivel} />
                {showsRisk && <RiskChip risk={row.risk} />}
              </div>
            </div>

            {!row.counts && (
              <p className="rounded-lg border border-border/60 bg-surface-muted px-3 py-2 text-[12px] text-text-secondary">
                Su estado de participante no cuenta en los resultados: aparece en las listas, pero
                queda fuera de promedios, rankings y distribuciones.
              </p>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <header className="flex items-center justify-between gap-3 px-1">
              <p className="flex items-center gap-2 text-[12.5px] font-bold text-text-primary">
                <Target className="size-3.5 text-text-muted" strokeWidth={2.3} />
                Sus objetivos
              </p>
              <p className="text-[11.5px] text-text-muted">
                {row.reportedCount} de {row.entries.length} con avance reportado
              </p>
            </header>

            {row.entries.map((entry, index) => (
              <ObjectiveCard key={entry.objective.id} entry={entry} numbering={index + 1} />
            ))}
          </section>
        </div>
      )}
    </DrawerShell>
  );
}

function ObjectiveCard({ entry, numbering }: { entry: ResultEntry; numbering: number }) {
  const measure = entry.objective.measure ? MEASURE_META[entry.objective.measure] : null;
  const review = entry.tracked.review;
  const conversation = entry.tracked.updates.filter((update) => update.comment.trim() !== "");

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-card">
      <header className="flex items-start gap-3 border-b border-border/50 bg-muted/40 px-4 py-3.5">
        <span
          aria-hidden
          className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border border-border/60 bg-surface text-[10px] font-bold tabular-nums text-text-secondary"
        >
          {numbering}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-bold leading-snug text-text-primary">
            {entry.objective.title || "Objetivo sin nombre"}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-text-muted">
            <span>Peso {entry.objective.weight} %</span>
            {measure && (
              <>
                <span aria-hidden>·</span>
                <span>{measure.label}</span>
              </>
            )}
            {entry.objective.targetValue && (
              <>
                <span aria-hidden>·</span>
                <span>
                  Meta {measure?.symbol === "$" ? "$" : ""}
                  {entry.objective.targetValue}
                  {measure?.symbol === "%" ? " %" : ""}
                </span>
              </>
            )}
          </p>
        </div>
        <LifecycleChip lifecycle={entry.lifecycle} size="sm" />
      </header>

      <div className="flex flex-col gap-3 px-4 py-3.5">
        <ComplianceBar percent={entry.percent} estado={entry.estado} />

        {/* Lo que el líder pidió cambiar es el dato más accionable de la
            tarjeta cuando el objetivo está devuelto: va arriba, no enterrado
            en el historial. */}
        {review?.status === "ajustes" && review.comment && (
          <div
            className={cn(
              "flex gap-2.5 rounded-xl border px-3 py-2.5",
              LIFECYCLE_META["por-ajustar"].bg,
              LIFECYCLE_META["por-ajustar"].border
            )}
          >
            <MessageSquareText
              className={cn("mt-0.5 size-3.5 shrink-0", LIFECYCLE_META["por-ajustar"].text)}
              strokeWidth={2.3}
            />
            <div className="min-w-0">
              <p className={cn("text-[11.5px] font-bold", LIFECYCLE_META["por-ajustar"].text)}>
                {review.reviewerName ?? "Su líder"} pidió cambios
                {review.date && ` · ${formatRelativeDate(review.date)}`}
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-text-secondary">
                {review.comment}
              </p>
            </div>
          </div>
        )}

        {entry.lastUpdate ? (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-text-muted">
              <CalendarClock className="size-3" strokeWidth={2.4} />
              Última actualización · {formatDateTime(entry.lastUpdate.date)}
            </p>
            {conversation.slice(-2).map((update) => (
              <div key={update.id} className="flex gap-2.5 rounded-xl bg-surface-muted/70 px-3 py-2.5">
                <UserRound className="mt-0.5 size-3.5 shrink-0 text-text-muted" strokeWidth={2.3} />
                <div className="min-w-0">
                  <p className="text-[11.5px] font-bold text-text-primary">
                    {update.authorName}
                    <span className="ml-1.5 font-medium text-text-muted">
                      {formatRelativeDate(update.date)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-text-secondary">
                    {update.comment}
                  </p>
                  {update.evidences.length > 0 && (
                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-text-muted">
                      <Paperclip className="size-3" strokeWidth={2.3} />
                      {update.evidences.length}{" "}
                      {update.evidences.length === 1 ? "evidencia" : "evidencias"}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-text-muted">
            {entry.lifecycle === "por-aprobar" || entry.lifecycle === "por-ajustar"
              ? "Aún no puede reportar avance: el objetivo no está aprobado."
              : "Sin ningún avance reportado todavía."}
          </p>
        )}
      </div>
    </article>
  );
}
