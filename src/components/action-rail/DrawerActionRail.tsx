import * as React from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RailDragHandle } from "./RailDragHandle";
import { RailSettingsMenu } from "./RailSettingsMenu";
import { useDraggableRail } from "./useDraggableRail";
import { useRailAutoHide } from "./railAutoHide";

interface DrawerActionRailProps {
  /** Dónde está el paso ahora mismo, en una línea. */
  hint?: React.ReactNode;
  /** Acciones puntuales del paso: cuadrar pesos, resolver un conflicto. */
  tools?: React.ReactNode;
  /** Lo que cierra el paso: continuar, guardar. */
  actions: React.ReactNode;
  /**
   * Mantiene la barra abierta pese a la preferencia de auto-ocultar. Los
   * pasos lo encienden cuando hay algo pendiente que solo se arregla desde
   * aquí — un aviso que desaparece mientras alguien alarga la mano hacia él
   * no es un aviso.
   */
  keepOpen?: boolean;
  /** Colapsa y bloquea la barra: no hay nada seguro que hacer todavía. */
  isBlocked?: boolean;
  /** Deja solo `actions` en la barra: sin ajustes, sin pista, sin
   * herramientas. Para cuando lo único seguro es decidir entre esas
   * acciones, como al revisar una propuesta de IA. */
  minimal?: boolean;
}

/**
 * La barra flotante del drawer.
 *
 * El drawer tenía un pie fijo con dos botones, y el paso creció hasta pedir
 * más: cuadrar pesos, resolver un conflicto, volver atrás. Un pie que crece
 * deja de leerse como un pie, así que estas acciones pasan al mismo dock
 * flotante que usa el constructor por detrás — se recoge en una pastilla
 * cuando no se usa, vuelve al pasar el cursor, y respeta la misma preferencia
 * de auto-ocultar que la barra de la pantalla, porque para quien la usa es la
 * misma barra.
 *
 * También comparte su asa de arrastre: `useDraggableRail` guarda la posición
 * fuera de React (`railPosition.ts`), así que es literalmente la misma barra
 * que la de la pantalla — arrastrarla aquí adentro la deja en el mismo sitio
 * si se cierra el drawer y se vuelve a abrir uno igual más tarde.
 *
 * Vive en la franja del pie y no encima del contenido: así nada queda tapado
 * y la altura de la lista no salta cuando la barra se recoge. Al arrastrarla
 * se despega de esa franja y pasa a `fixed`, igual que la barra de la
 * pantalla, para que pueda dejarse en cualquier punto del drawer.
 */
export function DrawerActionRail({
  hint,
  tools,
  actions,
  keepOpen = false,
  isBlocked = false,
  minimal = false,
}: DrawerActionRailProps) {
  const [autoHide] = useRailAutoHide();
  const [isExpanded, setIsExpanded] = React.useState(true);
  const collapseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const { barRef, position, isDragging, gripHandlers } = useDraggableRail();

  const shouldStayOpen = !autoHide || keepOpen;

  React.useEffect(() => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    setIsExpanded(isBlocked ? false : shouldStayOpen);
  }, [shouldStayOpen, isBlocked]);

  // La barra se queda abierta mientras dura el gesto: que el auto-ocultar la
  // recoja a mitad de un arrastre dejaría el asa colgando sin nada debajo.
  React.useEffect(() => {
    if (!isDragging) return;
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    setIsExpanded(true);
  }, [isDragging]);

  React.useEffect(
    () => () => {
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
    },
    []
  );

  const handleEnter = () => {
    if (isBlocked) return;
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    setIsExpanded(true);
  };

  const handleLeave = () => {
    if (shouldStayOpen || isBlocked || isDragging) return;
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => setIsExpanded(false), 150);
  };

  const isFloating = position != null;
  const floatingStyle = position
    ? { left: position.x, top: position.y, transform: "translateX(-50%)" }
    : undefined;

  return (
    <div className="pointer-events-none relative flex h-[72px] shrink-0 items-end justify-center bg-gradient-to-t from-background via-background/90 to-transparent px-4 pb-3">
      <div
        ref={barRef}
        className={cn(
          "flex flex-col items-center",
          isBlocked ? "pointer-events-none" : "pointer-events-auto",
          isFloating && "fixed z-[60]"
        )}
        style={floatingStyle}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        <div
          className={cn(
            "relative flex items-center justify-center overflow-hidden rounded-3xl transition-all duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
            isExpanded
              ? "h-14 max-w-[1140px] border border-white/10 bg-surface-nav px-3 shadow-rail"
              : "h-1.5 w-[64px] max-w-[64px] rounded-full border-transparent bg-border-strong shadow-card"
          )}
        >
          <div
            className={cn(
              "flex w-max items-center gap-2 transition-all duration-[500ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
              isExpanded ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
            )}
          >
            {isExpanded && (
              <>
                <RailDragHandle isDragging={isDragging} {...gripHandlers} />
                <RailSettingsMenu />
                <div className="mx-1 my-2 w-px self-stretch bg-white/10" />
              </>
            )}

            {!minimal && hint && (
              <span className="max-w-[34ch] truncate px-1 text-[12px] font-medium text-white/70">
                {hint}
              </span>
            )}

            {!minimal && tools && (
              <>
                <div className="mx-1 my-2 w-px self-stretch bg-white/10" />
                <div className="flex items-center gap-1.5">{tools}</div>
              </>
            )}

            {!minimal && <div className="mx-1 my-2 w-px self-stretch bg-white/10" />}
            <div className="flex items-center gap-2">{actions}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Un botón de la barra: mismo lenguaje oscuro que el dock del constructor.
 *
 * `iconOnly` lo reduce a un cuadrado —mismo trato que el resto de los rails
 * de la app (`RailButton`)—, con el rótulo movido a un tooltip en vez de
 * perderse: sigue siendo el mismo botón, solo que sin sitio para la palabra.
 */
export function DrawerRailButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  variant = "ghost",
  iconOnly = false,
}: {
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "ghost" | "primary" | "warning" | "danger";
  iconOnly?: boolean;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl text-[12.5px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
        iconOnly ? "w-9 justify-center" : "px-3",
        variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "warning" &&
          "bg-status-warning/15 text-status-warning hover:bg-status-warning/25",
        variant === "danger" &&
          "bg-status-negative/15 text-status-negative hover:bg-status-negative/25",
        variant === "ghost" && "text-white/85 hover:bg-white/10 hover:text-white"
      )}
    >
      {Icon && <Icon className="size-4" strokeWidth={2.2} />}
      {!iconOnly && label}
    </button>
  );

  if (!iconOnly) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}
