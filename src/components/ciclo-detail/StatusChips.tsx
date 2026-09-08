import * as React from "react";
import { cn } from "@/lib/utils";
import {
  getEstadoBadgeConfig,
  type NivelDesempenoConfig,
  type ObjetivoEstadoConfig,
} from "@/components/objetivos/objetivosConfigStore";
import { formatPercent } from "./cicloProgress";

/**
 * El estado de un objetivo (o de una persona), con los colores de "Estados y
 * rangos" ya traducidos a una pareja legible. Es la misma píldora que muestra
 * el simulador del builder, para que "En progreso" se vea igual donde se
 * prueba un objetivo y donde se sigue de verdad.
 */
export function EstadoChip({
  estado,
  className,
  size = "md",
}: {
  estado: ObjetivoEstadoConfig | null;
  className?: string;
  size?: "sm" | "md";
}) {
  if (!estado) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full border border-border/60 bg-surface-muted px-2.5 py-0.5 text-[11px] font-semibold text-text-muted",
          className
        )}
      >
        Sin estado
      </span>
    );
  }
  const badge = getEstadoBadgeConfig(estado);
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold",
        size === "sm" ? "px-2 py-px text-[10.5px]" : "px-2.5 py-0.5 text-[11px]",
        badge.bg,
        badge.text,
        badge.border,
        className
      )}
      title={estado.descripcion}
    >
      <badge.Icon className={cn("shrink-0", size === "sm" ? "size-2.5" : "size-3")} strokeWidth={2.5} />
      <span className="truncate">{estado.nombre}</span>
    </span>
  );
}

/** El nivel de desempeño de una persona: punto de color y nombre. */
export function NivelChip({
  nivel,
  className,
}: {
  nivel: NivelDesempenoConfig | null;
  className?: string;
}) {
  if (!nivel) return <span className={cn("text-[12px] text-text-muted", className)}>—</span>;
  return (
    <span
      className={cn("inline-flex items-center gap-2 text-[12.5px] font-semibold text-text-primary", className)}
      title={`${nivel.minPorcentaje} % a ${nivel.maxPorcentaje} %`}
    >
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-full ring-2 ring-surface"
        style={{ backgroundColor: nivel.colorHex }}
      />
      {nivel.nombre}
    </span>
  );
}

/**
 * Barra de avance coloreada por el estado que le corresponde. El porcentaje
 * va al lado, no encima: la barra dice "cuánto" de un vistazo, el número dice
 * exactamente cuánto.
 */
export function ComplianceBar({
  percent,
  estado,
  className,
  barClassName,
  showValue = true,
}: {
  percent: number;
  estado: ObjetivoEstadoConfig | null;
  className?: string;
  barClassName?: string;
  showValue?: boolean;
}) {
  const badge = estado ? getEstadoBadgeConfig(estado) : null;
  const width = Math.max(0, Math.min(100, percent));
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "relative h-1.5 w-full min-w-[56px] overflow-hidden rounded-full bg-border/50",
          barClassName
        )}
      >
        <span
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out",
            badge?.barBg ?? "bg-primary"
          )}
          style={{ width: `${width}%` }}
        />
        {percent > 100 && (
          <span
            aria-hidden
            className="absolute inset-y-0 right-0 w-1 rounded-full bg-white/70 mix-blend-overlay"
          />
        )}
      </span>
      {showValue && (
        <span
          className={cn(
            "shrink-0 text-[12.5px] font-bold tabular-nums",
            badge?.iconColor ?? "text-text-secondary"
          )}
        >
          {formatPercent(percent)}
        </span>
      )}
    </div>
  );
}

/**
 * Barra apilada de cuántas personas caen en cada nivel (o estado). Un vistazo
 * a la salud de un grupo sin abrirlo.
 */
export function DistributionBar({
  segments,
  className,
  height = "h-2",
}: {
  segments: readonly { id: string; label: string; count: number; color: string }[];
  className?: string;
  height?: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  if (total === 0) {
    return <span className={cn("block w-full rounded-full bg-border/40", height, className)} />;
  }
  return (
    <span
      className={cn("flex w-full overflow-hidden rounded-full bg-border/40", height, className)}
      role="img"
      aria-label={segments.map((segment) => `${segment.label}: ${segment.count}`).join(", ")}
    >
      {segments
        .filter((segment) => segment.count > 0)
        .map((segment) => (
          <span
            key={segment.id}
            className="h-full transition-[flex-grow] duration-500"
            style={{ flexGrow: segment.count, backgroundColor: segment.color }}
            title={`${segment.label}: ${segment.count}`}
          />
        ))}
    </span>
  );
}

/** Ícono de avatar con iniciales, en los tamaños que usa la tabla. */
export function InitialsAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary ring-1 ring-primary/15",
        size === "sm" ? "size-6 text-[10px]" : "size-8 text-[11px]",
        className
      )}
    >
      {initials}
    </span>
  );
}

export const MeasureGlyph = React.memo(function MeasureGlyph({
  symbol,
  className,
}: {
  symbol: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-[12px] font-black text-text-secondary",
        className
      )}
    >
      {symbol}
    </span>
  );
});
