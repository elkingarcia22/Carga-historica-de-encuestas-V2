import {
  BarChart3,
  CalendarClock,
  CircleCheckBig,
  Copy,
  Pencil,
  Share2,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Every action a single selected ciclo can offer, across all estados. */
export type CicloActionId =
  | "results"
  | "edit"
  | "duplicate"
  | "finish"
  | "editDates"
  | "editParticipants"
  | "share"
  | "delete";

export interface CicloActionSpec {
  label: string;
  icon: LucideIcon;
  tone?: "default" | "danger";
}

export const CICLO_ACTIONS: Readonly<Record<CicloActionId, CicloActionSpec>> = {
  results: { label: "Ver resultados", icon: BarChart3 },
  edit: { label: "Editar ciclo", icon: Pencil },
  duplicate: { label: "Duplicar ciclo", icon: Copy },
  finish: { label: "Finalizar ciclo", icon: CircleCheckBig },
  editDates: { label: "Editar fechas", icon: CalendarClock },
  editParticipants: { label: "Editar participantes", icon: Users },
  share: { label: "Compartir", icon: Share2 },
  delete: { label: "Eliminar ciclo", icon: Trash2, tone: "danger" },
};

/**
 * What each estado offers, in the order it is offered — mirrors
 * `surveyListActions`'s per-status split: a ciclo that has not started yet
 * has no results to show, and one already finalizado has nothing left to
 * edit or finish.
 */
export const CICLO_ACTIONS_BY_ESTADO: Readonly<Record<string, readonly CicloActionId[]>> = {
  Borrador: ["edit", "duplicate", "delete"],
  "Por iniciar": ["edit", "duplicate", "editDates", "editParticipants", "share", "delete"],
  "En curso": [
    "results",
    "edit",
    "duplicate",
    "finish",
    "editDates",
    "editParticipants",
    "share",
    "delete",
  ],
  Finalizado: ["results", "duplicate", "delete"],
};

/**
 * How many actions stay as icons on the bar before the rest fold into "Más
 * acciones". Five is what a reader can still tell apart at a glance; past that
 * an icon row turns into a puzzle solved one tooltip at a time.
 */
export const INLINE_ACTION_LIMIT = 5;

/** The actions for an estado, split into what the bar shows and what folds away. */
export function splitCicloActions(estado: string): {
  inline: readonly CicloActionId[];
  overflow: readonly CicloActionId[];
} {
  const all = CICLO_ACTIONS_BY_ESTADO[estado] ?? [];
  // One lone action in the menu is a worse trade than a sixth icon: the menu
  // costs a click and a label to say what an icon already said.
  if (all.length <= INLINE_ACTION_LIMIT + 1) return { inline: all, overflow: [] };
  return {
    inline: all.slice(0, INLINE_ACTION_LIMIT),
    overflow: all.slice(INLINE_ACTION_LIMIT),
  };
}
