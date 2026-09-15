/**
 * La alineación del ciclo, leída como estrategia y no como cobertura.
 *
 * El resto del reporte contesta "¿cómo va cada quien?". Esto contesta otra
 * pregunta, la que hace quien mira el ciclo desde arriba: *¿en qué estamos
 * gastando el esfuerzo de la empresa y qué está devolviendo cada apuesta?*
 *
 * Por eso casi todo aquí se mide en peso y no en cuenta de objetivos. Cada
 * persona reparte 100 puntos entre sus metas, así que el peso es la única
 * moneda común entre un área de ochenta personas y una de tres: "el 34 % del
 * esfuerzo del ciclo cuelga de Ingresos" es una frase que se puede decidir,
 * y "62 objetivos apuntan a Ingresos" no lo es.
 *
 * Todo es puro: entran las entradas ya filtradas, salen números. Los
 * inactivos no entran en ninguna cuenta —están fuera del ponderado, contarlos
 * inflaría una apuesta con esfuerzo que ya no juega—.
 */

import { resolveEstado } from "@/components/ciclo-detail";
import type { Objective, ObjectiveSet } from "@/components/ciclo-builder";
import type { CicloDetailData } from "@/components/ciclo-detail";
import type { ObjetivoEstadoConfig } from "@/components/objetivos/objetivosConfigStore";
import { BREAKDOWN_META, breakdownValueOf, type BreakdownKey } from "./resultsBreakdown";
import {
  riskFor,
  UNALIGNED_OBJECTIVE,
  type PersonResultRow,
  type ResultEntry,
  type ResultsConfig,
  type RiskLevel,
} from "./resultsModel";

export const UNALIGNED_TITLE = "Sin objetivo de empresa";

/**
 * Un porcentaje que nunca miente en los extremos.
 *
 * Un 0,4 % con diez objetivos detrás no puede leerse "0 %" al lado de la línea
 * que los cuenta, y un 99,6 % con algo todavía suelto no puede leerse "100 %":
 * redondear hacia el extremo convierte "casi" en "ya está" y "algo" en "nada",
 * que son justo las dos lecturas que esta vista existe para dar.
 */
export function safePercent(value: number): number {
  const rounded = Math.round(value);
  if (rounded === 100 && value < 99.995) return 99;
  if (rounded === 0 && value > 0.005) return 1;
  return rounded;
}

/** Las entradas que de verdad están en juego. */
const active = (entries: readonly ResultEntry[]): readonly ResultEntry[] =>
  entries.filter((entry) => entry.inactivation === null);

const weightOf = (entry: ResultEntry): number => entry.objective.weight ?? 0;

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

/**
 * El avance de un conjunto de objetivos, ponderado por su peso.
 *
 * Promediar a secas trataría igual un objetivo que vale 60 puntos del ciclo
 * de alguien y uno que vale 5, y es justo esa diferencia la que decide cuánto
 * mueve cada apuesta el resultado final. Sin pesos —todos en cero— cae al
 * promedio simple, que es lo único que queda por decir.
 */
export function weightedPercent(entries: readonly ResultEntry[]): number {
  if (entries.length === 0) return 0;
  const total = sum(entries.map(weightOf));
  if (total === 0) return sum(entries.map((entry) => entry.percent)) / entries.length;
  return sum(entries.map((entry) => weightOf(entry) * entry.percent)) / total;
}

/** A qué objetivo de empresa cuelga una entrada, o el cajón de los sueltos. */
const northOf = (entry: ResultEntry, alignedIds: ReadonlySet<string>): string => {
  const alignedTo = entry.objective.alignedTo;
  return alignedTo !== null && alignedIds.has(alignedTo) ? alignedTo : UNALIGNED_OBJECTIVE;
};

// ── Las apuestas ───────────────────────────────────────────────────────────

/** Quién empuja una apuesta, dentro del corte del "Ver por". */
export interface PushContributor {
  id: string;
  label: string;
  /** Qué parte del esfuerzo de esta apuesta pone ese grupo, 0–100. */
  share: number;
}

/**
 * Un objetivo de empresa con todo lo que el ciclo le está poniendo detrás.
 * La última fila siempre es el cajón de lo que no apunta a nada: es la
 * lectura que nadie pide y todos necesitan.
 */
export interface CompanyPush {
  id: string;
  title: string;
  /** El cajón de los objetivos sueltos, que no es una apuesta sino su ausencia. */
  isUnaligned: boolean;
  /** Qué parte del esfuerzo del ciclo cuelga de aquí, 0–100. */
  share: number;
  weight: number;
  objectives: number;
  people: number;
  /** Cuántos grupos del corte lo empujan: uno solo es una apuesta de un área. */
  groups: number;
  /** Avance ponderado de lo que cuelga de esta apuesta. */
  percent: number;
  estado: ObjetivoEstadoConfig | null;
  risk: RiskLevel;
  /** Los tres que más esfuerzo le ponen. */
  topContributors: readonly PushContributor[];
}

export function companyPushes(
  entries: readonly ResultEntry[],
  data: CicloDetailData,
  config: ResultsConfig,
  breakdown: BreakdownKey,
  /** El calendario corrido, o -1 en un ciclo donde el riesgo no aplica. */
  elapsed: number
): readonly CompanyPush[] {
  const live = active(entries);
  const alignedIds = new Set(data.companyObjectives.map((objective) => objective.id));
  const totalWeight = sum(live.map(weightOf));

  const buckets = new Map<string, ResultEntry[]>();
  data.companyObjectives.forEach((objective) => buckets.set(objective.id, []));
  buckets.set(UNALIGNED_OBJECTIVE, []);
  live.forEach((entry) => {
    const id = northOf(entry, alignedIds);
    const bucket = buckets.get(id);
    if (bucket) bucket.push(entry);
  });

  const titleById = new Map(
    data.companyObjectives.map((objective) => [
      objective.id,
      objective.title.trim() === "" ? "Objetivo sin título" : objective.title.trim(),
    ])
  );

  const pushes = [...buckets.entries()].map(([id, bucket]) => {
    const weight = sum(bucket.map(weightOf));
    const percent = weightedPercent(bucket);
    return {
      id,
      title: titleById.get(id) ?? UNALIGNED_TITLE,
      isUnaligned: id === UNALIGNED_OBJECTIVE,
      share: totalWeight === 0 ? 0 : (weight / totalWeight) * 100,
      weight,
      objectives: bucket.length,
      people: new Set(bucket.map((entry) => entry.personId)).size,
      groups: new Set(bucket.map((entry) => groupOf(entry, breakdown))).size,
      percent,
      estado: resolveEstado(config.estados, percent, data.status),
      risk: riskFor(percent, elapsed),
      topContributors: topContributors(bucket, breakdown, weight),
    };
  });

  // Una apuesta sin nada detrás sigue en la lista —"nadie está trabajando en
  // esto" es la lectura más dura que da este reparto—, pero el cajón de los
  // sueltos en cero sí sobra: decir "0 % sin alinear" es decir nada.
  const ordered = pushes
    .filter((push) => !push.isUnaligned)
    .sort((a, b) => b.share - a.share);
  const loose = pushes.find((push) => push.isUnaligned);
  return loose && loose.objectives > 0 ? [...ordered, loose] : ordered;
}

const groupOf = (entry: ResultEntry, breakdown: BreakdownKey): string =>
  breakdownValueOf(
    { collaborator: entry.person.collaborator, groupId: entry.person.groupId },
    breakdown
  );

function topContributors(
  bucket: readonly ResultEntry[],
  breakdown: BreakdownKey,
  totalWeight: number
): readonly PushContributor[] {
  if (totalWeight === 0) return [];
  const weights = new Map<string, number>();
  bucket.forEach((entry) => {
    const label = groupOf(entry, breakdown);
    weights.set(label, (weights.get(label) ?? 0) + weightOf(entry));
  });
  return [...weights.entries()]
    .map(([label, weight]) => ({ id: label, label, share: (weight / totalWeight) * 100 }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 3);
}

// ── El titular ─────────────────────────────────────────────────────────────

export interface AlignmentHeadline {
  /** Qué parte del esfuerzo del ciclo cuelga de un objetivo de empresa. */
  coverage: number;
  alignedWeight: number;
  totalWeight: number;
  /** Objetivos que no apuntan a nada, y a cuánta gente le pertenecen. */
  looseObjectives: number;
  loosePeople: number;
  /** Personas cuyo esfuerzo entero está fuera de la estrategia. */
  peopleWithoutNorth: number;
  peopleCounted: number;
  companyCount: number;
  /** Objetivos de empresa que sí tienen gente detrás. */
  backedCount: number;
  /** La apuesta que más esfuerzo se lleva. */
  focusLabel: string;
  focusShare: number;
}

export function alignmentHeadline(
  entries: readonly ResultEntry[],
  rows: readonly PersonResultRow[],
  data: CicloDetailData,
  pushes: readonly CompanyPush[]
): AlignmentHeadline {
  const live = active(entries);
  const alignedIds = new Set(data.companyObjectives.map((objective) => objective.id));
  const totalWeight = sum(live.map(weightOf));
  const alignedEntries = live.filter(
    (entry) => northOf(entry, alignedIds) !== UNALIGNED_OBJECTIVE
  );
  const loose = live.filter((entry) => northOf(entry, alignedIds) === UNALIGNED_OBJECTIVE);

  const withoutNorth = rows.filter((row) => {
    const own = active(row.entries);
    if (own.length === 0) return false;
    return own.every((entry) => northOf(entry, alignedIds) === UNALIGNED_OBJECTIVE);
  });

  const withObjectives = rows.filter((row) => active(row.entries).length > 0);
  const strongest = pushes.find((push) => !push.isUnaligned);

  return {
    coverage: totalWeight === 0 ? 0 : (sum(alignedEntries.map(weightOf)) / totalWeight) * 100,
    alignedWeight: sum(alignedEntries.map(weightOf)),
    totalWeight,
    looseObjectives: loose.length,
    loosePeople: new Set(loose.map((entry) => entry.personId)).size,
    peopleWithoutNorth: withoutNorth.length,
    peopleCounted: withObjectives.length,
    companyCount: data.companyObjectives.length,
    backedCount: pushes.filter((push) => !push.isUnaligned && push.objectives > 0).length,
    focusLabel: strongest?.title ?? "—",
    focusShare: strongest?.share ?? 0,
  };
}

// ── Quién empuja qué ───────────────────────────────────────────────────────

export interface ContributionRow {
  id: string;
  label: string;
  people: number;
  /** El peso total del grupo, para ordenar por quién mueve más el ciclo. */
  weight: number;
  /** Qué parte del esfuerzo de ese grupo va a cada apuesta, en el orden de
   *  `pushes`. Una celda en cero es un grupo que no toca esa apuesta, y es
   *  justo la celda que hay que poder ver. */
  cells: readonly number[];
}

/**
 * La matriz de contribución: cada grupo del corte contra cada apuesta.
 *
 * Se lee por filas —cada fila suma 100 %— porque la pregunta es "¿en qué
 * gasta su esfuerzo esta área?", no "¿cuánto de esta apuesta pone?". Esa otra
 * lectura ya la da la lista de apuestas con sus tres contribuyentes.
 *
 * No es el heatmap de Cumplimiento: ese pinta avance —cómo va cada cruce—,
 * este pinta esfuerzo —dónde está puesto—. Un área puede ir impecable en un
 * objetivo de empresa al que le dedica el 4 % de su semana.
 */
export function contributionMatrix(
  entries: readonly ResultEntry[],
  breakdown: BreakdownKey,
  pushes: readonly CompanyPush[],
  data: CicloDetailData
): readonly ContributionRow[] {
  const live = active(entries);
  const alignedIds = new Set(data.companyObjectives.map((objective) => objective.id));
  const index = new Map(pushes.map((push, position) => [push.id, position]));

  const buckets = new Map<string, { weight: number; people: Set<string>; cells: number[] }>();
  live.forEach((entry) => {
    const label = groupOf(entry, breakdown);
    const bucket =
      buckets.get(label) ??
      { weight: 0, people: new Set<string>(), cells: pushes.map(() => 0) };
    const position = index.get(northOf(entry, alignedIds));
    const weight = weightOf(entry);
    bucket.weight += weight;
    bucket.people.add(entry.personId);
    if (position !== undefined) bucket.cells[position] += weight;
    buckets.set(label, bucket);
  });

  return [...buckets.entries()]
    .map(([label, bucket]) => ({
      id: label,
      label,
      people: bucket.people.size,
      weight: bucket.weight,
      cells: bucket.cells.map((weight) =>
        bucket.weight === 0 ? 0 : (weight / bucket.weight) * 100
      ),
    }))
    .sort((a, b) => b.weight - a.weight);
}

// ── Quién está remando aparte ──────────────────────────────────────────────

export interface DriftingPerson {
  row: PersonResultRow;
  /** Qué parte de su esfuerzo no apunta a ningún objetivo de empresa, 0–100. */
  looseShare: number;
  looseObjectives: number;
  totalObjectives: number;
}

/**
 * Las personas cuyo esfuerzo se está yendo fuera de la estrategia.
 *
 * El reparto por objetivo de empresa cuenta objetivos y puede esconder esto:
 * un 6 % suelto suena a nada, pero si ese 6 % es *todo* lo que tienen doce
 * personas, hay doce personas remando hacia otro lado. Por eso esta lectura
 * es por persona y no por objetivo — y ordenada por cuánto de su propio
 * ciclo se está yendo, que es lo que hace la conversación con ella distinta.
 */
export function driftingPeople(
  rows: readonly PersonResultRow[],
  data: CicloDetailData
): readonly DriftingPerson[] {
  const alignedIds = new Set(data.companyObjectives.map((objective) => objective.id));

  return rows
    .map((row) => {
      const live = active(row.entries);
      const loose = live.filter((entry) => northOf(entry, alignedIds) === UNALIGNED_OBJECTIVE);
      const total = sum(live.map(weightOf));
      const looseWeight = sum(loose.map(weightOf));
      return {
        row,
        looseShare:
          total === 0
            ? live.length === 0
              ? 0
              : (loose.length / live.length) * 100
            : (looseWeight / total) * 100,
        looseObjectives: loose.length,
        totalObjectives: live.length,
      };
    })
    .filter((person) => person.looseObjectives > 0)
    .sort(
      (a, b) =>
        b.looseShare - a.looseShare ||
        b.looseObjectives - a.looseObjectives ||
        a.row.collaborator.name.localeCompare(b.row.collaborator.name, "es")
    );
}

/** Cómo se llama el corte activo, para los títulos de esta vista. */
export const breakdownNoun = (breakdown: BreakdownKey): string =>
  BREAKDOWN_META[breakdown].noun;

// ── El mapa ────────────────────────────────────────────────────────────────

/**
 * El ciclo, en la forma que el mapa de alineación sabe dibujar.
 *
 * Es el mismo mapa del último paso del constructor, alimentado con el ciclo
 * que ya está corriendo en vez de con el borrador: los objetivos de empresa y
 * las asignaciones son los mismos, solo que aquí llegan desde el reporte.
 *
 * Y llega recortado por los filtros, porque un mapa que ignora el filtro
 * puesto arriba es un mapa que contradice a las tarjetas de al lado. El
 * recorte se hace por objetivo —sobrevive el que le quede a alguien— y, en
 * las asignaciones individuales, también por destinatario. Un grupo entero
 * no se recorta persona a persona: la tarjeta del grupo habla del grupo, y
 * encogerla por un filtro de área diría algo que no es cierto del grupo.
 */
export function alignmentSource(
  data: CicloDetailData,
  entries: readonly ResultEntry[],
  rows: readonly PersonResultRow[]
): {
  assignment: { groupSegmentBy: CicloDetailData["segmentBy"] };
  useCompanyObjectives: boolean;
  companyObjectives: readonly Objective[];
  objectiveSets: readonly ObjectiveSet[];
} {
  const alive = new Set(
    entries.map((entry) => `${entry.person.setId}:${entry.objective.id}`)
  );
  const people = new Set(rows.map((row) => row.person.id));

  const sets = data.sets
    .map((set) => ({
      ...set,
      objectives: set.objectives.filter((objective) => alive.has(`${set.id}:${objective.id}`)),
      targetIds:
        set.kind === "individual"
          ? set.targetIds.filter((targetId) => people.has(targetId))
          : set.targetIds,
    }))
    .filter((set) => set.objectives.length > 0);

  return {
    assignment: { groupSegmentBy: data.segmentBy },
    useCompanyObjectives: data.companyObjectives.length > 0,
    companyObjectives: data.companyObjectives,
    objectiveSets: sets,
  };
}
