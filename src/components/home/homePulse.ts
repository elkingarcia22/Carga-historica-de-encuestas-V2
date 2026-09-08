import {
  buildCicloDetail,
  buildPersonRows,
  objectiveCompliance,
  parseSpanishDate,
  summarize,
  type CicloListRow,
  type ProgressConfig,
} from "@/components/ciclo-detail";
import {
  CLOSED_ESTADO,
  OPEN_ESTADO,
  type CicloFilterableRow,
} from "@/components/ciclo-list/cicloListFilters";

/**
 * The home's three averaged readings — avance, objetivos cumplidos and
 * personas que ya reportaron — over every ciclo that has actually started.
 *
 * Each ciclo is read through the very same `buildCicloDetail` + `summarize`
 * the ciclo tracking screen runs, so the average here and the number someone
 * sees after clicking a row come from one source. A ciclo still "Por iniciar"
 * has nothing to average yet, so it is left out rather than dragging the mean
 * to zero.
 */

/** Estados of a ciclo whose window has opened — the only ones with progress. */
const LAUNCHED_ESTADOS: readonly string[] = [OPEN_ESTADO, CLOSED_ESTADO];

export const isLaunched = (ciclo: Pick<CicloListRow, "estado">): boolean =>
  LAUNCHED_ESTADOS.includes(ciclo.estado);

export interface PulseMetric {
  /** Mean over the recent cohort; null when nothing could be averaged. */
  value: number | null;
  /** Mean over the earlier cohort — the delta's baseline. */
  previous: number | null;
  /** How many ciclos the mean is over. */
  count: number;
}

/** One point of the sparkline: a launched ciclo, in close-date order. */
export interface PulsePoint {
  id: string;
  name: string;
  value: number;
}

export interface HomePulse {
  /** Mean compliance of everyone in the ciclo. */
  avance: PulseMetric;
  /** Share of assigned objectives already at 100 % or above. */
  cumplimiento: PulseMetric & {
    /** Oldest first, so the line reads left to right like a timeline. */
    series: readonly PulsePoint[];
  };
  /** Share of people in the ciclo who have reported at least one value. */
  reporte: PulseMetric;
}

/** How many measurements the sparkline reaches back over. */
const SERIES_DEPTH = 10;

/** The avance a running ciclo is expected to reach — the sparkline's guide. */
export const AVANCE_TARGET = 80;

const mean = (values: readonly number[]): number | null =>
  values.length === 0
    ? null
    : Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;

const share = (part: number, whole: number): number => (whole === 0 ? 0 : (part / whole) * 100);

/** What one ciclo contributes to each of the three readings. */
interface CicloReading {
  id: string;
  name: string;
  /** When the ciclo closes — what orders the cohorts and the sparkline. */
  when: number;
  avance: number;
  cumplimiento: number;
  reporte: number;
}

function readCiclo(row: CicloListRow, config: ProgressConfig): CicloReading {
  const data = buildCicloDetail(row);
  const rows = buildPersonRows(data, config);
  const stats = summarize(data, rows, config);
  const tracked = rows.flatMap((person) => person.person.objectives);
  const achieved = tracked.filter(
    (item) => objectiveCompliance(item, config.allowNegative) >= 100
  ).length;

  return {
    id: row.id,
    name: row.nombre,
    when: new Date(`${parseSpanishDate(row.fechaCierre)}T00:00:00`).getTime(),
    avance: Math.round(stats.overallPercent * 10) / 10,
    cumplimiento: share(achieved, tracked.length),
    reporte: share(stats.peopleWithProgress, stats.peopleCount),
  };
}

/**
 * Splits the launched ciclos in two by close date and averages each half: the
 * more recent one is the reading, the earlier one is what it is compared to.
 *
 * A ciclo carries no "previous measurement" of its own the way a survey does —
 * it is one window that happens once — so the only honest baseline the list
 * itself holds is the ciclos that closed before this batch. Hence the delta
 * reads "vs ciclos anteriores" rather than "vs medición anterior".
 */
function cohorts<K extends "avance" | "cumplimiento" | "reporte">(
  readings: readonly CicloReading[],
  key: K
): PulseMetric {
  if (readings.length === 0) return { value: null, previous: null, count: 0 };
  // Newest first, so the recent half is simply the front of the list.
  const sorted = [...readings].sort((a, b) => b.when - a.when);
  const split = Math.ceil(sorted.length / 2);
  const recent = sorted.slice(0, split);
  const earlier = sorted.slice(split);
  return {
    value: mean(recent.map((reading) => reading[key])),
    previous: mean(earlier.map((reading) => reading[key])),
    count: recent.length,
  };
}

export function buildHomePulse(
  ciclos: readonly CicloListRow[],
  config: ProgressConfig
): HomePulse {
  const readings = ciclos.filter(isLaunched).map((ciclo) => readCiclo(ciclo, config));

  const series: PulsePoint[] = [...readings]
    .sort((a, b) => a.when - b.when)
    .slice(-SERIES_DEPTH)
    .map(({ id, name, cumplimiento }) => ({
      id,
      name,
      value: Math.round(cumplimiento * 10) / 10,
    }));

  return {
    avance: cohorts(readings, "avance"),
    cumplimiento: { ...cohorts(readings, "cumplimiento"), series },
    reporte: cohorts(readings, "reporte"),
  };
}

/** "1 ciclo" / "12 ciclos" — the caption under each averaged value. */
export const formatCicloCount = (count: number): string =>
  `${count.toLocaleString("es-CO")} ${count === 1 ? "ciclo" : "ciclos"}`;

/** How many ciclos of a list have already started. */
export const countLaunched = (ciclos: readonly CicloFilterableRow[]): number =>
  ciclos.filter((ciclo) => LAUNCHED_ESTADOS.includes(ciclo.estado)).length;
