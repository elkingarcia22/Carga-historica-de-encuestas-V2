/**
 * El ciclo de vida de un objetivo.
 *
 * Es un eje distinto de las bandas de cumplimiento que se configuran en el
 * drawer ("Estados de los objetivos"). Los cuatro primeros estados de esta
 * máquina son los que ese drawer muestra quemados.
 * Aquellos son *bandas de resultado* —cuánto cumplió— y se leen sobre todo al
 * cierre; este es la máquina de estados por la que pasa un objetivo antes y
 * durante el ciclo, y no es configurable porque no es una opinión de la
 * empresa: es cómo funciona el flujo.
 *
 *   Por aprobar ──(el líder pide cambios)──▶ Por ajustar ──┐
 *        │                                                 │
 *        └──(el líder aprueba)──▶ Por iniciar ◀────(se reenvía y aprueba)
 *                                     │
 *                          (primer valor reportado)
 *                                     ▼
 *                                En progreso ──(llega al 100 %)──▶ Completado
 *
 * Un objetivo en "Por aprobar" o "Por ajustar" todavía no es un compromiso:
 * no suma avance ni penaliza a nadie. Por eso las dos cuentan aparte en el
 * resumen, como trabajo pendiente del líder y no como mal desempeño.
 */

import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Loader,
  PenLine,
  type LucideIcon,
} from "lucide-react";
import type { ObjectiveApproval, TrackedObjective } from "@/components/ciclo-detail";

export type ObjectiveLifecycle =
  | "por-aprobar"
  | "por-ajustar"
  | "por-iniciar"
  | "en-progreso"
  | "completado";

export interface LifecycleMeta {
  id: ObjectiveLifecycle;
  label: string;
  /** Qué significa, en la voz de quien lo va a leer. */
  description: string;
  colorHex: string;
  Icon: LucideIcon;
  /** Clases de la píldora: fondo, texto, borde. */
  bg: string;
  text: string;
  border: string;
  /** Color de la barra cuando este estado la pinta. */
  barBg: string;
  /**
   * El objetivo ya está en juego: aprobado y contando. Los dos estados
   * anteriores al arranque son `false`, y de ahí sale la cuenta de "objetivos
   * que todavía no arrancan" sin listar ids a mano.
   */
  isCommitted: boolean;
}

/** En el orden en que un objetivo los recorre. */
export const LIFECYCLE_ORDER: readonly ObjectiveLifecycle[] = [
  "por-aprobar",
  "por-ajustar",
  "por-iniciar",
  "en-progreso",
  "completado",
];

export const LIFECYCLE_META: Readonly<Record<ObjectiveLifecycle, LifecycleMeta>> = {
  "por-aprobar": {
    id: "por-aprobar",
    label: "Por aprobar",
    description: "Escrito y enviado. Espera el visto bueno del líder para poder arrancar.",
    colorHex: "#A78BFA",
    Icon: CircleDashed,
    bg: "bg-violet-100/60 dark:bg-violet-500/15",
    text: "text-violet-800 dark:text-violet-300",
    border: "border-violet-200/60 dark:border-violet-700/40",
    barBg: "bg-violet-400",
    isCommitted: false,
  },
  "por-ajustar": {
    id: "por-ajustar",
    label: "Por ajustar",
    description: "El líder pidió cambios. Vuelve a quien lo escribió y no arranca hasta reenviarlo.",
    colorHex: "#FDBA74",
    Icon: PenLine,
    bg: "bg-orange-100/60 dark:bg-orange-500/15",
    text: "text-orange-800 dark:text-orange-300",
    border: "border-orange-200/60 dark:border-orange-700/40",
    barBg: "bg-orange-400",
    isCommitted: false,
  },
  "por-iniciar": {
    id: "por-iniciar",
    label: "Por iniciar",
    description: "Aprobado, pero todavía sin ningún avance reportado.",
    colorHex: "#CBD5E1",
    Icon: AlertTriangle,
    bg: "bg-slate-100/80 dark:bg-slate-800/40",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-200/60 dark:border-slate-700/50",
    barBg: "bg-slate-300 dark:bg-slate-600",
    isCommitted: true,
  },
  "en-progreso": {
    id: "en-progreso",
    label: "En progreso",
    description: "Tiene avance reportado y aún no llega a la meta.",
    colorHex: "#FCD34D",
    Icon: Loader,
    bg: "bg-amber-100/60 dark:bg-amber-500/15",
    text: "text-amber-800 dark:text-amber-300",
    border: "border-amber-200/60 dark:border-amber-700/40",
    barBg: "bg-amber-400",
    isCommitted: true,
  },
  completado: {
    id: "completado",
    label: "Completado",
    description: "Alcanzó el 100 % de la meta o la superó.",
    colorHex: "#22C55E",
    Icon: CheckCircle2,
    bg: "bg-green-100/60 dark:bg-green-500/15",
    text: "text-green-800 dark:text-green-300",
    border: "border-green-200/60 dark:border-green-700/40",
    barBg: "bg-green-600",
    isCommitted: true,
  },
};

/**
 * La aprobación de un objetivo. Un objetivo sin revisión se lee como aprobado:
 * los ciclos creados antes del flujo de aprobación ya estaban corriendo, y
 * mostrarlos de golpe como "Por aprobar" sería inventar un bloqueo que nunca
 * existió.
 */
export const approvalOf = (tracked: TrackedObjective): ObjectiveApproval =>
  tracked.review?.status ?? "aprobado";

/**
 * En qué punto del flujo está un objetivo. `percent` es su cumplimiento ya
 * calculado y `hasProgress` si alguien reportó algo — los dos vienen de
 * `cicloProgress`, para que esta función no vuelva a calcular lo mismo con
 * otras reglas.
 */
export function lifecycleOf(
  tracked: TrackedObjective,
  percent: number,
  hasProgress: boolean
): ObjectiveLifecycle {
  const approval = approvalOf(tracked);
  if (approval === "pendiente") return "por-aprobar";
  if (approval === "ajustes") return "por-ajustar";
  if (!hasProgress) return "por-iniciar";
  return percent >= 100 ? "completado" : "en-progreso";
}

// ── El eje de la aprobación ────────────────────────────────────────────────

/**
 * El flujo del objetivo visto solo como "¿ya arrancó?".
 *
 * Es un corte del ciclo de vida, no un estado nuevo: las tres primeras etapas
 * responden a la revisión del líder y las tres últimas al avance. Mezclarlas
 * en un solo gráfico escondía la pregunta que de verdad bloquea el ciclo
 * —cuántos objetivos siguen sin permiso para empezar— entre cinco tramos que
 * hablan de otra cosa.
 */
export type ApprovalState = "aprobado" | "por-aprobar" | "denegado";

export interface ApprovalMeta {
  id: ApprovalState;
  label: string;
  description: string;
  colorHex: string;
}

export const APPROVAL_ORDER: readonly ApprovalState[] = ["aprobado", "por-aprobar", "denegado"];

export const APPROVAL_META: Readonly<Record<ApprovalState, ApprovalMeta>> = {
  aprobado: {
    id: "aprobado",
    label: "Aprobados",
    description: "Con el visto bueno del líder. Son los únicos que suman avance.",
    colorHex: "#22C55E",
  },
  "por-aprobar": {
    id: "por-aprobar",
    label: "Por aprobar",
    description: LIFECYCLE_META["por-aprobar"].description,
    colorHex: LIFECYCLE_META["por-aprobar"].colorHex,
  },
  denegado: {
    id: "denegado",
    // "Denegado" es el nombre que le da la configuración de estados fijos;
    // el ciclo de vida lo llama "Por ajustar" porque describe lo que le toca
    // hacer a quien lo escribió. Aquí manda el nombre de la configuración.
    label: "Denegados",
    description: LIFECYCLE_META["por-ajustar"].description,
    colorHex: LIFECYCLE_META["por-ajustar"].colorHex,
  },
};

/** El tramo de aprobación al que pertenece una etapa del ciclo de vida. */
export function approvalStateOf(lifecycle: ObjectiveLifecycle): ApprovalState {
  if (lifecycle === "por-aprobar") return "por-aprobar";
  if (lifecycle === "por-ajustar") return "denegado";
  return "aprobado";
}

/**
 * Qué significa "editar" para un objetivo puntual, si es que significa algo.
 *
 * Un objetivo inactivo no se corrige: no está en juego, así que primero hay
 * que activarlo. Uno devuelto por su líder sí se corrige, pero corregirlo es
 * justo lo que lo destraba, así que guardar también lo reenvía. El resto se
 * edita y ya.
 *
 * Vive aquí —y no en la barra o en la tabla— porque las dos tienen que abrir
 * la misma edición: si cada una decidiera por su cuenta, el lápiz de la fila y
 * el de la barra acabarían haciendo cosas distintas sobre el mismo objetivo.
 */
export function editIntentOf(entry: {
  lifecycle: ObjectiveLifecycle;
  inactivation: unknown;
}): "editar" | "ajustar" | null {
  if (entry.inactivation) return null;
  return entry.lifecycle === "por-ajustar" ? "ajustar" : "editar";
}

/** Cuenta por estado, siempre con las cinco llaves aunque alguna vaya en cero. */
export function countLifecycles(
  values: readonly ObjectiveLifecycle[]
): Map<ObjectiveLifecycle, number> {
  const counts = new Map<ObjectiveLifecycle, number>(
    LIFECYCLE_ORDER.map((id) => [id, 0])
  );
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return counts;
}
