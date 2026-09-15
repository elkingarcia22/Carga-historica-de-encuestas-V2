/**
 * El "Ver por" del reporte: con qué atributo de la gente se agrupan los
 * resultados.
 *
 * Vive arriba, junto a los filtros, y no dentro de cada pestaña: el ranking y
 * el cuadro respondían la misma pregunta —"¿cómo va cada área?"— con dos
 * controles distintos, y cambiar de pestaña obligaba a volver a elegirlo. Es
 * el mismo criterio con el que los filtros ya son de la pantalla y no de la
 * tarjeta.
 */

import type { Collaborator } from "@/mocks/collaborators";
import type { FilterKey } from "./useResultsFilters";

export type BreakdownKey =
  | "area"
  | "lider"
  | "grupo"
  | "pais"
  | "edad"
  | "genero"
  | "customGroup"
  | "persona";

/**
 * Lo mínimo para resolver el corte: el ranking parte de filas ya calculadas y
 * el cuadro de entradas sueltas, pero los dos tienen a la persona y su
 * asignación, que es todo lo que hace falta.
 */
export interface BreakdownSubject {
  collaborator: Collaborator;
  /** El grupo por el que recibió la asignación, o null si fue individual. */
  groupId: string | null;
}

interface BreakdownMeta {
  /** Como se lee en el "Ver por". */
  label: string;
  /** En singular, para títulos: "Ranking por área". */
  noun: string;
  /** En plural, para conteos: "Top 3 áreas más rezagadas". */
  plural: string;
  valueOf: (subject: BreakdownSubject) => string;
  /**
   * Si el cuadro puede cruzar este corte con los objetivos de empresa. Una
   * fila por colaborador deja de ser un cuadro y pasa a ser la tabla de
   * colaboradores que ya existe, así que ese corte no lo dibuja.
   */
  drawsHeatmap: boolean;
  /**
   * Con qué filtro se angosta el reporte al pulsar una barra de este corte, o
   * null si el corte no tiene filtro propio —"colaborador" no lo tiene: para
   * eso está abrir su ficha.
   */
  filterKey: FilterKey | null;
}

export const BREAKDOWN_META: Readonly<Record<BreakdownKey, BreakdownMeta>> = {
  area: {
    label: "Área",
    noun: "área",
    plural: "áreas",
    valueOf: (subject) => subject.collaborator.area,
    drawsHeatmap: true,
    filterKey: "areas",
  },
  lider: {
    label: "Líder",
    noun: "líder",
    plural: "líderes",
    valueOf: (subject) => subject.collaborator.leader ?? "Sin líder",
    drawsHeatmap: true,
    filterKey: "leaders",
  },
  grupo: {
    label: "Asignación",
    noun: "asignación",
    plural: "asignaciones",
    valueOf: (subject) => subject.groupId ?? "Individual",
    drawsHeatmap: true,
    filterKey: "groups",
  },
  pais: {
    label: "País",
    noun: "país",
    plural: "países",
    valueOf: (subject) => subject.collaborator.country,
    drawsHeatmap: true,
    filterKey: "countries",
  },
  edad: {
    label: "Edad",
    noun: "rango de edad",
    plural: "rangos de edad",
    valueOf: (subject) => subject.collaborator.age,
    drawsHeatmap: true,
    filterKey: "ages",
  },
  genero: {
    label: "Género",
    noun: "género",
    plural: "géneros",
    valueOf: (subject) => subject.collaborator.gender,
    drawsHeatmap: true,
    filterKey: "genders",
  },
  customGroup: {
    label: "Grupo personalizado",
    noun: "grupo",
    plural: "grupos",
    // Quien no está en ninguno cae en su propia fila en vez de desaparecer
    // del corte: "cuánta gente no está en ningún grupo" es una lectura.
    valueOf: (subject) => subject.collaborator.customGroup ?? "Sin grupo",
    drawsHeatmap: true,
    filterKey: "customGroups",
  },
  persona: {
    label: "Colaborador",
    noun: "colaborador",
    plural: "colaboradores",
    valueOf: (subject) => subject.collaborator.name,
    drawsHeatmap: false,
    filterKey: null,
  },
};

/** En el orden en que se ofrecen: primero la estructura, luego el directorio. */
export const BREAKDOWN_ORDER: readonly BreakdownKey[] = [
  "area",
  "lider",
  "grupo",
  "pais",
  "edad",
  "genero",
  "customGroup",
  "persona",
];

export const DEFAULT_BREAKDOWN: BreakdownKey = "area";

export const breakdownValueOf = (subject: BreakdownSubject, key: BreakdownKey): string =>
  BREAKDOWN_META[key].valueOf(subject);

/** Lo que hace falta de una fila ya calculada para agruparla por el corte. */
interface BreakdownScoredRow {
  collaborator: Collaborator;
  person: { groupId: string | null };
  percent: number;
}

export interface BreakdownBar {
  id: string;
  label: string;
  /** 0–100: el promedio del grupo. */
  percent: number;
  people: number;
}

/**
 * El avance promedio de cada grupo del corte elegido, del que va más atrás al
 * que va mejor. La primera fila es el titular.
 *
 * Vive aquí y no dentro de una pestaña porque el ranking del Resumen, su
 * "Top 3 con menor avance" y el de Cumplimiento son la misma lista leída
 * desde puntas distintas. Calcularla en cada tarjeta es la vía más corta a
 * que dos tarjetas de la misma pantalla se contradigan en un número.
 */
export function breakdownBars(
  scored: readonly BreakdownScoredRow[],
  key: BreakdownKey
): BreakdownBar[] {
  const buckets = new Map<string, number[]>();
  scored.forEach((row) => {
    const value = breakdownValueOf(
      { collaborator: row.collaborator, groupId: row.person.groupId },
      key
    );
    const bucket = buckets.get(value);
    if (bucket) bucket.push(row.percent);
    else buckets.set(value, [row.percent]);
  });
  return [...buckets.entries()]
    .map(([label, percents]) => ({
      id: label,
      label,
      percent: percents.reduce((a, b) => a + b, 0) / percents.length,
      people: percents.length,
    }))
    .sort((a, b) => a.percent - b.percent);
}

/* ------------------------------------------------------------------ *
 * Reparto del peso
 * ------------------------------------------------------------------ */

export interface WeightBar {
  id: string;
  label: string;
  /** Qué parte del peso total del ciclo carga este grupo, 0–100. */
  share: number;
  /** La suma cruda de los pesos, para la lectura de al lado. */
  weight: number;
  objectives: number;
}

/**
 * Dónde está puesto el peso del ciclo.
 *
 * Cada persona reparte 100 puntos entre sus objetivos, así que sumar esos
 * pesos por área dice qué parte del resultado del ciclo se juega en cada
 * una. No es lo mismo que el avance: un área puede ir perfecta y pesar poco,
 * y es esa segunda cifra la que decide cuánto mueve el número de arriba.
 *
 * Los inactivos no entran: están fuera del ponderado, así que contarlos aquí
 * inflaría un área con peso que ya no juega.
 */
export function weightBars(
  entries: readonly {
    objective: { weight: number | null };
    person: BreakdownSubject & { groupId: string | null };
    inactivation: unknown | null;
  }[],
  key: BreakdownKey
): WeightBar[] {
  const buckets = new Map<string, { weight: number; objectives: number }>();

  entries.forEach((entry) => {
    if (entry.inactivation !== null) return;
    const weight = entry.objective.weight ?? 0;
    const value = breakdownValueOf(
      { collaborator: entry.person.collaborator, groupId: entry.person.groupId },
      key
    );
    const bucket = buckets.get(value);
    if (bucket) {
      bucket.weight += weight;
      bucket.objectives += 1;
    } else {
      buckets.set(value, { weight, objectives: 1 });
    }
  });

  const total = [...buckets.values()].reduce((sum, bucket) => sum + bucket.weight, 0);

  return [...buckets.entries()]
    .map(([label, bucket]) => ({
      id: label,
      label,
      share: total === 0 ? 0 : (bucket.weight / total) * 100,
      weight: bucket.weight,
      objectives: bucket.objectives,
    }))
    .sort((a, b) => b.share - a.share);
}


/**
 * El peso, repartido entre los objetivos de la empresa.
 *
 * Es la otra mitad de [[weightBars]] y la que de verdad ordena: por área el
 * reparto tiende a copiar cuánta gente tiene cada una, pero por objetivo de
 * empresa dice en qué se está jugando la estrategia del ciclo — y saca a la
 * luz lo que no está alineado a nada, que es la lectura que nadie pide y
 * todos necesitan.
 */
export function weightByCompanyObjective(
  entries: readonly {
    objective: { weight: number | null; alignedTo: string | null };
    inactivation: unknown | null;
  }[],
  companyObjectives: readonly { id: string; title: string }[],
  unalignedId: string
): WeightBar[] {
  const buckets = new Map<string, { weight: number; objectives: number; label: string }>(
    companyObjectives.map((objective) => [
      objective.id,
      { weight: 0, objectives: 0, label: objective.title },
    ])
  );
  buckets.set(unalignedId, { weight: 0, objectives: 0, label: "Sin objetivo de empresa" });

  entries.forEach((entry) => {
    if (entry.inactivation !== null) return;
    const alignedTo = entry.objective.alignedTo;
    const key = alignedTo !== null && buckets.has(alignedTo) ? alignedTo : unalignedId;
    const bucket = buckets.get(key);
    if (!bucket) return;
    bucket.weight += entry.objective.weight ?? 0;
    bucket.objectives += 1;
  });

  const total = [...buckets.values()].reduce((sum, bucket) => sum + bucket.weight, 0);

  return [...buckets.entries()]
    // Un objetivo de empresa sin nada colgando sí se muestra: "nadie está
    // trabajando en esto" es la lectura más dura que da este reparto.
    .map(([id, bucket]) => ({
      id,
      label: bucket.label,
      share: total === 0 ? 0 : (bucket.weight / total) * 100,
      weight: bucket.weight,
      objectives: bucket.objectives,
    }))
    .sort((a, b) => b.share - a.share);
}

/* ------------------------------------------------------------------ *
 * Aprobaciones atascadas
 * ------------------------------------------------------------------ */

export interface PendingApprovalBar {
  id: string;
  label: string;
  objectives: number;
  people: number;
  /** Qué parte de todo lo que está esperando depende de esta persona. */
  share: number;
}

/**
 * Quién tiene que dar el visto bueno.
 *
 * El reporte ya dice cuántos objetivos esperan aprobación; lo que no dice es
 * de quién dependen, y sin eso el pendiente no tiene a quién avisarle. Un
 * objetivo sin aprobar no suma avance, así que cada fila de aquí es ciclo
 * parado esperando a una persona.
 */
export function pendingApprovalBars(
  entries: readonly {
    lifecycle: string;
    personId: string;
    person: { collaborator: { leader?: string | null } };
  }[],
  /** Qué etapa se está contando: lo que espera al líder ("por-aprobar") o lo
   *  que el líder ya devolvió y espera al colaborador ("por-ajustar"). */
  lifecycle: string = "por-aprobar"
): PendingApprovalBar[] {
  const buckets = new Map<string, { objectives: number; people: Set<string> }>();

  entries.forEach((entry) => {
    if (entry.lifecycle !== lifecycle) return;
    const leader = entry.person.collaborator.leader ?? "Sin líder";
    const bucket = buckets.get(leader);
    if (bucket) {
      bucket.objectives += 1;
      bucket.people.add(entry.personId);
    } else {
      buckets.set(leader, { objectives: 1, people: new Set([entry.personId]) });
    }
  });

  const total = [...buckets.values()].reduce((sum, bucket) => sum + bucket.objectives, 0);

  return [...buckets.entries()]
    .map(([label, bucket]) => ({
      id: label,
      label,
      objectives: bucket.objectives,
      people: bucket.people.size,
      share: total === 0 ? 0 : (bucket.objectives / total) * 100,
    }))
    .sort((a, b) => b.objectives - a.objectives);
}

/* ------------------------------------------------------------------ *
 * Alineación con la estrategia
 * ------------------------------------------------------------------ */

export type AlignmentBand = "total" | "parcial" | "ninguna";

export interface AlignmentSplit {
  band: AlignmentBand;
  label: string;
  people: number;
}

/**
 * Cuánta gente está trabajando en lo que la empresa dijo que importaba.
 *
 * El reparto del peso por objetivo de empresa cuenta objetivos y puede
 * esconder el problema: un 5 % sin alinear suena a nada, pero si ese 5 % es
 * *todo* lo que tienen veinte personas, hay veinte personas remando hacia
 * otro lado. Esta lectura es por persona justamente por eso.
 *
 * Los inactivos no cuentan: no están en juego, y alguien cuyos objetivos
 * están todos apagados no es un caso de desalineación.
 */
export function alignmentSplit(
  rows: readonly {
    entries: readonly {
      objective: { alignedTo: string | null };
      inactivation: unknown | null;
    }[];
  }[],
  alignedIds: ReadonlySet<string>
): AlignmentSplit[] {
  let total = 0;
  let parcial = 0;
  let ninguna = 0;

  rows.forEach((row) => {
    const active = row.entries.filter((entry) => entry.inactivation === null);
    if (active.length === 0) return;
    const aligned = active.filter(
      (entry) => entry.objective.alignedTo !== null && alignedIds.has(entry.objective.alignedTo)
    ).length;
    if (aligned === active.length) total += 1;
    else if (aligned === 0) ninguna += 1;
    else parcial += 1;
  });

  return [
    { band: "total", label: "Todos sus objetivos alineados", people: total },
    { band: "parcial", label: "Solo algunos alineados", people: parcial },
    { band: "ninguna", label: "Ninguno alineado", people: ninguna },
  ];
}

export interface AlignmentBar {
  id: string;
  label: string;
  /** Qué parte del peso de ese grupo cuelga de un objetivo de empresa, 0–100. */
  percent: number;
  people: number;
}

/**
 * Qué tan enganchado a la estrategia está cada grupo del corte.
 *
 * Se mide sobre el peso y no sobre la cuenta de objetivos: un área puede
 * tener nueve objetivos alineados de diez y que el suelto se lleve la mitad
 * de su peso. Ordenado de menos a más alineado, porque la primera fila es la
 * que hay que ir a mirar.
 */
export function alignmentByBreakdown(
  entries: readonly {
    objective: { weight: number | null; alignedTo: string | null };
    personId: string;
    person: BreakdownSubject & { groupId: string | null };
    inactivation: unknown | null;
  }[],
  key: BreakdownKey,
  alignedIds: ReadonlySet<string>
): AlignmentBar[] {
  const buckets = new Map<string, { aligned: number; total: number; people: Set<string> }>();

  entries.forEach((entry) => {
    if (entry.inactivation !== null) return;
    const weight = entry.objective.weight ?? 0;
    const value = breakdownValueOf(
      { collaborator: entry.person.collaborator, groupId: entry.person.groupId },
      key
    );
    const bucket = buckets.get(value) ?? { aligned: 0, total: 0, people: new Set<string>() };
    bucket.total += weight;
    if (entry.objective.alignedTo !== null && alignedIds.has(entry.objective.alignedTo)) {
      bucket.aligned += weight;
    }
    bucket.people.add(entry.personId);
    buckets.set(value, bucket);
  });

  return [...buckets.entries()]
    .map(([label, bucket]) => ({
      id: label,
      label,
      percent: bucket.total === 0 ? 0 : (bucket.aligned / bucket.total) * 100,
      people: bucket.people.size,
    }))
    .sort((a, b) => a.percent - b.percent);
}
