import * as React from "react";
import { Plus, Edit2, Copy, Trash2, CheckSquare, Sparkles, Upload, GitCompare } from "lucide-react";
import {
  ActionRailShell,
  RailButton,
  RailDivider,
  RailPrimaryAction,
  AnimatedActionItem,
  RailSelectionChip,
  RailOverflowMenu,
  useContextChangeKey,
  useRailPopoutSide,
} from "@/components/action-rail";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AiAgentDrawer } from "@/components/ai/AiAgentDrawer";
import { MovingBorderBeam } from "@/components/ui/moving-border-beam";
import { CICLO_ACTIONS, splitCicloActions, type CicloActionId } from "@/components/ciclo-list";

interface ObjetivosListActionRailProps {
  /** A row is mid date-edit — an immersive, in-row decision that the rail
   * must not compete with, so the whole rail closes rather than sit there
   * offering an unrelated action on top of it. */
  locked?: boolean;
  /**
   * Un panel modal se quedó con la pantalla —hoy, la carga masiva de
   * objetivos—: la barra se recoge a su pastilla y deja de responder mientras
   * dure, en vez de seguir flotando sobre el panel con las acciones del fondo.
   * Al cerrarlo vuelve sola.
   */
  isBlocked?: boolean;
  selectedCount: number;
  onClearSelection: () => void;
  activeTab: "ciclos" | "usuarios";
  /** The estado of the lone selected ciclo — decides which actions apply. */
  selectedCicloEstado?: string;
  /** Opens the ciclo creation wizard. */
  onCreateCiclo?: () => void;
  /** Opens the "comparar ciclos" view. */
  onCompareCiclos?: () => void;
  /** Runs one of the single selected ciclo's own actions. */
  onCicloAction?: (action: CicloActionId) => void;
  /** Duplicates the currently selected ciclo(s), in bulk mode. */
  onDuplicateCiclos?: () => void;
  /** Requests deletion of the currently selected ciclo(s), in bulk mode —
   * opens the confirmation modal, it doesn't delete outright. */
  onDeleteCiclos?: () => void;
  /** Opens the ciclo picker for a bulk objectives upload. */
  onUploadObjectives?: () => void;
}

export function ObjetivosListActionRail({
  locked = false,
  isBlocked = false,
  selectedCount,
  onClearSelection,
  activeTab,
  selectedCicloEstado,
  onCreateCiclo,
  onCompareCiclos,
  onCicloAction,
  onDuplicateCiclos,
  onDeleteCiclos,
  onUploadObjectives
}: ObjetivosListActionRailProps) {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = React.useState(false);
  const popoutSide = useRailPopoutSide();

  const mode = selectedCount === 0 ? "none" : selectedCount === 1 ? "single" : "bulk";
  const animKey = useContextChangeKey(mode + activeTab + (selectedCicloEstado ?? ""));
  const { inline, overflow } =
    activeTab === "ciclos" && mode === "single" && selectedCicloEstado
      ? splitCicloActions(selectedCicloEstado)
      : { inline: [] as readonly CicloActionId[], overflow: [] as readonly CicloActionId[] };

  // Closed and inert, not just missing its buttons — a stray click landing
  // on where the rail used to be must not reach a control that is no longer
  // meant to be there.
  if (locked) return null;

  const contextual = selectedCount === 0 ? null : (
    <>
      <AnimatedActionItem animKey={animKey} staggerIndex={0} skipColorFlash>
        <RailSelectionChip count={selectedCount} onClear={onClearSelection} />
      </AnimatedActionItem>
      <AnimatedActionItem animKey={animKey} staggerIndex={1} skipColorFlash>
        <RailDivider />
      </AnimatedActionItem>

      {activeTab === "ciclos" && mode === "single" && (
        <>
          {inline.map((id, index) => {
            const spec = CICLO_ACTIONS[id];
            const Icon = spec.icon;
            return (
              <AnimatedActionItem key={id} animKey={animKey} staggerIndex={2 + index}>
                <RailButton
                  icon={<Icon className="h-[20px] w-[20px]" strokeWidth={2} />}
                  label={spec.label}
                  tone={spec.tone}
                  onClick={() => onCicloAction?.(id)}
                />
              </AnimatedActionItem>
            );
          })}

          {overflow.length > 0 && (
            <AnimatedActionItem animKey={animKey} staggerIndex={2 + inline.length}>
              <RailOverflowMenu
                onOpenChange={setIsMenuOpen}
                items={overflow.map((id) => {
                  const spec = CICLO_ACTIONS[id];
                  const Icon = spec.icon;
                  return {
                    id,
                    label: spec.label,
                    tone: spec.tone,
                    icon: <Icon className="h-[18px] w-[18px]" strokeWidth={2} />,
                    onClick: () => onCicloAction?.(id),
                  };
                })}
              />
            </AnimatedActionItem>
          )}
        </>
      )}

      {activeTab === "ciclos" && mode === "bulk" && (
        <>
          <AnimatedActionItem animKey={animKey} staggerIndex={2}>
            <RailButton
              icon={<Copy className="h-[20px] w-[20px]" strokeWidth={2} />}
              label={`Duplicar (${selectedCount})`}
              onClick={() => onDuplicateCiclos?.()}
            />
          </AnimatedActionItem>
          <AnimatedActionItem animKey={animKey} staggerIndex={3}>
            <RailButton
              icon={<Trash2 className="h-[20px] w-[20px]" strokeWidth={2} />}
              label={`Eliminar (${selectedCount})`}
              onClick={() => onDeleteCiclos?.()}
              tone="danger"
            />
          </AnimatedActionItem>
        </>
      )}

      {activeTab === "usuarios" && (
        <>
          <AnimatedActionItem animKey={animKey} staggerIndex={2}>
            <RailButton
              icon={<Plus className="h-[20px] w-[20px]" strokeWidth={2} />}
              label={mode === "single" ? "Crear objetivos a un nuevo usuario" : "Crear objetivos a varios usuarios"}
              onClick={() => {}}
            />
          </AnimatedActionItem>
          {mode === "bulk" && (
            <>
              <AnimatedActionItem animKey={animKey} staggerIndex={3}>
                <RailButton
                  icon={<Edit2 className="h-[20px] w-[20px]" strokeWidth={2} />}
                  label="Editar objetivos a varios usuarios"
                  onClick={() => {}}
                />
              </AnimatedActionItem>
              <AnimatedActionItem animKey={animKey} staggerIndex={4}>
                <RailButton
                  icon={<CheckSquare className="h-[20px] w-[20px]" strokeWidth={2} />}
                  label="Actualizar avance de varios objetivos"
                  onClick={() => {}}
                />
              </AnimatedActionItem>
            </>
          )}
        </>
      )}
    </>
  );

  return (
    <>
      <ActionRailShell
        keepOpen={selectedCount > 0 || isMenuOpen || aiDrawerOpen}
        isBlocked={isBlocked}
        contextual={contextual}
        persistent={
          selectedCount === 0 ? (
            <>
              <RailButton
                icon={<GitCompare className="h-[20px] w-[20px]" strokeWidth={2} />}
                label="Comparar ciclos"
                onClick={() => onCompareCiclos?.()}
              />

              <RailButton
                icon={<Upload className="h-[20px] w-[20px]" strokeWidth={2} />}
                label="Cargar objetivos"
                onClick={() => onUploadObjectives?.()}
              />

              <svg width="0" height="0" className="absolute">
                <defs>
                  <linearGradient id="ai-icon-gradient-objetivos" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="hsl(var(--ai-gradient-start))" />
                    <stop offset="100%" stopColor="hsl(var(--ai-gradient-end))" />
                  </linearGradient>
                </defs>
              </svg>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setAiDrawerOpen(true)}
                    aria-label="Agente IA"
                    className="group hover-icon-pop relative flex h-10 w-10 items-center justify-center rounded-xl bg-transparent transition-all duration-300 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 overflow-hidden"
                  >
                    {/* Background animation on hover */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-ai-gradient -z-10" />

                    <MovingBorderBeam
                      duration={4000}
                      borderWidth={2}
                      rx={12}
                      ry={12}
                      beamSize={60}
                      colorFrom="hsl(var(--ai-gradient-start))"
                      colorTo="hsl(var(--ai-gradient-end))"
                      className="opacity-100 group-hover:opacity-0 transition-opacity duration-300"
                    />
                    
                    {/* Gradient icon (default) */}
                    <Sparkles 
                      className="absolute z-10 h-[18px] w-[18px] drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] opacity-100 group-hover:opacity-0 transition-opacity duration-300" 
                      stroke="url(#ai-icon-gradient-objetivos)" 
                      strokeWidth={2.5} 
                    />
                    
                    {/* White icon (hover) */}
                    <Sparkles 
                      className="absolute z-10 h-[18px] w-[18px] text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" 
                      strokeWidth={2.5} 
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side={popoutSide}>Agente IA</TooltipContent>
              </Tooltip>

              <RailPrimaryAction
                icon={<Plus className="h-4 w-4" strokeWidth={2.5} />}
                label="Crear ciclo"
                onClick={onCreateCiclo}
              />
            </>
          ) : null
        }
      />
      <AiAgentDrawer open={aiDrawerOpen} onOpenChange={setAiDrawerOpen} context="dashboard" />
    </>
  );
}
