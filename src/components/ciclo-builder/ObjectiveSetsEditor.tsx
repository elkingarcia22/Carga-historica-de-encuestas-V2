import * as React from "react";
import {
  Info,
  Layers,
  Library,
  Rows3,
  Scale,
  Sparkles,
  Plus,
  TriangleAlert,
  UserRound,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "@/components/selection/SegmentedControl";
import { formatCount, type SegmentKey } from "@/components/survey-builder";
import { AssignmentDrawer, type AssignmentIntent } from "./AssignmentDrawer";
import { AssignmentGroupList } from "./AssignmentGroupList";
import { AssignmentRowsTable } from "./AssignmentRowsTable";
import {
  assignmentRowId,
  assignmentRows,
  assignmentSetSummaries,
  splitAssignmentRowId,
} from "./assignmentRows";
import type { AssignmentSelection } from "./assignmentSelection";
import {
  WeightBalanceDialog,
  weightBalanceGroup,
  type WeightBalanceGroup,
  type WeightBalanceResult,
} from "./WeightBalanceDialog";
import {
  WeightConflictActions,
  WeightConflictView,
  useWeightShares,
} from "./WeightConflictView";
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
import type { ObjectiveModelId, ObjectiveModelRules } from "./objectiveModel";

/**
 * Cómo se está mirando lo repartido: agrupado por quién comparte objetivos, o
 * de corrido, un grupo (o una persona) por fila.
 */
export type AssignmentView = "asignacion" | "lista";

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
  /** Las reglas del modelo del ciclo, que deciden qué se le pide a cada
   *  objetivo. Bajan hasta la tarjeta y hasta la validación del set. */
  rules?: ObjectiveModelRules;
  model?: ObjectiveModelId | null;
  /** Null while the drawer is closed. Owned by the builder so the action bar
   * can open it — the step itself carries no "add" button. */
  drawerRequest: AssignmentDrawerRequest | null;
  onDrawerRequestChange: (request: AssignmentDrawerRequest | null) => void;
  onSaveSet: (set: ObjectiveSet) => void;
  /** Drops these groups (or people) from their assignments; an assignment left
   * with nobody goes with them. */
  onRemoveTargets: (targets: readonly { setId: string; targetId: string }[]) => void;
  /** Lo marcado y lo que se puede hacer con ello, para la barra flotante —
   *  que es donde viven todas las acciones del paso. Null sin nada marcado. */
  onSelectionChange?: (selection: AssignmentSelection | null) => void;
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
  /** El nivel ya se decidió en la parametrización: la cabecera no ofrece
   *  apagarlo desde aquí. */
  hideSwitch?: boolean;
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
    hint: "Elige a las personas y escribe los objetivos que va a llevar cada una, sin salir del mismo panel.",
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
  rules,
  model,
  drawerRequest,
  onDrawerRequestChange,
  onSaveSet,
  onRemoveTargets,
  onSelectionChange,
  onAiWorkingChange,
  showValidation,
  coveredElsewhere,
  pendingSeedObjectives,
  onResumeTemplateSeed,
  enabled,
  onEnabledChange,
  hideSwitch = false,
}: ObjectiveSetsEditorProps) {
  const [selectedRowIds, setSelectedRowIds] = React.useState<ReadonlySet<string>>(
    () => new Set()
  );
  /** Los sets que el modal de pesos está cuadrando, o null mientras está cerrado. */
  const [balancingSetIds, setBalancingSetIds] = React.useState<readonly string[] | null>(null);
  const [isConflictOpen, setIsConflictOpen] = React.useState(false);
  /**
   * Agrupado por quién comparte objetivos, o de corrido.
   *
   * No son dos pantallas: son la misma selección leída de dos formas, y por
   * eso el estado de lo marcado vive aquí arriba y no dentro de ninguna de las
   * dos. Cambiar de vista con tres grupos marcados los deja marcados.
   */
  const [view, setView] = React.useState<AssignmentView>("asignacion");

  const copy = COPY[kind];
  const isGroup = kind === "grupal";
  const Icon = isGroup ? UsersRound : UserRound;

  const requireAlignment =
    rules?.alignment === "required" &&
    rules.companyObjectives !== "off" &&
    companyObjectives.length > 0;

  const summaries = React.useMemo(
    () => assignmentSetSummaries(sets, segmentBy, { rules, requireAlignment }),
    [sets, segmentBy, rules, requireAlignment]
  );
  const tableRows = React.useMemo(
    () => assignmentRows(summaries, segmentBy),
    [summaries, segmentBy]
  );
  const rows = React.useMemo(() => tableRows.map((row) => row.id), [tableRows]);

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

  // Los callbacks del padre y las listas se leen por ref dentro de las
  // acciones: el paso los recrea en cada render, y meterlos en las
  // dependencias haría que la selección cambie de identidad siempre, que el
  // efecto que la publica se dispare siempre, y que el render se realimente a
  // sí mismo. Con refs, lo único que mueve la selección es marcar o desmarcar.
  const onRemoveTargetsRef = React.useRef(onRemoveTargets);
  onRemoveTargetsRef.current = onRemoveTargets;
  const onDrawerRequestChangeRef = React.useRef(onDrawerRequestChange);
  onDrawerRequestChangeRef.current = onDrawerRequestChange;
  const onAllSetsChangeRef = React.useRef(onAllSetsChange);
  onAllSetsChangeRef.current = onAllSetsChange;
  const allSetsRef = React.useRef(allSets);
  allSetsRef.current = allSets;
  const setsRef = React.useRef(sets);
  setsRef.current = sets;

  const clearSelection = React.useCallback(() => setSelectedRowIds(new Set()), []);

  const removeSelected = React.useCallback(() => {
    const targets = [...selectedRowIds].map(splitAssignmentRowId);
    if (targets.length > 0) onRemoveTargetsRef.current(targets);
    setSelectedRowIds(new Set());
  }, [selectedRowIds]);

  /** Las agrupaciones que toca la selección, sin repetir. */
  const selectedSetIds = React.useMemo(() => {
    const ids: string[] = [];
    selectedRowIds.forEach((rowId) => {
      const { setId } = splitAssignmentRowId(rowId);
      if (!ids.includes(setId)) ids.push(setId);
    });
    return ids;
  }, [selectedRowIds]);

  /**
   * Cuántas filas marcadas comparten agrupación con alguien más — las únicas
   * que se pueden sacar aparte, porque a las que ya están solas separarlas no
   * les cambiaría nada.
   */
  const detachableCount = React.useMemo(() => {
    let count = 0;
    selectedRowIds.forEach((rowId) => {
      const { setId } = splitAssignmentRowId(rowId);
      const set = setsRef.current.find((candidate) => candidate.id === setId);
      if (set && set.targetIds.length > 1) count += 1;
    });
    return count;
  }, [selectedRowIds]);

  const adjustSelectedWeights = React.useCallback(() => {
    if (selectedSetIds.length > 0) setBalancingSetIds(selectedSetIds);
  }, [selectedSetIds]);

  /**
   * Saca lo marcado a agrupaciones propias, con copia de los objetivos.
   *
   * Con una sola fila abre su agrupación recién creada: separar es el paso
   * previo a editarla, y no hacerlo dejaría al usuario buscando la copia que
   * acaba de pedir. Con varias no, porque no hay una sola que abrir.
   */
  const detachSelected = React.useCallback(() => {
    const rowIds = [...selectedRowIds];
    const result = rowIds.reduce(
      (current, rowId) => {
        const { setId, targetId } = splitAssignmentRowId(rowId);
        const source = current.sets.find((set) => set.id === setId);
        if (!source || source.targetIds.length < 2) return current;
        const next = detachTarget(current.sets, setId, targetId);
        return {
          sets: next.sets,
          created: next.created ? [...current.created, next.created] : current.created,
        };
      },
      { sets: allSetsRef.current, created: [] as ObjectiveSet[] }
    );

    if (result.created.length === 0) return;
    onAllSetsChangeRef.current(result.sets);
    setSelectedRowIds(new Set());
    if (result.created.length === 1) {
      onDrawerRequestChangeRef.current({
        setId: result.created[0].id,
        phase: "objectives",
        intent: "manual",
      });
    }
  }, [selectedRowIds]);

  const openSelectedSet = React.useCallback(
    (phase: "targets" | "objectives") => () => {
      const setId = selectedSetIds[0];
      if (setId === undefined) return;
      onDrawerRequestChangeRef.current({ setId, phase, intent: "manual" });
    },
    [selectedSetIds]
  );

  /**
   * Lo marcado, ya traducido a lo que la barra puede ofrecer.
   *
   * Una sola agrupación marcada permite editar sus objetivos y cambiar sus
   * destinatarios; varias, no —eso serían dos ediciones, no una—. Cuadrar
   * pesos y quitar sí valen para varias a la vez, porque cada agrupación
   * resuelve su propio reparto.
   */
  const selection = React.useMemo<AssignmentSelection | null>(() => {
    if (selectedRowIds.size === 0) return null;
    const singleSet = selectedSetIds.length === 1;
    return {
      count: selectedRowIds.size,
      unit: isGroup ? "grupo" : "persona",
      setCount: selectedSetIds.length,
      detachableCount,
      clear: clearSelection,
      editObjectives: singleSet ? openSelectedSet("objectives") : null,
      editTargets: singleSet ? openSelectedSet("targets") : null,
      adjustWeights: adjustSelectedWeights,
      detach: detachableCount > 0 ? detachSelected : null,
      remove: removeSelected,
    };
  }, [
    selectedRowIds,
    selectedSetIds,
    detachableCount,
    isGroup,
    clearSelection,
    openSelectedSet,
    adjustSelectedWeights,
    detachSelected,
    removeSelected,
  ]);

  const onSelectionChangeRef = React.useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  React.useEffect(() => {
    onSelectionChangeRef.current?.(selection);
  }, [selection]);

  // Salir del paso no puede dejar la barra armada sobre filas que ya no se ven.
  React.useEffect(() => () => onSelectionChangeRef.current?.(null), []);

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
      const ids = set.targetIds.map((targetId) => assignmentRowId(setId, targetId));
      const allOn = ids.every((id) => current.has(id));
      const next = new Set(current);
      ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
      return next;
    });

  /** La casilla del encabezado de la lista: marca o desmarca de un tirón. */
  const setSelection = (rowIds: readonly string[], selected: boolean) =>
    setSelectedRowIds((current) => {
      const next = new Set(current);
      rowIds.forEach((id) => (selected ? next.add(id) : next.delete(id)));
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
  const conflictShares = useWeightShares(conflicts, isConflictOpen);

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

  const overlapping = React.useMemo(() => {
    if (isGroup || coveredElsewhere.size === 0) return 0;
    const ids = new Set<string>();
    sets.forEach((set) => set.targetIds.forEach((id) => coveredElsewhere.has(id) && ids.add(id)));
    return ids.size;
  }, [isGroup, sets, coveredElsewhere]);

  const showContent = enabled;

  if (isConflictOpen) {
    // El reparto del peso ocupa el paso entero, como dentro del cajón: no es
    // una ventana encima de la lista, es a dónde se va desde ella. Aquí las
    // acciones van al pie de la propia tarjeta porque este paso no tiene una
    // barra flotante propia que las recoja.
    return (
      <section className="flex min-w-0 w-full flex-1 flex-col gap-5">
        <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-surface p-6 pt-4 shadow-card">
          <WeightConflictView
            controller={conflictShares}
            affected={conflicts.length}
            onBack={() => setIsConflictOpen(false)}
            onSeparate={(setId, personId) =>
              onAllSetsChange(excludeFromSet(allSets, setId, personId))
            }
          />
          <div className="border-t border-border/60 pt-4">
            <WeightConflictActions
              controller={conflictShares}
              onCancel={() => setIsConflictOpen(false)}
              onApply={() => {
                applyShares(conflictShares.shareMap());
                setIsConflictOpen(false);
              }}
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-w-0 w-full flex-1 flex-col gap-5">
      {showContent && (
        <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-surface p-6 shadow-card">
          {sets.length > 0 && (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-surface-muted/40 px-4 py-2.5">
              {/* Lo que no cambia entre una vista y otra: a cuánta gente llega
                  y cuántos objetivos reparte. Las otras dos cuentas
                  —agrupaciones y grupos— se fueron a las pestañas, que es
                  donde significan algo: cada una dice cuántas filas vas a ver
                  si la abres. */}
              <div className="flex min-w-0 items-center gap-x-4 overflow-hidden">
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
                        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-bold",
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

              {/* Las dos lecturas de lo mismo, cada una con su cuenta dentro:
                  "Agrupaciones" es la misma palabra con la que se nombra cada
                  tarjeta —Agrupación 1, Agrupación 2—, y la lista de corrido
                  cuenta destinatarios. Llevar el número dentro de la pestaña
                  es lo que hace que "1 agrupación / 2 grupos" deje de ser un
                  dato suelto: es cuántas filas tiene cada vista. */}
              <SegmentedControl
                ariaLabel="Cómo ver lo asignado"
                size="sm"
                className="w-auto shrink-0"
                options={[
                  {
                    value: "asignacion",
                    label: `Agrupaciones (${sets.length})`,
                    icon: Layers,
                  },
                  {
                    value: "lista",
                    label: `${isGroup ? "Lista de grupos" : "Lista de colaboradores"} (${rows.length})`,
                    icon: Rows3,
                  },
                ]}
                value={view}
                onChange={(next) => setView(next as AssignmentView)}
              />
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
                  ? `El peso de los objetivos de ${conflicts[0].name} suma ${conflicts[0].total} %, no 100 %.`
                  : `A ${conflicts.length} personas el peso de sus objetivos no les suma 100 %.`
              }
              detail="Les llegan objetivos por más de una asignación, y entre todas tienen que repartir ese 100 %."
              actionLabel="Repartir el peso"
              onAction={() => setIsConflictOpen(true)}
            />
          )}

          {overlapping > 0 && (
            <p className="flex items-start gap-2 rounded-xl border border-status-warning/30 bg-status-warning/5 px-4 py-3 text-[12.5px] leading-relaxed text-text-secondary">
              <Info className="mt-px size-4 shrink-0 text-status-warning" strokeWidth={2} />
              <span>
                {overlapping === 1 ? "1 persona ya recibe" : `${overlapping} personas ya reciben`}{" "}
                objetivos por su grupo. El peso de lo que definas aquí se suma al que ya llevan, y
                entre las dos asignaciones tiene que dar 100 %.
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
            <>
              {view === "asignacion" ? (
                <AssignmentGroupList
                  kind={kind}
                  summaries={summaries}
                  segmentBy={segmentBy}
                  showValidation={showValidation}
                  selectedRowIds={selectedRowIds}
                  onToggleRow={toggleRow}
                  onToggleSet={toggleSet}
                  allSets={allSets}
                />
              ) : (
                <AssignmentRowsTable
                  kind={kind}
                  rows={tableRows}
                  showValidation={showValidation}
                  selectedRowIds={selectedRowIds}
                  onToggleRow={toggleRow}
                  onSetSelection={setSelection}
                />
              )}
            </>
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
        rules={rules}
        model={model}
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
