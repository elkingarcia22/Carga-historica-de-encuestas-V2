import { average } from "@/components/ciclo-detail";
import {
  UNALIGNED_OBJECTIVE,
  type CicloResults,
  type PersonResultRow,
  type ResultEntry,
} from "./resultsModel";
import type { FilterKey } from "./useResultsFilters";
import {
  GAP_WORTH_TELLING,
  MIN_CUT_SIZE,
  STRENGTH_WORTH_TELLING,
  confidenceForSample,
  groupRows,
  pct,
  plural,
  weightOf,
  type Bucket,
  type FocusRow,
  type GapCut,
  type GapGroup,
  type GovernanceReading,
  type StrengthRow,
} from "./cicloInsightTypes";

/**
 * Los cuatro bloques propios del ciclo: dónde está el peso, qué lo sostiene,
 * por dónde se abre la diferencia entre equipos y cómo se está llevando el
 * ciclo como proceso. Todos son puros —entra el agregado, salen filas— y
 * ninguno vuelve a calcular un porcentaje que `resultsModel` ya calculó.
 */

/**
 * Los focos ordenados por lo que ponen en juego, no por lo mal que van.
 *
 * Un área de tres personas al 10 % y una de sesenta al 45 % no compiten por la
 * misma atención, y un ranking por porcentaje pone primera a la de tres. Lo
 * que decide el orden es el peso del ciclo que cada foco carga multiplicado
 * por lo que arrastra: los puntos de atraso, más el peso propio que todavía
 * no se ha movido. Eso es exactamente lo que se pierde si nadie hace nada.
 *
 * Un ciclo que va por delante del calendario no deja el bloque vacío: ahí el
 * atraso es cero pero el peso quieto no, y «el 40 % de lo que carga Tecnología
 * no ha arrancado» sigue siendo la pregunta que hay que hacerle a Tecnología.
 */
export function buildFocus(
  scored: readonly PersonResultRow[],
  reference: number,
  isClosed: boolean
): FocusRow[] {
  const totalWeight = scored.reduce((sum, row) => sum + weightOf(row.entries).total, 0);
  if (totalWeight === 0) return [];

  return groupRows(scored, (row) => row.area)
    .filter((bucket) => bucket.rows.length >= MIN_CUT_SIZE)
    .map((bucket) => {
      const bucketEntries = bucket.rows.flatMap((row) => [...row.entries]);
      const weight = weightOf(bucketEntries);
      const percent = average(bucket.rows.map((row) => row.percent));
      const gap = Math.round(reference - percent);
      const weightShare = pct(weight.total, totalWeight);
      const stalledShare = pct(weight.stalled, weight.total);
      const exposure = (weightShare * (Math.max(gap, 0) + stalledShare)) / 100;

      return {
        id: bucket.label,
        label: bucket.label,
        sublabel: `${bucket.rows.length} ${plural(bucket.rows.length, "persona", "personas")} · ${bucketEntries.length} ${plural(bucketEntries.length, "objetivo", "objetivos")}`,
        people: bucket.rows.length,
        objectives: bucketEntries.length,
        weightShare,
        percent,
        gap,
        stalledShare,
        severity: (gap >= 25 || stalledShare >= 40
          ? "alta"
          : gap >= 12 || stalledShare >= 25
            ? "media"
            : "baja") as FocusRow["severity"],
        confidence: confidenceForSample(bucket.rows.length),
        filterValue: bucket.label,
        exposure,
      };
    })
    .filter((row) => row.gap > (isClosed ? GAP_WORTH_TELLING : 0) || row.stalledShare >= 15)
    .sort((a, b) => b.exposure - a.exposure)
    .slice(0, 6)
    .map(({ exposure: _exposure, ...row }) => row);
}

// ── Bloque: lo que sostiene el ciclo ───────────────────────────────────────

export function buildStrengths(
  results: CicloResults,
  scored: readonly PersonResultRow[]
): StrengthRow[] {
  const cuts: { key: FilterKey; pick: (row: PersonResultRow) => string; noun: string }[] = [
    { key: "areas", pick: (row) => row.area, noun: "Área" },
    { key: "leaders", pick: (row) => row.leader, noun: "Líder" },
  ];

  const found = cuts.flatMap(({ key, pick, noun }) =>
    groupRows(scored, pick)
      .filter((bucket) => bucket.rows.length >= MIN_CUT_SIZE)
      .map((bucket) => {
        const percent = average(bucket.rows.map((row) => row.percent));
        return {
          id: `${key}:${bucket.label}`,
          label: bucket.label,
          sublabel: `${noun} · ${bucket.rows.length} ${plural(bucket.rows.length, "persona", "personas")}`,
          people: bucket.rows.length,
          percent,
          delta: Math.round(percent - results.overallPercent),
          confidence: confidenceForSample(bucket.rows.length),
          filterKey: key,
          filterValue: bucket.label,
        };
      })
  );

  return found
    .filter((row) => row.delta >= STRENGTH_WORTH_TELLING)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 5);
}

// ── Bloque: brechas entre equipos ──────────────────────────────────────────

function buildCut(
  id: string,
  key: FilterKey,
  label: string,
  pluralLabel: string,
  unit: GapCut["unit"],
  buckets: readonly Bucket[]
): GapCut | null {
  const covered = buckets.filter((bucket) => bucket.rows.length >= MIN_CUT_SIZE);
  const omitted = buckets
    .filter((bucket) => bucket.rows.length < MIN_CUT_SIZE)
    .map((bucket) => ({ label: bucket.label, size: bucket.rows.length }));

  if (covered.length < 2) return null;

  const groups: GapGroup[] = covered
    .map((bucket) => ({
      label: bucket.label,
      percent: average(bucket.rows.map((row) => row.percent)),
      size: bucket.rows.length,
      diff: 0,
    }))
    .sort((a, b) => a.percent - b.percent);

  const cutAverage = average(groups.map((group) => group.percent));
  const withDiff = groups.map((group) => ({
    ...group,
    diff: Math.round((group.percent - cutAverage) * 10) / 10,
  }));

  const worst = withDiff[0];
  const best = withDiff[withDiff.length - 1];
  const spread = Math.round((best.percent - worst.percent) * 10) / 10;

  return {
    id,
    key,
    label,
    pluralLabel,
    unit,
    covered: covered.length,
    omitted,
    average: cutAverage,
    spread,
    best,
    worst,
    laggards: withDiff.filter((group) => group.diff < 0).slice(0, 4),
    confidence: confidenceForSample(Math.min(...covered.map((bucket) => bucket.rows.length))),
  };
}

export function buildGaps(
  scored: readonly PersonResultRow[],
  scoredEntries: readonly ResultEntry[],
  results: CicloResults
): GapCut[] {
  const cuts = [
    buildCut("areas", "areas", "Área", "áreas", "personas", groupRows(scored, (row) => row.area)),
    buildCut(
      "leaders",
      "leaders",
      "Líder",
      "líderes",
      "personas",
      groupRows(scored, (row) => row.leader)
    ),
    buildCut(
      "groups",
      "groups",
      "Grupo del ciclo",
      "grupos del ciclo",
      "personas",
      groupRows(scored, (row) => row.groupLabel)
    ),
    buildAlignmentCut(scoredEntries, results),
  ].filter((cut): cut is GapCut => cut !== null);

  // El corte que más se abre primero: es el que de verdad tiene algo que decir.
  return cuts.sort((a, b) => b.spread - a.spread);
}

/**
 * La alineación como un corte más.
 *
 * Se arma sobre objetivos y no sobre personas —una persona puede tener
 * objetivos colgando de dos objetivos de empresa distintos— así que su
 * "muestra" es el número de objetivos del tramo.
 */
function buildAlignmentCut(
  scoredEntries: readonly ResultEntry[],
  results: CicloResults
): GapCut | null {
  const labels = new Map(results.companyObjectiveMix.map((share) => [share.id, share.label]));
  const buckets = new Map<string, { label: string; percents: number[] }>();

  scoredEntries.forEach((entry) => {
    const id = entry.objective.alignedTo ?? UNALIGNED_OBJECTIVE;
    const label = labels.get(id) ?? "Sin alinear";
    const bucket = buckets.get(id);
    if (bucket) bucket.percents.push(entry.percent);
    else buckets.set(id, { label, percents: [entry.percent] });
  });

  const asRows = [...buckets.values()].map((bucket) => ({
    label: bucket.label,
    rows: bucket.percents.map(
      (percent) => ({ percent, counts: true }) as unknown as PersonResultRow
    ),
  }));

  return buildCut(
    "companyObjectives",
    "companyObjectives",
    "Objetivo de empresa",
    "objetivos de empresa",
    "objetivos",
    asRows
  );
}

// ── Bloque: cómo se está llevando el ciclo ─────────────────────────────────

const WEEKDAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

export function buildGovernance(
  results: CicloResults,
  scoredEntries: readonly ResultEntry[],
  rows: readonly PersonResultRow[]
): GovernanceReading {
  const porAprobar = results.lifecycleCounts.get("por-aprobar") ?? 0;
  const porAjustar = results.lifecycleCounts.get("por-ajustar") ?? 0;

  const conAvance = scoredEntries.filter((entry) => entry.hasProgress);
  const conComentario = conAvance.filter((entry) => entry.commentCount > 0).length;
  const conEvidencia = scoredEntries.filter((entry) =>
    entry.tracked.updates.some((update) => update.evidences.length > 0)
  ).length;

  const hours = new Array<number>(24).fill(0);
  const weekdays = new Array<number>(7).fill(0);
  let updates = 0;
  let monthEnd = 0;

  scoredEntries.forEach((entry) => {
    entry.tracked.updates.forEach((update) => {
      const date = new Date(update.date);
      hours[date.getHours()] += 1;
      weekdays[(date.getDay() + 6) % 7] += 1;
      const lastOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      if (lastOfMonth - date.getDate() < 5) monthEnd += 1;
      updates += 1;
    });
  });

  const peakHourIndex = hours.indexOf(Math.max(...hours));
  const peakWeekdayIndex = weekdays.indexOf(Math.max(...weekdays));

  return {
    approval: {
      aprobados: results.committedCount,
      porAprobar,
      porAjustar,
      total: results.objectiveCount,
    },
    conversation: {
      conComentario,
      mudos: conAvance.length - conComentario,
      conAvance: conAvance.length,
      conEvidencia,
    },
    rhythm: {
      updates,
      peakHour: `${String(peakHourIndex).padStart(2, "0")}:00–${String((peakHourIndex + 1) % 24).padStart(2, "0")}:00`,
      peakHourShare: pct(hours[peakHourIndex] ?? 0, updates),
      peakWeekday: WEEKDAYS[peakWeekdayIndex] ?? "—",
      peakWeekdayShare: pct(weekdays[peakWeekdayIndex] ?? 0, updates),
      monthEndShare: pct(monthEnd, updates),
    },
    coverage: {
      sinObjetivos: results.withoutObjectives.length,
      noCuentan: rows.filter((row) => !row.counts).length,
      inactivos: scoredEntries.filter((entry) => entry.inactivation).length,
    },
  };
}

