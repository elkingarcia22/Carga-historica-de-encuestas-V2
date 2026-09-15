import * as React from "react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useRailPopoutSide } from "./railOrientation";

export type ConfirmTone = "destructive" | "warning" | "primary";

/**
 * El sí/no de una acción de la barra, anclado al botón que la pide.
 *
 * Antes cada barra abría un `ConfirmDialog` centrado con un velo detrás: para
 * una decisión sobre lo que ya está marcado —el contexto está bajo el dedo que
 * la pidió— tapar el resto de la pantalla era más caja de la que la pregunta
 * necesita. Un popover se abre pegado al botón, no le quita la vista a la
 * tabla que explica la decisión, y se cierra como cualquier otro popover de la
 * app: clic afuera, Escape, o su propio botón.
 *
 * Vive aquí y no dentro de una barra concreta porque las tres que lo usan
 * —resultados, la ficha del colaborador y las que vengan— tienen que
 * preguntar igual: dos confirmaciones con distinta forma sobre la misma
 * acción se leen como dos acciones distintas.
 */
export function ConfirmActionPopover({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  confirmLabel,
  tone,
  onConfirm,
  side,
  tooltip,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** El botón al que se ancla. Un solo elemento: va por `asChild`. */
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  tone: ConfirmTone;
  onConfirm: () => void;
  /** Por defecto, hacia donde la barra tenga sitio. */
  side?: "top" | "right" | "bottom" | "left";
  /**
   * Lo que dice el botón al pasar por encima, cuando es un icono desnudo.
   *
   * El tooltip se monta aquí dentro y no alrededor: `PopoverTrigger asChild`
   * necesita un elemento del DOM debajo, y una raíz de `Tooltip` no lo es
   * —le tragaría las props y el popover no abriría nunca—. Anidados al revés,
   * los dos `Slot` se componen sobre el mismo `<button>`.
   */
  tooltip?: React.ReactNode;
}) {
  const railSide = useRailPopoutSide();
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {tooltip === undefined ? (
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side={side ?? railSide} className="max-w-[220px]">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      )}
      <PopoverContent
        side={side ?? railSide}
        align="center"
        sideOffset={10}
        collisionPadding={16}
        className="w-72 flex-col gap-0 rounded-2xl border border-white/10 bg-surface-nav p-3.5 text-white shadow-rail"
      >
        <p className="text-[13px] font-semibold">{title}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-white/60">{description}</p>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors",
              tone === "destructive" &&
                "bg-status-negative/15 text-status-negative hover:bg-status-negative/25",
              tone === "warning" &&
                "bg-status-warning/15 text-status-warning hover:bg-status-warning/25",
              tone === "primary" && "bg-primary text-white hover:bg-primary/90"
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Las mismas clases del botón del pie de un drawer, para el `<button>` crudo
 * que hace de disparador de un popover — no puede ser `DrawerRailButton`
 * porque ese se envuelve en su propio `Tooltip`, y un `Tooltip` no es un solo
 * elemento al que `PopoverTrigger asChild` pueda inyectarle sus props.
 */
export function railButtonClass(
  variant: "ghost" | "primary" | "warning" | "danger",
  iconOnly: boolean
): string {
  return cn(
    "flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl text-[12.5px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
    iconOnly ? "w-9 justify-center" : "px-3",
    variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary/90",
    variant === "warning" && "bg-status-warning/15 text-status-warning hover:bg-status-warning/25",
    variant === "danger" && "bg-status-negative/15 text-status-negative hover:bg-status-negative/25",
    variant === "ghost" && "text-white/85 hover:bg-white/10 hover:text-white"
  );
}

/**
 * Un `RailButton` que en vez de actuar pregunta primero, con la respuesta
 * pegada a él.
 *
 * El disparador lleva `Tooltip` y `PopoverTrigger` sobre el mismo `<button>`:
 * un botón de la barra es un icono desnudo, y sin su tooltip dejaría de
 * decir qué hace.
 */
export function RailConfirmButton({
  icon,
  label,
  tone = "default",
  blockedReason = null,
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmTone,
  onConfirm,
}: {
  icon: React.ReactNode;
  label: string;
  /** El color del botón en la barra, no el de la confirmación. */
  tone?: "default" | "danger";
  blockedReason?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  confirmTone: ConfirmTone;
  onConfirm: () => void;
}) {
  const disabled = blockedReason !== null;

  return (
    <ConfirmActionPopover
      open={open && !disabled}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      tone={confirmTone}
      onConfirm={onConfirm}
      tooltip={blockedReason ?? label}
      trigger={
        <button
          type="button"
          disabled={disabled}
          aria-label={label}
          className={cn(
            "dock-item hover-icon-pop relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
            tone === "danger"
              ? "text-status-negative hover:bg-status-negative/15 focus-visible:ring-status-negative/40 disabled:hover:text-status-negative"
              : "text-white/60 hover:bg-white/10 hover:text-white focus-visible:ring-white/30",
            open &&
              !disabled &&
              (tone === "danger" ? "bg-status-negative/15" : "bg-white/10 text-white")
          )}
        >
          {icon}
        </button>
      }
    />
  );
}
