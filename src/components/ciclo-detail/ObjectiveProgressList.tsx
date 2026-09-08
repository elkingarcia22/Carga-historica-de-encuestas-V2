import * as React from "react";
import { ArrowRight, Check, Link2, Minus, PenLine, MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DIRECTION_META,
  MEASURE_META,
  formatRawValue,
  type CicloStatus,
  type Objective,
} from "@/components/ciclo-builder";
import type { ObjetivoEstadoConfig } from "@/components/objetivos/objetivosConfigStore";
import type { TrackedObjective } from "./cicloDetailTypes";
import type { AggregatedObjective } from "./cicloProgress";
import { formatRelativeDate, lastUpdate } from "./cicloProgress";
import { ComplianceBar, EstadoChip, InitialsAvatar, MeasureGlyph } from "./StatusChips";

/**
 * El contenido que despliega una fila de la tabla: los objetivos, uno por
 * línea, con su estado, sus cifras y su avance.
 *
 * Es una lista en grid y no otra tabla porque vive *dentro* de una celda:
 * anidar `<table>` en `<td>` rompe la alineación de la tabla madre y el
 * lector de pantalla anuncia dos tablas donde el ojo ve una.
 */

export interface PersonObjectiveItem {
  tracked: TrackedObjective;
  percent: number;
  estado: ObjetivoEstadoConfig | null;
}

const PERSON_GRID =
  "grid-cols-[minmax(0,2.3fr)_minmax(0,2fr)_56px_minmax(0,1.4fr)_minmax(150px,auto)_minmax(0,1.4fr)_auto]";
const GROUP_GRID =
  "grid-cols-[minmax(0,2.3fr)_minmax(0,1.6fr)_56px_minmax(0,1.4fr)_minmax(150px,auto)_minmax(0,1.6fr)]";

function ListHeader({ columns, grid }: { columns: readonly string[]; grid: string }) {
  return (
    <li
      aria-hidden
      className={cn(
        "grid items-center gap-4 px-5 pb-2 pt-1 text-[10.5px] font-bold uppercase tracking-wide text-text-muted",
        grid
      )}
    >
      {columns.map((column, index) => (
        <span key={`${column}-${index}`} className={cn(index === 2 && "text-right")}>
          {column}
        </span>
      ))}
    </li>
  );
}

function ObjectiveTitle({
  objective,
  companyObjectives,
  extra,
}: {
  objective: Objective;
  companyObjectives: readonly Objective[];
  extra?: React.ReactNode;
}) {
  const meta = objective.measure ? MEASURE_META[objective.measure] : null;
  const aligned = objective.alignedTo
    ? companyObjectives.find((item) => item.id === objective.alignedTo)
    : null;
  return (
    <div className="flex min-w-0 items-start gap-3">
      <MeasureGlyph symbol={meta?.symbol ?? "?"} className="mt-0.5" />
      <div className="min-w-0">
        <p className="truncate text-[13px] font-bold text-text-primary" title={objective.title}>
          {objective.title}
        </p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11.5px] text-text-muted">
          {aligned ? (
            <>
              <Link2 className="size-3 shrink-0" strokeWidth={2.2} />
              <span className="truncate" title={aligned.title}>
                {aligned.title}
              </span>
            </>
          ) : (
            <span className="truncate">
              {meta?.label}
              {objective.direction ? ` · ${DIRECTION_META[objective.direction].label}` : ""}
            </span>
          )}
        </p>
        {extra}
      </div>
    </div>
  );
}

function ValueStat({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{label}</span>
      <span
        className={cn(
          "truncate text-[12.5px] tabular-nums",
          emphasized ? "font-bold text-text-primary" : "font-medium text-text-secondary"
        )}
      >
        {value}
      </span>
    </span>
  );
}

function Arrow() {
  return <ArrowRight className="size-3 shrink-0 text-text-muted/70" strokeWidth={2.2} />;
}

/** Inicial → Actual → Meta, o el resultado si el objetivo es de sí/no. */
function ValuesCell({ tracked }: { tracked: TrackedObjective }) {
  const { objective, currentValue } = tracked;
  if (objective.measure === "boolean") {
    const done = currentValue === "true";
    const failed = currentValue === "false";
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-[12.5px] font-semibold",
          done ? "text-status-positive" : failed ? "text-status-negative" : "text-text-muted"
        )}
      >
        {done ? <Check className="size-3.5" strokeWidth={2.6} /> : <Minus className="size-3.5" strokeWidth={2.6} />}
        {done ? "Se cumplió" : failed ? "No se cumplió" : "Pendiente de reportar"}
      </span>
    );
  }
  const initial = formatRawValue(objective.initialValue, objective.measure) ?? "—";
  const current = currentValue === "" ? "Sin reporte" : formatRawValue(currentValue, objective.measure) ?? "—";
  const target = formatRawValue(objective.targetValue, objective.measure) ?? "—";
  return (
    <div className="flex min-w-0 items-center gap-2">
      <ValueStat label="Inicial" value={initial} />
      <Arrow />
      <ValueStat label="Actual" value={current} emphasized={currentValue !== ""} />
      <Arrow />
      <ValueStat label="Meta" value={target} />
    </div>
  );
}

function LastUpdateCell({ tracked }: { tracked: TrackedObjective }) {
  const latest = lastUpdate(tracked.updates);
  if (!latest) {
    return <span className="text-[12px] text-text-muted">Sin actualizaciones</span>;
  }
  return (
    <span className="flex min-w-0 items-center gap-2">
      <InitialsAvatar name={latest.authorName} size="sm" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[12px] font-semibold text-text-primary">{latest.authorName}</span>
        <span className="text-[11px] text-text-muted">
          {formatRelativeDate(latest.date)}
          {tracked.updates.length > 1 ? ` · ${tracked.updates.length} entradas` : ""}
        </span>
      </span>
    </span>
  );
}

export function PersonObjectivesList({
  items,
  companyObjectives,
  cicloStatus,
  onOpen,
}: {
  items: readonly PersonObjectiveItem[];
  companyObjectives: readonly Objective[];
  cicloStatus: CicloStatus;
  onOpen: (objectiveId: string) => void;
}) {
  const canUpdate = cicloStatus === "live";
  return (
    <ul className="flex min-w-[960px] flex-col">
      <ListHeader
        grid={PERSON_GRID}
        columns={["Objetivo", "Valores", "Peso", "Avance", "Estado", "Última actualización", ""]}
      />
      {items.map(({ tracked, percent, estado }) => (
        <li
          key={tracked.objective.id}
          className={cn(
            "grid items-center gap-4 rounded-xl border border-border/60 bg-surface px-5 py-3 shadow-card transition-colors hover:border-primary/25",
            "not-last:mb-2",
            PERSON_GRID
          )}
        >
          <ObjectiveTitle objective={tracked.objective} companyObjectives={companyObjectives} />
          <ValuesCell tracked={tracked} />
          <span className="text-right text-[12.5px] font-bold tabular-nums text-text-primary">
            {tracked.objective.weight} %
          </span>
          <ComplianceBar percent={percent} estado={estado} />
          <EstadoChip estado={estado} />
          <LastUpdateCell tracked={tracked} />
          <button
            type="button"
            onClick={() => onOpen(tracked.objective.id)}
            className={cn(
              "flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.98]",
              canUpdate
                ? "border-border text-text-secondary hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                : "border-transparent text-text-secondary hover:bg-surface-muted hover:text-text-primary"
            )}
          >
            {canUpdate ? (
              <PenLine className="size-3.5" strokeWidth={2.2} />
            ) : (
              <MessageSquareText className="size-3.5" strokeWidth={2.2} />
            )}
            {canUpdate ? "Actualizar" : "Ver historial"}
          </button>
        </li>
      ))}
    </ul>
  );
}

function AchievementCell({ item }: { item: AggregatedObjective }) {
  const pending = item.memberCount - item.reportedCount;
  return (
    <span className="flex min-w-0 flex-col gap-0.5 text-[12px]">
      <span className="font-semibold text-text-primary">
        {item.achievedCount} de {item.memberCount} {item.achievedCount === 1 ? "cumplió" : "cumplieron"}
      </span>
      <span className="text-text-muted">
        {pending === 0
          ? "Todos han reportado"
          : `${pending} sin reportar avance`}
      </span>
    </span>
  );
}

export function GroupObjectivesList({
  items,
  companyObjectives,
}: {
  items: readonly AggregatedObjective[];
  companyObjectives: readonly Objective[];
}) {
  return (
    <ul className="flex min-w-[920px] flex-col">
      <ListHeader
        grid={GROUP_GRID}
        columns={["Objetivo", "Meta", "Peso", "Avance promedio", "Estado", "Cumplimiento del grupo"]}
      />
      {items.map((item, index) => {
        const { objective } = item;
        const target =
          objective.measure === "boolean"
            ? "Se cumple / no se cumple"
            : formatRawValue(objective.targetValue, objective.measure) ?? "—";
        const initial =
          objective.measure === "boolean"
            ? null
            : formatRawValue(objective.initialValue, objective.measure);
        return (
          <li
            key={`${objective.id}-${index}`}
            className={cn(
              "grid items-center gap-4 rounded-xl border border-border/60 bg-surface px-5 py-3 shadow-card transition-colors hover:border-primary/25 not-last:mb-2",
              GROUP_GRID
            )}
          >
            <ObjectiveTitle
              objective={objective}
              companyObjectives={companyObjectives}
              extra={
                item.assigneeNames.length > 0 ? (
                  <p className="mt-1 truncate text-[11.5px] font-medium text-text-secondary">
                    Asignado a {item.assigneeNames.join(", ")}
                  </p>
                ) : null
              }
            />
            <div className="flex min-w-0 items-center gap-2">
              {initial && (
                <>
                  <ValueStat label="Inicial" value={initial} />
                  <Arrow />
                </>
              )}
              <ValueStat label="Meta" value={target} emphasized />
            </div>
            <span className="text-right text-[12.5px] font-bold tabular-nums text-text-primary">
              {objective.weight} %
            </span>
            <ComplianceBar percent={item.percent} estado={item.estado} />
            <EstadoChip estado={item.estado} />
            <AchievementCell item={item} />
          </li>
        );
      })}
    </ul>
  );
}
