import * as React from "react";
import { Info, Library, Scale, Sparkles, Plus, TriangleAlert, UserRound, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import type { TableSelectionActions } from "@/components/action-rail";
import { formatCount, type SegmentKey } from "@/components/survey-builder";
import { AssignmentDrawer, type AssignmentIntent } from "./AssignmentDrawer";
import { AssignmentGroupList } from "./AssignmentGroupList";
import {
  WeightBalanceDialog,
  weightBalanceGroup,
  type WeightBalanceGroup,
  type WeightBalanceResult,
} from "./WeightBalanceDialog";
import { WeightConflictDialog } from "./WeightConflictDialog";
import {
  assignedObjectiveCount,
  isObjectiveSetComplete,
  setWeightBudget,
  type Objective,
  type ObjectiveSet,
  type ObjectiveSetKind,
} from "./cicloBuilderTypes";
import {
  applyObjectiveWeights,
  detachTarget,
  excludeFromSet,
  objectiveSetsReach,
  setWeightShare,
} from "./objectiveSets";
import { conflictedLoads } from "./weightConflicts";

/** What the drawer is currently building. */
export interface AssignmentDrawerRequest {
  setId: string | null;
  phase: "targets" | "objectives";
  intent: AssignmentIntent;
  /** Con `intent: "plantilla"`, los objetivos con los que el borrador arranca
   *  ya escritos. */
  templateObjectives?: readonly Objective[];
}

export interface ObjectiveSetsEditorProps {
  kind: ObjectiveSetKind;
  /** Only the sets of this kind — the step never sees the other's. */
  sets: readonly ObjectiveSet[];
  /**
   * Las dos clases juntas. El choque de pesos no se ve dentro de una sola:
   * quien lo sufre es la persona que está en las dos, así que el aviso y su
   * arreglo necesitan la lista completa.
   */
  allSets: readonly ObjectiveSet[];
  /** Escribe la lista completa de una vez — separar un grupo, cambiar un cupo
   *  o cuadrar pesos son operaciones sobre el conjunto, no sobre un set. */
  onAllSetsChange: (next: readonly ObjectiveSet[]) => void;
  segmentBy: SegmentKey;
  onSegmentByChange: (value: SegmentKey) => void;
  autoInclude: boolean;
  onAutoIncludeChange: (value: boolean) => void;
  companyObjectives: readonly Objective[];
  /** Null while the drawer is closed. Owned by the builder so the action bar
   * can open it — the step itself carries no "add" button. */
  drawerRequest: AssignmentDrawerRequest | null;
  onDrawerRequestChange: (request: AssignmentDrawerRequest | null) => void;
  onSaveSet: (set: ObjectiveSet) => void;
  /** Drops these groups (or people) from their assignments; an assignment left
   * with nobody goes with them. */
  onRemoveTargets: (targets: readonly { setId: string; targetId: string }[]) => void;
  /** Ticked rows, reported up so the action bar can act on them — the same
   * contract the participants table uses. */
  onSelectionChange?: (count: number, actions: TableSelectionActions) => void;
  /** Fires when the bar's "editar" acts on a single ticked row. */
  onRequestEdit?: (setId: string) => void;
  onAiWorkingChange?: (working: boolean) => void;
  showValidation: boolean;
  /** People already covered on the *other* step, so the individual step can
   * warn instead of silently giving someone two competing 100 %. */
  coveredElsewhere: ReadonlySet<string>;
  /** Objetivos que trajo una plantilla para este alcance, todavía sin
   *  destinatario — null cuando no se usó ninguna o ya se resolvió. */
  pendingSeedObjectives?: readonly Objective[] | null;
  /** Reabre el drawer de destinatarios con esos mismos objetivos. */
  onResumeTemplateSeed?: () => void;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}

const COPY: Readonly<
  Record<
    ObjectiveSetKind,
    { title: string; lead: string; empty: string; hint: string; unit: string; switchLabel: string }
  >
> = {
  grupal: {
    title: "Objetivos por grupo",
    lead: "Un mismo set de objetivos para todo un grupo. Quien entre al grupo después los hereda.",
    empty: "Todavía no has creado ninguna asignación grupal",
    hint: "Elige los grupos y escribe los objetivos que compartirán, sin salir del mismo panel.",
    unit: "Grupo",
    switchLabel: "Usar objetivos por grupo",
  },
  individual: {
    title: "Objetivos individuales",
    lead: "Objetivos que se le asignan a personas concretas, cuando lo que se mide cambia de una a otra.",
    empty: "Todavía no has creado ninguna asignación individual",
    hint: "Este paso es opcional: si todo tu ciclo se reparte por grupos, puedes continuar sin agregar nada.",
    unit: "Persona",
    switchLabel: "Usar objetivos individuales",
  },
};

/**
 * One of the two assignment steps — the same screen twice, once per kind.
 *
 * El paso es el registro de lo repartido, agrupado por agrupación: varios
 * grupos que comparten un set comparten también su 100 %, y verlos juntos es
 * lo que hace que "editar" signifique algo concreto —para todos, o para uno
 * solo, que entonces se separa—.
 *
 * Crear sigue pasando entero dentro del drawer. Lo que este paso añade por su
 * cuenta son las dos revisiones que solo se ven desde arriba: los repartos que
 * no cierran, y la gente que recibe objetivos por dos vías a la vez.
 */
export function ObjectiveSetsEditor({
  kind,
  sets,
  allSets,
  onAllSetsChange,
  segmentBy,
  onSegmentByChange,
  autoInclude,
  onAutoIncludeChange,
  companyObjectives,
  drawerRequest,
  onDrawerRequestChange,
  onSaveSet,
  onRemoveTargets,
  onSelectionChange,
  onRequestEdit,
  onAiWorkingChange,
  showValidation,
  coveredElsewhere,
  pendingSeedObjectives,
  onResumeTemplateSeed,
  enabled,
  onEnabledChange,
}: ObjectiveSetsEditorProps) {
  const [selectedRowIds, setSelectedRowIds] = React.useState<ReadonlySet<string>>(
    () => new Set()
  );
  /** Los sets que el modal de pesos está cuadrando, o null mientras está cerrado. */
  const [balancingSetIds, setBalancingSetIds] = React.useState<readonly string[] | null>(null);
  const [isConflictOpen, setIsConflictOpen] = React.useState(false);

  const copy = COPY[kind];
  const isGroup = kind === "grupal";
  const Icon = isGroup ? UsersRound : UserRound;

  const rows = React.useMemo(
    () => sets.flatMap((set) => set.targetIds.map((targetId) => `${set.id}::${targetId}`)),
    [sets]
  );

  const editing =
    drawerRequest?.setId != null
      ? (sets.find((set) => set.id === drawerRequest.setId) ?? null)
      : null;

  // A target already carried by another assignment of this kind can't be
  // picked again: two assignments over the same person would each claim to be
  // their whole 100 %.
  const takenIds = React.useMemo(() => {
    const taken = new Set<string>();
    sets.forEach((set) => {
      if (set.id === editing?.id) return;
      set.targetIds.forEach((id) => taken.add(id));
    });
    return taken;
  }, [sets, editing]);

  // Rows that disappear (a group dropped, an assignment deleted) must not keep
  // the bar armed for something that is no longer there.
  React.useEffect(() => {
    setSelectedRowIds((current) => {
      const alive = new Set(rows);
      const next = new Set([...current].filter((id) => alive.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [rows]);

  // Los callbacks del padre se llegan por ref: el paso los recrea en cada
  // render, y meterlos en las dependencias haría que `removeSelected` cambie
  // de identidad siempre, que el efecto que la publica se dispare siempre, y
  // que el render se realimente a sí mismo.
  const onRemoveTargetsRef = React.useRef(onRemoveTargets);
  onRemoveTargetsRef.current = onRemoveTargets;

  const clearSelection = React.useCallback(() => setSelectedRowIds(new Set()), []);

  const removeSelected = React.useCallback(() => {
    const targets = [...selectedRowIds].map((rowId) => {
      const [setId, targetId] = rowId.split("::");
      return { setId, targetId };
    });
    if (targets.length > 0) onRemoveTargetsRef.current(targets);
    setSelectedRowIds(new Set());
  }, [selectedRowIds]);

  // The single ticked row's assignment, for the bar's "editar objetivos".
  const singleSelectedSetId = React.useMemo(() => {
    if (selectedRowIds.size !== 1) return null;
    const [rowId] = [...selectedRowIds];
    return rowId.split("::")[0] ?? null;
  }, [selectedRowIds]);

  const onSelectionChangeRef = React.useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  const onRequestEditRef = React.useRef(onRequestEdit);
  onRequestEditRef.current = onRequestEdit;

  React.useEffect(() => {
    onSelectionChangeRef.current?.(selectedRowIds.size, {
      clear: clearSelection,
      remove: removeSelected,
    });
  }, [selectedRowIds, clearSelection, removeSelected]);

  // The bar's "editar" needs to know which assignment is ticked; it is handed
  // over the same way the count is.
  React.useEffect(() => {
    onRequestEditRef.current?.(singleSelectedSetId ?? "");
  }, [singleSelectedSetId]);

  const toggleRow = (rowId: string) =>
    setSelectedRowIds((current) => {
      const next = new Set(current);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });

  /** El checkbox de la cabecera de una agrupación: todo o nada. */
  const toggleSet = (setId: string) =>
    setSelectedRowIds((current) => {
      const set = sets.find((candidate) => candidate.id === setId);
      if (!set) return current;
      const ids = set.targetIds.map((targetId) => `${setId}::${targetId}`);
      const allOn = ids.every((id) => current.has(id));
      const next = new Set(current);
      ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
      return next;
    });

  const reach = objectiveSetsReach(sets, segmentBy);
  const objectivesCount = assignedObjectiveCount(sets);
  const pending = sets.filter((set) => !isObjectiveSetComplete(set)).length;

  // ── Revisiones ───────────────────────────────────────────────────────────

  /** Repartos que no cierran en su cupo, y por eso se pueden cuadrar juntos. */
  const unbalancedSets = React.useMemo(
    () =>
      sets.filter(
        (set) =>
          set.objectives.length > 0 &&
          set.objectives.reduce((sum, objective) => sum + objective.weight, 0) !==
            setWeightBudget(set)
      ),
    [sets]
  );

  const conflicts = React.useMemo(
    () => conflictedLoads(allSets, segmentBy),
    [allSets, segmentBy]
  );

  const balancingGroups = React.useMemo<readonly WeightBalanceGroup[]>(() => {
    if (balancingSetIds === null) return [];
    return balancingSetIds
      .map((setId) => sets.find((set) => set.id === setId))
      .filter((set): set is ObjectiveSet => set !== undefined)
      .map((set) => weightBalanceGroup(set, setWeightBudget(set)));
  }, [balancingSetIds, sets]);

  const applyBalance = (result: WeightBalanceResult) => {
    const next = Object.entries(result).reduce(
      (current, [setId, weights]) => applyObjectiveWeights(current, setId, weights),
      allSets
    );
    onAllSetsChange(next);
  };

  const applyShares = (shares: ReadonlyMap<string, number>) => {
    const next = [...shares.entries()].reduce(
      (current, [setId, share]) => setWeightShare(current, setId, share),
      allSets
    );
    onAllSetsChange(next);
  };

  /** Saca a un destinatario de una agrupación compartida y abre la suya. */
  const editOne = (setId: string, targetId: string) => {
    const { sets: next, created } = detachTarget(allSets, setId, targetId);
    onAllSetsChange(next);
    if (created) {
      onDrawerRequestChange({ setId: created.id, phase: "objectives", intent: "manual" });
    }
  };

  const overlapping = React.useMemo(() => {
    if (isGroup || coveredElsewhere.size === 0) return 0;
    const ids = new Set<string>();
    sets.forEach((set) => set.targetIds.forEach((id) => coveredElsewhere.has(id) && ids.add(id)));
    return ids.size;
  }, [isGroup, sets, coveredElsewhere]);

  // Por grupos ya no lleva su propio header con switch: activar/desactivar
  // vive en el checkbox de la tarjeta "Por grupos" de arriba, y este panel se
  // reduce siempre al mismo empty state o lista, sin un segundo interruptor
  // duplicando la misma decisión.
  const showContent = isGroup || enabled;

  return (
    <section className="flex min-w-0 w-full flex-1 flex-col gap-5">
      {!isGroup && (
        <header className="rounded-2xl border border-border/60 bg-surface p-6 shadow-card">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="size-[18px]" strokeWidth={2.2} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <h2 className="text-[16px] font-bold tracking-tight text-text-primary">
                {copy.title}
              </h2>
              <p className="text-[13px] leading-relaxed text-text-secondary">{copy.lead}</p>
            </div>

            <label className="ml-4 mt-1 flex shrink-0 cursor-pointer items-center gap-2 text-[12px] font-medium text-text-primary">
              <span>{copy.switchLabel}</span>
              <Switch
                checked={enabled}
                onCheckedChange={onEnabledChange}
                aria-label={copy.switchLabel}
                className="data-[state=checked]:bg-status-positive"
              />
            </label>
          </div>
        </header>
      )}

      {showContent && (
        <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-surface p-6 shadow-card">
          {sets.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border/60 bg-surface-muted/40 px-4 py-3">
              <Stat
                label={sets.length === 1 ? "agrupación" : "agrupaciones"}
                value={sets.length}
              />
              <Divider />
              <Stat
                label={
                  rows.length === 1 ? copy.unit.toLowerCase() : `${copy.unit.toLowerCase()}s`
                }
                value={rows.length}
              />
              <Divider />
              <Stat label="personas alcanzadas" value={formatCount(reach)} />
              <Divider />
              <Stat
                label={objectivesCount === 1 ? "objetivo" : "objetivos"}
                value={objectivesCount}
              />
              {pending > 0 && (
                <>
                  <Divider />
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-bold",
                      showValidation
                        ? "bg-destructive/10 text-destructive"
                        : "bg-surface text-text-secondary"
                    )}
                  >
                    {pending} sin terminar
                  </span>
                </>
              )}
            </div>
          )}

          {/* Las dos revisiones que solo se ven desde aquí arriba, cada una con
              el arreglo en bloque al lado del diagnóstico: leerlo y no poder
              hacer nada con ello es lo que obligaba a entrar objetivo por
              objetivo. */}
          {unbalancedSets.length > 0 && (
            <ReviewBanner
              tone="warning"
              icon={Scale}
              message={
                unbalancedSets.length === 1
                  ? "1 agrupación tiene los pesos sin cuadrar."
                  : `${unbalancedSets.length} agrupaciones tienen los pesos sin cuadrar.`
              }
              detail="Puedes repartirlos todos de una vez, sin abrir cada objetivo."
              actionLabel="Ajustar pesos"
              onAction={() => setBalancingSetIds(unbalancedSets.map((set) => set.id))}
            />
          )}

          {conflicts.length > 0 && (
            <ReviewBanner
              tone="destructive"
              icon={TriangleAlert}
              message={
                conflicts.length === 1
                  ? `${conflicts[0].name} recibe objetivos por ${conflicts[0].sources.length} vías y suma ${conflicts[0].total} %.`
                  : `${conflicts.length} personas reciben objetivos por más de una vía y no cierran en 100 %.`
              }
              detail="Reparte su 100 % entre las asignaciones que las alcanzan, o deja que se ajuste solo."
              actionLabel="Resolver conflictos"
              onAction={() => setIsConflictOpen(true)}
            />
          )}

          {overlapping > 0 && (
            <p className="flex items-start gap-2 rounded-xl border border-status-warning/30 bg-status-warning/5 px-4 py-3 text-[12.5px] leading-relaxed text-text-secondary">
              <Info className="mt-px size-4 shrink-0 text-status-warning" strokeWidth={2} />
              <span>
                {overlapping === 1 ? "1 persona ya recibe" : `${overlapping} personas ya reciben`}{" "}
                objetivos por su grupo. Lo que definas aquí se suma a lo que ya llevan, así que
                entre las dos vías tiene que dar 100 %.
              </span>
            </p>
          )}

          {pendingSeedObjectives != null && pendingSeedObjectives.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
              <div className="flex items-start gap-2.5">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2.2} />
                <p className="text-[12.5px] leading-relaxed text-text-secondary">
                  <strong className="text-text-primary">
                    {pendingSeedObjectives.length}{" "}
                    {pendingSeedObjectives.length === 1 ? "objetivo" : "objetivos"} de la plantilla
                  </strong>{" "}
                  {pendingSeedObjectives.length === 1 ? "está" : "están"} sin{" "}
                  {isGroup ? "grupo asignado" : "persona asignada"}.
                </p>
              </div>
              <button
                type="button"
                onClick={onResumeTemplateSeed}
                className="shrink-0 rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                {isGroup ? "Elegir grupos" : "Elegir personas"}
              </button>
            </div>
          )}

          {sets.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-surface-muted/30 px-6 py-12 text-center">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-surface text-text-secondary">
                <Icon className="size-5" strokeWidth={2} />
              </span>
              <p className="text-[13.5px] font-semibold text-text-primary">{copy.empty}</p>
              <p className="max-w-[52ch] text-[12.5px] leading-relaxed text-text-secondary">
                {copy.hint}
              </p>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onEnabledChange(true);
                    onDrawerRequestChange({ setId: null, phase: "targets", intent: "manual" });
                  }}
                  className="flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.98]"
                >
                  <Plus className="size-4" strokeWidth={2.4} />
                  {isGroup ? "Agregar objetivos por grupo" : "Crear objetivos manualmente"}
                </button>
                {/* La tercera procedencia, la misma que ofrece el menú de la
                    barra: objetivos ya escritos. El drawer los pedirá después de
                    elegir a quién van, que es cuando existe dónde ponerlos. */}
                <button
                  type="button"
                  onClick={() => {
                    onEnabledChange(true);
                    onDrawerRequestChange({ setId: null, phase: "targets", intent: "banco" });
                  }}
                  className="group flex h-11 items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-4 text-[13px] font-semibold text-text-secondary transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.98]"
                >
                  <Library className="size-4" strokeWidth={2.2} />
                  Elegir del banco
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onEnabledChange(true);
                    onDrawerRequestChange({ setId: null, phase: "targets", intent: "ai" });
                  }}
                  className="ai-trigger group flex h-11 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-[13px] font-semibold text-text-primary transition-all hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.98]"
                >
                  <svg width="0" height="0" className="absolute">
                    <defs>
                      <linearGradient
                        id="ai-gradient-sets-empty"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="hsl(var(--ai-gradient-start))" />
                        <stop offset="100%" stopColor="hsl(var(--ai-gradient-end))" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <Sparkles
                    className="size-4"
                    strokeWidth={2.4}
                    stroke="url(#ai-gradient-sets-empty)"
                  />
                  <span className="text-ai-gradient">Crear objetivos con IA</span>
                </button>
              </div>
            </div>
          ) : (
            <AssignmentGroupList
              kind={kind}
              sets={sets}
              segmentBy={segmentBy}
              showValidation={showValidation}
              selectedRowIds={selectedRowIds}
              onToggleRow={toggleRow}
              onToggleSet={toggleSet}
              onEditObjectives={(setId) =>
                onDrawerRequestChange({ setId, phase: "objectives", intent: "manual" })
              }
              onEditTargets={(setId) =>
                onDrawerRequestChange({ setId, phase: "targets", intent: "manual" })
              }
              onEditOne={editOne}
              onRemoveTarget={(setId, targetId) => onRemoveTargets([{ setId, targetId }])}
              onAdjustWeights={(setId) => setBalancingSetIds([setId])}
            />
          )}
        </div>
      )}

      <AssignmentDrawer
        open={drawerRequest !== null}
        onOpenChange={(open) => !open && onDrawerRequestChange(null)}
        kind={kind}
        initialSet={editing}
        initialPhase={drawerRequest?.phase ?? "targets"}
        intent={drawerRequest?.intent ?? "manual"}
        templateObjectives={drawerRequest?.templateObjectives}
        takenIds={takenIds}
        allSets={allSets}
        onAllSetsChange={onAllSetsChange}
        segmentBy={segmentBy}
        onSegmentByChange={onSegmentByChange}
        autoInclude={autoInclude}
        onAutoIncludeChange={onAutoIncludeChange}
        companyObjectives={companyObjectives}
        onSave={(set) => {
          onSaveSet(set);
          onDrawerRequestChange(null);
        }}
        onAiWorkingChange={onAiWorkingChange}
      />

      <WeightBalanceDialog
        open={balancingSetIds !== null}
        onOpenChange={(open) => !open && setBalancingSetIds(null)}
        groups={balancingGroups}
        onApply={applyBalance}
      />

      <WeightConflictDialog
        open={isConflictOpen}
        onOpenChange={setIsConflictOpen}
        loads={conflicts}
        onSeparate={(setId, personId) =>
          onAllSetsChange(excludeFromSet(allSets, setId, personId))
        }
        onApply={applyShares}
      />
    </section>
  );
}

function ReviewBanner({
  tone,
  icon: Icon,
  message,
  detail,
  actionLabel,
  onAction,
}: {
  tone: "warning" | "destructive";
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  message: string;
  detail: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3",
        tone === "warning"
          ? "border-status-warning/30 bg-status-warning/5"
          : "border-destructive/30 bg-destructive/5"
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <Icon
          className={cn(
            "mt-0.5 size-4 shrink-0",
            tone === "warning" ? "text-status-warning" : "text-destructive"
          )}
          strokeWidth={2.2}
        />
        <p className="text-[12.5px] leading-relaxed text-text-secondary">
          <strong className="text-text-primary">{message}</strong> {detail}
        </p>
      </div>
      <button
        type="button"
        onClick={onAction}
        className={cn(
          "shrink-0 rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2",
          tone === "warning"
            ? "bg-status-warning hover:bg-status-warning/90 focus-visible:ring-status-warning/30"
            : "bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive/30"
        )}
      >
        {actionLabel}
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-[15px] font-bold tabular-nums text-text-primary">{value}</span>
      <span className="text-[12px] font-medium text-text-secondary">{label}</span>
    </span>
  );
}

const Divider = () => <span aria-hidden className="h-4 w-px bg-border" />;
