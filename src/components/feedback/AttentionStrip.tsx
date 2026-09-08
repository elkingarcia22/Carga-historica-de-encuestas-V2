import * as React from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * La franja de avisos del producto: una sola fila que dice cuánto reclama
 * atención y ofrece un botón por motivo.
 *
 * Nació en el home (`AlertsRow`, sobre la lista de ciclos) y vive aquí porque
 * el resumen de un ciclo tiene el mismo problema — varias cosas pendientes,
 * cada una con su cifra y su acción — y lo estaba resolviendo con banderolas
 * teñidas apiladas a lo ancho: tres bloques de color donde el home pone una
 * fila. Con la anatomía compartida, cambiar el lenguaje de los avisos lo
 * cambia en las dos pantallas a la vez.
 *
 * El ánimo va en el filete lateral y en el disco del icono, no en un lavado de
 * color sobre toda la fila: la franja se apoya en la misma superficie blanca
 * que las tarjetas de arriba.
 */

export type AttentionTone = "brand" | "positive" | "warning" | "negative" | "neutral";

/** El acento de cada tono, para el icono de un botón. */
const TONE_TEXT_CLASSES: Readonly<Record<AttentionTone, string>> = {
  brand: "text-primary",
  positive: "text-status-positive",
  warning: "text-status-warning",
  negative: "text-status-negative",
  neutral: "text-text-muted",
};

/** El filete lateral y el disco del icono de la franja. */
const TONE_STRIP_CLASSES: Readonly<Record<AttentionTone, { rail: string; chip: string }>> = {
  brand: { rail: "bg-primary", chip: "bg-primary/10 text-primary" },
  positive: { rail: "bg-status-positive", chip: "bg-status-positive/10 text-status-positive" },
  warning: { rail: "bg-status-warning", chip: "bg-status-warning/15 text-status-warning" },
  negative: { rail: "bg-status-negative", chip: "bg-status-negative/15 text-status-negative" },
  neutral: { rail: "bg-border", chip: "bg-muted/60 text-text-muted" },
};

const formatCount = (value: number): string => value.toLocaleString("es-CO");

interface AttentionStripProps {
  /** Cómo se anuncia el grupo a un lector de pantalla. */
  label: string;
  icon: LucideIcon;
  tone?: AttentionTone;
  /** La cifra de arriba: cuánto reclama atención. */
  title: string;
  /** La línea de abajo: qué hacer con la fila. */
  detail: string;
  /** Los botones — un `AttentionAction` por motivo. */
  children?: React.ReactNode;
  className?: string;
}

export function AttentionStrip({
  label,
  icon: Icon,
  tone = "warning",
  title,
  detail,
  children,
  className,
}: AttentionStripProps) {
  const toneClasses = TONE_STRIP_CLASSES[tone];

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "relative flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-border/60 bg-surface py-2.5 pl-5 pr-3.5 shadow-card",
        className
      )}
    >
      <span
        aria-hidden
        className={cn("absolute bottom-3 left-2 top-3 w-[3px] rounded-full", toneClasses.rail)}
      />
      <div className="mr-auto flex min-w-0 items-center gap-2.5">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            toneClasses.chip
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[12.5px] font-bold text-text-primary">{title}</span>
          <span className="truncate text-[11px] font-medium text-text-muted">{detail}</span>
        </div>
      </div>

      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

interface AttentionActionProps {
  icon: LucideIcon;
  label: string;
  /** Lo que el aviso significa, en su propio tooltip. */
  hint: string;
  value: number;
  tone?: AttentionTone;
  /** Para un aviso que además es un filtro puesto: se pinta encendido. */
  active?: boolean;
  onClick: () => void;
}

/** Un motivo: su icono, su nombre, su cifra y la flecha de que lleva a algo. */
export function AttentionAction({
  icon: Icon,
  label,
  hint,
  value,
  tone = "brand",
  active = false,
  onClick,
}: AttentionActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-pressed={active}
          className={cn(
            "group inline-flex h-8 items-center gap-2 rounded-lg border pl-2.5 pr-1.5 text-[12px] font-semibold transition-colors duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
            active
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border/70 bg-surface-muted/60 text-text-primary hover:border-primary/40 hover:bg-primary/[0.06]"
          )}
        >
          <Icon
            className={cn(
              "h-3.5 w-3.5 shrink-0",
              active ? "text-primary-foreground" : TONE_TEXT_CLASSES[tone]
            )}
            strokeWidth={2}
          />
          <span>{label}</span>
          <span
            className={cn(
              "flex h-5 min-w-[20px] items-center justify-center rounded-md px-1.5 text-[11px] font-bold tabular-nums",
              active ? "bg-white/20 text-primary-foreground" : "bg-surface text-text-primary shadow-sm"
            )}
          >
            {formatCount(value)}
          </span>
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5",
              active ? "text-primary-foreground/80" : "text-text-muted"
            )}
            strokeWidth={2}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px]">{hint}</TooltipContent>
    </Tooltip>
  );
}
