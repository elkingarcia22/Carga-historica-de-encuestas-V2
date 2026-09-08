/**
 * Lo que una carga es una vez sale de la revisión: una tarea de fondo con sus
 * filas, y el vocabulario con que el drawer, la pestaña "Cargas" y el widget
 * flotante la describen.
 */

import { countObjectives, isObjectiveValid, type DetectedObjectivesAnalysis } from "@/lib/objectivesImport";

/**
 * Estados de una fila dentro de una carga.
 *
 *  - `pending` / `uploaded` / `failed`: la escritura, tal como la respondió la
 *    plataforma (o no llegó a responder).
 *  - `unassigned` / `analysis_error`: filas que la revisión no dejó pasar. Van
 *    en la tarea para que "retomar" las encuentre, pero la barra no las cuenta.
 */
export type UploadRowStatus = "pending" | "uploaded" | "failed" | "unassigned" | "analysis_error";

export interface UploadRowResult {
  id: string;
  title: string;
  userName: string;
  userEmail?: string;
  userArea?: string;
  userLeader?: string;
  description?: string;
  weightPercent?: number;
  measureType?: string;
  trend?: string;
  initialValue?: number | null;
  target?: number;
  minProgress?: number | null;
  maxProgress?: number | null;
  newProgress?: number | null;
  status: UploadRowStatus;
  analysisError?: string;
  /** Decidido al arrancar la carga, no fila a fila: el mismo archivo falla igual siempre. */
  willFail: boolean;
}

export interface UploadTaskState {
  id: string;
  name: string;
  status: "loading" | "completed";
  rows: UploadRowResult[];
  /**
   * La carga se cayó entera, no perdió algunas filas.
   *
   * Son dos noticias distintas: un puñado de rechazos es la plataforma
   * diciendo no a objetivos concretos (nada que reintentar); un servicio caído
   * no rechazó nada, y lo único sensato es volver a intentarlo. Solo este caso
   * ofrece "Reintentar".
   */
  serviceFailed?: boolean;
}

export interface RecentUpload {
  id: string;
  name: string;
  loadedAt: string;
  objectivesCount: number;
  failedCount: number;
}

/** Cargas de los últimos 7 días — el historial de la pestaña "Cargas". */
export const RECENT_UPLOADS: readonly RecentUpload[] = [
  { id: "ru-1", name: "Objetivos Comercial Q3.xlsx", loadedAt: "Hoy, 09:14", objectivesCount: 42, failedCount: 0 },
  { id: "ru-2", name: "Metas Tecnología 2026.xlsx", loadedAt: "Ayer, 16:40", objectivesCount: 28, failedCount: 0 },
  { id: "ru-3", name: "Objetivos People marzo.csv", loadedAt: "Hace 3 días", objectivesCount: 17, failedCount: 0 },
  { id: "ru-4", name: "Carga inicial Operaciones.xlsx", loadedAt: "Hace 5 días", objectivesCount: 63, failedCount: 0 },
];

/** Un objetivo por tick. Lento a propósito: una carga cuyos fallos pasan en dos segundos no la lee nadie. */
export const UPLOAD_TICK_MS = 900;

/** Ritmo del análisis: ~5 s hasta llenar la barra y medio segundo en 100 %. */
export const ANALYSIS_TICK_MS = 150;
export const ANALYSIS_STEP = 3;
export const ANALYSIS_HOLD_MS = 550;

/** Filas que no llegaron a UBITS y que "retomar" vuelve a poner en revisión. */
export function isPendingRow(row: UploadRowResult): boolean {
  return row.status === "failed" || row.status === "analysis_error" || row.status === "unassigned";
}

/** Qué filas rechaza la plataforma. Posiciones fijas, no un dado por fila. */
export function failureFor(index: number): boolean {
  return index % 13 === 6 || index % 7 === 4 || index % 11 === 9;
}

/** Filas ya respondidas sobre el total que sí se escribe. Mueve todas las barras. */
export function taskProgress(task: UploadTaskState): number {
  const uploadable = task.rows.filter(
    (row) => row.status !== "unassigned" && row.status !== "analysis_error"
  );
  if (uploadable.length === 0) return 100;
  const done = uploadable.filter((row) => row.status !== "pending").length;
  return Math.round((done / uploadable.length) * 100);
}

export function countByStatus(task: UploadTaskState, status: UploadRowStatus): number {
  return task.rows.filter((row) => row.status === status).length;
}

export function countPending(task: UploadTaskState): number {
  return task.rows.filter(isPendingRow).length;
}

/** Lo que el análisis encontró de verdad, para la segunda mitad de la narración. */
export interface AnalysisFindings {
  sheetName?: string;
  objectives: number;
  users: number;
  /** Resueltos de una por username o correo corporativo. */
  matched: number;
  /** Resueltos por nombre, documento o teléfono — alguien tiene que confirmar. */
  proposed: number;
  /** Identificadores para los que UBITS no tiene a nadie. */
  unmatched: number;
  /** Objetivos con datos que rompen una regla, entre los usuarios que tienen dueño. */
  invalid: number;
}

export function summarizeFindings(result: DetectedObjectivesAnalysis): AnalysisFindings {
  return {
    sheetName: result.sheetName,
    objectives: countObjectives(result.groups),
    users: result.groups.length,
    matched: result.groups.filter((group) => group.matchStatus === "matched").length,
    proposed: result.groups.filter((group) => group.matchStatus === "possible").length,
    unmatched: result.groups.filter((group) => group.matchStatus === "unmatched").length,
    invalid: result.groups
      .filter((group) => group.matchStatus !== "unmatched")
      .flatMap((group) => group.objectives)
      .filter((objective) => !isObjectiveValid(objective)).length,
  };
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Qué dice el panel de análisis, etapa por etapa.
 *
 * Las dos primeras líneas se escriben a ciegas: hasta abrir el archivo no hay
 * nada cierto que decir. De ahí en adelante cada línea reporta un número que la
 * revisión va a mostrar un segundo después, que es lo que hace que la espera se
 * lea como trabajo hecho y no como un spinner con subtítulos.
 */
export function getAnalyzingCopy(
  progress: number,
  filesCount: number,
  findings: AnalysisFindings | null
): string {
  if (progress < 16) return `Abriendo ${plural(filesCount, "archivo", "archivos")}…`;

  if (progress < 34) {
    return findings?.sheetName
      ? `Leyendo la hoja "${findings.sheetName}"…`
      : "Leyendo la estructura del archivo…";
  }

  if (progress < 54) {
    if (!findings) return "Identificando objetivos y usuarios…";
    return `${plural(findings.objectives, "objetivo", "objetivos")} en ${plural(findings.users, "usuario", "usuarios")}`;
  }

  if (progress < 74) {
    if (!findings) return "Alineando los usuarios con UBITS…";
    if (findings.unmatched > 0) {
      return `${plural(findings.unmatched, "identificador sin usuario", "identificadores sin usuario")} en UBITS`;
    }
    if (findings.proposed > 0) {
      return plural(findings.proposed, "usuario por confirmar", "usuarios por confirmar");
    }
    return `${plural(findings.matched, "usuario alineado", "usuarios alineados")} por username o correo`;
  }

  if (progress < 92) {
    if (!findings) return "Validando pesos, metas y direcciones…";
    return findings.invalid > 0
      ? plural(findings.invalid, "objetivo con datos por corregir", "objetivos con datos por corregir")
      : "Pesos, metas y direcciones sin errores";
  }

  if (progress < 100) return "Ordenando el resultado…";
  return "Análisis completo";
}
