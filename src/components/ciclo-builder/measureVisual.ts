import {
  Building2,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CheckCheck,
  DollarSign,
  Hash,
  Percent,
  Settings2,
  TrendingDown,
  TrendingUp,
  UserCog,
  UsersRound,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { toneForIndex, type Tone } from "@/lib/tone";
import type { CicloObjectiveCreator, CicloPeriod, MeasureType, ObjectiveDirection } from "./cicloBuilderTypes";

/**
 * One icon and one tone per choice the objective editor offers — the single
 * place that decides what "Dinero" looks like.
 *
 * Same idea as the survey builder's `KIND_VISUAL`: a decision the author makes
 * over and over gets a mark of its own, so a card is recognizable by shape and
 * color before it is read. What is *not* here is a hue for every option in the
 * product — a period is a period, and six of them in six colors would be
 * noise, so those share one accent (see `PERIOD_VISUAL`).
 */
export interface OptionVisual {
  icon: LucideIcon;
  tone: Tone;
}

/**
 * Just the icon, no tone — for a set of options where the choice itself
 * matters but painting each one a different hue would be noise.
 * `ObjectiveOptionCard` reads the missing tone as "fall back to a plain
 * gray/brand look" rather than an accent of its own.
 */
export type UntonedOptionVisual = Pick<OptionVisual, "icon">;

/**
 * How the result is expressed. Money takes the positive green it already wears
 * everywhere it appears as a figure, a percentage takes brand blue, a plain
 * count takes the indigo that means "no status of its own", and a milestone
 * that is either met or not takes the warning amber — it is the one measure
 * with no middle ground.
 */
export const MEASURE_VISUAL: Readonly<Record<MeasureType, OptionVisual>> = {
  money: { icon: DollarSign, tone: "positive" },
  percentage: { icon: Percent, tone: "brand" },
  numeric: { icon: Hash, tone: "neutral" },
  boolean: { icon: CheckCheck, tone: "warning" },
};

/**
 * Which way the number has to move. Both take brand blue on purpose: raising
 * revenue and cutting churn are two equally valid objectives, not a
 * good/bad pair, and painting "Reducir" red would say otherwise — the same
 * reasoning the survey builder applies to its two visibility choices.
 */
export const DIRECTION_VISUAL: Readonly<Record<ObjectiveDirection, UntonedOptionVisual>> = {
  increase: { icon: TrendingUp },
  decrease: { icon: TrendingDown },
};

/**
 * Who writes the objectives. No tone here on purpose: the three aren't
 * different *kinds* of thing the way a measure or a period are — they are
 * one plain either/or/or, so an accent per option would invent a status
 * distinction that isn't there. The picked one still reads clearly; it just
 * does it in brand blue, like the rest of the product's plain choices.
 */
export const OBJECTIVE_CREATOR_VISUAL: Readonly<Record<CicloObjectiveCreator, UntonedOptionVisual>> = {
  leader: { icon: UserCog },
  collaborator: { icon: UsersRound },
  hr: { icon: Building2 },
  custom: { icon: SlidersHorizontal },
};

/**
 * How long the ciclo runs, in the order the row shows them.
 *
 * A period carries no meaning of its own — "Trimestre" isn't inherently
 * warmer than "Semestre" — so like the survey builder's own theme chips
 * ("un tema no tiene color propio, así que lo toma de su posición"), each one
 * takes its accent from where it sits in the row rather than from a fixed
 * per-option map. That still reads as a real set of options, not a wall of
 * gray text, without inventing meaning that isn't there.
 */
export const PERIOD_ORDER: readonly CicloPeriod[] = [
  "mes",
  "bimestre",
  "trimestre",
  "semestre",
  "anio",
  "personalizado",
];

const PERIOD_ICONS: Readonly<Record<CicloPeriod, LucideIcon>> = {
  mes: CalendarDays,
  bimestre: CalendarDays,
  trimestre: CalendarRange,
  semestre: CalendarRange,
  anio: CalendarClock,
  personalizado: Settings2,
};

export const PERIOD_VISUAL: Readonly<Record<CicloPeriod, OptionVisual>> = Object.fromEntries(
  PERIOD_ORDER.map((period, index) => [
    period,
    { icon: PERIOD_ICONS[period], tone: toneForIndex(index) },
  ])
) as Readonly<Record<CicloPeriod, OptionVisual>>;

/**
 * The fronts the AI brief offers ("¿en qué frentes?").
 *
 * These are real categories, not a list of interchangeable items, so each one
 * takes an accent it can be recognized by — the same thing the survey builder
 * does with its survey kinds. Growth is the core business (brand), profit is
 * money (positive green), customers ask for care (warning amber), people and
 * operations are the two that carry no status of their own (indigo), and
 * product/innovation takes the AI gradient it shares with everything
 * forward-looking in the product.
 */
export const FOCUS_TONE: Readonly<Record<string, Tone>> = {
  crecimiento: "brand",
  rentabilidad: "positive",
  clientes: "warning",
  personas: "neutral",
  operacion: "neutral",
  producto: "ai",
};

/**
 * How ambitious the targets should be. A ramp rather than a palette: safe
 * green, a challenging brand blue, then the amber that says "this one will
 * hurt if it slips" — so the three read as increasing exposure, which is
 * exactly the decision being made.
 */
export const AMBITION_TONE: Readonly<Record<string, Tone>> = {
  conservador: "positive",
  retador: "brand",
  agresivo: "warning",
};
