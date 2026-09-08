import type { ObjectiveField, RuleViolation } from "@/lib/objectivesImport";

/**
 * Lo que las celdas de la tabla de revisión comparten sin ser componentes: la
 * clase de una celda en reposo, cómo se agrupan las violaciones por campo y
 * cómo se pinta una celda que rompe una regla.
 */

export type ViolationsByField = Partial<Record<ObjectiveField, RuleViolation[]>>;

export function groupViolations(violations: RuleViolation[]): ViolationsByField {
  return violations.reduce<ViolationsByField>((grouped, violation) => {
    const existing = grouped[violation.field] ?? [];
    return { ...grouped, [violation.field]: [...existing, violation] };
  }, {});
}

/** Celda editable en reposo: sin borde ni fondo. Se revela al pasar y se afirma al enfocar. */
export const QUIET_CELL =
  "w-full h-7 px-1.5 rounded-md border border-transparent bg-transparent text-[12px] " +
  "text-text-primary transition-colors hover:border-border/50 hover:bg-surface " +
  "focus:outline-none focus:bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20";

/**
 * Marca para contornear las celdas de peso de un usuario que suma más de 100%.
 * Quedarse corto nunca llega aquí: no es una regla que UBITS rechace. El
 * mensaje se dice una vez por tarjeta, por eso esta marca no lleva texto.
 */
export const WEIGHT_TOTAL_MARK: RuleViolation = {
  rule: "PESO_TOTAL",
  field: "weightPercent",
  message: "",
  severity: "error",
};

/** Una celda que las reglas marcaron conserva su contorno en reposo — esa es la excepción. */
export function fieldStateClass(violations: RuleViolation[] | undefined): string {
  if (!violations || violations.length === 0) return "";
  if (violations.some((violation) => violation.severity === "error")) {
    return "border-status-negative/60 bg-status-negative/5 hover:border-status-negative";
  }
  if (violations.some((violation) => violation.severity === "warning")) {
    return "border-status-warning/60 bg-status-warning/5 hover:border-status-warning";
  }
  return "";
}

/** Un número como lo muestra la tabla; el guion largo hace de "no hay". */
export function formatValue(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return String(value);
}
