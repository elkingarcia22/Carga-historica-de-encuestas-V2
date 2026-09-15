/**
 * El mapa de impacto de una sola persona, como datos.
 *
 * Es el mismo grafo del paso de alineación del constructor —columnas, tarjetas
 * y flechas hacia el norte de la empresa— recortado a alguien y leído al
 * revés: en vez de "¿quién contribuye a qué?", responde "¿de dónde le llegan
 * sus metas y a qué objetivo de la empresa empuja cada una?".
 *
 * Cuatro columnas, de izquierda a derecha:
 *
 *   0  empresa    todos los objetivos de la empresa, con cuánto de esta
 *                 persona les llega (los que no toca quedan apagados: que no
 *                 aporte ahí también es información)
 *   1  objetivo   cada objetivo suyo, con su peso y su avance
 *   2  persona    ella, el eje del mapa
 *   3  origen     la asignación por la que recibió sus metas
 *
 * Vive aparte del lienzo por lo mismo que `alignmentGraph.ts` vive aparte del
 * canvas: la pregunta se puede responder (y probar) sin nada que dibujar.
 */

import { SEGMENT_LABELS } from "@/components/survey-builder";
import { MEASURE_META } from "@/components/ciclo-builder";
import { targetMemberCount } from "@/components/ciclo-builder/objectiveSets";
import type { CicloDetailData } from "@/components/ciclo-detail";
import { formatPercent } from "@/components/ciclo-detail";
import type { PersonResultRow, ResultEntry } from "./resultsModel";

// ── Geometría ──────────────────────────────────────────────────────────────

export const IMPACT_NODE_WIDTH = 250;
/** Aire entre columnas: suficiente para que la curva de una flecha se lea. */
export const IMPACT_COLUMN_GAP = 150;
export const IMPACT_NODE_GAP = 14;

export type ImpactNodeKind = "company" | "objective" | "person" | "origin";

/** Un acento por familia, el mismo que usa el mapa del constructor. */
export const IMPACT_KIND_ACCENT: Readonly<Record<ImpactNodeKind, string>> = {
  company: "var(--color-brand)",
  objective: "var(--color-indigo)",
  person: "var(--color-positive)",
  origin: "var(--color-text-muted)",
};

const NODE_HEIGHT: Readonly<Record<ImpactNodeKind, number>> = {
  company: 96,
  objective: 92,
  person: 84,
  origin: 68,
};

// ── Nodos y líneas ─────────────────────────────────────────────────────────

export interface ImpactNode {
  id: string;
  kind: ImpactNodeKind;
  column: number;
  title: string;
  subtitle: string;
  /** Cifra al vuelo: el peso del objetivo, cuánto le llega a la empresa. */
  badge: string | null;
  /** Segunda línea, para lo que hay que advertir: inactivo, sin alinear. */
  note: string | null;
  /** Una tarjeta apagada: existe pero esta persona no la toca. */
  isMuted: boolean;
  /** Solo en objetivos: la barra fina de avance al pie de la tarjeta. */
  progress: { percent: number; colorHex: string | null } | null;
  /** El id del objetivo detrás de la tarjeta, para cruzarla con la tabla. */
  objectiveId: string | null;
  width: number;
  height: number;
  x: number;
  y: number;
}

export type ImpactEdgeStyle =
  /** Un objetivo empujando a la empresa: la alineación que se decidió en el
   *  constructor. Es la flecha que importa y va en el azul de marca. */
  | "alignment"
  /** La persona cargando un objetivo: un hecho del reparto, no una decisión. */
  | "carry"
  /** De qué grupo le llegó la asignación: un hecho del directorio. */
  | "membership";

export interface ImpactEdge {
  id: string;
  /** Nodo del que sale la flecha: siempre el de la columna más alta. */
  from: string;
  to: string;
  style: ImpactEdgeStyle;
  /** El rótulo en mitad de la curva: el peso que viaja por ella. */
  label: string | null;
  /** Una flecha que ya no cuenta: el objetivo está inactivo. */
  isInactive: boolean;
}

export interface ImpactGraph {
  nodes: readonly ImpactNode[];
  edges: readonly ImpactEdge[];
}

// ── Construcción ───────────────────────────────────────────────────────────

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

const objectiveTitle = (title: string): string =>
  title.trim() === "" ? "Objetivo sin nombre" : title.trim();

export const companyImpactNodeId = (objectiveId: string): string => `co:${objectiveId}`;
export const objectiveImpactNodeId = (objectiveId: string): string => `ob:${objectiveId}`;
export const PERSON_IMPACT_NODE_ID = "pe:self";
export const ORIGIN_IMPACT_NODE_ID = "or:self";

/** Qué subraya la tarjeta de un objetivo debajo del título. */
function objectiveSubtitle(entry: ResultEntry): string {
  const measure = entry.objective.measure ? MEASURE_META[entry.objective.measure] : null;
  const target = entry.objective.targetValue.trim();
  if (measure && target !== "") {
    const prefix = measure.symbol === "$" ? "$" : "";
    const suffix = measure.symbol === "%" ? " %" : "";
    return `${measure.label} · Meta ${prefix}${target}${suffix}`;
  }
  if (measure) return measure.label;
  return "Sin tipo de medida";
}

/**
 * El grafo de una persona, ya colocado en columnas.
 *
 * Las alineaciones hacia un objetivo de empresa que ya no existe se tratan
 * como "sin alinear": una flecha hacia la nada no es información, es ruido.
 */
export function buildPersonImpactGraph(row: PersonResultRow, data: CicloDetailData): ImpactGraph {
  const companyIds = new Set(data.companyObjectives.map((objective) => objective.id));
  const alignedTo = (entry: ResultEntry): string | null =>
    entry.objective.alignedTo !== null && companyIds.has(entry.objective.alignedTo)
      ? entry.objective.alignedTo
      : null;

  // Cuánto de esta persona le llega a cada objetivo de empresa: objetivos y
  // peso, contando solo los que siguen activos. Un objetivo inactivo dibuja
  // su flecha apagada, pero no infla el aporte.
  const contribution = new Map<string, { count: number; weight: number }>();
  row.entries.forEach((entry) => {
    const target = alignedTo(entry);
    if (target === null || entry.inactivation) return;
    const current = contribution.get(target) ?? { count: 0, weight: 0 };
    contribution.set(target, {
      count: current.count + 1,
      weight: current.weight + entry.objective.weight,
    });
  });

  const companyNodes = data.companyObjectives.map<ImpactNode>((objective) => {
    const aporte = contribution.get(objective.id);
    return {
      id: companyImpactNodeId(objective.id),
      kind: "company",
      column: 0,
      title: objectiveTitle(objective.title),
      subtitle:
        objective.description.trim() === "" ? "Objetivo de la empresa" : objective.description.trim(),
      badge: aporte ? `${plural(aporte.count, "aporte", "aportes")} · ${aporte.weight} %` : "Sin aportes",
      note: null,
      isMuted: !aporte,
      progress: null,
      objectiveId: null,
      width: IMPACT_NODE_WIDTH,
      height: NODE_HEIGHT.company,
      x: 0,
      y: 0,
    };
  });

  const objectiveNodes = row.entries.map<ImpactNode>((entry) => {
    const target = alignedTo(entry);
    const note = entry.inactivation
      ? "Inactivo · no cuenta"
      : target === null
        ? "Sin objetivo de empresa"
        : entry.estado?.nombre ?? null;
    return {
      id: objectiveImpactNodeId(entry.objective.id),
      kind: "objective",
      column: 1,
      title: objectiveTitle(entry.objective.title),
      subtitle: objectiveSubtitle(entry),
      badge: `${entry.objective.weight} %`,
      note,
      isMuted: entry.inactivation !== null,
      progress: { percent: entry.percent, colorHex: entry.estado?.colorHex ?? null },
      objectiveId: entry.objective.id,
      width: IMPACT_NODE_WIDTH,
      height: NODE_HEIGHT.objective,
      x: 0,
      y: 0,
    };
  });

  const activeCount = row.entries.filter((entry) => !entry.inactivation).length;
  const personNode: ImpactNode = {
    id: PERSON_IMPACT_NODE_ID,
    kind: "person",
    column: 2,
    title: row.collaborator.name,
    subtitle: `${row.area} · ${row.leader}`,
    badge: `${formatPercent(row.percent)} ponderado`,
    note:
      activeCount === row.entries.length
        ? plural(row.entries.length, "objetivo", "objetivos")
        : `${activeCount} de ${row.entries.length} objetivos activos`,
    isMuted: false,
    progress: null,
    objectiveId: null,
    width: IMPACT_NODE_WIDTH,
    height: NODE_HEIGHT.person,
    x: 0,
    y: 0,
  };

  const originNode = buildOriginNode(row, data);

  const edges: ImpactEdge[] = [];
  row.entries.forEach((entry) => {
    const objectiveNode = objectiveImpactNodeId(entry.objective.id);
    edges.push({
      id: `carry:${objectiveNode}`,
      from: PERSON_IMPACT_NODE_ID,
      to: objectiveNode,
      style: "carry",
      label: null,
      isInactive: entry.inactivation !== null,
    });
    const target = alignedTo(entry);
    if (target === null) return;
    edges.push({
      id: `align:${objectiveNode}`,
      from: objectiveNode,
      to: companyImpactNodeId(target),
      style: "alignment",
      label: `${entry.objective.weight} %`,
      isInactive: entry.inactivation !== null,
    });
  });
  edges.push({
    id: `member:${ORIGIN_IMPACT_NODE_ID}`,
    from: ORIGIN_IMPACT_NODE_ID,
    to: PERSON_IMPACT_NODE_ID,
    style: "membership",
    label: null,
    isInactive: false,
  });

  const rankOfObjective = (node: ImpactNode): number => {
    const entry = row.entries.find((candidate) => candidate.objective.id === node.objectiveId);
    const target = entry ? alignedTo(entry) : null;
    if (target === null) return Number.MAX_SAFE_INTEGER;
    return data.companyObjectives.findIndex((objective) => objective.id === target);
  };

  return {
    nodes: layoutColumns([...companyNodes, ...objectiveNodes, personNode, originNode], rankOfObjective),
    edges,
  };
}

/** De dónde le llegaron las metas: su grupo, o una asignación persona a persona. */
function buildOriginNode(row: PersonResultRow, data: CicloDetailData): ImpactNode {
  const set = data.sets.find((candidate) => candidate.id === row.person.setId);
  const groupId = row.person.groupId;
  const isGroup = set !== undefined && set.kind === "grupal" && groupId !== null;
  const members = isGroup ? targetMemberCount(set, groupId, data.segmentBy) : 1;

  return {
    id: ORIGIN_IMPACT_NODE_ID,
    kind: "origin",
    column: 3,
    title: isGroup ? groupId : "Objetivos individuales",
    subtitle: isGroup
      ? `${SEGMENT_LABELS[data.segmentBy]} · ${plural(members, "persona", "personas")}`
      : "Asignación persona a persona",
    badge: set ? plural(set.objectives.length, "meta", "metas") : null,
    note: null,
    isMuted: false,
    progress: null,
    objectiveId: null,
    width: IMPACT_NODE_WIDTH,
    height: NODE_HEIGHT.origin,
    x: 0,
    y: 0,
  };
}

// ── Colocación ─────────────────────────────────────────────────────────────

/**
 * Apila cada columna y las centra entre sí.
 *
 * Los objetivos se ordenan por el objetivo de empresa al que apuntan, así que
 * las flechas salen casi paralelas en vez de cruzarse; los que no apuntan a
 * nada caen al final, juntos.
 */
function layoutColumns(
  nodes: readonly ImpactNode[],
  rankOfObjective: (node: ImpactNode) => number
): ImpactNode[] {
  const byColumn = new Map<number, ImpactNode[]>();
  nodes.forEach((node) => {
    byColumn.set(node.column, [...(byColumn.get(node.column) ?? []), node]);
  });
  const order = [...byColumn.keys()].sort((a, b) => a - b);

  const columnHeight = new Map<number, number>();
  order.forEach((column) => {
    const items = byColumn.get(column)!;
    if (column === 1) {
      items.sort((a, b) => {
        const difference = rankOfObjective(a) - rankOfObjective(b);
        if (difference !== 0) return difference;
        return a.title.localeCompare(b.title, "es");
      });
    }
    columnHeight.set(
      column,
      items.reduce((sum, node) => sum + node.height + IMPACT_NODE_GAP, -IMPACT_NODE_GAP)
    );
  });

  const tallest = Math.max(0, ...columnHeight.values());
  const placed: ImpactNode[] = [];
  let cursorX = 0;

  order.forEach((column) => {
    let y = (tallest - (columnHeight.get(column) ?? 0)) / 2;
    byColumn.get(column)!.forEach((node) => {
      placed.push({ ...node, x: cursorX, y });
      y += node.height + IMPACT_NODE_GAP;
    });
    cursorX += IMPACT_NODE_WIDTH + IMPACT_COLUMN_GAP;
  });

  return placed;
}
