import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ListChecks, Target, UserRound, Users2, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { HeaderSelectionMark } from "@/components/data-display";
import { formatCount, type SegmentKey } from "@/components/survey-builder";
import { TOTAL_WEIGHT, type ObjectiveSetKind } from "./cicloBuilderTypes";
import { targetHint, targetLabel } from "./objectiveSets";
import { assignmentRowId, type AssignmentSetSummary } from "./assignmentRows";
import { AssignmentStatusPill, AssignmentWeightMeter } from "./assignmentPieces";

export interface AssignmentGroupListProps {
  kind: ObjectiveSetKind;
  /** Las agrupaciones, ya con sus cuentas hechas. */
  summaries: readonly AssignmentSetSummary[];
  segmentBy: SegmentKey;
  showValidation: boolean;
  /** Filas marcadas, con el id `${setId}::${targetId}` que usa la barra. */
  selectedRowIds: ReadonlySet<string>;
  onToggleRow: (rowId: string) => void;
  onToggleSet: (setId: string) => void;
}

/**
 * Lo repartido, agrupado por lo que de verdad se creó: la agrupación.
 *
 * Una tabla plana de grupos escondía el hecho central de este paso —que varios
 * grupos comparten un mismo set de objetivos y por eso comparten su 100 %— y
 * dejaba "editar" como una sola acción ambigua: ¿le cambio el objetivo a
 * Marketing, o a los tres grupos que lo comparten con él? El acordeón lo dice
 * antes de preguntar: arriba la agrupación con sus objetivos y su peso, dentro
 * los grupos que la forman.
 *
 * Aquí no hay un solo botón. Las tarjetas dicen qué hay; marcar una fila —o la
 * agrupación entera desde su casilla— es lo que elige sobre qué se actúa, y
 * las acciones aparecen todas juntas en la barra flotante, como en la tabla de
 * colaboradores. Eso vale el clic de más: antes cada fila repetía tres botones
 * y la agrupación otros dos, y ninguno decía si estaba tocando a uno o a los
 * cuatro que comparten esos objetivos.
 */
export function AssignmentGroupList({
  kind,
  summaries,
  segmentBy,
  showValidation,
  selectedRowIds,
  onToggleRow,
  onToggleSet,
}: AssignmentGroupListProps) {
  // La agrupación recién creada entra abierta: es lo que se acaba de hacer, y
  // cerrarla obligaría a buscarla para comprobar que quedó como se quería.
  const [expandedIds, setExpandedIds] = React.useState<ReadonlySet<string>>(
    () => new Set(summaries.length > 0 ? [summaries[summaries.length - 1].set.id] : [])
  );
  const knownIds = React.useRef<ReadonlySet<string>>(
    new Set(summaries.map((summary) => summary.set.id))
  );

  React.useEffect(() => {
    const currentIds = summaries.map((summary) => summary.set.id);
    const fresh = currentIds.filter((id) => !knownIds.current.has(id));
    knownIds.current = new Set(currentIds);
    if (fresh.length === 0) return;
    setExpandedIds((current) => new Set([...current, ...fresh]));
  }, [summaries]);

  const toggleExpanded = (setId: string) =>
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(setId)) next.delete(setId);
      else next.add(setId);
      return next;
    });

  return (
    <div className="flex flex-col gap-3">
      {summaries.map((summary) => (
        <AssignmentGroupCard
          key={summary.set.id}
          summary={summary}
          kind={kind}
          segmentBy={segmentBy}
          showValidation={showValidation}
          isExpanded={expandedIds.has(summary.set.id)}
          onToggleExpanded={() => toggleExpanded(summary.set.id)}
          selectedRowIds={selectedRowIds}
          onToggleRow={onToggleRow}
          onToggleSet={onToggleSet}
        />
      ))}
    </div>
  );
}

function AssignmentGroupCard({
  summary,
  kind,
  segmentBy,
  showValidation,
  isExpanded,
  onToggleExpanded,
  selectedRowIds,
  onToggleRow,
  onToggleSet,
}: {
  summary: AssignmentSetSummary;
  kind: ObjectiveSetKind;
  segmentBy: SegmentKey;
  showValidation: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
} & Pick<AssignmentGroupListProps, "selectedRowIds" | "onToggleRow" | "onToggleSet">) {
  const { set, position, title, isShared, reach, excludedCount, weight, budget, issue } = summary;
  const isGroup = kind === "grupal";
  const Icon = isGroup ? UsersRound : UserRound;

  const rowIds = set.targetIds.map((targetId) => assignmentRowId(set.id, targetId));
  const selectedCount = rowIds.filter((id) => selectedRowIds.has(id)).length;
  const allSelected = selectedCount === rowIds.length && rowIds.length > 0;
  const hasSelection = selectedCount > 0;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border bg-surface transition-[border-color,box-shadow] duration-200",
        hasSelection
          ? "border-primary/50 shadow-[0_0_0_3px_hsl(var(--primary)/0.08)]"
          : showValidation && issue !== null
            ? "border-destructive/40"
            : "border-border/60"
      )}
    >
      <header
        onClick={onToggleExpanded}
        className={cn(
          "flex cursor-pointer items-center gap-3 px-4 py-3.5 transition-colors",
          hasSelection ? "bg-primary/[0.04] hover:bg-primary/[0.07]" : "hover:bg-muted/25"
        )}
      >
        <span onClick={(event) => event.stopPropagation()} className="flex shrink-0 items-center">
          <Checkbox
            checked={allSelected ? true : hasSelection ? "indeterminate" : false}
            onCheckedChange={() => onToggleSet(set.id)}
            aria-label={`Seleccionar la agrupación ${title}`}
          />
        </span>

        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
        >
          <Icon className="size-[18px]" strokeWidth={2.2} />
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span className="truncate text-[13.5px] font-bold text-text-primary">{title}</span>
            {isShared && (
              <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-text-secondary">
                Compartida
              </span>
            )}
            {excludedCount > 0 && (
              <span
                className="shrink-0 rounded-full bg-status-warning/10 px-2 py-0.5 text-[10.5px] font-bold text-status-warning"
                title="Personas del grupo que se sacaron de esta asignación porque llevan objetivos propios"
              >
                {excludedCount === 1 ? "1 excepción" : `${excludedCount} excepciones`}
              </span>
            )}
          </span>
          <span className="truncate text-[11.5px] font-medium text-text-muted">
            Agrupación {position} · {formatCount(reach)} {reach === 1 ? "persona" : "personas"} ·{" "}
            {set.objectives.length} {set.objectives.length === 1 ? "objetivo" : "objetivos"}
          </span>
        </div>

        <AssignmentWeightMeter
          weight={weight}
          budget={budget}
          showValidation={showValidation}
          className="hidden shrink-0 sm:flex"
        />

        <AssignmentStatusPill
          issue={issue}
          showValidation={showValidation}
          className="hidden shrink-0 lg:inline-flex"
        />

        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-text-muted transition-transform duration-200",
            isExpanded && "rotate-180"
          )}
          strokeWidth={2.2}
        />
      </header>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-4 border-t border-border/60 bg-surface-muted/20 px-4 py-4">
              <section className="flex flex-col gap-2">
                <SectionTitle icon={Target}>
                  Objetivos de esta agrupación
                  {budget !== TOTAL_WEIGHT && (
                    <span className="ml-1.5 rounded-full bg-status-warning/10 px-2 py-0.5 text-[10.5px] font-bold text-status-warning">
                      cupo de {budget} %
                    </span>
                  )}
                </SectionTitle>

                {set.objectives.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border bg-surface px-3 py-4 text-center text-[12px] text-text-secondary">
                    Esta agrupación todavía no tiene objetivos.
                  </p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border/50 overflow-hidden rounded-lg border border-border/60 bg-surface">
                    {set.objectives.map((objective, index) => (
                      <li
                        key={objective.id}
                        className="flex items-center gap-2.5 px-3 py-2 text-[12.5px]"
                      >
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[10.5px] font-bold tabular-nums text-text-secondary">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-semibold text-text-primary">
                          {objective.title.trim() || "Objetivo sin título"}
                        </span>
                        {objective.keyActions.length > 0 && (
                          <span className="hidden shrink-0 items-center gap-1 text-[11px] font-medium text-text-muted sm:inline-flex">
                            <ListChecks className="size-3.5" strokeWidth={2} />
                            {objective.keyActions.length}
                          </span>
                        )}
                        <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-bold tabular-nums text-text-secondary">
                          {objective.weight} %
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="flex flex-col gap-2">
                <SectionTitle icon={isGroup ? Users2 : UserRound}>
                  {isGroup ? "Grupos en esta agrupación" : "Personas en esta agrupación"}
                </SectionTitle>

                <ul className="flex flex-col divide-y divide-border/50 overflow-hidden rounded-lg border border-border/60 bg-surface">
                  {set.targetIds.map((targetId) => {
                    const rowId = assignmentRowId(set.id, targetId);
                    const selected = selectedRowIds.has(rowId);
                    return (
                      <li key={rowId}>
                        {/* La fila entera marca: la casilla dice cómo se hace,
                            pero el objetivo de clic no tiene por qué ser un
                            cuadrado de 16 píxeles. */}
                        <button
                          type="button"
                          onClick={() => onToggleRow(rowId)}
                          aria-pressed={selected}
                          className={cn(
                            "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30",
                            selected ? "bg-primary/5" : "hover:bg-muted/25"
                          )}
                        >
                          {/* La marca, no el control: el `Checkbox` real es
                              un `<button>`, y meterlo dentro del botón de la
                              fila es HTML inválido. Quien pulsa es la fila. */}
                          <HeaderSelectionMark state={selected} />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-[12.5px] font-semibold text-text-primary">
                              {targetLabel(set, targetId)}
                            </span>
                            <span className="truncate text-[11px] font-medium text-text-muted">
                              {targetHint(set, targetId, segmentBy)}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  children: React.ReactNode;
}) {
  return (
    <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-text-secondary">
      <Icon className="size-3.5" strokeWidth={2.2} />
      {children}
    </h4>
  );
}
