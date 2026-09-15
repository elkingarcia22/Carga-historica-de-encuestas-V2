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
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DrawerShell } from "@/components/overlays";
import { DrawerActionRail, DrawerRailButton } from "@/components/action-rail";
import { WeightBalanceDialog, weightBalanceGroup } from "./WeightBalanceDialog";
import { WeightConflictView, useWeightShares } from "./WeightConflictView";
import {
  loadsForTargets,
  sourceLabels,
  tightestFreeShare,
  type PersonLoad,
} from "./weightConflicts";
import { COLLABORATORS } from "@/mocks/collaborators";
import { formatCount, type SegmentKey } from "@/components/survey-builder";
import { AutoIncludeToggle, GroupsPanel } from "@/components/survey-builder/ParticipantsEditor";
import { CollaboratorTable } from "@/components/survey-builder/CollaboratorTable";
import { groupMemberIds } from "@/components/survey-builder/participants";
import { ObjectiveCardCompact } from "./ObjectiveCardCompact";
import { AiAnalyzingState } from "@/components/ai-interaction/AiAnalyzingState";
import { AiAgentDrawer } from "@/components/ai/AiAgentDrawer";
import type { AiReviewActions } from "./AiObjectiveComposer";
import {
  ObjectiveBankPanel,
  ObjectiveBankStepHeader,
  useObjectiveBank,
} from "./ObjectiveBankPanel";
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
import type { ObjectiveModelId, ObjectiveModelRules } from "./objectiveModel";

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
  /** Reglas del modelo del ciclo: qué cuelga de cada objetivo y si tiene
   *  que colgar de uno de la empresa. */
  rules?: ObjectiveModelRules;
  model?: ObjectiveModelId | null;
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
  rules,
  model,
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
  /** El banco no se abre en otro cajón encima de este: se saca aquí dentro,
   *  en el sitio de la lista, una vez ya está decidido a quién se le asigna.
   *  Por eso su estado vive en este drawer y no en una concha aparte. */
  const [isBankOpen, setIsBankOpen] = React.useState(false);
  const bank = useObjectiveBank(isGroup ? "grupo" : "individual", isBankOpen);
  /** El menú de "añadir objetivo" de la barra flotante: las tres formas de
   *  traer uno viven ahí abajo, no sobre la lista. */
  const [isAddMenuOpen, setIsAddMenuOpen] = React.useState(false);
  const [isBalanceOpen, setIsBalanceOpen] = React.useState(false);
  const [isConflictOpen, setIsConflictOpen] = React.useState(false);
  const [showValidation, setShowValidation] = React.useState(false);
  const [workingState, setWorkingState] = React.useState<{ progress: number; caption: string; detail: string } | null>(null);

  /**
   * La tanda que la IA acaba de proponer y que todavía no se ha conservado.
   *
   * Lo que la asignación ya tenía escrito no se esconde mientras se conversa:
   * esconderlo dejaba la lista vacía y un estado vacío mintiendo sobre una
   * asignación que sí tenía objetivos. Se queda a la vista, y lo que se marca
   * —con el borde degradado del Agente— es lo nuevo, hasta que el chat decide
   * si se conserva o se descarta.
   */
  const [aiDraftIds, setAiDraftIds] = React.useState<ReadonlySet<string>>(() => new Set());

  // Cerrar el panel cierra la decisión: conservar, descartar y modificar
  // salen todos por ahí, y lo que quede en la lista ya es del borrador.
  React.useEffect(() => {
    if (!isComposerOpen) setAiDraftIds(new Set());
  }, [isComposerOpen]);

  // Everything is local until "Guardar", so each opening starts from the
  // assignment as it is stored — a drawer closed halfway leaves no trace.
  React.useEffect(() => {
    if (!open) return;
    setDraft(initialSet ?? buildBlankDraft());
    setPhase(initialSet && initialSet.targetIds.length > 0 ? initialPhase : "targets");
    setHasNavigated(false);
    setExpandedObjectiveIds(new Set());
    setIsComposerOpen(false);
    setIsBankOpen(false);
    setIsBalanceOpen(false);
    setIsConflictOpen(false);
    setShowValidation(false);
    setAiDraftIds(new Set());
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
   * El reparto ya quedó resuelto: a este borrador le tocó un cupo que cabe en
   * lo que quedaba libre. Resuelto, ni el aviso ni "Repartir el peso" tienen
   * nada más que decir — se apagan los dos en vez de quedarse confirmando algo
   * que ya no hace falta confirmar.
   */
  const isPriorLoadResolved = draft.weightShare !== undefined && draft.weightShare <= freeShare;

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
  const hasBlockingConflict = priorLoads.length > 0 && !isPriorLoadResolved;

  /**
   * Alguien de los marcados ya reparte su 100 %: no queda ni un punto donde
   * meter un objetivo nuevo.
   *
   * Eso no se resuelve escribiendo —el peso sale de algún lado— así que el
   * paso no deja pasar: lo que toca es bajarle el peso a lo que esa gente ya
   * lleva, y para eso está "Ajustar sus pesos" del aviso de arriba.
   */
  const isFullyLoaded = priorLoads.length > 0 && freeShare === 0;

  const conflictShares = useWeightShares(conflictLoads, isConflictOpen);

  /**
   * Escribe el reparto decidido en la página de peso.
   *
   * El cupo del borrador se queda en el borrador —todavía no es parte del
   * ciclo—; el de las demás asignaciones sí se escribe ya, que es lo que abre
   * el hueco donde esta va a caber.
   */
  const applyConflictShares = () => {
    const shares = conflictShares.shareMap();
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
    setIsConflictOpen(false);
  };

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
  const issue = objectiveSetIssue(draft, {
    rules,
    requireAlignment:
      rules?.alignment === "required" &&
      rules.companyObjectives !== "off" &&
      companyObjectives.length > 0,
  });

  const applySets = (next: readonly ObjectiveSet[]) => setDraft(next[0]);

  /**
   * Guarda sola la asignación si con lo que acaba de llegar ya no falta nada.
   *
   * Lo que trae el banco o lo que la IA deja al conservar es una decisión ya
   * tomada, no un borrador a medio llenar: si eso alcanza para completar la
   * asignación, pedir además "Guardar asignación" repetiría un paso que el
   * autor ya dio. Si sigue faltando algo —peso, alineación—, se queda en la
   * pantalla de objetivos exactamente como antes.
   */
  const finishIfComplete = (nextDraft: ObjectiveSet): boolean => {
    const nextIssue = objectiveSetIssue(nextDraft, {
      rules,
      requireAlignment:
        rules?.alignment === "required" &&
        rules.companyObjectives !== "off" &&
        companyObjectives.length > 0,
    });
    if (nextIssue !== null) return false;
    onSave(nextDraft);
    onOpenChange(false);
    return true;
  };

  const addObjective = () => {
    const objective = createBlankObjective(freeWeight(draft));
    applySets(insertObjective([draft], draft.id, objective));
    setExpandedObjectiveIds(new Set([objective.id]));
  };

  /**
   * Punto de entrada de los objetivos que llegan ya escritos —de la IA o del
   * banco—. `insertObjectivesFromAI` reparte entre ellos el peso que quede
   * libre, así que el que los trae no tiene que calcularlo.
   *
   * `expand` decide si el primero cae abierto. Del banco sí, porque se elige
   * de uno en uno y abrirlo es seguir mirándolo; de la IA no, porque llega
   * una tanda y abrir uno de cinco no es revisar la tanda, es tapar el
   * resto con una tarjeta larga.
   */
  const addWrittenObjectives = (
    incoming: readonly Objective[],
    { expand = true, fromAi = false }: { expand?: boolean; fromAi?: boolean } = {}
  ) => {
    if (incoming.length === 0) return;
    applySets(insertObjectivesFromAI([draft], draft.id, incoming));
    setExpandedObjectiveIds(expand ? new Set([incoming[0].id]) : new Set());
    if (fromAi) setAiDraftIds(new Set(incoming.map((objective) => objective.id)));
  };

  /**
   * Cierra el banco llevándose lo marcado. El peso libre se calcula en este
   * momento y no al abrirlo: entre medias pudo entrar algo más.
   *
   * Elegir del banco es la decisión completa —a diferencia de la IA, aquí no
   * hay una revisión posterior—, así que si con esto la asignación ya queda
   * completa se guarda sola en vez de dejar un "Guardar asignación" de más.
   */
  const addFromBank = () => {
    const incoming = bank.buildObjectives(freeWeight(draft));
    if (incoming.length === 0) return;
    const next = insertObjectivesFromAI([draft], draft.id, incoming)[0];
    setIsBankOpen(false);
    if (finishIfComplete(next)) return;
    setDraft(next);
    setExpandedObjectiveIds(new Set([incoming[0].id]));
  };

  /**
   * "Conservar todos" del panel de IA. Los objetivos ya están en `draft`
   * desde que se generaron (`onConfirm`); aquí solo se decide si con ellos ya
   * queda todo listo —y entonces se guarda y se cierra— o si sigue faltando
   * algo, en cuyo caso solo se cierra el panel y la asignación sigue en
   * pantalla para completarla.
   */
  const keepAiDraft = () => {
    setIsComposerOpen(false);
    finishIfComplete(draft);
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
    setAiDraftIds((current) => new Set([...current].filter((id) => !idSet.has(id))));
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
    isBankOpen
      ? bank.selectedCount === 0
        ? "Marca en el banco los objetivos que quieras traer"
        : `${bank.selectedCount} ${
            bank.selectedCount === 1 ? "objetivo" : "objetivos"
          } del banco · se añadirán a esta asignación`
      : phase === "targets"
      ? selection.length === 0
        ? `Marca al menos ${isGroup ? "un grupo" : "una persona"} para continuar`
        : isFullyLoaded
          ? `${
              priorLoads.length === 1
                ? `${priorLoads[0].name} ya reparte`
                : `${priorLoads.length} personas ya reparten`
            } todo su ${TOTAL_WEIGHT} % de peso · reparte ese peso antes de crear objetivos`
          : priorLoads.length > 0 && !isPriorLoadResolved
            ? `${priorLoads.length} ${
                priorLoads.length === 1 ? "persona ya lleva" : "personas ya llevan"
              } objetivos · solo les queda ${freeShare} % de peso libre`
            : isGroup
              ? `${selection.length} ${selection.length === 1 ? "grupo" : "grupos"} · ${reach} ${
                  reach === 1 ? "persona" : "personas"
                }`
              : `${selection.length} ${
                  selection.length === 1 ? "persona" : "personas"
                } seleccionada${selection.length === 1 ? "" : "s"}`
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
      description={phase === "targets" ? stepDescription : undefined}
      size="5xl"
      // La tabla de colaboradores trae columnas, buscador y paginación, y la
      // fase de objetivos apila "Tipo de medida" y "Dirección" en la misma
      // fila: ambas se aprietan por debajo de ~1000 px, así que el drawer
      // pide más ancho y cede solo donde no lo hay.
      //
      // Con el Agente IA abierto el drawer no se convierte en otra cosa: es
      // el mismo cajón —mismo borde, misma altura, mismo sitio— corrido a la
      // izquierda para hacerle hueco al panel. Se quedó en tarjeta flotante
      // durante un tiempo, con margen arriba y abajo y esquinas redondas por
      // los cuatro lados, y eso leía como un drawer nuevo que solo servía
      // para escribir objetivos: el paso de elegir grupos y personas parecía
      // haberse quedado en otro sitio.
      className={cn(
        "!w-[min(1280px,96vw)] !top-0 !bottom-0 !h-dvh !rounded-none sm:!rounded-l-2xl !border-y-0",
        "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        (phase === "objectives" && isComposerOpen)
          // 448 px = el panel (416) más el aire que deja ver que detrás sigue
          // estando la app, para que el cajón no se coma la pantalla entera.
          ? "!max-w-[calc(100vw_-_448px)] !right-[416px] !border-r !border-border/60"
          : "!max-w-[min(1280px,96vw)] !right-0 !border-r-0"
      )}
      /*
       * Con el generador abierto el drawer deja de ser modal. El panel del
       * Agente IA vive en la concha de la app, fuera del portal del drawer, y
       * un diálogo modal apaga los eventos de puntero de todo lo que no sea
       * él: el chat quedaba dibujado pero inerte. El velo sigue estando —lo
       * dibuja `SheetContent`—, recortado justo donde empieza el panel.
       */
      modal={!isComposerOpen}
      overlayClassName={isComposerOpen ? "right-[416px]" : undefined}
      onInteractOutside={(e) => {
        // Prevent closing the Drawer if the AI panel is open (because clicks in the AI panel are outside the DrawerShell)
        if (isComposerOpen) e.preventDefault();
      }}
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
          hint={isConflictOpen ? conflictShares.status.text : footerHint}
          isBlocked={isComposerOpen && reviewActions === null}
          keepOpen={
            hasBlockingConflict ||
            isBankOpen ||
            isConflictOpen ||
            (phase === "objectives" && total !== budget) ||
            reviewActions !== null
          }
          minimal={reviewActions !== null}
          tools={
            // Con el banco o el reparto sacados en el cuerpo, la barra solo
            // tiene que rematarlos: volver a ofrecer "añadir objetivo" desde
            // aquí sería ofrecer salir del sitio donde ya se está trabajando.
            isConflictOpen ? (
              <DrawerRailButton
                icon={Sparkles}
                label="Repartir por mí"
                onClick={conflictShares.autoAdjust}
              />
            ) : isBankOpen ? null : phase === "targets" ? (
              priorLoads.length > 0 && !isPriorLoadResolved ? (
                <DrawerRailButton
                  icon={Scale}
                  variant="warning"
                  label="Repartir el peso"
                  onClick={() => setIsConflictOpen(true)}
                />
              ) : null
            ) : (
              // Las tres formas de traer un objetivo —a mano, del banco o con
              // IA— viven aquí y no sobre la lista: es la misma barra que
              // termina el paso, y así la lista empieza en el primer objetivo.
              <>
                <AddObjectiveMenu
                  open={isAddMenuOpen}
                  onOpenChange={setIsAddMenuOpen}
                  isEmpty={draft.objectives.length === 0}
                  onAddBlank={addObjective}
                  onOpenBank={() => setIsBankOpen(true)}
                  onOpenComposer={() => setIsComposerOpen(true)}
                />
                {draft.objectives.length > 1 && (
                  <DrawerRailButton
                    icon={Scale}
                    label="Ajustar pesos"
                    onClick={() => setIsBalanceOpen(true)}
                  />
                )}
              </>
            )
          }
          actions={
            isConflictOpen ? (
              <>
                <DrawerRailButton
                  icon={ArrowLeft}
                  label="Volver"
                  onClick={() => setIsConflictOpen(false)}
                />
                <DrawerRailButton
                  icon={Check}
                  variant="primary"
                  label="Aplicar pesos"
                  disabled={!conflictShares.canApply}
                  onClick={applyConflictShares}
                />
              </>
            ) : isBankOpen ? (
              <>
                <DrawerRailButton
                  icon={ArrowLeft}
                  label="Volver"
                  onClick={() => setIsBankOpen(false)}
                />
                <DrawerRailButton
                  icon={Check}
                  variant="primary"
                  label={`Agregar (${bank.selectedCount})`}
                  disabled={bank.selectedCount === 0}
                  onClick={addFromBank}
                />
              </>
            ) : reviewActions ? (
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
                  disabled={selection.length === 0 || isFullyLoaded}
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
      {isConflictOpen ? (
        // El reparto del peso es otra página de este mismo cajón, igual que el
        // banco: se entra con "Repartir el peso", se sale con "Volver", y sus
        // dos acciones viven en la barra flotante como las de cualquier paso.
        <div key="conflict" className={cn(bodyCascade, "flex min-h-0 flex-1 flex-col gap-3 bg-background p-4")}>
          <WeightConflictView
            controller={conflictShares}
            affected={conflictLoads.length}
            onBack={() => setIsConflictOpen(false)}
            onSeparate={(setId, personId) =>
              onAllSetsChange(excludeFromSet(allSets, setId, personId))
            }
          />
        </div>
      ) : phase === "targets" ? (
        <div key="targets" className={cn(bodyCascade, "flex min-h-0 flex-1 flex-col gap-3 bg-background p-4")}>
          {((priorLoads.length > 0 && !isPriorLoadResolved) || isGroup) && (
            <section className="shrink-0 rounded-2xl border border-border/60 bg-surface p-3.5 shadow-card">
              {priorLoads.length > 0 && !isPriorLoadResolved && (
                <PriorLoadNotice
                  loads={priorLoads}
                  freeShare={freeShare}
                  onResolve={() => setIsConflictOpen(true)}
                  onUseFreeShare={applyFreeShare}
                />
              )}

              {isGroup && (
                <div
                  className={cn(
                    priorLoads.length > 0 && !isPriorLoadResolved && "mt-3 border-t border-border/50 pt-3.5"
                  )}
                >
                  <AutoIncludeToggle
                    checked={autoInclude}
                    onCheckedChange={onAutoIncludeChange}
                    title="Sincronizar automáticamente con el grupo"
                    description="Sigue el organigrama de la empresa: si alguien entra a uno de estos grupos durante el ciclo hereda sus objetivos, y si sale —cambia de área, de líder, o se desvincula— se los retiramos solos."
                  />
                </div>
              )}
            </section>
          )}

          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface p-3.5 shadow-card">
          {isGroup ? (
            <GroupsPanel
              // La sección del cajón lleva `p-3.5`, no los `px-6` del paso.
              bleed="-mx-3.5"
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
              disabledGroups={{ ids: takenIds, reason: "Ya tiene objetivos" }}
            />
          ) : (
            <CollaboratorTable
              bleed="-mx-3.5"
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
      ) : isBankOpen ? (
        // El banco, dentro del mismo cajón y en el sitio de la lista: primero
        // se decidió a quién se le asigna, ahora se elige qué. Apilarlo en un
        // segundo cajón encima de este tapaba justo esa respuesta.
        <div key="bank" className={cn(bodyCascade, "flex min-h-0 flex-1 flex-col gap-3 bg-background p-4")}>
          <ObjectiveBankStepHeader
            onBack={() => setIsBankOpen(false)}
            kindLabel={isGroup ? "de área" : "individuales"}
            targetName={headline}
            selectedCount={bank.selectedCount}
          />
          <ObjectiveBankPanel bank={bank} />
        </div>
      ) : (
        <div key="objectives" className={cn(bodyCascade, "flex min-h-0 flex-1 flex-col gap-3 bg-background p-4")}>
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

          {priorLoads.length > 0 && !isPriorLoadResolved && !isComposerOpen && (
            <PriorLoadNotice
              loads={priorLoads}
              freeShare={freeShare}
              onResolve={() => setIsConflictOpen(true)}
              onUseFreeShare={applyFreeShare}
            />
          )}

          {/* Antes de la lista y no después: "otra propuesta" y "descartar"
              actúan sobre lo que la IA acaba de dejar puesto en `draft`, y la
              tarjeta debe quedar fija arriba de eso mientras se decide. */}
          <AiAgentDrawer
            open={isComposerOpen}
            onOpenChange={(open) => {
              if (!open) setIsComposerOpen(false);
            }}
            context="objectives"
            objectiveCallbacks={{
              mode: "set",
              onConfirm: (incoming) =>
                addWrittenObjectives(incoming, { expand: false, fromAi: true }),
              onKeep: keepAiDraft,
              onRemoveObjectives: removeManyFromAI,
              maxCount: Math.max(1, MAX_AI_OBJECTIVES - draft.objectives.length),
              scopeLabel: isGroup ? "del grupo" : "de la persona",
              onWorkingStateChange: (isWorking, progress, caption, detail) => {
                if (isWorking) {
                  setWorkingState({ progress, caption, detail });
                } else {
                  setWorkingState(null);
                }
              },
            }}
          />

          {workingState !== null && (
            <div className="mb-4">
              <AiAnalyzingState
                title="Analizando"
                progress={workingState.progress}
                caption={workingState.caption}
                detail={workingState.detail}
              />
            </div>
          )}

          {draft.objectives.length === 0 && !isComposerOpen ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface-muted/30 px-6 py-10 text-center">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-surface text-text-secondary">
                <Target className="size-5" strokeWidth={2} />
              </span>
              <p className="text-[13.5px] font-semibold text-text-primary">
                Esta asignación se quedó sin objetivos
              </p>
              <p className="max-w-[52ch] text-[12.5px] leading-relaxed text-text-secondary">
                Añade al menos uno desde la barra de acciones antes de guardar.
              </p>
            </div>
          ) : draft.objectives.length === 0 && isComposerOpen && workingState === null ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center">
              <div className="relative flex size-14 items-center justify-center rounded-2xl bg-surface shadow-sm">
                <Sparkles className="size-6 text-primary" strokeWidth={2.2} />
                <div className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-surface shadow-sm">
                  <Target className="size-3 text-text-secondary" strokeWidth={2.5} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-[14px] font-semibold text-text-primary">
                  Creando objetivos con IA
                </p>
                <p className="max-w-[42ch] text-[12.5px] leading-relaxed text-text-secondary">
                  Dile al Agente IA en el panel derecho qué necesitas medir. Los objetivos que genere aparecerán aquí para que los revises.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {draft.objectives.map((objective, index) => (
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
                  rules={rules}
                  model={model}
                  cycleObjectives={isGroup ? [] : draft.objectives.filter(o => o.id !== objective.id)}
                  isAiDraft={aiDraftIds.has(objective.id)}
                />
              ))}
            </div>
          )}

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
}: {
  loads: readonly PersonLoad[];
  freeShare: number;
  onResolve: () => void;
  onUseFreeShare: () => void;
}) {
  const isFull = freeShare === 0;
  const names = loads.slice(0, 3).map((load) => load.name).join(", ");
  const sources = sourceLabels(loads);
  const via =
    sources.slice(0, 2).join(" y ") + (sources.length > 2 ? ` y ${sources.length - 2} más` : "");

  /** El titular dice el número que importa: cuánto peso les queda. */
  const headline =
    loads.length === 1
      ? isFull
        ? `${names} ya reparte todo su ${TOTAL_WEIGHT} % de peso`
        : `A ${names} solo le queda ${freeShare} % de peso libre`
      : isFull
        ? `${loads.length} personas ya reparten todo su ${TOTAL_WEIGHT} % de peso`
        : `A ${loads.length} personas solo les queda ${freeShare} % de peso libre`;

  const detail = isFull
    ? `Ya reciben objetivos por ${via}. Los objetivos de una persona reparten ${TOTAL_WEIGHT} % entre todos, así que aquí no cabe ninguno más hasta que le bajes el peso a esos.`
    : `Ya reciben objetivos por ${via}. Lo que crees aquí solo puede llevarse ese ${freeShare} %, salvo que le bajes el peso a lo que ya tienen.`;

  return (
    <div className="mt-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-3 rounded-xl border border-status-warning/30 bg-status-warning/5 px-3.5 py-3">
      <div className="flex min-w-[16rem] flex-1 items-start gap-2.5">
        <span className="mt-px flex size-7 shrink-0 items-center justify-center rounded-lg bg-status-warning/15 text-status-warning">
          <Scale className="size-4" strokeWidth={2.2} />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-[12.5px] font-bold leading-snug text-text-primary">{headline}</p>
          <p className="text-[12px] leading-relaxed text-text-secondary">
            {detail}
            {loads.length > 1 && (
              <span className="text-text-muted">
                {" "}
                ({names}
                {loads.length > 3 ? ` y ${loads.length - 3} más` : ""})
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {freeShare > 0 && (
          <button
            type="button"
            onClick={onUseFreeShare}
            className="h-9 rounded-lg border border-border bg-surface px-3 text-[12px] font-semibold text-text-secondary transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            Usar solo ese {freeShare} %
          </button>
        )}
        <button
          type="button"
          onClick={onResolve}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-status-warning px-3 text-[12px] font-semibold text-white transition-colors hover:bg-status-warning/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-warning/30"
        >
          <Scale className="size-3.5" strokeWidth={2.4} />
          Repartir el peso
        </button>
      </div>
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
                <div
                  className="inline-flex h-6 cursor-default items-center gap-1.5 rounded-md bg-surface-muted px-2 text-[11.5px] font-semibold text-text-secondary transition-colors hover:text-text-primary"
                >
                  {targetLabelText}
                </div>
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



/**
 * Las tres formas de traer un objetivo, recogidas en un solo botón de la
 * barra flotante.
 *
 * Es el mismo menú que el "+" del constructor por detrás —crear con IA,
 * elegir del banco, escribirlo a mano, con su renglón de explicación— para
 * que abrir una asignación no cambie el gesto: la barra de abajo es donde
 * están las acciones del paso, y añadir es una de ellas.
 */
function AddObjectiveMenu({
  open,
  onOpenChange,
  isEmpty,
  onAddBlank,
  onOpenBank,
  onOpenComposer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEmpty: boolean;
  onAddBlank: () => void;
  onOpenBank: () => void;
  onOpenComposer: () => void;
}) {
  const choose = (action: () => void) => () => {
    onOpenChange(false);
    action();
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {/* El disparador envuelve al botón de la barra para que el rótulo y
            el estado sigan siendo los del propio rail. */}
        <div>
          {/* Se queda en el tono de la barra aunque la lista esté vacía: el
              azul es de la acción que cierra el paso, y dos azules seguidos
              dejarían de señalar nada. La pista de al lado es la que avisa
              de que todavía falta un objetivo. */}
          <DrawerRailButton
            icon={Plus}
            label={isEmpty ? "Crear un objetivo" : "Añadir objetivo"}
            onClick={() => {}}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={16}
        avoidCollisions={false}
        className="w-[280px] rounded-2xl border-white/10 bg-surface-nav p-2 text-white/60 shadow-rail"
      >
        <div className="flex flex-col gap-0.5">
          <svg width="0" height="0" className="absolute">
            <defs>
              <linearGradient id="ai-icon-gradient-assignment-add" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--ai-gradient-start))" />
                <stop offset="100%" stopColor="hsl(var(--ai-gradient-end))" />
              </linearGradient>
            </defs>
          </svg>

          <button
            type="button"
            onClick={choose(onOpenComposer)}
            className="hover-icon-pop group flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-white/5"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 transition-colors group-hover:bg-white/10">
              <Sparkles
                className="h-5 w-5"
                strokeWidth={2.5}
                stroke="url(#ai-icon-gradient-assignment-add)"
              />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[14px] font-bold tracking-tight text-ai-gradient">
                Proponer con IA
              </span>
              <span className="text-[11px] font-medium text-white/45">
                Genera una propuesta base.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={choose(onOpenBank)}
            className="hover-icon-pop group flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-white/5"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/60 transition-colors group-hover:bg-white/10 group-hover:text-white">
              <Library className="h-5 w-5" strokeWidth={2} />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[14px] font-bold tracking-tight text-white">
                Elegir del banco
              </span>
              <span className="text-[11px] font-medium text-white/45">
                Objetivos ya escritos por área y tema.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={choose(onAddBlank)}
            className="hover-icon-pop group flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-white/5"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/60 transition-colors group-hover:bg-white/10 group-hover:text-white">
              <Plus className="h-5 w-5" strokeWidth={2} />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[14px] font-bold tracking-tight text-white">
                Crear manualmente
              </span>
              <span className="text-[11px] font-medium text-white/45">
                Redacta un objetivo desde cero.
              </span>
            </span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
