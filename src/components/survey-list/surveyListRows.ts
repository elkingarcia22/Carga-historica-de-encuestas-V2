/**
 * Qué es una fila de la lista de encuestas y cómo se ordena.
 *
 * Vive aparte de la tabla porque el archivo de columnas también lo necesita, y
 * dos módulos que se importan entre sí para compartir un tipo acaban en un
 * ciclo que solo se nota cuando algo sale `undefined` en producción.
 */

/** One row of the list. Shaped by the mocks, so the fields stay loose. */
export interface SurveyListRow {
  id: string;
  name: string;
  type: string;
  status: string;
  statusVariant?: string;
  startDate: string;
  endDate: string;
  participants: string | number;
  progress: number;
}

export type SurveySortKey =
  | "name"
  | "type"
  | "status"
  | "startDate"
  | "endDate"
  | "participants"
  | "progress";

/** Default table order: drafts need attention first, then what's running, then what's done. */
const STATUS_ORDER: Readonly<Record<string, number>> = {
  Borrador: 0,
  "Por iniciar": 1,
  "En curso": 2,
  Finalizado: 3,
};

export function statusOrder(status: string): number {
  return STATUS_ORDER[status] ?? STATUS_ORDER.Finalizado + 1;
}

/** Same tone mapping the list has always used for a survey's lifecycle. */
export function statusVariant(
  survey: SurveyListRow
): "info" | "positive" | "warning" | "neutral" {
  switch (survey.statusVariant) {
    case "info":
      return "info";
    case "positive":
      return "positive";
    case "warning":
      return "warning";
    default:
      return "neutral";
  }
}

export function mapVariantToState(
  variant: "info" | "positive" | "warning" | "neutral"
): "success" | "pending" | "failed" {
  if (variant === "positive") return "success";
  // Ni `info` ni `neutral` tienen tono propio en `StatusBadge` todavía, así que
  // caen en el intermedio en vez de inventarse un estado.
  return "pending";
}

export function participantsValue(raw: string | number): number {
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 0;
}
