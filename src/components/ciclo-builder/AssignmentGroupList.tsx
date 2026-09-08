import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ListChecks,
  Pencil,
  Scale,
  SplitSquareHorizontal,
  Target,
  Trash2,
  UserRound,
  Users2,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCount, type SegmentKey } from "@/components/survey-builder";
import {
  TOTAL_WEIGHT,
  objectiveSetIssue,
  setWeightBudget,
  totalWeight,
  type ObjectiveSet,
  type ObjectiveSetKind,
} from "./cicloBuilderTypes";
import {
  objectiveSetMemberIds,
  targetHint,
  targetLabel,
} from "./objectiveSets";

export interface AssignmentGroupListProps {
  kind: ObjectiveSetKind;
  sets: readonly ObjectiveSet[];
  segmentBy: SegmentKey;
  showValidation: boolean;
  /** Filas marcadas, con el id `${setId}::${targetId}` que usa la barra. */
  selectedRowIds: ReadonlySet<string>;
  onToggleRow: (rowId: string) => void;
  onToggleSet: (setId: string) => void;
  /** Abre el drawer en los objetivos de toda la agrupación. */
  onEditObjectives: (setId: string) => void;
  /** Abre el drawer en sus destinatarios. */
  onEditTargets: (setId: string) => void;
  /** Saca a un destinatario a su propia agrupación y la abre para editarla. */
  onEditOne: (setId: string, targetId: string) => void;
  onRemoveTarget: (setId: string, targetId: string) => void;
  /** Abre el modal de pesos sobre esta agrupación. */
  onAdjustWeights: (setId: string) => void;
}

/**
 * Lo repartido, agrupado por lo que de verdad se creó: la agrupación.
 *
 * Una tabla plana de grupos escondía el hecho central de este paso —que varios
 * grupos comparten un mismo set de objetivos y por eso comparten su 100 %— y
 * dejaba "editar" como una sola acción ambigua: ¿le cambio el objetivo a
 * Marketing, o a los tres grupos que lo comparten con él? El acordeón lo dice
 * antes de preguntar: arriba la agrupación con sus objetivos y su peso, dentro
 * los grupos que la forman, y en cada uno la salida explícita —"editar solo
 * este"— que lo separa a una agrupación propia en vez de tocar a los demás
 * por accidente.
 */
export function AssignmentGroupList({
  kind,
  sets,
  segmentBy,
  showValidation,
  selectedRowIds,
  onToggleRow,
  onToggleSet,
  onEditObjectives,
  onEditTargets,
  onEditOne,
  onRemoveTarget,
  onAdjustWeights,
}: AssignmentGroupListProps) {
  // La agrupación recién creada entra abierta: es lo que se acaba de hacer, y
  // cerrarla obligaría a buscarla para comprobar que quedó como se quería.
  const [expandedIds, setExpandedIds] = React.useState<ReadonlySet<string>>(
    () => new Set(sets.length > 0 ? [sets[sets.length - 1].id] : [])
  );
  const knownIds = React.useRef<ReadonlySet<string>>(new Set(sets.map((set) => set.id)));

  React.useEffect(() => {
    const currentIds = sets.map((set) => set.id);
    const fresh = currentIds.filter((id) => !knownIds.current.has(id));
    knownIds.current = new Set(currentIds);
    if (fresh.length === 0) return;
    setExpandedIds((current) => new Set([...current, ...fresh]));
  }, [sets]);

  const toggleExpanded = (setId: string) =>
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(setId)) next.delete(setId);
      else next.add(setId);
      return next;
    });

  return (
    <div className="flex flex-col gap-3">
      {sets.map((set, index) => (
        <AssignmentGroupCard
          key={set.id}
          set={set}
          position={index + 1}
          kind={kind}
          segmentBy={segmentBy}
          showValidation={showValidation}
          isExpanded={expandedIds.has(set.id)}
          onToggleExpanded={() => toggleExpanded(set.id)}
          selectedRowIds={selectedRowIds}
          onToggleRow={onToggleRow}
          onToggleSet={onToggleSet}
          onEditObjectives={onEditObjectives}
          onEditTargets={onEditTargets}
          onEditOne={onEditOne}
          onRemoveTarget={onRemoveTarget}
          onAdjustWeights={onAdjustWeights}
        />
      ))}
    </div>
  );
}

function AssignmentGroupCard({
  set,
  position,
  kind,
  segmentBy,
  showValidation,
  isExpanded,
  onToggleExpanded,
  selectedRowIds,
  onToggleRow,
  onToggleSet,
  onEditObjectives,
  onEditTargets,
  onEditOne,
  onRemoveTarget,
  onAdjustWeights,
}: {
  set: ObjectiveSet;
  position: number;
  kind: ObjectiveSetKind;
  segmentBy: SegmentKey;
  showValidation: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
} & Pick<
  AssignmentGroupListProps,
  | "selectedRowIds"
  | "onToggleRow"
  | "onToggleSet"
  | "onEditObjectives"
  | "onEditTargets"
  | "onEditOne"
  | "onRemoveTarget"
  | "onAdjustWeights"
>) {
  const isGroup = kind === "grupal";
  const Icon = isGroup ? UsersRound : UserRound;
  const budget = setWeightBudget(set);
  const total = totalWeight(set.objectives);
  const isExact = total === budget;
  const isOver = total > budget;
  const issue = objectiveSetIssue(set);
  const shared = set.targetIds.length > 1;

  // Cuenta a quién alcanza de verdad, no cuánta gente hay en los grupos: la
  // persona separada a mano sigue estando en el grupo y ya no recibe esto.
  const reach = objectiveSetMemberIds(set, segmentBy).size;
  const excludedCount = set.excludedIds?.length ?? 0;

  const rowIds = set.targetIds.map((targetId) => `${set.id}::${targetId}`);
  const selectedCount = rowIds.filter((id) => selectedRowIds.has(id)).length;
  const allSelected = selectedCount === rowIds.length && rowIds.length > 0;

  const title = shared
    ? `${set.targetIds.length} ${isGroup ? "grupos" : "personas"} con los mismos objetivos`
    : targetLabel(set, set.targetIds[0] ?? "");

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border bg-surface transition-colors",
        showValidation && issue !== null ? "border-destructive/40" : "border-border/60"
      )}
    >
      <header
        onClick={onToggleExpanded}
        className="flex cursor-pointer items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/25"
      >
        <span onClick={(event) => event.stopPropagation()} className="flex shrink-0 items-center">
          <Checkbox
            checked={allSelected ? true : selectedCount > 0 ? "indeterminate" : false}
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
            {shared && (
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
            Agrupación {position} · {formatCount(reach)}{" "}
            {reach === 1 ? "persona" : "personas"} · {set.objectives.length}{" "}
            {set.objectives.length === 1 ? "objetivo" : "objetivos"}
          </span>
        </div>

        <div className="hidden shrink-0 items-center gap-2.5 sm:flex">
          <span className="relative h-1.5 w-[72px] overflow-hidden rounded-full bg-border/60">
            <span
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
                isExact ? "bg-status-positive" : isOver ? "bg-destructive" : "bg-primary"
              )}
              style={{ width: `${Math.min(100, (total / Math.max(1, budget)) * 100)}%` }}
            />
          </span>
          <span
            className={cn(
              "w-[68px] shrink-0 text-right text-[12px] font-bold tabular-nums",
              isExact ? "text-status-positive" : isOver ? "text-destructive" : "text-text-secondary"
            )}
          >
            {total} / {budget} %
          </span>
        </div>

        <span
          className={cn(
            "hidden max-w-[180px] shrink-0 items-center truncate rounded-full px-2.5 py-1 text-[11.5px] font-bold lg:inline-flex",
            issue === null
              ? "bg-status-positive/10 text-status-positive"
              : showValidation
                ? "bg-destructive/10 text-destructive"
                : "bg-surface-muted text-text-secondary"
          )}
          title={issue ?? undefined}
        >
          {issue ?? "Lista"}
        </span>

        <span
          onClick={(event) => event.stopPropagation()}
          className="flex shrink-0 items-center gap-1"
        >
          <IconAction
            icon={Scale}
            label="Ajustar pesos"
            onClick={() => onAdjustWeights(set.id)}
          />
          <IconAction
            icon={Pencil}
            label={shared ? "Editar los objetivos de toda la agrupación" : "Editar objetivos"}
            onClick={() => onEditObjectives(set.id)}
          />
        </span>

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

                <div className="flex flex-wrap items-center gap-2">
                  <TextAction icon={Pencil} onClick={() => onEditObjectives(set.id)}>
                    {shared ? "Editar para toda la agrupación" : "Editar objetivos"}
                  </TextAction>
                  <TextAction icon={Scale} onClick={() => onAdjustWeights(set.id)}>
                    Ajustar pesos
                  </TextAction>
                  <TextAction icon={isGroup ? Users2 : UserRound} onClick={() => onEditTargets(set.id)}>
                    {isGroup ? "Cambiar grupos" : "Cambiar personas"}
                  </TextAction>
                </div>
              </section>

              <section className="flex flex-col gap-2">
                <SectionTitle icon={isGroup ? Users2 : UserRound}>
                  {isGroup ? "Grupos en esta agrupación" : "Personas en esta agrupación"}
                </SectionTitle>

                <ul className="flex flex-col divide-y divide-border/50 overflow-hidden rounded-lg border border-border/60 bg-surface">
                  {set.targetIds.map((targetId) => {
                    const rowId = `${set.id}::${targetId}`;
                    return (
                      <li
                        key={rowId}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 transition-colors",
                          selectedRowIds.has(rowId) ? "bg-primary/5" : "hover:bg-muted/25"
                        )}
                      >
                        <Checkbox
                          checked={selectedRowIds.has(rowId)}
                          onCheckedChange={() => onToggleRow(rowId)}
                          aria-label={`Seleccionar ${targetLabel(set, targetId)}`}
                        />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[12.5px] font-semibold text-text-primary">
                            {targetLabel(set, targetId)}
                          </span>
                          <span className="truncate text-[11px] font-medium text-text-muted">
                            {targetHint(set, targetId, segmentBy)}
                          </span>
                        </div>

                        {shared && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => onEditOne(set.id, targetId)}
                                className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-[11.5px] font-semibold text-text-secondary transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                              >
                                <SplitSquareHorizontal className="size-3.5" strokeWidth={2.2} />
                                Editar solo {isGroup ? "este grupo" : "a esta persona"}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-[260px]">
                              Se separa a una agrupación propia con una copia de estos objetivos, para
                              que editarlo no le cambie nada a{" "}
                              {set.targetIds.length - 1 === 1
                                ? "el otro"
                                : `los otros ${set.targetIds.length - 1}`}
                              .
                            </TooltipContent>
                          </Tooltip>
                        )}

                        {!shared && (
                          <button
                            type="button"
                            onClick={() => onEditObjectives(set.id)}
                            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-[11.5px] font-semibold text-text-secondary transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                          >
                            <Pencil className="size-3.5" strokeWidth={2.2} />
                            Ver y editar
                          </button>
                        )}

                        <IconAction
                          icon={Trash2}
                          label={`Quitar ${targetLabel(set, targetId)}`}
                          tone="destructive"
                          onClick={() => onRemoveTarget(set.id, targetId)}
                        />
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

function IconAction({
  icon: Icon,
  label,
  onClick,
  tone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  onClick: () => void;
  tone?: "neutral" | "destructive";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2",
            tone === "destructive"
              ? "text-text-muted hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/30"
              : "text-text-secondary hover:bg-surface-muted hover:text-text-primary focus-visible:ring-primary/30"
          )}
        >
          <Icon className="size-4" strokeWidth={2} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

function TextAction({
  icon: Icon,
  onClick,
  children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-[11.5px] font-semibold text-text-secondary transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <Icon className="size-3.5" strokeWidth={2.2} />
      {children}
    </button>
  );
}
