import { cn } from "@/lib/utils";
import { TOTAL_WEIGHT } from "./cicloBuilderTypes";
import type { AssignmentSetSummary } from "./assignmentRows";

/**
 * Las tres marcas que las dos vistas del paso comparten: el peso repartido, si
 * la agrupación está lista, y la etiqueta de "compartida".
 *
 * Van juntas y aquí porque son lo que hace que la lista y el acordeón se lean
 * como la misma pantalla en dos formas, y no como dos tablas que casualmente
 * hablan del mismo dato.
 */

/** El reparto de peso de una agrupación: cuánto lleva de su cupo. */
export function AssignmentWeightMeter({
  weight,
  budget,
  showValidation,
  className,
}: {
  weight: number;
  budget: number;
  /** Fuera de la validación, pasarse todavía no es un error rojo. */
  showValidation?: boolean;
  className?: string;
}) {
  const isExact = weight === budget;
  const isOver = weight > budget;

  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="relative h-1.5 w-[72px] shrink-0 overflow-hidden rounded-full bg-border/60">
        <span
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
            isExact ? "bg-status-positive" : isOver ? "bg-destructive" : "bg-primary"
          )}
          style={{ width: `${Math.min(100, (weight / Math.max(1, budget)) * 100)}%` }}
        />
      </span>
      <span
        className={cn(
          "shrink-0 whitespace-nowrap text-[12px] font-bold tabular-nums",
          isExact
            ? "text-status-positive"
            : isOver || showValidation
              ? "text-destructive"
              : "text-text-secondary"
        )}
      >
        {weight} / {budget} %
      </span>
    </span>
  );
}

/** "Lista", o la primera razón por la que todavía no lo está. */
export function AssignmentStatusPill({
  issue,
  showValidation,
  className,
}: {
  issue: string | null;
  showValidation: boolean;
  className?: string;
}) {
  return (
    <span
      title={issue ?? undefined}
      className={cn(
        "inline-flex max-w-[190px] items-center truncate rounded-full px-2.5 py-1 text-[11.5px] font-bold",
        issue === null
          ? "bg-status-positive/10 text-status-positive"
          : showValidation
            ? "bg-destructive/10 text-destructive"
            : "bg-surface-muted text-text-secondary",
        className
      )}
    >
      {issue ?? "Lista"}
    </span>
  );
}

/** De qué agrupación viene una fila, y con cuántos la comparte. */
export function AssignmentOriginTag({ summary }: { summary: AssignmentSetSummary }) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[12.5px] font-semibold text-text-primary">
        Agrupación {summary.position}
      </span>
      <span className="truncate text-[11px] font-medium text-text-muted">
        {summary.isShared
          ? `Compartida con ${summary.set.targetIds.length - 1} más`
          : summary.set.kind === "grupal"
            ? "Solo para este grupo"
            : "Solo para esta persona"}
        {summary.budget !== TOTAL_WEIGHT && ` · cupo de ${summary.budget} %`}
      </span>
    </span>
  );
}
