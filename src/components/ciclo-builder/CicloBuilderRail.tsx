import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Trash2,
  Info,
  Library,
  Link2,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Scale,
  SlidersHorizontal,
  Sparkles,
  SplitSquareHorizontal,
  Target,
  Unlink,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger, PopoverTitle } from "@/components/ui/popover";
import {
  AnimatedActionItem,
  RailButton,
  RailConfirmButton,
  RailDragHandle,
  RailSelectionChip,
  RailSettingsMenu,
  useContextChangeKey,
  useDraggableRail,
  useRailAutoHide,
} from "@/components/action-rail";
import { formatCount, type ParticipantsGroupBreakdown } from "@/components/survey-builder";
import type { AiReviewActions } from "./AiObjectiveComposer";
import type { AssignmentSelection } from "./assignmentSelection";
import type { CicloStepId } from "./cicloStepper";

interface CicloBuilderRailProps {
  activeStep: CicloStepId;
  /** True for as long as the AI composer card is on screen — brief,
   * generation and review alike. The bar minimises itself and refuses to
   * reopen while this holds — nothing in it (save, continue, add a card by
   * hand) is a safe action while there's a half-answered brief or a
   * proposal that hasn't been handed over yet. */
  isBlocked?: boolean;
  /** Present on the two objective steps: creates one more card. */
  onAddObjective: (() => void) | null;
  onAddObjectiveAi?: (() => void) | null;
  /** Abre el banco de objetivos ya escritos. Es la tercera procedencia de un
   *  objetivo —a mano, con IA, o elegido del banco— y por eso vive en el mismo
   *  menú que las otras dos en vez de en un botón suelto. */
  onOpenObjectiveBank?: (() => void) | null;
  /** Las cuatro salidas de revisar una tanda de objetivos creada con IA.
   * Mientras estén presentes la barra deja de bloquearse y reemplaza el
   * botón de añadir por ellas — es la única decisión pendiente. */
  reviewActions?: AiReviewActions | null;
  onSave: () => void;
  /** Previous step, or null on the first one — the button hides rather than
   * disabling, since there is nowhere for it to go. */
  onBack: (() => void) | null;
  /** Leaves the wizard. Nothing here decides whether that's safe — the
   * screen owning this callback is the one that knows if there's unsaved
   * work worth confirming first. */
  onExit: () => void;
  onContinue: () => void;
  continueLabel: string;
  /** Stats shown inside the info card. */
  participantsCount: number;
  /** How that count splits between the selected groups and the ad-hoc picks
   * on top of them, so the summary isn't one flat number once groups are in
   * play. Empty for the modes that have nothing to break down. */
  participantsBreakdown: ParticipantsGroupBreakdown;
  companyObjectivesCount: number;
  /** Assigned objectives, split by which of the two assignment steps handed
   * them out — a single combined total would blur the one thing each step
   * actually owns. */
  groupObjectivesCount: number;
  individualObjectivesCount: number;
  /** Assigned objectives that point at a company objective, and those left
   * standalone. */
  alignedCount: number;
  unalignedCount: number;
  /** Assignments on the step being shown, and how many of them already close
   * at 100 %. Weight is a share of one assignment, so a single total across
   * the ciclo would be a number that means nothing. */
  setsTotal: number;
  setsComplete: number;
  reachCount: number;
  /** Ticked rows in the participants table, mirroring the survey builder. */
  participantsSelectionCount?: number;
  onClearParticipantsSelection?: (() => void) | null;
  onDeleteParticipantsSelection?: (() => void) | null;
  /**
   * Lo marcado en el paso de objetivos asignados, ya con sus acciones.
   *
   * Llega entero y no en cinco props sueltas porque la barra no decide nada
   * sobre ello: el paso, que es quien sabe cómo están repartidos los
   * objetivos, dice qué se puede hacer con lo marcado, y la barra lo dibuja.
   */
  assignmentSelection?: AssignmentSelection | null;
  /** Acciones específicas del paso de alineación (ej: Popover de alinear). */
  alignmentActions?: React.ReactNode;
}

/**
 * Bottom action bar for the ciclo builder.
 *
 * Same dock as the survey builder — minimises to a pill, expands on hover,
 * contextual actions on the left and the step navigation on the right — with
 * the ciclo's own actions in it. It stays a separate component rather than a
 * mode of the survey rail because almost none of that rail's surface (sections,
 * subsections, question bank, preview) has a counterpart here, and threading
 * eight more "is this step active" flags through it would make both harder to
 * read than two focused files.
 */
export function CicloBuilderRail({
  activeStep,
  isBlocked = false,
  onAddObjective,
  onAddObjectiveAi,
  onOpenObjectiveBank,
  reviewActions = null,
  onSave,
  onBack,
  onExit,
  onContinue,
  continueLabel,
  participantsCount,
  participantsBreakdown,
  companyObjectivesCount,
  groupObjectivesCount,
  individualObjectivesCount,
  alignedCount,
  unalignedCount,
  setsTotal,
  setsComplete,
  reachCount,
  participantsSelectionCount = 0,
  onClearParticipantsSelection,
  onDeleteParticipantsSelection,
  assignmentSelection = null,
  alignmentActions,
}: CicloBuilderRailProps) {
  const [autoHide] = useRailAutoHide();
  const [isExpanded, setIsExpanded] = React.useState(true);
  // The bar can be dragged anywhere in the viewport, same as the list's own
  // rail — a wizard step whose content sits under the dock is the one case
  // where a fixed bottom-centre bar gets in the way.
  const { barRef, position, isDragging, gripHandlers } = useDraggableRail();
  const collapseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const graceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Timers read this instead of closing over `autoHide` directly, so the
  // mount/step-change effect below doesn't need it as a dependency — toggling
  // the pin must not retrigger the "open for a moment" grace period.
  const autoHideRef = React.useRef(autoHide);
  React.useEffect(() => {
    autoHideRef.current = autoHide;
  }, [autoHide]);

  // Entering the builder — or moving to a new step within it — brings new
  // contextual buttons; the rail opens itself for a moment so they are
  // noticed rather than discovered by accident later, then honours the
  // auto-hide preference once that moment has passed. 1500ms matches the
  // steps menu's own opens-then-collapses timing (CicloBuilder.tsx) so both
  // panels settle together instead of the rail lingering after the menu.
  const previousStep = React.useRef(activeStep);
  const [stepChangeKey, setStepChangeKey] = React.useState(0);
  const [addMenuOpen, setAddMenuOpen] = React.useState(false);
  const [isRemoveOpen, setIsRemoveOpen] = React.useState(false);

  /**
   * Las acciones de la selección vuelven a entrar escalonadas cuando cambia lo
   * que se puede hacer con ella —al pasar de una agrupación a varias, por
   * ejemplo—, no en cada fila que se marca: repetir la animación en cada clic
   * la convierte en parpadeo.
   */
  const selectionKey = useContextChangeKey(
    assignmentSelection === null
      ? "vacio"
      : `${assignmentSelection.setCount}:${assignmentSelection.detachableCount > 0}`
  );

  // Una confirmación abierta sobre filas que ya no están marcadas preguntaría
  // por algo que ya no existe.
  React.useEffect(() => {
    if (assignmentSelection === null) setIsRemoveOpen(false);
  }, [assignmentSelection]);

  React.useEffect(() => {
    if (previousStep.current !== activeStep) {
      previousStep.current = activeStep;
      setStepChangeKey((key) => key + 1);
    }
    if (isBlocked) return;
    setIsExpanded(true);
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    if (graceTimer.current) clearTimeout(graceTimer.current);
    graceTimer.current = setTimeout(() => {
      if (autoHideRef.current) setIsExpanded(false);
    }, 1500);
  }, [activeStep, isBlocked]);

  React.useEffect(
    () => () => {
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
      if (graceTimer.current) clearTimeout(graceTimer.current);
    },
    []
  );

  // Stay open for the whole gesture: auto-hide collapsing the bar out from
  // under a drag in progress would strand the grip mid-move.
  React.useEffect(() => {
    if (!isDragging) return;
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    if (graceTimer.current) clearTimeout(graceTimer.current);
    setIsExpanded(true);
  }, [isDragging]);

  // Reacts to the pin being toggled *after* mount — a manual change of the
  // preference takes effect immediately. Comparing against the previous
  // *value* (rather than a "have I run yet" flag) is what makes this survive
  // StrictMode's dev-only double-invoke of effects: both replays see the same
  // value, so neither is mistaken for a real toggle and steals the mount's
  // open-then-honour-the-preference behaviour above.
  const previousAutoHide = React.useRef(autoHide);
  React.useEffect(() => {
    if (previousAutoHide.current === autoHide) return;
    previousAutoHide.current = autoHide;
    setIsExpanded(!autoHide);
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    if (graceTimer.current) clearTimeout(graceTimer.current);
  }, [autoHide]);

  // El bloqueo gana sobre cualquier otra razón para estar abierta —el pin,
  // el hover, el cambio de paso recién ocurrido— así que se colapsa aparte
  // de esas reglas en cuanto se activa. Al salir del bloqueo, recupera el
  // estado normal según autoHide. La comparación con el bloqueo anterior evita
  // que este efecto pise la apertura inicial de montaje cuando nunca estuvo
  // bloqueada.
  const wasBlocked = React.useRef(isBlocked);
  React.useEffect(() => {
    const previouslyBlocked = wasBlocked.current;
    wasBlocked.current = isBlocked;
    if (isBlocked) {
      setIsExpanded(false);
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
      if (graceTimer.current) clearTimeout(graceTimer.current);
    } else if (previouslyBlocked) {
      setIsExpanded(!autoHide);
    }
  }, [isBlocked, autoHide]);

  // Con una tanda de IA pendiente de revisar, la barra se queda abierta sin
  // importar la preferencia de auto-ocultar: es la única decisión que falta,
  // y perderla de vista sería peor que tenerla siempre a la vista.
  React.useEffect(() => {
    if (!reviewActions) return;
    setIsExpanded(true);
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    if (graceTimer.current) clearTimeout(graceTimer.current);
  }, [reviewActions]);

  const handleMouseEnter = () => {
    if (isBlocked) return;
    setIsExpanded(true);
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
  };

  const handleMouseLeave = () => {
    if (!autoHide || reviewActions) return;
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => setIsExpanded(false), 150);
  };

  const isFinalStep = continueLabel === "Finalizar";
  const hasParticipantsSelection =
    activeStep === "participants" && participantsSelectionCount > 0;
  const assignmentUnitPlural = assignmentSelection?.unit === "persona" ? "personas" : "grupos";
  /**
   * Con algo marcado la barra deja de hablarle al paso y le habla a la
   * selección: "Crear asignación", "Resumen del ciclo", "Salir", "Guardar" y
   * la navegación entre pasos no son acciones sobre lo marcado, y ofrecerlas
   * junto a "Quitar" mezclaba dos conversaciones en una tira. Mismo patrón
   * que la barra de resultados (`persistent={selectedCount === 0 ? … : null}`
   * en `CicloResultsActionRail`): estas se retiran del todo mientras hay
   * selección, no se quedan atenuadas.
   */
  const hasAnySelection = hasParticipantsSelection || assignmentSelection !== null;

  return (
    <>
      <div className="pointer-events-none absolute bottom-0 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center justify-end">
        <div
          ref={barRef}
          className={cn(
            "flex h-16 flex-col items-center justify-end px-6",
            isBlocked ? "pointer-events-none" : "pointer-events-auto",
            position && "fixed z-[60]"
          )}
          style={position ? { left: position.x, top: position.y } : undefined}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div
            title={isBlocked ? "Generando objetivos con IA…" : undefined}
            className={cn(
              "relative flex items-center justify-center overflow-hidden rounded-3xl transition-all duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
              isExpanded
                ? "h-14 max-w-[800px] border border-white/10 bg-surface-nav px-3 shadow-rail"
                : "h-1.5 w-[64px] max-w-[64px] translate-y-[2px] rounded-full border-transparent bg-border-strong shadow-card"
            )}
          >
            <div
              className={cn(
                "dock-container flex w-max items-center gap-2 transition-all duration-[700ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
                isExpanded ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
              )}
            >
              {reviewActions ? (
                <>
                  {isExpanded && (
                    <>
                      <RailDragHandle isDragging={isDragging} {...gripHandlers} />
                      <RailSettingsMenu />
                      <div className="mx-1 my-2 w-px self-stretch bg-white/10" />
                    </>
                  )}

                  <AnimatedActionItem animKey={stepChangeKey} staggerIndex={0}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={reviewActions.onDiscard}
                      className="hover-icon-pop h-10 gap-2 rounded-full border-status-negative/30 bg-status-negative/10 px-4 text-[13px] text-status-negative hover:bg-status-negative/20 hover:text-status-negative"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={2} />
                      Descartar
                    </Button>
                  </AnimatedActionItem>

                  <AnimatedActionItem animKey={stepChangeKey} staggerIndex={1}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={reviewActions.onModify}
                      className="hover-icon-pop h-10 gap-2 rounded-full border-white/15 bg-transparent px-4 text-[13px] text-white/70 hover:bg-white/10 hover:text-white"
                    >
                      <SlidersHorizontal className="h-4 w-4" strokeWidth={2} />
                      Modificar criterios
                    </Button>
                  </AnimatedActionItem>

                  <AnimatedActionItem animKey={stepChangeKey} staggerIndex={2}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={reviewActions.onRegenerate}
                      className="hover-icon-pop h-10 gap-2 rounded-full border-white/15 bg-transparent px-4 text-[13px] text-white/70 hover:bg-white/10 hover:text-white"
                    >
                      <RefreshCw className="h-4 w-4" strokeWidth={2} />
                      Otra propuesta
                    </Button>
                  </AnimatedActionItem>

                  <AnimatedActionItem animKey={stepChangeKey} staggerIndex={3}>
                    <Button
                      size="sm"
                      onClick={reviewActions.onKeep}
                      className="hover-icon-pop relative h-10 gap-2 rounded-full px-4 text-[13px] transition-shadow hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
                    >
                      <Check className="h-4 w-4" strokeWidth={2} />
                      Conservar esta versión
                    </Button>
                  </AnimatedActionItem>
                </>
              ) : (
                <>
              {isExpanded && (
                <>
                  <RailDragHandle isDragging={isDragging} {...gripHandlers} />
                  <RailSettingsMenu />
                  <div className="mx-1 my-2 w-px self-stretch bg-white/10" />
                </>
              )}

              {assignmentSelection && (
                <>
                  <AnimatedActionItem animKey={selectionKey} staggerIndex={0} skipColorFlash>
                    <RailSelectionChip
                      count={assignmentSelection.count}
                      onClear={assignmentSelection.clear}
                      gender={assignmentSelection.unit === "grupo" ? "m" : "f"}
                    />
                  </AnimatedActionItem>

                  {/* Igual que en la tabla de colaboradores: la barra no
                      enseña las cinco acciones con dos apagadas, muestra
                      solo las que sirven para lo marcado ahora mismo. "Editar
                      objetivos" y "Cambiar destinatarios" son gestos de una
                      sola agrupación —editarlos a la vez sería prometer algo
                      que dos agrupaciones distintas no pueden cumplir sin
                      preguntar de cuál se trata—, así que solo aparecen con
                      una marcada. "Sacar" solo aparece si hay algo que
                      separar. Ajustar pesos y quitar sirven igual para una
                      fila que para diez. */}
                  {assignmentSelection.editObjectives && (
                    <AnimatedActionItem animKey={selectionKey} staggerIndex={1}>
                      <RailButton
                        icon={<Target className="h-[20px] w-[20px]" strokeWidth={2} />}
                        label="Editar objetivos"
                        onClick={() => assignmentSelection.editObjectives?.()}
                      />
                    </AnimatedActionItem>
                  )}

                  {assignmentSelection.editTargets && (
                    <AnimatedActionItem animKey={selectionKey} staggerIndex={2}>
                      <RailButton
                        icon={<Users className="h-[20px] w-[20px]" strokeWidth={2} />}
                        label={`Cambiar ${assignmentUnitPlural} de la agrupación`}
                        onClick={() => assignmentSelection.editTargets?.()}
                      />
                    </AnimatedActionItem>
                  )}

                  <AnimatedActionItem animKey={selectionKey} staggerIndex={3}>
                    <RailButton
                      icon={<Scale className="h-[20px] w-[20px]" strokeWidth={2} />}
                      label={
                        assignmentSelection.setCount === 1
                          ? "Ajustar los pesos de esta agrupación"
                          : `Ajustar los pesos de ${assignmentSelection.setCount} agrupaciones`
                      }
                      onClick={assignmentSelection.adjustWeights}
                    />
                  </AnimatedActionItem>

                  {assignmentSelection.detach && (
                    <AnimatedActionItem animKey={selectionKey} staggerIndex={4}>
                      <RailButton
                        icon={<SplitSquareHorizontal className="h-[20px] w-[20px]" strokeWidth={2} />}
                        label={
                          assignmentSelection.detachableCount <= 1
                            ? "Sacar a su propia agrupación, con una copia de estos objetivos"
                            : `Sacar ${assignmentSelection.detachableCount} a agrupaciones propias, cada una con su copia de los objetivos`
                        }
                        onClick={() => assignmentSelection.detach?.()}
                      />
                    </AnimatedActionItem>
                  )}

                  <AnimatedActionItem animKey={selectionKey} staggerIndex={5}>
                    <RailConfirmButton
                      icon={<Trash2 className="h-[20px] w-[20px]" strokeWidth={2} />}
                      label={`Quitar los objetivos de ${assignmentSelection.count} ${
                        assignmentSelection.count === 1
                          ? assignmentSelection.unit
                          : assignmentUnitPlural
                      }`}
                      tone="danger"
                      open={isRemoveOpen}
                      onOpenChange={setIsRemoveOpen}
                      title={
                        assignmentSelection.count === 1
                          ? `¿Quitar los objetivos de este ${assignmentSelection.unit}?`
                          : `¿Quitar los objetivos de ${assignmentSelection.count} ${assignmentUnitPlural}?`
                      }
                      description="Dejan de tener objetivos en este ciclo. Una agrupación que se quede sin nadie se va con ellos."
                      confirmLabel="Quitar"
                      confirmTone="destructive"
                      onConfirm={() => {
                        assignmentSelection.remove();
                        setIsRemoveOpen(false);
                      }}
                    />
                  </AnimatedActionItem>

                  <div className="-mx-1 my-2 w-px self-stretch bg-white/10" />
                </>
              )}

              {hasParticipantsSelection && (
                <>
                  <AnimatedActionItem animKey={stepChangeKey} staggerIndex={0} skipColorFlash>
                    <RailSelectionChip
                      count={participantsSelectionCount}
                      onClear={() => onClearParticipantsSelection?.()}
                      gender="m"
                    />
                  </AnimatedActionItem>
                  {onDeleteParticipantsSelection && (
                    <AnimatedActionItem animKey={stepChangeKey} staggerIndex={1}>
                      <RailButton
                        icon={
                          <svg
                            className="h-[20px] w-[20px] text-status-negative"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        }
                        label={`Eliminar ${participantsSelectionCount} ${participantsSelectionCount === 1 ? "seleccionado" : "seleccionados"}`}
                        onClick={() => onDeleteParticipantsSelection?.()}
                      />
                    </AnimatedActionItem>
                  )}
                  <div className="-mx-1 my-2 w-px self-stretch bg-white/10" />
                </>
              )}

              {!hasAnySelection && (
                <>
              {onAddObjective && (
                <>
                  <div
                    key={`shimmer-${stepChangeKey}`}
                    className="pointer-events-none absolute inset-0 rounded-3xl"
                    style={{ animation: "railGroupShimmer 1200ms ease-out both", animationDelay: "200ms" }}
                  />
                  <AnimatedActionItem animKey={stepChangeKey} staggerIndex={0}>
                    {onAddObjectiveAi || onOpenObjectiveBank ? (
                      <Popover open={addMenuOpen} onOpenChange={setAddMenuOpen}>
                        <PopoverTrigger asChild>
                          <div>
                            <RailButton
                              icon={<Plus className="h-[20px] w-[20px]" strokeWidth={2} />}
                              label={
                                activeStep === "company"
                                  ? "Añadir objetivo de la empresa"
                                  : "Crear asignación"
                              }
                              // El clic lo recoge el `PopoverTrigger` que lo
                              // envuelve; el botón solo necesita existir.
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
                                <linearGradient id="ai-icon-gradient-rail-add" x1="0%" y1="0%" x2="100%" y2="100%">
                                  <stop offset="0%" stopColor="hsl(var(--ai-gradient-start))" />
                                  <stop offset="100%" stopColor="hsl(var(--ai-gradient-end))" />
                                </linearGradient>
                              </defs>
                            </svg>

                            {onAddObjectiveAi && (
                            <button
                              type="button"
                              onClick={() => { setAddMenuOpen(false); onAddObjectiveAi(); }}
                              className="hover-icon-pop group flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-white/5"
                            >
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 transition-colors group-hover:bg-white/10">
                                <Sparkles className="h-5 w-5" strokeWidth={2.5} stroke="url(#ai-icon-gradient-rail-add)" />
                              </span>
                              <span className="flex flex-col gap-0.5">
                                <span className="text-[14px] font-bold tracking-tight text-ai-gradient">
                                  Crear con IA
                                </span>
                                <span className="text-[11px] font-medium text-white/45">
                                  Genera una propuesta base.
                                </span>
                              </span>
                            </button>
                            )}

                            {onOpenObjectiveBank && (
                            <button
                              type="button"
                              onClick={() => { setAddMenuOpen(false); onOpenObjectiveBank(); }}
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
                            )}

                            <button
                              type="button"
                              onClick={onAddObjective}
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
                    ) : (
                      <RailButton
                        icon={<Plus className="h-[20px] w-[20px]" strokeWidth={2} />}
                        label={
                          activeStep === "company"
                            ? "Añadir objetivo de la empresa"
                            : "Crear asignación"
                        }
                        onClick={onAddObjective}
                      />
                    )}
                  </AnimatedActionItem>
                  <div className="-mx-1 my-2 w-px self-stretch bg-white/10" />
                </>
              )}

              {alignmentActions && (
                <>
                  <AnimatedActionItem animKey={stepChangeKey} staggerIndex={0}>
                    {alignmentActions}
                  </AnimatedActionItem>
                  <div className="-mx-1 my-2 w-px self-stretch bg-white/10" />
                </>
              )}

              <HoverCard>
                <HoverCardTrigger asChild>
                  <button
                    type="button"
                    aria-label="Resumen del ciclo"
                    className="dock-item relative flex h-10 w-10 items-center justify-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                  >
                    <Info className="h-[20px] w-[20px]" strokeWidth={2} />
                  </button>
                </HoverCardTrigger>
                <HoverCardContent
                  side="top"
                  align="center"
                  sideOffset={16}
                  avoidCollisions={false}
                  className="w-64 gap-0 rounded-2xl border border-white/10 bg-surface-nav p-4 shadow-rail"
                >
                  <PopoverTitle className="text-[13px] font-semibold text-white">
                    Resumen del ciclo
                  </PopoverTitle>
                  <div className="mb-3 mt-2 h-px bg-white/10" />
                  <dl className="flex flex-col gap-2.5">
                    <InfoRow icon={Users} label="Participantes" value={formatCount(participantsCount)} />
                    {(participantsBreakdown.groups.length > 0 || participantsBreakdown.outsideCount > 0) && (
                      <div className="ml-[22px] flex flex-col gap-1 border-l border-white/10 pl-2.5">
                        {participantsBreakdown.groups.map((group) => (
                          <div key={group.label} className="flex items-center justify-between gap-3 text-[11.5px]">
                            <span className="truncate text-white/50">{group.label}</span>
                            <span className="shrink-0 tabular-nums font-medium text-white/80">
                              {formatCount(group.count)}
                            </span>
                          </div>
                        ))}
                        {participantsBreakdown.outsideCount > 0 && (
                          <div className="flex items-center justify-between gap-3 text-[11.5px]">
                            <span className="truncate text-white/50">Fuera de grupos</span>
                            <span className="shrink-0 tabular-nums font-medium text-white/80">
                              {formatCount(participantsBreakdown.outsideCount)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    <InfoRow icon={Building2} label="Objetivos de la empresa" value={companyObjectivesCount} />
                    <InfoRow icon={Target} label="Objetivos en grupo" value={groupObjectivesCount} />
                    <InfoRow icon={Target} label="Objetivos individuales" value={individualObjectivesCount} />
                    <InfoRow icon={Link2} label="Objetivos alineados" value={alignedCount} />
                    <InfoRow icon={Unlink} label="Objetivos sin alineación" value={unalignedCount} />
                    <InfoRow
                      icon={Scale}
                      label="Asignaciones listas"
                      value={`${setsComplete} / ${setsTotal}`}
                    />
                    <InfoRow icon={Users} label="Personas con objetivos" value={formatCount(reachCount)} />
                  </dl>
                </HoverCardContent>
              </HoverCard>

              <RailButton
                icon={<LogOut className="h-[20px] w-[20px]" strokeWidth={2} />}
                label="Salir"
                onClick={onExit}
                tone="danger"
              />

              <RailButton
                icon={<Save className="h-[20px] w-[20px]" strokeWidth={2} />}
                label="Guardar ciclo"
                onClick={onSave}
              />

              {onBack && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onBack}
                  className="hover-icon-pop relative h-10 gap-2 rounded-full border-white/15 bg-transparent px-4 text-[13px] text-white/70 hover:bg-white/10 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" strokeWidth={2} />
                  Atrás
                </Button>
              )}

              <Button
                size="sm"
                onClick={onContinue}
                className="hover-icon-pop relative h-10 gap-2 rounded-full px-4 text-[13px] transition-shadow hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
              >
                {continueLabel}
                {isFinalStep ? (
                  <Check className="h-4 w-4" strokeWidth={2} />
                ) : (
                  <ArrowRight className="h-4 w-4" strokeWidth={2} />
                )}
              </Button>
                </>
              )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** One stat line in the info card: icon-led label left, value flush right. */
function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2 text-[13px] text-white/60">
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
        {label}
      </dt>
      <dd className="text-[13px] font-semibold tabular-nums text-white">{value}</dd>
    </div>
  );
}
