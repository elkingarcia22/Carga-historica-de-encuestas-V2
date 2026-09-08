import { Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/components/ciclo-detail";
import { getEstadoBadgeConfig, type EstadoParticipanteConfig } from "@/components/objetivos/objetivosConfigStore";
import type { ObjetivoEstadoConfig } from "@/components/objetivos/objetivosConfigStore";
import { LIFECYCLE_META, LIFECYCLE_ORDER, type ObjectiveLifecycle } from "./objectiveLifecycle";
import { RISK_META, type RiskLevel } from "./resultsModel";

/**
 * Las píldoras de la vista de resultados.
 *
 * Cada eje tiene su forma, y esa diferencia es deliberada: un estado del
 * objetivo lleva ícono, un nivel de desempeño lleva punto de color, un riesgo
 * lleva punto sin borde. Con tres píldoras idénticas en una misma fila nadie
 * sabría cuál habla del objetivo y cuál de la persona.
 */

/** El ciclo de vida de un objetivo: por aprobar, por ajustar, por iniciar… */
export function LifecycleChip({
  lifecycle,
  size = "md",
  className,
}: {
  lifecycle: ObjectiveLifecycle | null;
  size?: "sm" | "md";
  className?: string;
}) {
  if (!lifecycle) return null;
  const meta = LIFECYCLE_META[lifecycle];
  return (
    <span
      title={meta.description}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold",
        size === "sm" ? "px-2 py-px text-[10.5px]" : "px-2.5 py-0.5 text-[11px]",
        meta.bg,
        meta.text,
        meta.border,
        className
      )}
    >
      <meta.Icon className={cn("shrink-0", size === "sm" ? "size-2.5" : "size-3")} strokeWidth={2.5} />
      <span className="truncate">{meta.label}</span>
    </span>
  );
}

/**
 * Que un objetivo puntual está inactivo. Va aparte del `LifecycleChip` en vez
 * de reemplazarlo: uno dice en qué etapa del flujo se congeló, este dice que
 * ya no cuenta.
 */
export function InactiveChip({
  date,
  percentAtInactivation,
  size = "md",
  className,
}: {
  date: string;
  percentAtInactivation: number;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      title={`Inactivado el ${date} con ${formatPercent(percentAtInactivation)} de avance. No cuenta en el peso ni en el promedio.`}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200/60 bg-slate-100/80 font-semibold text-slate-600 dark:border-slate-700/50 dark:bg-slate-800/40 dark:text-slate-300",
        size === "sm" ? "px-2 py-px text-[10.5px]" : "px-2.5 py-0.5 text-[11px]",
        className
      )}
    >
      <Ban className={cn("shrink-0", size === "sm" ? "size-2.5" : "size-3")} strokeWidth={2.5} />
      Inactivo
    </span>
  );
}

/** El riesgo de un avance frente al calendario. */
export function RiskChip({
  risk,
  className,
  withLabel = true,
}: {
  risk: RiskLevel;
  className?: string;
  withLabel?: boolean;
}) {
  const meta = RISK_META[risk];
  return (
    <span
      title={meta.description}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-semibold",
        meta.text,
        className
      )}
    >
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: meta.colorHex }}
      />
      {withLabel && meta.label}
    </span>
  );
}

/** El estado del participante, tal como está configurado en el drawer. */
export function ParticipanteChip({
  estado,
  className,
}: {
  estado: EstadoParticipanteConfig | null;
  className?: string;
}) {
  if (!estado) return <span className={cn("text-[12px] text-text-muted", className)}>—</span>;
  return (
    <span
      title={
        estado.cuentaEnResultados
          ? estado.descripcion
          : `${estado.descripcion} No entra en promedios ni rankings.`
      }
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border/60 bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-text-secondary",
        !estado.cuentaEnResultados && "opacity-80",
        className
      )}
    >
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: estado.colorHex }}
      />
      {estado.nombre}
      {!estado.cuentaEnResultados && (
        <span className="text-[10px] font-medium text-text-muted">· no cuenta</span>
      )}
    </span>
  );
}

/**
 * "Avance: [78,2 %]" — la métrica de una fila del árbol, en el mismo formato
 * que "Favorabilidad: [77,9 %]" en el reporte de encuestas: rótulo gris y una
 * píldora con el fondo y el texto de su banda de resultado. Una barra al lado
 * de otra barra se leía como una sola; una píldora no se confunde con nada.
 */
export function AvancePill({
  percent,
  estado,
  labeled = true,
  className,
}: {
  percent: number;
  estado: ObjetivoEstadoConfig | null;
  labeled?: boolean;
  className?: string;
}) {
  const badge = estado ? getEstadoBadgeConfig(estado) : null;
  return (
    <span className={cn("flex items-center gap-1.5", className)}>
      {labeled && (
        <span className="text-[11px] font-semibold text-muted-foreground">Avance:</span>
      )}
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums",
          badge?.bg ?? "bg-muted",
          badge?.text ?? "text-text-secondary"
        )}
        title={estado?.nombre}
      >
        {formatPercent(percent)}
      </span>
    </span>
  );
}

/**
 * El avance de un nodo del árbol: barra teñida por su banda de resultado y el
 * número al lado. Es el `renderMetric` por defecto de todo el outline.
 */
export function NodeMetric({
  percent,
  estado,
  className,
}: {
  percent: number;
  estado: ObjetivoEstadoConfig | null;
  className?: string;
}) {
  const badge = estado ? getEstadoBadgeConfig(estado) : null;
  const width = Math.max(0, Math.min(100, percent));
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="relative hidden h-1.5 w-24 overflow-hidden rounded-full bg-border/50 sm:block">
        <span
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out",
            badge?.barBg ?? "bg-primary"
          )}
          style={{ width: `${width}%` }}
        />
      </span>
      <span
        className={cn(
          "w-[52px] shrink-0 text-right text-[12.5px] font-bold tabular-nums",
          badge?.iconColor ?? "text-text-secondary"
        )}
      >
        {formatPercent(percent)}
      </span>
    </div>
  );
}

/**
 * Barra apilada del ciclo de vida de un conjunto de objetivos. Aparece a la
 * derecha de cada nodo del árbol: de un vistazo se ve si una rama está
 * frenada en aprobaciones o si de verdad está atrasada.
 */
export function LifecycleBar({
  counts,
  className,
  width = "w-28",
}: {
  counts: Map<ObjectiveLifecycle, number>;
  className?: string;
  width?: string;
}) {
  const segments = LIFECYCLE_ORDER.map((id) => ({ id, count: counts.get(id) ?? 0 })).filter(
    (segment) => segment.count > 0
  );
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  if (total === 0) return null;
  return (
    /*
     * Segmentos separados por una rendija en vez de una barra continua: al
     * lado del avance —que sí es una barra sólida— una segunda barra maciza
     * se lee como la continuación de la primera. La rendija dice, sin
     * rótulos, que esto se cuenta por partes y aquello se mide de corrido.
     */
    <span
      role="img"
      aria-label={segments
        .map((segment) => `${LIFECYCLE_META[segment.id].label}: ${segment.count}`)
        .join(", ")}
      className={cn("hidden h-2 gap-px md:flex", width, className)}
    >
      {segments.map((segment) => (
        <span
          key={segment.id}
          className="h-full rounded-[2px] transition-[flex-grow] duration-500"
          style={{
            flexGrow: segment.count,
            backgroundColor: LIFECYCLE_META[segment.id].colorHex,
          }}
          title={`${LIFECYCLE_META[segment.id].label}: ${segment.count}`}
        />
      ))}
    </span>
  );
}
