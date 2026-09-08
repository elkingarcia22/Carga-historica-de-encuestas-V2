import * as React from "react";
import { toast } from "sonner";
import { useAutosave } from "@/hooks/useAutosave";
import { ShellHeaderSlot } from "@/components/app-shell";
import { ConfirmDialog } from "@/components/overlays/ConfirmDialog";
import { ManualAlignmentPopover } from "@/components/ciclo-alignment/ManualAlignmentPopover";
import type { TableSelectionActions } from "@/components/action-rail";
import {
  DEFAULT_PARTICIPANTS,
  ParticipantsEditor,
  totalParticipantCount,
  participantsGroupBreakdown,
} from "@/components/survey-builder";
import {
  PARTICIPANT_MODES_BY_CREATOR,
  CicloBuilderRail,
  CicloGeneralEditor,
  CicloIdentity,
  CicloStepsPanel,
  CompanyObjectivesEditor,
  ObjectiveBankDrawer,
  assignedObjectiveCount,
  cicloStepIssue,
  createBlankObjective,
  getCicloStepperOrder,
  isCicloStepComplete,
  isObjectiveSetComplete,
  objectiveSetsReach,
  TOTAL_WEIGHT,
  totalWeight,
  setsOfKind,
  type AiComposerMode,
  type AiReviewActions,
  type AssignmentDrawerRequest,
  type CicloBuilderAssignmentSeed,
  type CicloDraft,
  type CicloStepId,
  type Objective,
  type ObjectiveSet,
  type ObjectiveSetKind,
} from "@/components/ciclo-builder";
import { ObjectivesStep } from "@/components/ciclo-builder/ObjectivesStep";
import {
  AlignmentStep,
  type AlignmentLevel,
  type NodePositions,
  type ObjectiveRef,
} from "@/components/ciclo-alignment";
import * as sets from "@/components/ciclo-builder/objectiveSets";

interface CicloBuilderProps {
  initialDraft?: CicloDraft;
  initialStep?: CicloStepId;
  /** Objetivos de plantilla en busca de destinatario — el paso de grupo o de
   *  individuo los ofrece solo en cuanto se llega a él. */
  initialAssignmentSeeds?: readonly CicloBuilderAssignmentSeed[];
  /** Called with the finished ciclo on "Finalizar", or undefined on exit. */
  onExit: (draft?: CicloDraft) => void;
}

export const createBlankCicloDraft = (): CicloDraft => {
  const start = new Date();
  
  // yyyy-mm-dd format
  const toISODate = (date: Date): string => {
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  };

  const startDateStr = toISODate(start);
  
  // calculate trimestre (add 3 months, minus 1 day)
  const end = new Date(start.getFullYear(), start.getMonth() + 3, start.getDate() - 1);
  const endDateStr = toISODate(end);

  return {
    name: "",
    status: "draft",
    period: "trimestre",
    startDate: startDateStr,
    endDate: endDateStr,
    description: "",
    // El creador por defecto es "leader", así que el ciclo arranca con el
    // mismo preset que `CicloGeneralEditor` aplicaría al elegirlo a mano —
    // de otro modo, como esa card ya llega seleccionada, el autor nunca
    // dispara el click que normalmente pone "Por grupos" agrupado por líder.
    objectiveCreator: "leader",
    participants: { ...DEFAULT_PARTICIPANTS, mode: "groups", groupSegmentBy: "leader" },
    useCompanyObjectives: true,
    companyObjectives: [],
    // Para leader: group activo, individual inactivo (lo puede encender en el tab).
    // Para collaborator: individual activo, group inactivo.
    // Para HR: ambos inactivos hasta que los encienda.
    // Aquí el default es leader, así que groups=true, individual=false.
    useGroupObjectives: true,
    useIndividualObjectives: false,
    assignment: { groupSegmentBy: "area", groupsAutoInclude: false },
    objectiveSets: [],
  };
};

/**
 * Creation wizard for a ciclo de objetivos.
 *
 * Structurally this is the survey builder: a stepper on the left, one editor
 * in the middle, a floating action bar at the bottom, and the same rule that
 * a step opens once the previous one is complete. What changed is the content
 * of the middle column — a ciclo has no sections, no demographics and no
 * welcome page; it has a time window, an audience, the company's objectives,
 * and the objectives that get handed out.
 */
export function CicloBuilder({
  initialDraft,
  initialStep = "general",
  initialAssignmentSeeds,
  onExit,
}: CicloBuilderProps) {
  const blankDraft = React.useMemo(() => initialDraft ?? createBlankCicloDraft(), [initialDraft]);
  const [draft, setDraft] = React.useState<CicloDraft>(blankDraft);
  const [activeStep, setActiveStep] = React.useState<CicloStepId>(initialStep);
  const [activeObjectiveTab, setActiveObjectiveTab] = React.useState<"groups" | "individual">(() => {
    if (blankDraft.objectiveCreator === "collaborator") return "individual";
    return "groups";
  });
  const [visitedSteps, setVisitedSteps] = React.useState<ReadonlySet<CicloStepId>>(
    () => new Set([initialStep])
  );

  // El mapa de alineación: a qué altura se está mirando el ciclo y dónde
  // dejó el autor cada tarjeta. Vive aquí, y no dentro del paso, porque el
  // paso se desmonta al cambiar de pantalla y volver no debería deshacer un
  // mapa que alguien acabó de ordenar a mano.
  const [alignmentLevel, setAlignmentLevel] = React.useState<AlignmentLevel>("objetivos");
  const [alignmentPositions, setAlignmentPositions] = React.useState<NodePositions>({});
  const [alignmentSelectedNode, setAlignmentSelectedNode] = React.useState<import("@/components/ciclo-alignment/alignmentGraph").AlignmentNode | undefined>(undefined);
  const [isPanelCollapsed, setIsPanelCollapsed] = React.useState(false);

  // The steps menu opens expanded so a first-time author sees the whole path,
  // then collapses itself once that's had time to register — same as the
  // survey builder's own sections panel.
  React.useEffect(() => {
    const timer = setTimeout(() => setIsPanelCollapsed(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Validation only turns red in response to an attempt to move on, so a blank
  // form is never greeted by errors it caused itself.
  const [touchedSteps, setTouchedSteps] = React.useState<ReadonlySet<CicloStepId>>(
    () => new Set()
  );
  const [finalizeErrorSteps, setFinalizeErrorSteps] = React.useState<ReadonlySet<CicloStepId>>(
    () => new Set()
  );

  // Only one objective card is open at a time on each step: they are tall, and
  // two open cards means neither is fully on screen.
  const [expandedObjectiveIds, setExpandedObjectiveIds] = React.useState<ReadonlySet<string>>(
    () => new Set()
  );

  /**
   * What the assignment drawer is editing, or null while it is closed. It
   * lives here rather than inside the step because the action bar is what
   * opens it — the step itself carries no "add" button.
   */
  const [drawerRequest, setDrawerRequest] = React.useState<AssignmentDrawerRequest | null>(null);

  /**
   * Objetivos de plantilla sin destinatario todavía.
   *
   * Cada uno se ofrece una sola vez —al llegar a su paso, si el drawer está
   * libre— abriendo directo la fase de elegir grupos o personas, con los
   * objetivos ya puestos. Cancelar esa oferta no la repite sola: el propio
   * paso deja un aviso con el mismo botón para reabrirla a mano, y el
   * stepper mantiene el paso incompleto hasta que se resuelva.
   */
  const [pendingSeeds, setPendingSeeds] = React.useState<readonly CicloBuilderAssignmentSeed[]>(
    () => initialAssignmentSeeds ?? []
  );
  const [offeredSeedKinds, setOfferedSeedKinds] = React.useState<ReadonlySet<ObjectiveSetKind>>(
    () => new Set()
  );

  const pendingSeedFor = (kind: ObjectiveSetKind): CicloBuilderAssignmentSeed | null =>
    pendingSeeds.find((seed) => seed.kind === kind) ?? null;

  const openSeedDrawer = (kind: ObjectiveSetKind) => {
    const seed = pendingSeedFor(kind);
    if (seed === null) return;
    setDrawerRequest({
      setId: null,
      phase: "targets",
      intent: "plantilla",
      templateObjectives: seed.objectives,
    });
  };

  React.useEffect(() => {
    if (drawerRequest !== null) return;
    if (activeStep !== "objectives") return;
    const kind: ObjectiveSetKind = activeObjectiveTab === "groups" ? "grupal" : "individual";
    const kindEnabled =
      kind === "grupal" ? draft.useGroupObjectives : draft.useIndividualObjectives;
    if (!kindEnabled) return;
    if (offeredSeedKinds.has(kind)) return;
    if (pendingSeedFor(kind) === null) return;
    setOfferedSeedKinds((current) => new Set(current).add(kind));
    openSeedDrawer(kind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeStep,
    drawerRequest,
    pendingSeeds,
    offeredSeedKinds,
    draft.useGroupObjectives,
    draft.useIndividualObjectives,
  ]);

  const [companyComposerMode, setCompanyComposerMode] = React.useState<AiComposerMode | null>(null);

  // Se bloquea la barra de acciones mientras el generador de IA está
  // armando una propuesta: nada de esa barra —guardar, continuar, añadir un
  // objetivo a mano— tiene sentido mientras la tarjeta todavía no ha
  // entregado nada que guardar o con qué continuar.
  const [isAiGenerating, setIsAiGenerating] = React.useState(false);

  // Las cuatro salidas de revisar la última tanda de objetivos de la empresa
  // creada con IA. Mientras existan, la propia barra de acciones las muestra
  // y deja de bloquearse — es la decisión pendiente, no el generador.
  const [companyReviewActions, setCompanyReviewActions] = React.useState<AiReviewActions | null>(
    null
  );

  // "Salir" asks first: the draft only lives in this screen's state, so
  // leaving without saving drops it for good.
  const [exitDialogOpen, setExitDialogOpen] = React.useState(false);

  const [participantsSelectionCount, setParticipantsSelectionCount] = React.useState(0);
  const [clearParticipantsSelection, setClearParticipantsSelection] = React.useState<
    (() => void) | null
  >(null);
  const [deleteParticipantsSelection, setDeleteParticipantsSelection] = React.useState<
    (() => void) | null
  >(null);

  // Ticked assignment rows, mirrored up from the step so the action bar can
  // act on them — the same shape the participants table uses.
  const [assignmentSelectionCount, setAssignmentSelectionCount] = React.useState(0);
  const [clearAssignmentSelection, setClearAssignmentSelection] = React.useState<
    (() => void) | null
  >(null);
  const [removeAssignmentSelection, setRemoveAssignmentSelection] = React.useState<
    (() => void) | null
  >(null);
  /** The assignment behind a single ticked row, for "Editar objetivos". */
  const [selectedAssignmentSetId, setSelectedAssignmentSetId] = React.useState<string | null>(null);

  const handleAssignmentSelectionChange = React.useCallback(
    (count: number, actions: TableSelectionActions) => {
      setAssignmentSelectionCount(count);
      setClearAssignmentSelection(() => actions.clear);
      setRemoveAssignmentSelection(actions.remove ? () => actions.remove! : null);
    },
    []
  );

  const handleParticipantsSelectionChange = React.useCallback(
    (count: number, actions: TableSelectionActions) => {
      setParticipantsSelectionCount(count);
      setClearParticipantsSelection(() => actions.clear);
      setDeleteParticipantsSelection(actions.remove ? () => actions.remove! : null);
    },
    []
  );

  const autosave = useAutosave(draft);
  const pendingSeedKinds = React.useMemo(
    () => new Set(pendingSeeds.map((seed) => seed.kind)),
    [pendingSeeds]
  );
  const stepInput = { draft, visitedSteps, pendingSeedKinds };

  const patchDraft = (patch: Partial<CicloDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const handleSelectStep = (step: CicloStepId) => {
    if (activeStep === "objectives" && step !== "objectives") {
      const patch: Partial<CicloDraft> = {};
      if (draft.useGroupObjectives && groupSets.length === 0) {
        patch.useGroupObjectives = false;
      }
      if (draft.useIndividualObjectives && individualSets.length === 0) {
        patch.useIndividualObjectives = false;
      }
      if (Object.keys(patch).length > 0) {
        patchDraft(patch);
      }
    }

    setActiveStep(step);
    setVisitedSteps((current) => new Set(current).add(step));
  };

  const toggleObjectiveExpanded = (id: string) =>
    setExpandedObjectiveIds((current) => (current.has(id) ? new Set() : new Set([id])));

  // ── Company objectives ───────────────────────────────────────────────────

  const addCompanyObjective = () => {
    const objective = createBlankObjective();
    patchDraft({ companyObjectives: [...draft.companyObjectives, objective] });
    setExpandedObjectiveIds(new Set([objective.id]));
  };

  /** El banco de objetivos, abierto desde el menú "Añadir" de la barra. */
  const [isBankOpen, setIsBankOpen] = React.useState(false);

  /**
   * Peso que queda por repartir en los objetivos de empresa.
   *
   * El banco lo necesita para no entregar objetivos con un peso inventado: si
   * ya hay tres cargando el 100 %, lo que entre nuevo entra en cero y es el
   * autor quien decide de dónde sale su parte.
   */
  const companyWeightLeft = Math.max(
    0,
    TOTAL_WEIGHT - totalWeight(draft.companyObjectives)
  );

  /** Same drop point as `addCompanyObjective`, para los objetivos que llegan
   * ya escritos —de la IA o del banco—: vienen completos, así que el primero
   * cae abierto para revisarlo, no para rellenarlo. */
  const addWrittenCompanyObjectives = (incoming: readonly Objective[]) => {
    if (incoming.length === 0) return;
    patchDraft({ companyObjectives: [...draft.companyObjectives, ...incoming] });
    setExpandedObjectiveIds(new Set([incoming[0].id]));
  };

  const changeCompanyObjective = (id: string, patch: Partial<Objective>) =>
    patchDraft({
      companyObjectives: draft.companyObjectives.map((objective) =>
        objective.id === id ? { ...objective, ...patch } : objective
      ),
    });

  const removeCompanyObjective = (id: string) =>
    patchDraft({
      companyObjectives: draft.companyObjectives.filter((objective) => objective.id !== id),
      // An assigned objective pointing at a company objective that no longer
      // exists would be an alignment to nothing, so those links go with it.
      objectiveSets: sets.unalignFromCompanyObjective(draft.objectiveSets, id),
    });

  // Same as `removeCompanyObjective`, but for a whole batch in one patch:
  // calling the single-id version once per id would have each call read the
  // same pre-update `draft`, so only the last removal would stick.
  const removeCompanyObjectives = (ids: readonly string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    patchDraft({
      companyObjectives: draft.companyObjectives.filter((objective) => !idSet.has(objective.id)),
      objectiveSets: ids.reduce(
        (currentSets, id) => sets.unalignFromCompanyObjective(currentSets, id),
        draft.objectiveSets
      ),
    });
  };

  // ── Assignments ──────────────────────────────────────────────────────────
  //
  // An assignment reaches the draft whole or not at all: the drawer builds it
  // against its own copy and hands it over on "Guardar". That is why there is
  // one write here and not a per-objective handler for each field — a
  // half-written assignment never exists outside the drawer.

  const saveSet = (set: ObjectiveSet) => {
    patchDraft({
      objectiveSets: draft.objectiveSets.some((existing) => existing.id === set.id)
        ? draft.objectiveSets.map((existing) => (existing.id === set.id ? set : existing))
        : [...draft.objectiveSets, set],
    });
    // La asignación que se acaba de guardar es la que la plantilla estaba
    // ofreciendo: ya tiene destinatario, así que deja de estar pendiente.
    if (drawerRequest?.intent === "plantilla") {
      setPendingSeeds((current) => current.filter((seed) => seed.kind !== set.kind));
    }
  };

  const removeTargets = (targets: readonly { setId: string; targetId: string }[]) =>
    patchDraft({ objectiveSets: sets.removeTargets(draft.objectiveSets, targets) });

  /**
   * Lo que hace una flecha del mapa: apuntar un puñado de objetivos hacia un
   * objetivo de la empresa, o soltarlos.
   *
   * Llega en lote porque una tarjeta del mapa puede hablar por varios
   * objetivos a la vez —un área entera, una persona con metas de dos
   * frentes— y el aviso cuenta cuántos se movieron, ya que en ese caso el
   * gesto afecta a más de lo que la tarjeta muestra.
   */
  const alignObjectives = (
    refs: readonly ObjectiveRef[],
    companyObjectiveId: string | null
  ) => {
    if (refs.length === 0) return;
    patchDraft({
      objectiveSets: sets.alignObjectives(draft.objectiveSets, refs, companyObjectiveId),
    });

    const count = refs.length;
    const subject = `${count} ${count === 1 ? "objetivo" : "objetivos"}`;
    if (companyObjectiveId === null) {
      toast.success(`${subject} sin alineación`);
      return;
    }
    const target = draft.companyObjectives.find(
      (objective) => objective.id === companyObjectiveId
    );
    toast.success(`${subject} ${count === 1 ? "alineado" : "alineados"}`, {
      description: `Ahora contribuye${count === 1 ? "" : "n"} a "${target?.title.trim() || "Objetivo sin título"}".`,
    });
  };

  // Memoizadas porque el paso las usa como dependencia: `setsOfKind` filtra, y
  // un array nuevo en cada render haría que la selección de la tabla se
  // reconstruya sin parar.
  const groupSets = React.useMemo(
    () => setsOfKind(draft.objectiveSets, "grupal"),
    [draft.objectiveSets]
  );
  const individualSets = React.useMemo(
    () => setsOfKind(draft.objectiveSets, "individual"),
    [draft.objectiveSets]
  );
  const groupCoverage = React.useMemo(
    () => sets.coveredMemberIds(groupSets, draft.assignment.groupSegmentBy),
    [groupSets, draft.assignment.groupSegmentBy]
  );
  const noCoverage = React.useMemo(() => new Set<string>(), []);

  // ── Navigation ───────────────────────────────────────────────────────────

  // RH se salta "participants" por completo (ver `getCicloStepperOrder`), así
  // que el recorrido depende de quién escribe los objetivos, no es fijo.
  const stepperOrder = getCicloStepperOrder(draft);
  const activeStepIndex = stepperOrder.indexOf(activeStep);
  const isLastStep = activeStep === stepperOrder[stepperOrder.length - 1];
  const continueLabel = isLastStep ? "Finalizar" : "Continuar";

  const markTouched = (step: CicloStepId) =>
    setTouchedSteps((current) => new Set(current).add(step));

  // Going back never re-checks the step being left — those rules only guard
  // moving forward, so retracing a step is always allowed.
  const handleBack =
    activeStepIndex > 0
      ? () => handleSelectStep(stepperOrder[activeStepIndex - 1])
      : null;

  const handleContinue = () => {
    if (!isLastStep) {
      const issue = cicloStepIssue(activeStep, stepInput);
      if (issue !== null) {
        markTouched(activeStep);
        toast.error(issue);
        return;
      }
      handleSelectStep(stepperOrder[activeStepIndex + 1]);
      return;
    }
    handleFinalize();
  };

  /**
   * "Finalizar" checks every step, not just the one on screen: an incomplete
   * step anywhere keeps the ciclo unpublishable, so all of them are worth
   * flagging at once. The author lands on the first failure with the rest
   * still marked in the stepper.
   */
  const handleFinalize = () => {
    // Auto-clean empty assignment types before finalizing so the user doesn't get blocked
    // by a mode they opened but left empty.
    let effectiveDraft = draft;
    if (activeStep === "objectives") {
      const patch: Partial<CicloDraft> = {};
      if (draft.useGroupObjectives && groupSets.length === 0) patch.useGroupObjectives = false;
      if (draft.useIndividualObjectives && individualSets.length === 0) patch.useIndividualObjectives = false;
      if (Object.keys(patch).length > 0) {
        effectiveDraft = { ...draft, ...patch };
        patchDraft(patch);
      }
    }

    const effectiveInput = { ...stepInput, draft: effectiveDraft };
    const failing = stepperOrder.filter((step) => !isCicloStepComplete(step, effectiveInput));

    if (failing.length === 0) {
      setFinalizeErrorSteps(new Set());
      const count = assignedObjectiveCount(effectiveDraft.objectiveSets);
      const setCount = effectiveDraft.objectiveSets.length;
      toast.success("Ciclo creado", {
        description: `${count} ${count === 1 ? "objetivo repartido" : "objetivos repartidos"} en ${setCount} ${setCount === 1 ? "asignación" : "asignaciones"}.`,
      });
      onExit({ ...effectiveDraft, status: "scheduled" });
      return;
    }

    setFinalizeErrorSteps(new Set(failing));
    setTouchedSteps((current) => new Set([...current, ...failing]));
    handleSelectStep(failing[0]);

    const first = cicloStepIssue(failing[0], effectiveInput);
    toast.error(
      failing.length === 1
        ? `${first}.`
        : `${first} y ${failing.length - 1} ${failing.length - 1 === 1 ? "paso más" : "pasos más"} por completar.`
    );
  };

  const showValidation = (step: CicloStepId) =>
    touchedSteps.has(step) || finalizeErrorSteps.has(step);

  // ── Panels ───────────────────────────────────────────────────────────────

  const renderMainPanel = () => {
    switch (activeStep) {
      case "general":
        return (
          <CicloGeneralEditor
            draft={draft}
            onChange={(patch) => {
              // Cuando el autor cambia de creador, ajustamos los flags de
              // asignación para que el recorrido arranque en el estado correcto:
              // HR empieza sin ninguno activo (el paso assignmentConfig los enciende),
              // leader/collaborator empiezan con ambos activos (el prompt dentro
              // del paso los desactiva si el autor quiere).
              if ("objectiveCreator" in patch && patch.objectiveCreator !== draft.objectiveCreator) {
                const isHr = patch.objectiveCreator === "hr";
                patchDraft({
                  ...patch,
                  useGroupObjectives: !isHr,
                  useIndividualObjectives: !isHr,
                });
              } else {
                patchDraft(patch);
              }
            }}
            showValidation={showValidation("general")}
          />
        );

      case "participants":
        return (
          <ParticipantsEditor
            // El paso es el mismo que en encuestas; lo único que cambia es
            // para qué se arma la lista: aquí nadie responde nada, se le
            // asignan objetivos. RH nunca llega aquí — ver
            // `getCicloStepperOrder` — así que solo líder y colaborador
            // tienen una entrada en `PARTICIPANT_MODES_BY_CREATOR`.
            copy={{
              launchPhrase: "iniciar el ciclo",
              groupsDescription: "Elige áreas, líderes u otros grupos que entran al ciclo.",
            }}
            modesOrder={
              draft.objectiveCreator === "hr"
                ? undefined
                : PARTICIPANT_MODES_BY_CREATOR[draft.objectiveCreator]
            }
            participants={draft.participants}
            onChange={(patch) =>
              setDraft((current) => ({
                ...current,
                participants: { ...current.participants, ...patch },
              }))
            }
            showValidation={showValidation("participants")}
            onSelectionChange={handleParticipantsSelectionChange}
          />
        );

      case "company":
        return (
          <CompanyObjectivesEditor
            objectives={draft.companyObjectives}
            expandedIds={expandedObjectiveIds}
            onToggleExpanded={toggleObjectiveExpanded}
            onChange={changeCompanyObjective}
            onAdd={addCompanyObjective}
            onAddFromAI={addWrittenCompanyObjectives}
            onAiWorkingChange={setIsAiGenerating}
            onReviewActionsChange={setCompanyReviewActions}
            onRemove={removeCompanyObjective}
            onRemoveMany={removeCompanyObjectives}
            showValidation={showValidation("company")}
            enabled={draft.useCompanyObjectives}
            onEnabledChange={(enabled) => patchDraft({ useCompanyObjectives: enabled })}
            composerMode={companyComposerMode}
            onComposerModeChange={setCompanyComposerMode}
          />
        );

      case "objectives":
        return (
          <ObjectivesStep
            key="objectives"
            draft={draft}
            onChange={patchDraft}
            activeTab={activeObjectiveTab}
            onActiveTabChange={setActiveObjectiveTab}
            editorProps={{
              groupSets,
              individualSets,
              drawerRequest,
              onDrawerRequestChange: setDrawerRequest,
              onSaveSet: saveSet,
              onRemoveTargets: removeTargets,
              onSelectionChange: handleAssignmentSelectionChange,
              onRequestEdit: (setId) => setSelectedAssignmentSetId(setId === "" ? null : setId),
              onAiWorkingChange: setIsAiGenerating,
              showValidation: showValidation("objectives"),
              groupCoverage,
              noCoverage,
              pendingSeedObjectivesGroup: pendingSeedFor("grupal")?.objectives ?? null,
              pendingSeedObjectivesIndividual: pendingSeedFor("individual")?.objectives ?? null,
              onResumeTemplateSeedGroup: () => openSeedDrawer("grupal"),
              onResumeTemplateSeedIndividual: () => openSeedDrawer("individual"),
            }}
          />
        );

      case "alignment":
        return (
          <AlignmentStep
            draft={draft}
            level={alignmentLevel}
            onLevelChange={setAlignmentLevel}
            positions={alignmentPositions}
            onPositionsChange={setAlignmentPositions}
            onAlign={alignObjectives}
            onSelectedNodeChange={setAlignmentSelectedNode}
            onGoToCompanyStep={() => handleSelectStep("company")}
            onGoToObjectivesStep={() => handleSelectStep("objectives")}
          />
        );
    }
  };

  const isAssignmentStep = activeStep === "objectives";
  const visibleSets = activeObjectiveTab === "individual" ? individualSets : groupSets;

  // Shared between the rail's headcount and its "Grupos" row, so the two
  // numbers can never drift out of step with each other.
  const participantsBreakdown = React.useMemo(
    () => participantsGroupBreakdown(draft.participants),
    [draft.participants]
  );
  const alignment = React.useMemo(
    () => sets.alignmentCounts(draft.objectiveSets),
    [draft.objectiveSets]
  );

  // Whether the assignment tab on screen is switched on.
  const activeAssignmentEnabled =
    isAssignmentStep
      ? activeObjectiveTab === "groups"
        ? draft.useGroupObjectives
        : draft.useIndividualObjectives
      : false;

  // On the assignment steps the bar opens the drawer that builds a whole
  // assignment — destinatarios and objectives in one pass. The manual/IA
  // choice is made here, before the drawer, so the flow never asks it twice.
  const onAddObjective =
    activeStep === "company"
      ? draft.useCompanyObjectives
        ? addCompanyObjective
        : null
      : isAssignmentStep && activeAssignmentEnabled
        ? () => setDrawerRequest({ setId: null, phase: "targets", intent: "manual" })
        : null;

  /**
   * De dónde salen los objetivos elegidos del banco.
   *
   * En el paso de empresa caen directamente en la lista. En los de asignación
   * no hay dónde dejarlos todavía —un objetivo asignado vive dentro de un set,
   * y el set no existe hasta que se eligen sus destinatarios—, así que el
   * banco viaja como intención hasta la segunda fase del drawer de asignación
   * y se abre allí, ya con un sitio donde caer.
   */
  const onOpenObjectiveBank =
    activeStep === "company"
      ? draft.useCompanyObjectives
        ? () => setIsBankOpen(true)
        : null
      : isAssignmentStep && activeAssignmentEnabled
        ? () => setDrawerRequest({ setId: null, phase: "targets", intent: "banco" })
        : null;

  const onAddObjectiveAi =
    activeStep === "company"
      ? draft.useCompanyObjectives
        ? () => setCompanyComposerMode("set")
        : null
      : isAssignmentStep && activeAssignmentEnabled
        ? () => setDrawerRequest({ setId: null, phase: "targets", intent: "ai" })
        : null;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background font-sans">
      <ShellHeaderSlot>
        <CicloIdentity
          name={draft.name}
          status={draft.status}
          autosave={autosave}
          onNameChange={(name) => patchDraft({ name })}
        />
      </ShellHeaderSlot>

      {/* Only the middle column scrolls; the stepper sits outside that scroll
          region so it never drifts from the header. Horizontal inset matches
          the header's own px-1 (not p-3) so the panel's left edge lines up
          with the sidebar toggle and the rail's right edge lines up with the
          avatar — vertical spacing keeps p-3's breathing room. */}
      <div className="flex min-h-0 flex-1 items-start gap-3 px-1 py-3">
        <CicloStepsPanel
          activeStep={activeStep}
          stepInput={stepInput}
          errorSteps={finalizeErrorSteps}
          isCollapsed={isPanelCollapsed}
          onToggleCollapsed={() => setIsPanelCollapsed((collapsed) => !collapsed)}
          onSelectStep={handleSelectStep}
        />

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col self-stretch">
          <div className="flex flex-1 items-start gap-3 self-stretch overflow-y-auto pb-16">
            {renderMainPanel()}
          </div>

          <CicloBuilderRail
            activeStep={activeStep}
            isBlocked={
              (companyReviewActions === null &&
                (isAiGenerating || companyComposerMode !== null)) ||
              drawerRequest !== null
            }
            onAddObjective={onAddObjective}
            onAddObjectiveAi={onAddObjectiveAi}
            onOpenObjectiveBank={onOpenObjectiveBank}
            reviewActions={activeStep === "company" ? companyReviewActions : null}
            onSave={() => toast.success("Ciclo guardado")}
            onBack={handleBack}
            onExit={() => setExitDialogOpen(true)}
            onContinue={handleContinue}
            continueLabel={continueLabel}
            participantsCount={totalParticipantCount(draft.participants)}
            participantsBreakdown={participantsBreakdown}
            companyObjectivesCount={draft.companyObjectives.length}
            groupObjectivesCount={assignedObjectiveCount(groupSets)}
            individualObjectivesCount={assignedObjectiveCount(individualSets)}
            alignedCount={alignment.aligned}
            unalignedCount={alignment.unaligned}
            setsTotal={visibleSets.length}
            setsComplete={visibleSets.filter(isObjectiveSetComplete).length}
            reachCount={objectiveSetsReach(draft.objectiveSets, draft.assignment.groupSegmentBy)}
            participantsSelectionCount={participantsSelectionCount}
            onClearParticipantsSelection={clearParticipantsSelection}
            onDeleteParticipantsSelection={deleteParticipantsSelection}
            assignmentSelectionCount={isAssignmentStep ? assignmentSelectionCount : 0}
            assignmentUnit={activeObjectiveTab === "individual" ? "persona" : "grupo"}
            onClearAssignmentSelection={clearAssignmentSelection}
            onRemoveAssignmentSelection={removeAssignmentSelection}
            onEditAssignmentSelection={
              selectedAssignmentSetId !== null && assignmentSelectionCount === 1
                ? () =>
                    setDrawerRequest({
                      setId: selectedAssignmentSetId,
                      phase: "objectives",
                      intent: "manual",
                    })
                : null
            }
            alignmentActions={
              activeStep === "alignment" ? (
                <ManualAlignmentPopover
                  draft={draft}
                  companyOptions={
                    draft.useCompanyObjectives
                      ? draft.companyObjectives.map((co) => ({ id: co.id, title: co.title }))
                      : []
                  }
                  selectedNode={alignmentSelectedNode}
                  onAlign={alignObjectives}
                  onUnalign={(refs) => alignObjectives(refs, null)}
                />
              ) : null
            }
          />
        </div>
      </div>

      <ObjectiveBankDrawer
        open={isBankOpen}
        onOpenChange={setIsBankOpen}
        scope="empresa"
        availableWeight={companyWeightLeft}
        onAddObjectives={addWrittenCompanyObjectives}
      />

      <ConfirmDialog
        open={exitDialogOpen}
        onOpenChange={setExitDialogOpen}
        title="¿Salir sin guardar?"
        description="El ciclo que estás creando no se ha guardado. Si sales ahora, se perderán los cambios."
        confirmLabel="Salir"
        cancelLabel="Cancelar"
        variant="destructive"
        onConfirm={() => {
          setExitDialogOpen(false);
          onExit();
        }}
      />
    </div>
  );
}
