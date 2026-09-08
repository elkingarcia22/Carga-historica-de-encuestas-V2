import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Library,
  Plus,
  RefreshCw,
  Scale,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DrawerShell } from "@/components/overlays";
import { DrawerActionRail, DrawerRailButton } from "@/components/action-rail";
import { WeightBalanceDialog, weightBalanceGroup } from "./WeightBalanceDialog";
import { WeightConflictDialog } from "./WeightConflictDialog";
import { loadsForTargets, tightestFreeShare, type PersonLoad } from "./weightConflicts";
import { COLLABORATORS } from "@/mocks/collaborators";
import { formatCount, type SegmentKey } from "@/components/survey-builder";
import { AutoIncludeToggle, GroupsPanel } from "@/components/survey-builder/ParticipantsEditor";
import { CollaboratorTable } from "@/components/survey-builder/CollaboratorTable";
import { groupMemberIds } from "@/components/survey-builder/participants";
import { ObjectiveCardCompact } from "./ObjectiveCardCompact";
import { AiObjectiveComposer, type AiReviewActions } from "./AiObjectiveComposer";
import { AiTriggerButton } from "./AiObjectiveControls";
import { ObjectiveBankDrawer } from "./ObjectiveBankDrawer";
import { MAX_AI_OBJECTIVES } from "./aiObjectiveBrief";
import {
  createBlankObjective,
  createObjectiveSet,
  objectiveSetIssue,
  setWeightBudget,
  totalWeight,
  TOTAL_WEIGHT,
  type Objective,
  type ObjectiveSet,
  type ObjectiveSetKind,
} from "./cicloBuilderTypes";
import {
  distributeSetWeights,
  excludeFromSet,
  freeWeight,
  insertObjective,
  insertObjectivesFromAI,
  changeObjective as changeObjectiveIn,
  removeObjective as removeObjectiveIn,
  rescaleObjectives,
  setWeightShare,
  targetLabel,
} from "./objectiveSets";

type Phase = "targets" | "objectives";

/** Whether the objectives are going to be written by hand or by the AI. The
 * question is answered before the drawer opens — in the step's empty state or
 * in the action bar's menu — so this flow never asks it twice. */
/** Con qué se abre la fase de objetivos: una tarjeta en blanco, el generador
 *  de IA, o el banco de objetivos ya escritos. La decisión se toma fuera —en
 *  el menú "Añadir" de la barra— para que el flujo no la pregunte dos veces. */
export type AssignmentIntent = "manual" | "ai" | "banco" | "plantilla";

interface AssignmentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: ObjectiveSetKind;
  /** The assignment being edited, or null to build a new one. */
  initialSet: ObjectiveSet | null;
  /** Which phase to land on. New assignments always start at "targets";
   * editing an existing one usually means going straight to its objectives. */
  initialPhase?: Phase;
  /** How the author said they wanted to write the objectives. Applied once,
   * the moment the objectives phase opens on an assignment that has none. */
  intent: AssignmentIntent;
  /** Con `intent: "plantilla"`, los objetivos con los que arranca el borrador
   *  — ya escritos y pesados por la plantilla, a falta solo de destinatario. */
  templateObjectives?: readonly Objective[];
  /** Targets already carried by another assignment of the same kind. */
  takenIds: ReadonlySet<string>;
  /**
   * Todo lo repartido en el ciclo, de las dos clases. El drawer lo necesita
   * para contestar la pregunta que solo se puede hacer aquí: de la gente a la
   * que estoy a punto de ponerle esto, ¿quién ya lleva objetivos?
   */
  allSets: readonly ObjectiveSet[];
  /** Escribe esa lista: resolver el conflicto cambia asignaciones que ya
   *  existen, no el borrador que se está armando. */
  onAllSetsChange: (next: readonly ObjectiveSet[]) => void;
  segmentBy: SegmentKey;
  onSegmentByChange: (value: SegmentKey) => void;
  autoInclude: boolean;
  onAutoIncludeChange: (value: boolean) => void;
  companyObjectives: readonly Objective[];
  /** Fires once, on "Guardar", with the finished assignment. */
  onSave: (set: ObjectiveSet) => void;
  onAiWorkingChange?: (working: boolean) => void;
}

/**
 * Creating an assignment, start to finish, without leaving the drawer.
 *
 * Two phases in one flow — who carries the objectives, then what they are —
 * because those two answers only make sense together: the objectives are
 * written *for* the people picked a moment earlier, and nothing reaches the
 * ciclo until both halves exist. The step behind it stays a read-only table of
 * what has already been decided, so the builder never shows a half-made
 * assignment.
 */
export function AssignmentDrawer({
  open,
  onOpenChange,
  kind,
  initialSet,
  initialPhase = "targets",
  intent,
  templateObjectives,
  takenIds,
  allSets,
  onAllSetsChange,
  segmentBy,
  onSegmentByChange,
  autoInclude,
  onAutoIncludeChange,
  companyObjectives,
  onSave,
  onAiWorkingChange,
}: AssignmentDrawerProps) {
  const isGroup = kind === "grupal";

  const [phase, setPhase] = React.useState<Phase>(initialPhase);
  /**
   * Whether the reader has moved off the phase the drawer opened on.
   *
   * The first phase lands while the Sheet is still sliding in, so it needs the
   * extra delay that clears that motion first; a phase reached by pressing
   * "Continuar" or "Atrás" has nothing to wait on, and the delayed cascade
   * would leave the panel blank for a beat on every switch.
   */
  const [hasNavigated, setHasNavigated] = React.useState(false);
  const bodyCascade = hasNavigated ? "cascade-enter" : "cascade-enter-drawer";
  const goToPhase = (next: Phase) => {
    setPhase(next);
    setHasNavigated(true);
  };
  /** Un borrador en blanco arranca vacío, salvo con `intent: "plantilla"`:
   *  ahí ya trae los objetivos que la plantilla escribió, a falta solo de a
   *  quién se los reparte. */
  const buildBlankDraft = (): ObjectiveSet => ({
    ...createObjectiveSet(kind, []),
    objectives: intent === "plantilla" ? (templateObjectives ?? []) : [],
  });

  const [draft, setDraft] = React.useState<ObjectiveSet>(() => initialSet ?? buildBlankDraft());
  const [expandedObjectiveIds, setExpandedObjectiveIds] = React.useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [isComposerOpen, setIsComposerOpen] = React.useState(false);
  // Las cuatro salidas de revisar la última tanda de objetivos creada con
  // IA. Mientras existan, la barra de acciones del drawer las muestra y deja
  // de bloquearse — es la decisión pendiente, no el generador.
  const [reviewActions, setReviewActions] = React.useState<AiReviewActions | null>(null);
  const [isBankOpen, setIsBankOpen] = React.useState(false);
  const [isBalanceOpen, setIsBalanceOpen] = React.useState(false);
  const [isConflictOpen, setIsConflictOpen] = React.useState(false);
  const [showValidation, setShowValidation] = React.useState(false);
  // Los objetivos que ya existían antes de abrir el generador: se ocultan
  // mientras dura esa experiencia para que la atención quede solo en la
  // tanda que la IA está armando y revisando. Capturados una vez al abrir,
  // no en cada render, así lo que entra durante la revisión sí se ve.
  const [hiddenWhileComposing, setHiddenWhileComposing] = React.useState<ReadonlySet<string> | null>(
    null
  );
  React.useEffect(() => {
    setHiddenWhileComposing(
      isComposerOpen ? new Set(draft.objectives.map((objective) => objective.id)) : null
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComposerOpen]);

  const visibleDraftObjectives = hiddenWhileComposing
    ? draft.objectives.filter((objective) => !hiddenWhileComposing.has(objective.id))
    : draft.objectives;

  // Everything is local until "Guardar", so each opening starts from the
  // assignment as it is stored — a drawer closed halfway leaves no trace.
  React.useEffect(() => {
    if (!open) return;
    setDraft(initialSet ?? buildBlankDraft());
    setPhase(initialSet && initialSet.targetIds.length > 0 ? initialPhase : "targets");
    setHasNavigated(false);
    setExpandedObjectiveIds(new Set());
    setIsComposerOpen(false);
    setIsBalanceOpen(false);
    setIsConflictOpen(false);
    setShowValidation(false);
    intentApplied.current = false;
    // `buildBlankDraft` reads `intent`/`templateObjectives`/`kind` off the
    // current render, which is what should seed the draft: this effect only
    // needs to re-run when the drawer opens on a (possibly different) request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialSet, initialPhase, kind]);

  const selection = draft.targetIds;
  const setSelection = (targetIds: readonly string[]) =>
    setDraft((current) => ({ ...current, targetIds }));

  const available = React.useMemo(
    () =>
      isGroup
        ? COLLABORATORS
        : COLLABORATORS.filter(
            (person) => !takenIds.has(person.id) || selection.includes(person.id)
          ),
    [isGroup, takenIds, selection]
  );

  const reach = React.useMemo(
    () => (isGroup ? groupMemberIds(segmentBy, selection).size : selection.length),
    [isGroup, segmentBy, selection]
  );

  const toggleGroup = (value: string) => {
    if (takenIds.has(value) && !selection.includes(value)) return;
    setSelection(
      selection.includes(value) ? selection.filter((v) => v !== value) : [...selection, value]
    );
  };

  /**
   * Quién, de la gente que va a recibir esto, ya lleva objetivos por otra vía.
   *
   * Se calcula ignorando la asignación que se está editando: su peso todavía
   * se está decidiendo, y contarlo haría que el aviso se acusara a sí mismo.
   */
  const priorLoads: readonly PersonLoad[] = React.useMemo(
    () => loadsForTargets(allSets, segmentBy, kind, selection, { excludeSetId: draft.id }),
    [allSets, segmentBy, kind, selection, draft.id]
  );

  /** Lo máximo que cabe sin pasar de 100 % a la persona más cargada. */
  const freeShare = tightestFreeShare(priorLoads);
  const budget = setWeightBudget(draft);

  /**
   * Los mismos conflictos, pero contando también la asignación que se está
   * armando. El modal reparte el 100 % de una persona entre sus vías, y esta
   * es una de ellas aunque todavía no exista en el ciclo: sin ella, bajarle el
   * peso a lo que ya tenía dejaría a esa persona "descuadrada" a ojos del
   * modal, justo después de haber hecho lo que el modal pedía.
   */
  const conflictLoads: readonly PersonLoad[] = React.useMemo(
    () =>
      priorLoads.map((load) => ({
        ...load,
        total: load.total + totalWeight(draft.objectives),
        sources: [
          ...load.sources,
          {
            setId: draft.id,
            kind,
            label: initialSet ? "Esta asignación" : "Esta asignación (nueva)",
            weight: totalWeight(draft.objectives),
            objectiveCount: draft.objectives.length,
            sharedWith: Math.max(0, reach - 1),
          },
        ],
      })),
    [priorLoads, draft.id, draft.objectives, kind, initialSet, reach]
  );

  /**
   * Si lo que se está armando no cabe: en la fase de destinatarios basta con
   * que alguien ya lleve algo —todavía no hay pesos que comparar—, y en la de
   * objetivos, que lo repartido se pase del hueco que quedaba.
   */
  const hasBlockingConflict = priorLoads.length > 0;

  /** Le pone a este borrador el cupo que le queda libre y reparte dentro. */
  const applyFreeShare = () => {
    setDraft((current) => ({
      ...current,
      weightShare: freeShare === TOTAL_WEIGHT ? undefined : freeShare,
      objectives: rescaleObjectives(current.objectives, freeShare),
    }));
  };

  // ── Objectives, on the local draft ───────────────────────────────────────

  const total = totalWeight(draft.objectives);
  const issue = objectiveSetIssue(draft);

  const applySets = (next: readonly ObjectiveSet[]) => setDraft(next[0]);

  const addObjective = () => {
    const objective = createBlankObjective(freeWeight(draft));
    applySets(insertObjective([draft], draft.id, objective));
    setExpandedObjectiveIds(new Set([objective.id]));
  };

  /** Punto de entrada de los objetivos que llegan ya escritos —de la IA o del
   *  banco—. `insertObjectivesFromAI` reparte entre ellos el peso que quede
   *  libre, así que el que los trae no tiene que calcularlo. */
  const addWrittenObjectives = (incoming: readonly Objective[]) => {
    if (incoming.length === 0) return;
    applySets(insertObjectivesFromAI([draft], draft.id, incoming));
    setExpandedObjectiveIds(new Set([incoming[0].id]));
  };

  /** Quita varios objetivos de una tanda de IA en un solo cambio de estado.
   * `applySets` no sirve aquí llamada varias veces seguidas: cada llamada lee
   * el mismo `draft` de antes de la primera, así que solo la última quitada
   * sobrevive. El filtro directo sobre `current` no tiene ese problema. */
  const removeManyFromAI = (ids: readonly string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setDraft((current) => ({
      ...current,
      objectives: current.objectives.filter((objective) => !idSet.has(objective.id)),
    }));
  };

  /**
   * The manual/AI choice was already made outside; landing on the objectives
   * phase acts on it instead of asking again. Latched so deleting the last
   * objective doesn't silently conjure a new one.
   */
  const intentApplied = React.useRef(false);

  React.useEffect(() => {
    if (!open || phase !== "objectives" || intentApplied.current) return;
    intentApplied.current = true;
    if (draft.objectives.length > 0) return;
    if (intent === "ai") setIsComposerOpen(true);
    else if (intent === "banco") setIsBankOpen(true);
    else addObjective();
    // `addObjective` reads the draft it was built with, which is the current
    // one: this runs on the render right after the phase flipped.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phase, intent]);

  const headline =
    selection.length === 0
      ? isGroup
        ? "Sin grupos"
        : "Sin personas"
      : selection.length === 1
        ? targetLabel(draft, selection[0])
        : `${selection.length} ${isGroup ? "grupos" : "personas"}`;

  const handleSave = () => {
    if (issue !== null) {
      setShowValidation(true);
      return;
    }
    onSave(draft);
    onOpenChange(false);
  };

  // The drawer's own name stays put across both phases — what changes phase
  // to phase is the heading inside the body, right above that phase's content.
  const drawerTitle = `${initialSet ? "Editar" : "Nueva"} asignación ${
    isGroup ? "grupal" : "individual"
  }`;

  const stepTitle =
    phase === "targets"
      ? isGroup
        ? "Elige los grupos"
        : "Elige las personas"
      : `Objetivos de ${headline}`;
  const stepDescription =
    phase === "targets"
      ? intent === "plantilla"
        ? isGroup
          ? "La plantilla ya trae estos objetivos escritos y con su peso repartido — solo falta decidir a qué grupos pertenecen."
          : "La plantilla ya trae estos objetivos escritos y con su peso repartido — solo falta decidir a qué personas pertenecen."
        : isGroup
          ? "Todo lo que marques aquí compartirá un mismo set de objetivos."
          : "Cada persona que marques recibirá el mismo set de objetivos. Quien ya tenga objetivos en otra asignación no aparece aquí."
      : budget === TOTAL_WEIGHT
        ? `Entre todos deben sumar 100 % del ciclo de ${
            isGroup ? "cada persona del grupo" : "esta persona"
          }.`
        : `Esta asignación reparte ${budget} % del ciclo: el resto ya lo llevan por otra vía.`;

  /**
   * The line beside the footer's buttons: where the step stands right now.
   *
   * It exists so a disabled "Continuar" or a refused "Guardar" is never a dead
   * end with nothing saying why — the same job the reference's own picker
   * drawer gives this corner.
   */
  const footerHint =
    phase === "targets"
      ? selection.length === 0
        ? `Marca al menos ${isGroup ? "un grupo" : "una persona"} para continuar`
        : priorLoads.length > 0
          ? `${priorLoads.length} ${
              priorLoads.length === 1 ? "persona ya lleva" : "personas ya llevan"
            } objetivos · quedan ${freeShare} %`
          : isGroup
            ? `${selection.length} ${selection.length === 1 ? "grupo" : "grupos"} · ${reach} ${
                reach === 1 ? "persona" : "personas"
              }`
            : `${selection.length} ${selection.length === 1 ? "persona" : "personas"} seleccionada${
                selection.length === 1 ? "" : "s"
              }`
      : draft.objectives.length === 0
        ? "Añade al menos un objetivo para guardar"
        : total === budget
          ? `${draft.objectives.length} ${
              draft.objectives.length === 1 ? "objetivo" : "objetivos"
            } · los pesos suman ${budget} %`
          : `Los pesos suman ${total} % de ${budget} %`;

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title={drawerTitle}
      size="5xl"
      // La tabla de colaboradores trae columnas, buscador y paginación, y la
      // fase de objetivos apila "Tipo de medida" y "Dirección" en la misma
      // fila: ambas se aprietan por debajo de ~1000 px, así que el drawer
      // pide más ancho y cede solo donde no lo hay.
      className="!w-[min(1280px,96vw)] !max-w-[min(1280px,96vw)]"
      disablePadding
      footer={
        // La barra flotante del constructor, también aquí: se recoge sola
        // cuando no se usa y guarda las acciones puntuales del paso —cuadrar
        // pesos, resolver un conflicto— junto a la que lo termina. Mientras la
        // propuesta de IA está armándose se bloquea entera —el brief y el
        // "Analizando" no tienen nada seguro que hacer desde aquí—, pero en
        // cuanto queda lista para revisar, la barra se desbloquea y son sus
        // propios botones los que deciden qué hacer con ella.
        <DrawerActionRail
          hint={footerHint}
          isBlocked={isComposerOpen && reviewActions === null}
          keepOpen={
            hasBlockingConflict || (phase === "objectives" && total !== budget) || reviewActions !== null
          }
          minimal={reviewActions !== null}
          tools={
            phase === "targets" ? (
              priorLoads.length > 0 ? (
                <DrawerRailButton
                  icon={TriangleAlert}
                  variant="warning"
                  label="Resolver conflicto"
                  onClick={() => setIsConflictOpen(true)}
                />
              ) : null
            ) : draft.objectives.length > 1 ? (
              <DrawerRailButton
                icon={Scale}
                label="Ajustar pesos"
                onClick={() => setIsBalanceOpen(true)}
              />
            ) : null
          }
          actions={
            reviewActions ? (
              <>
                <DrawerRailButton
                  icon={Trash2}
                  variant="danger"
                  label="Descartar"
                  onClick={reviewActions.onDiscard}
                />
                <DrawerRailButton
                  icon={SlidersHorizontal}
                  label="Modificar criterios"
                  onClick={reviewActions.onModify}
                />
                <DrawerRailButton
                  icon={RefreshCw}
                  label="Otra propuesta"
                  onClick={reviewActions.onRegenerate}
                />
                <DrawerRailButton
                  icon={Check}
                  variant="primary"
                  label="Conservar esta versión"
                  onClick={reviewActions.onKeep}
                />
              </>
            ) : phase === "targets" ? (
              <>
                <DrawerRailButton icon={X} label="Cancelar" onClick={() => onOpenChange(false)} />
                <DrawerRailButton
                  icon={ArrowRight}
                  variant="primary"
                  label="Continuar"
                  disabled={selection.length === 0}
                  onClick={() => goToPhase("objectives")}
                />
              </>
            ) : (
              // "Atrás" vive arriba, junto al título — aquí solo queda la
              // acción que termina el paso.
              <DrawerRailButton
                icon={Check}
                variant="primary"
                label={initialSet ? "Guardar cambios" : "Guardar asignación"}
                onClick={handleSave}
              />
            )
          }
        />
      }
    >
      {phase === "targets" ? (
        <div key="targets" className={cn(bodyCascade, "flex min-h-0 flex-1 flex-col gap-3 bg-background p-4")}>
          <section className="shrink-0 rounded-2xl border border-border/60 bg-surface p-3.5 shadow-card">
            <StepHeading title={stepTitle} description={stepDescription} />

            {priorLoads.length > 0 && (
              <PriorLoadNotice
                loads={priorLoads}
                freeShare={freeShare}
                onResolve={() => setIsConflictOpen(true)}
                onUseFreeShare={applyFreeShare}
                appliedShare={draft.weightShare}
              />
            )}

            {isGroup && (
              <div className="mt-3 border-t border-border/50 pt-3.5">
                <AutoIncludeToggle
                  checked={autoInclude}
                  onCheckedChange={onAutoIncludeChange}
                  title="Incluir automáticamente nuevos colaboradores"
                  description="Si alguien entra a uno de estos grupos durante el ciclo, hereda sus objetivos automáticamente."
                />
              </div>
            )}
          </section>

          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface p-3.5 shadow-card">
          {isGroup ? (
            <GroupsPanel
              segmentBy={segmentBy}
              onSegmentByChange={(value) => {
                onSegmentByChange(value);
                setSelection([]);
              }}
              selectedGroups={selection}
              onToggleGroup={toggleGroup}
              onSelectAll={(values) =>
                setSelection(values.filter((v) => !takenIds.has(v) || selection.includes(v)))
              }
              onClearAll={() => setSelection([])}
              copy={{
                lead: "Elige cómo agrupar a tus colaboradores y marca los grupos que compartirán este set de objetivos.",
              }}
              disabledGroups={{ ids: takenIds, reason: "Ya tiene objetivos" }}
            />
          ) : (
            <CollaboratorTable
              collaborators={available}
              selectedIds={selection}
              onChange={(ids) => setSelection(ids)}
              onToggleIndividual={(id) =>
                setSelection(
                  selection.includes(id)
                    ? selection.filter((v) => v !== id)
                    : [...selection, id]
                )
              }
            />
          )}
          </section>
        </div>
      ) : (
        <div key="objectives" className={cn(bodyCascade, "flex flex-col gap-3 bg-background p-4")}>
          <ObjectivesHeader
            title={stepTitle}
            description={stepDescription}
            // Mientras la propuesta de IA está abierta, sus propios controles
            // son la única salida — "Atrás" perdería ese progreso sin avisar.
            onBack={!isComposerOpen ? () => goToPhase("targets") : undefined}
            set={draft}
            reach={reach}
            total={total}
            budget={budget}
            count={draft.objectives.length}
            onDistribute={() => applySets(distributeSetWeights([draft], draft.id))}
            segmentBy={segmentBy}
          />

          {/* El cupo se puso para hacerle sitio a lo que otra asignación ya
              llevaba. Si ese motivo desapareció —porque se separó a esa
              persona, o porque cambió el reparto de al lado— el cupo se queda
              recortado sin razón, y hay que poder devolverlo sin adivinar. */}
          {priorLoads.length === 0 && budget < TOTAL_WEIGHT && !isComposerOpen && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface px-3.5 py-3">
              <p className="text-[12.5px] leading-relaxed text-text-secondary">
                Esta asignación reparte solo <strong className="text-text-primary">{budget} %</strong>,
                pero ya nadie más se cruza con ella.
              </p>
              <button
                type="button"
                onClick={applyFreeShare}
                className="shrink-0 rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-text-secondary transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                Recuperar el {TOTAL_WEIGHT} %
              </button>
            </div>
          )}

          {priorLoads.length > 0 && !isComposerOpen && (
            <PriorLoadNotice
              loads={priorLoads}
              freeShare={freeShare}
              onResolve={() => setIsConflictOpen(true)}
              onUseFreeShare={applyFreeShare}
              appliedShare={draft.weightShare}
            />
          )}

          {!isComposerOpen && (
            <div className="flex flex-wrap items-center justify-end gap-2.5">
              <AddObjectiveButton
                onClick={addObjective}
                label={draft.objectives.length === 0 ? "Crear un objetivo" : "Añadir otro objetivo"}
              />
              <button
                type="button"
                onClick={() => setIsBankOpen(true)}
                className="group flex h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface px-4 text-[13px] font-semibold text-text-secondary transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.98]"
              >
                <Library className="size-4" strokeWidth={2.2} />
                Elegir del banco
              </button>
              <AiTriggerButton label="Proponer con IA" onClick={() => setIsComposerOpen(true)} />
            </div>
          )}

          {/* Antes de la lista y no después: "otra propuesta" y "descartar"
              actúan sobre lo que la IA acaba de dejar puesto en `draft`, y la
              tarjeta debe quedar fija arriba de eso mientras se decide. */}
          {isComposerOpen && (
            <AiObjectiveComposer
              mode="set"
              onConfirm={addWrittenObjectives}
              onCancel={() => setIsComposerOpen(false)}
              onRemoveObjectives={removeManyFromAI}
              maxCount={Math.max(1, MAX_AI_OBJECTIVES - draft.objectives.length)}
              scopeLabel={isGroup ? "del grupo" : "de la persona"}
              onWorkingChange={onAiWorkingChange}
              onReviewActionsChange={setReviewActions}
            />
          )}

          {visibleDraftObjectives.length === 0 && !isComposerOpen ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface-muted/30 px-6 py-10 text-center">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-surface text-text-secondary">
                <Target className="size-5" strokeWidth={2} />
              </span>
              <p className="text-[13.5px] font-semibold text-text-primary">
                Esta asignación se quedó sin objetivos
              </p>
              <p className="max-w-[52ch] text-[12.5px] leading-relaxed text-text-secondary">
                Añade al menos uno con los botones de arriba antes de guardar.
              </p>
            </div>
          ) : (
            visibleDraftObjectives.length > 0 && (
            <div className="flex flex-col gap-3">
              {draft.objectives.map((objective, index) => {
                // El índice se calcula sobre la lista completa y no sobre la
                // visible, para que el número no salte cuando el generador
                // se cierra y los ocultos vuelven a aparecer.
                if (hiddenWhileComposing?.has(objective.id)) return null;
                return (
                <ObjectiveCardCompact
                  key={objective.id}
                  objective={objective}
                  position={index + 1}
                  variant="assigned"
                  scope={isGroup ? "grupo" : "individual"}
                  isExpanded={expandedObjectiveIds.has(objective.id)}
                  onToggleExpanded={() =>
                    setExpandedObjectiveIds((current) =>
                      current.has(objective.id) ? new Set() : new Set([objective.id])
                    )
                  }
                  onChange={(patch) =>
                    applySets(changeObjectiveIn([draft], draft.id, objective.id, patch))
                  }
                  onRemove={() => applySets(removeObjectiveIn([draft], draft.id, objective.id))}
                  canRemove
                  showValidation={showValidation}
                  otherObjectivesWeight={total - objective.weight}
                  weightBudget={budget}
                  companyObjectives={companyObjectives}
                  cycleObjectives={isGroup ? [] : draft.objectives.filter(o => o.id !== objective.id)}
                />
                );
              })}
            </div>
            )
          )}

          {/* El banco se abre encima de este drawer y ya viene filtrado por el
              tipo de asignación: en una grupal ofrece objetivos de área, en una
              individual objetivos de una sola persona. */}
          <ObjectiveBankDrawer
            open={isBankOpen}
            onOpenChange={setIsBankOpen}
            scope={isGroup ? "grupo" : "individual"}
            availableWeight={freeWeight(draft)}
            onAddObjectives={addWrittenObjectives}
          />

          {/* Cuadrar los pesos de esta tanda sin abrir tarjeta por tarjeta. Se
              aplica sobre el borrador, así que cerrar el drawer sin guardar
              sigue sin dejar rastro. */}
          <WeightBalanceDialog
            open={isBalanceOpen}
            onOpenChange={setIsBalanceOpen}
            groups={[weightBalanceGroup(draft, budget)]}
            onApply={(result) => {
              const weights = result[draft.id];
              if (!weights) return;
              setDraft((current) => ({
                ...current,
                objectives: current.objectives.map((objective) =>
                  objective.id in weights
                    ? { ...objective, weight: weights[objective.id] }
                    : objective
                ),
              }));
            }}
            title="Ajustar los pesos de esta asignación"
            description={`Reparte el ${budget} % entre los objetivos sin entrar uno por uno.`}
          />
        </div>
      )}

      {/* El conflicto se arregla tocando asignaciones que ya existen, no este
          borrador, así que el modal vive fuera de las dos fases y escribe
          directo sobre el ciclo. */}
      <WeightConflictDialog
        open={isConflictOpen}
        onOpenChange={setIsConflictOpen}
        loads={conflictLoads}
        onSeparate={(setId, personId) =>
          onAllSetsChange(excludeFromSet(allSets, setId, personId))
        }
        onApply={(shares) => {
          // El cupo del borrador se queda en el borrador —todavía no es parte
          // del ciclo—; el de las demás asignaciones sí se escribe ya, que es
          // lo que abre el hueco donde esta va a caber.
          const ownShare = shares.get(draft.id);
          if (ownShare !== undefined) {
            setDraft((current) => ({
              ...current,
              weightShare: ownShare === TOTAL_WEIGHT ? undefined : ownShare,
              objectives: rescaleObjectives(current.objectives, ownShare),
            }));
          }
          const others = [...shares.entries()].filter(([setId]) => setId !== draft.id);
          if (others.length > 0) {
            onAllSetsChange(
              others.reduce(
                (current, [setId, share]) => setWeightShare(current, setId, share),
                allSets
              )
            );
          }
        }}
      />
    </DrawerShell>
  );
}

/**
 * El aviso de "esta gente ya lleva objetivos", con sus dos salidas.
 *
 * Nombra a quién le pasa —que es la pregunta real: no "hay un conflicto" sino
 * "¿a quién?"— y ofrece las dos formas de resolverlo sin salir: quedarse con
 * el hueco que queda libre, o repartir el 100 % de esas personas entre todo lo
 * que las alcanza.
 */
function PriorLoadNotice({
  loads,
  freeShare,
  onResolve,
  onUseFreeShare,
  appliedShare,
}: {
  loads: readonly PersonLoad[];
  freeShare: number;
  onResolve: () => void;
  onUseFreeShare: () => void;
  appliedShare?: number;
}) {
  const isResolved = appliedShare !== undefined && appliedShare <= freeShare;
  const names = loads.slice(0, 3).map((load) => load.name).join(", ");

  return (
    <div
      className={cn(
        "mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3.5 py-3",
        isResolved
          ? "border-status-positive/30 bg-status-positive/5"
          : "border-status-warning/30 bg-status-warning/5"
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <TriangleAlert
          className={cn(
            "mt-0.5 size-4 shrink-0",
            isResolved ? "text-status-positive" : "text-status-warning"
          )}
          strokeWidth={2.2}
        />
        <p className="min-w-0 text-[12.5px] leading-relaxed text-text-secondary">
          <strong className="text-text-primary">
            {loads.length === 1
              ? `${names} ya lleva objetivos`
              : `${loads.length} personas ya llevan objetivos`}
          </strong>{" "}
          {loads.length > 1 && <span className="text-text-muted">({names}
          {loads.length > 3 ? ` y ${loads.length - 3} más` : ""}). </span>}
          {freeShare === 0
            ? "No les queda nada libre: hay que bajarle el peso a lo que ya tienen."
            : `Solo les quedan ${freeShare} % libres del ciclo.`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {freeShare > 0 && !isResolved && (
          <button
            type="button"
            onClick={onUseFreeShare}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-text-secondary transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            Usar {freeShare} %
          </button>
        )}
        <button
          type="button"
          onClick={onResolve}
          className="rounded-lg bg-status-warning px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-status-warning/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-warning/30"
        >
          Ajustar sus pesos
        </button>
      </div>
    </div>
  );
}

/** What the current phase is about, inside the body — the drawer's own title
 * stays fixed across both phases. */
function StepHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h2 className="text-[15px] font-bold tracking-tight text-text-primary">{title}</h2>
      <p className="text-[12.5px] text-text-secondary">{description}</p>
    </div>
  );
}

/**
 * The objectives phase's own header, pinned above its list.
 *
 * Three columns on the same two lines instead of stacked bands: the back
 * arrow hangs in the left margin, the title and its line of copy hold the
 * middle, and everything factual — who carries the set, how much weight is
 * left — is right-aligned so both lines end on the same edge. It paints the
 * drawer's own surface, not the app background, so pinning it reads as the
 * list scrolling under a header instead of a grey band cutting across.
 */
function ObjectivesHeader({
  title,
  onBack,
  set,
  reach,
  total,
  budget,
  count,
  onDistribute,
  segmentBy,
}: {
  title: string;
  description: string;
  onBack?: () => void;
  set: ObjectiveSet;
  reach: number;
  total: number;
  /** El 100 % del ciclo, o el cupo que le quedó a esta asignación. */
  budget: number;
  count: number;
  onDistribute: () => void;
  segmentBy: SegmentKey;
}) {
  const isGroup = set.kind === "grupal";
  const targetLabelText =
    set.targetIds.length === 1
      ? isGroup
        ? "1 grupo"
        : "1 persona"
      : `${set.targetIds.length} ${isGroup ? "grupos" : "personas"}`;

  return (
    <div className="sticky top-0 z-10 -mx-4 -mt-4 flex items-center justify-between gap-4 rounded-t-none border-b border-border/60 bg-surface px-4 py-3 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Atrás"
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <ArrowLeft className="size-4" strokeWidth={2.2} />
          </button>
        )}

        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-[14px] font-bold text-text-primary">{title}</h3>

          <TooltipProvider>
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-6 cursor-default items-center gap-1.5 rounded-md bg-surface-muted px-2 text-[11.5px] font-semibold text-text-secondary transition-colors hover:text-text-primary"
                >
                  {targetLabelText}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" className="max-w-[280px] p-3 text-white">
                <div className="flex flex-col gap-2">
                  <p className="mb-1 text-[12px] font-semibold text-white">
                    {isGroup ? "Grupos seleccionados" : "Personas seleccionadas"}
                  </p>
                  <div className="flex max-h-[200px] flex-col gap-1.5 overflow-y-auto">
                    {set.targetIds.map((targetId) => {
                      const groupCount = isGroup ? groupMemberIds(segmentBy, [targetId]).size : null;
                      return (
                        <div key={targetId} className="flex items-start justify-between gap-3 text-[11.5px] text-white/90">
                          <span className="truncate">• {targetLabel(set, targetId)}</span>
                          {isGroup && groupCount !== null && (
                            <span className="shrink-0 text-white/60">
                              {formatCount(groupCount)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-1 border-t border-white/20 pt-2">
                    <span className="text-[11.5px] font-medium text-white/80">
                      Total: {formatCount(reach)} {reach === 1 ? "persona alcanzada" : "personas alcanzadas"}
                    </span>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="flex shrink-0 items-center">
        <WeightMeter total={total} budget={budget} count={count} onDistribute={onDistribute} />
      </div>
    </div>
  );
}

/** How much of the 100 % is already handed out, as one right-aligned line. */
function WeightMeter({
  total,
  budget,
  count,
  onDistribute,
}: {
  total: number;
  budget: number;
  count: number;
  onDistribute: () => void;
}) {
  const isExact = total === budget;
  const isOver = total > budget;

  return (
    <div className="flex items-center gap-2">
      {!isExact && count > 0 && (
        <button
          type="button"
          onClick={onDistribute}
          className="flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11.5px] font-semibold text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <Sparkles className="size-3.5" strokeWidth={2.2} />
          Repartir por igual
        </button>
      )}
      <span className="text-[11.5px] text-text-muted">Peso</span>
      <span className="relative h-1.5 w-20 overflow-hidden rounded-full bg-border/60">
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
          "w-[4.75rem] text-right text-[11.5px] font-bold tabular-nums",
          isExact ? "text-status-positive" : isOver ? "text-destructive" : "text-text-primary"
        )}
      >
        {total} / {budget} %
      </span>
    </div>
  );
}

function AddObjectiveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface px-4 text-[13px] font-semibold text-text-secondary transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.98]"
    >
      <Plus className="size-4 transition-transform group-hover:rotate-90" strokeWidth={2.4} />
      {label}
    </button>
  );
}
