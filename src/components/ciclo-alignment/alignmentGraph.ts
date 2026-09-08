/**
 * El mapa de alineación, como datos.
 *
 * Todo lo que el lienzo dibuja sale de aquí: un grafo de nodos en columnas y
 * las líneas entre ellos. Vive aparte del componente por la misma razón que
 * `objectiveSets.ts` vive aparte del editor — la pregunta "¿quién contribuye
 * a qué?" se puede responder (y leer) sin un canvas alrededor.
 *
 * El grafo se lee de derecha a izquierda: la columna 0 son los objetivos de
 * la empresa —el norte— y todo lo que está a su derecha apunta hacia ellos.
 * Cuál es ese "todo" depende del nivel:
 *
 *   objetivos     cada objetivo asignado, uno por tarjeta
 *   agrupacion    cada destinatario de una asignación (área, líder, persona)
 *   colaboradores cada persona alcanzada, y de qué grupos le llegan sus metas
 */

import { COLLABORATORS } from "@/mocks/collaborators";
import type { SegmentKey } from "@/components/survey-builder";
import { SEGMENT_LABELS } from "@/components/survey-builder";
import {
  objectiveSetMemberIds,
  targetHint,
  targetLabel,
} from "@/components/ciclo-builder/objectiveSets";
import type { CicloDraft, Objective, ObjectiveSet } from "@/components/ciclo-builder";

// ── Niveles ────────────────────────────────────────────────────────────────

export type AlignmentLevel = "objetivos" | "agrupacion" | "colaboradores";

export const ALIGNMENT_LEVEL_LABELS: Readonly<Record<AlignmentLevel, string>> = {
  objetivos: "Objetivos",
  agrupacion: "Agrupación",
  colaboradores: "Colaboradores",
};

/** Qué responde cada nivel, en una línea. */
export const ALIGNMENT_LEVEL_HINTS: Readonly<Record<AlignmentLevel, string>> = {
  objetivos: "Cada meta asignada y el objetivo de empresa al que empuja.",
  agrupacion: "Qué aporta cada área, líder o persona con asignación propia.",
  colaboradores: "La contribución de cada persona y de qué grupos le llega.",
};

// ── Geometría ──────────────────────────────────────────────────────────────

export const NODE_WIDTH = 250;
/** Aire entre columnas: suficiente para que la curva de una línea se lea. */
export const COLUMN_GAP = 168;
export const NODE_GAP = 14;

const NODE_HEIGHT: Readonly<Record<AlignmentNodeKind, number>> = {
  company: 96,
  objective: 88,
  target: 80,
  person: 76,
  origin: 68,
};

/** Cuántas personas caben en el nivel de colaboradores antes de recortar.
 *  Un área de 90 personas dibujada entera no es un mapa, es una lista. */
export const MAX_PERSON_NODES = 18;

/** Filas por columna antes de doblarla en dos. Una columna de treinta
 *  tarjetas obliga a alejar el zoom hasta que no se lee ninguna. */
const MAX_COLUMN_ROWS = 6;

// ── Nodos y líneas ─────────────────────────────────────────────────────────

export type AlignmentNodeKind = "company" | "objective" | "target" | "person" | "origin";

/** Un objetivo asignado, localizable dentro de su asignación. */
export interface ObjectiveRef {
  setId: string;
  objectiveId: string;
}

export interface AlignmentNode {
  id: string;
  kind: AlignmentNodeKind;
  /** 0 = objetivos de empresa. Cuanto más alta, más lejos del norte. */
  column: number;
  title: string;
  subtitle: string;
  /** Cifra al vuelo: el peso del objetivo, cuántos lleva un grupo. */
  badge: string | null;
  /** Segunda línea, para lo que hay que advertir (objetivos compartidos). */
  note: string | null;
  /** Los objetivos que esta tarjeta representa — lo que se alinea al soltar
   *  una flecha sobre un objetivo de empresa. Vacío en la columna 0. */
  objectiveRefs: readonly ObjectiveRef[];
  /** Ids de objetivos de empresa a los que ya apunta. */
  alignedTo: readonly string[];
  width: number;
  height: number;
  /** Posición por defecto. El lienzo la respeta mientras nadie mueva nada. */
  x: number;
  y: number;
}

export interface AlignmentEdge {
  id: string;
  /** Nodo del que sale la flecha — siempre el de la columna más alta. */
  from: string;
  to: string;
  /** Cuántos objetivos hay detrás de la línea; decide su grosor. */
  strength: number;
  /** Exactamente qué objetivos sostienen esta línea. Cortarla desalinea
   *  estos y solo estos: una tarjeta puede apuntar a varios nortes a la vez,
   *  y cortar uno no puede llevarse los demás por delante. */
  refs: readonly ObjectiveRef[];
  /** Una alineación se puede cortar. Una pertenencia a un grupo no: es un
   *  hecho del directorio, no una decisión de este ciclo. */
  removable: boolean;
}

export interface AlignmentGraph {
  nodes: readonly AlignmentNode[];
  edges: readonly AlignmentEdge[];
  /** Personas que el recorte dejó fuera del nivel de colaboradores. */
  hiddenCount: number;
  /** Cuántos nodos escondió el buscador. */
  filteredCount: number;
}

// ── Utilidades ─────────────────────────────────────────────────────────────

const PERSON_BY_ID = new Map(COLLABORATORS.map((person) => [person.id, person]));

const objectiveTitle = (objective: Objective): string =>
  objective.title.trim() === "" ? "Objetivo sin título" : objective.title.trim();

const setTargetsSummary = (set: ObjectiveSet): string => {
  const labels = set.targetIds.map((targetId) => targetLabel(set, targetId));
  if (labels.length === 0) return "Sin destinatarios";
  if (labels.length <= 2) return labels.join(" · ");
  return `${labels[0]} · ${labels[1]} +${labels.length - 2}`;
};

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

/** Los refs de un set, en el orden en que están escritos. */
const refsOfSet = (set: ObjectiveSet): ObjectiveRef[] =>
  set.objectives.map((objective) => ({ setId: set.id, objectiveId: objective.id }));

// ── Construcción ───────────────────────────────────────────────────────────

interface BuildOptions {
  level: AlignmentLevel;
  /** Filtro por texto sobre las tarjetas que no son de empresa. */
  search?: string;
}

/**
 * El grafo del ciclo en un nivel concreto, ya colocado en columnas.
 *
 * Las alineaciones que apuntan a un objetivo de empresa que ya no existe se
 * ignoran en silencio: el objetivo pudo borrarse en el paso anterior, y una
 * flecha hacia la nada no es información, es ruido.
 */
export function buildAlignmentGraph(
  draft: CicloDraft,
  { level, search = "" }: BuildOptions
): AlignmentGraph {
  const segmentBy = draft.assignment.groupSegmentBy;
  const companyObjectives = draft.useCompanyObjectives ? draft.companyObjectives : [];
  const companyIds = new Set(companyObjectives.map((objective) => objective.id));

  const objectiveById = new Map<string, Objective>();
  draft.objectiveSets.forEach((set) => {
    set.objectives.forEach((objective) => {
      objectiveById.set(`${set.id}:${objective.id}`, objective);
    });
  });

  /** La alineación viva de un objetivo, o null si apunta a algo que ya no está. */
  const livingAlignment = (objective: Objective): string | null =>
    objective.alignedTo !== null && companyIds.has(objective.alignedTo)
      ? objective.alignedTo
      : null;

  const alignmentOf = (ref: ObjectiveRef): string | null => {
    const objective = objectiveById.get(`${ref.setId}:${ref.objectiveId}`);
    return objective ? livingAlignment(objective) : null;
  };

  const contributors =
    level === "objetivos"
      ? objectiveNodes(draft, livingAlignment)
      : level === "agrupacion"
        ? targetNodes(draft, segmentBy, alignmentOf)
        : personNodes(draft, segmentBy, alignmentOf, search);

  const matches = (node: AlignmentNode): boolean => {
    const needle = search.trim().toLowerCase();
    if (needle === "") return true;
    return (
      node.title.toLowerCase().includes(needle) ||
      node.subtitle.toLowerCase().includes(needle)
    );
  };

  // El buscador solo recorta las columnas de contribución: esconder el norte
  // dejaría flechas apuntando fuera del mapa.
  const keptColumnOne = contributors.nodes.filter(
    (node) => node.column !== 1 || matches(node)
  );
  const keptIds = new Set(keptColumnOne.map((node) => node.id));
  // Una columna 2 (los orígenes de una persona) solo se sostiene mientras le
  // quede alguien a quien apuntar.
  const reachableFromKept = new Set(
    contributors.edges
      .filter((edge) => keptIds.has(edge.to))
      .map((edge) => edge.from)
  );
  const keptNodes = keptColumnOne.filter(
    (node) => node.column < 2 || reachableFromKept.has(node.id)
  );
  const keptNodeIds = new Set(keptNodes.map((node) => node.id));

  const companyNodes = companyObjectives.map<AlignmentNode>((objective, index) => {
    // Se cuentan objetivos distintos, no flechas: un set compartido por dos
    // grupos dibuja dos flechas, pero sigue siendo una sola meta. Contar
    // flechas haría que el mismo ciclo tuviera "3 aportes" en un nivel y "6"
    // en el siguiente.
    const incoming = contributors.edges.filter(
      (edge) => edge.to === companyNodeId(objective.id) && keptNodeIds.has(edge.from)
    );
    const total = new Set(
      incoming.flatMap((edge) => edge.refs.map((ref) => `${ref.setId}:${ref.objectiveId}`))
    ).size;
    return {
      id: companyNodeId(objective.id),
      kind: "company",
      column: 0,
      title: objectiveTitle(objective),
      subtitle:
        objective.description.trim() === ""
          ? "Objetivo de la empresa"
          : objective.description.trim(),
      badge: total === 0 ? "Sin aportes" : plural(total, "aporte", "aportes"),
      note: null,
      objectiveRefs: [],
      alignedTo: [],
      width: NODE_WIDTH,
      height: NODE_HEIGHT.company,
      x: 0,
      y: index * (NODE_HEIGHT.company + NODE_GAP),
    };
  });

  const nodes = [...companyNodes, ...keptNodes];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = contributors.edges.filter(
    (edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)
  );

  return {
    nodes: layoutColumns(nodes, companyObjectives.map((objective) => objective.id)),
    edges,
    hiddenCount: contributors.hiddenCount,
    filteredCount: contributors.nodes.length - keptNodes.length,
  };
}

export const companyNodeId = (objectiveId: string): string => `co:${objectiveId}`;

/** El id de empresa detrás de un nodo de la columna 0, o null. */
export const companyIdOfNode = (nodeId: string): string | null =>
  nodeId.startsWith("co:") ? nodeId.slice(3) : null;

interface ContributorLayer {
  nodes: AlignmentNode[];
  edges: AlignmentEdge[];
  hiddenCount: number;
}

// ── Nivel: objetivos ───────────────────────────────────────────────────────

function objectiveNodes(
  draft: CicloDraft,
  livingAlignment: (objective: Objective) => string | null
): ContributorLayer {
  const nodes: AlignmentNode[] = [];
  const edges: AlignmentEdge[] = [];

  draft.objectiveSets.forEach((set) => {
    set.objectives.forEach((objective) => {
      const id = `ob:${set.id}:${objective.id}`;
      const aligned = livingAlignment(objective);

      nodes.push({
        id,
        kind: "objective",
        column: 1,
        title: objectiveTitle(objective),
        subtitle: setTargetsSummary(set),
        badge: `${objective.weight} %`,
        note: set.kind === "individual" ? "Individual" : "Grupal",
        objectiveRefs: [{ setId: set.id, objectiveId: objective.id }],
        alignedTo: aligned === null ? [] : [aligned],
        width: NODE_WIDTH,
        height: NODE_HEIGHT.objective,
        x: 0,
        y: 0,
      });

      if (aligned !== null) {
        edges.push({
          id: `e:${id}`,
          from: id,
          to: companyNodeId(aligned),
          strength: 1,
          refs: [{ setId: set.id, objectiveId: objective.id }],
          removable: true,
        });
      }
    });
  });

  return { nodes, edges, hiddenCount: 0 };
}

// ── Nivel: agrupación ──────────────────────────────────────────────────────

function targetNodes(
  draft: CicloDraft,
  segmentBy: SegmentKey,
  alignmentOf: (ref: ObjectiveRef) => string | null
): ContributorLayer {
  const nodes: AlignmentNode[] = [];
  const edges: AlignmentEdge[] = [];

  draft.objectiveSets.forEach((set) => {
    const refs = refsOfSet(set);
    const perCompany = new Map<string, ObjectiveRef[]>();
    refs.forEach((ref) => {
      const aligned = alignmentOf(ref);
      if (aligned === null) return;
      perCompany.set(aligned, [...(perCompany.get(aligned) ?? []), ref]);
    });

    set.targetIds.forEach((targetId) => {
      const id = `tg:${set.id}:${targetId}`;
      nodes.push({
        id,
        kind: "target",
        column: 1,
        title: targetLabel(set, targetId),
        subtitle: targetHint(set, targetId, segmentBy),
        badge: plural(set.objectives.length, "objetivo", "objetivos"),
        note:
          set.targetIds.length > 1
            ? `Comparte objetivos con ${set.targetIds.length - 1} más`
            : null,
        objectiveRefs: refs,
        alignedTo: [...perCompany.keys()],
        width: NODE_WIDTH,
        height: NODE_HEIGHT.target,
        x: 0,
        y: 0,
      });

      perCompany.forEach((alignedRefs, companyId) => {
        edges.push({
          id: `e:${id}:${companyId}`,
          from: id,
          to: companyNodeId(companyId),
          strength: alignedRefs.length,
          refs: alignedRefs,
          removable: true,
        });
      });
    });
  });

  return { nodes, edges, hiddenCount: 0 };
}

// ── Nivel: colaboradores ───────────────────────────────────────────────────

interface PersonEntry {
  refs: ObjectiveRef[];
  /** Etiqueta del grupo (o "Objetivos individuales") → objetivos que aporta. */
  origins: Map<string, ObjectiveRef[]>;
}

function personNodes(
  draft: CicloDraft,
  segmentBy: SegmentKey,
  alignmentOf: (ref: ObjectiveRef) => string | null,
  search: string
): ContributorLayer {
  const byPerson = new Map<string, PersonEntry>();

  const record = (personId: string, origin: string, refs: readonly ObjectiveRef[]) => {
    const entry: PersonEntry = byPerson.get(personId) ?? {
      refs: [],
      origins: new Map<string, ObjectiveRef[]>(),
    };
    entry.refs.push(...refs);
    entry.origins.set(origin, [...(entry.origins.get(origin) ?? []), ...refs]);
    byPerson.set(personId, entry);
  };

  draft.objectiveSets.forEach((set) => {
    const refs = refsOfSet(set);
    if (refs.length === 0) return;

    if (set.kind === "individual") {
      set.targetIds.forEach((personId) => record(personId, INDIVIDUAL_ORIGIN, refs));
      return;
    }

    // En un set grupal, cada persona entra por el grupo al que pertenece —
    // ese grupo es lo que el mapa dibuja detrás de ella.
    set.targetIds.forEach((targetId) => {
      objectiveSetMemberIds({ ...set, targetIds: [targetId] }, segmentBy).forEach((personId) =>
        record(personId, targetId, refs)
      );
    });
  });

  const ordered = [...byPerson.entries()].sort((a, b) => {
    const byOrigins = b[1].origins.size - a[1].origins.size;
    if (byOrigins !== 0) return byOrigins;
    const byCount = b[1].refs.length - a[1].refs.length;
    if (byCount !== 0) return byCount;
    return personName(a[0]).localeCompare(personName(b[0]), "es");
  });

  // A quién dibuja este nivel. Una persona que solo recibe las metas de su
  // área ya está contada por la tarjeta de su área; lo que este mapa tiene
  // que enseñar es a quien no cabe ahí: quien recibe metas de más de un
  // frente y quien tiene asignación propia. Si no hay nadie así, se cae a
  // las que más objetivos cargan, y el paso avisa del recorte.
  const isCrossContributor = (entry: PersonEntry): boolean =>
    entry.origins.size > 1 || entry.origins.has(INDIVIDUAL_ORIGIN);
  const focus = ordered.filter(([, entry]) => isCrossContributor(entry));
  const pool = focus.length > 0 ? focus : ordered;
  const searching = search.trim() !== "";
  const matching = searching
    ? ordered.filter(([personId]) =>
        personMatches(personId, search)
      )
    : pool;
  const shown = matching.slice(0, MAX_PERSON_NODES);

  const nodes: AlignmentNode[] = [];
  const edges: AlignmentEdge[] = [];

  /** Los orígenes se comparten entre personas: una sola tarjeta por grupo. */
  const originRefs = new Map<string, ObjectiveRef[]>();
  const originPeople = new Map<string, number>();

  shown.forEach(([personId, entry]) => {
    const id = `pe:${personId}`;
    const person = PERSON_BY_ID.get(personId);

    const perCompany = new Map<string, ObjectiveRef[]>();
    entry.refs.forEach((ref) => {
      const aligned = alignmentOf(ref);
      if (aligned === null) return;
      perCompany.set(aligned, [...(perCompany.get(aligned) ?? []), ref]);
    });

    nodes.push({
      id,
      kind: "person",
      column: 1,
      title: person?.name ?? "Colaborador",
      subtitle: person?.area ?? "Sin área",
      badge: plural(entry.refs.length, "objetivo", "objetivos"),
      note:
        entry.origins.size > 1
          ? `Recibe metas de ${entry.origins.size} frentes`
          : null,
      objectiveRefs: entry.refs,
      alignedTo: [...perCompany.keys()],
      width: NODE_WIDTH,
      height: NODE_HEIGHT.person,
      x: 0,
      y: 0,
    });

    perCompany.forEach((alignedRefs, companyId) => {
      edges.push({
        id: `e:${id}:${companyId}`,
        from: id,
        to: companyNodeId(companyId),
        strength: alignedRefs.length,
        refs: dedupeRefs(alignedRefs),
        removable: true,
      });
    });

    entry.origins.forEach((refs, origin) => {
      const originId = `or:${origin}`;
      originRefs.set(originId, [...(originRefs.get(originId) ?? []), ...refs]);
      originPeople.set(originId, (originPeople.get(originId) ?? 0) + 1);
      edges.push({
        id: `m:${originId}:${id}`,
        from: originId,
        to: id,
        strength: refs.length,
        refs,
        removable: false,
      });
    });
  });

  originRefs.forEach((refs, originId) => {
    const label = originId.slice(3);
    const isIndividual = label === INDIVIDUAL_ORIGIN;
    // Un mismo objetivo llega a varias personas del grupo; la tarjeta del
    // grupo habla de metas distintas, no de repeticiones.
    const distinct = new Set(refs.map((ref) => `${ref.setId}:${ref.objectiveId}`));
    nodes.push({
      id: originId,
      kind: "origin",
      column: 2,
      title: label,
      subtitle: isIndividual
        ? "Asignación persona a persona"
        : `${SEGMENT_LABELS[segmentBy]} · ${plural(originPeople.get(originId) ?? 0, "persona", "personas")}`,
      badge: plural(distinct.size, "meta", "metas"),
      note: null,
      objectiveRefs: dedupeRefs(refs),
      alignedTo: [],
      width: NODE_WIDTH,
      height: NODE_HEIGHT.origin,
      x: 0,
      y: 0,
    });
  });

  return { nodes, edges, hiddenCount: matching.length - shown.length };
}

/** Cómo se llama el origen de una meta que no viene de ningún grupo. */
const INDIVIDUAL_ORIGIN = "Objetivos individuales";

const personName = (personId: string): string =>
  PERSON_BY_ID.get(personId)?.name ?? "Colaborador";

/** El buscador del nivel de colaboradores mira a todo el directorio del
 *  ciclo, no solo a las tarjetas ya dibujadas: buscar a alguien que el
 *  recorte dejó fuera es justamente para lo que está. */
function personMatches(personId: string, search: string): boolean {
  const needle = search.trim().toLowerCase();
  const person = PERSON_BY_ID.get(personId);
  if (!person) return false;
  return (
    person.name.toLowerCase().includes(needle) ||
    person.area.toLowerCase().includes(needle)
  );
}

const dedupeRefs = (refs: readonly ObjectiveRef[]): ObjectiveRef[] => {
  const seen = new Set<string>();
  const unique: ObjectiveRef[] = [];
  refs.forEach((ref) => {
    const key = `${ref.setId}:${ref.objectiveId}`;
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(ref);
  });
  return unique;
};

// ── Colocación ─────────────────────────────────────────────────────────────

/**
 * Apila cada columna y las centra entre sí.
 *
 * Las tarjetas de contribución se ordenan por el objetivo de empresa al que
 * apuntan, así que las flechas salen casi paralelas en vez de cruzarse: lo
 * que ya está alineado se lee de un vistazo y lo que no cae al final, junto.
 */
function layoutColumns(
  nodes: readonly AlignmentNode[],
  companyOrder: readonly string[]
): AlignmentNode[] {
  const rank = new Map(companyOrder.map((id, index) => [id, index]));
  const byColumn = new Map<number, AlignmentNode[]>();
  nodes.forEach((node) => {
    byColumn.set(node.column, [...(byColumn.get(node.column) ?? []), node]);
  });

  const order = [...byColumn.keys()].sort((a, b) => a - b);

  // Cada columna se dobla en tantas tiras como haga falta para no pasar de
  // `MAX_COLUMN_ROWS`, y se mide antes de colocar nada: la altura de la más
  // alta es la que centra a las demás, y su ancho es lo que empuja a la
  // siguiente hacia la derecha.
  const strips = new Map<number, AlignmentNode[][]>();
  const columnHeight = new Map<number, number>();

  order.forEach((column) => {
    const items = byColumn.get(column)!;
    if (column > 0) {
      items.sort((a, b) => {
        const rankOf = (node: AlignmentNode) =>
          node.alignedTo.length === 0
            ? Number.MAX_SAFE_INTEGER
            : rank.get(node.alignedTo[0]) ?? Number.MAX_SAFE_INTEGER;
        const difference = rankOf(a) - rankOf(b);
        if (difference !== 0) return difference;
        return a.title.localeCompare(b.title, "es");
      });
    }

    const rows = Math.min(MAX_COLUMN_ROWS, Math.max(1, items.length));
    const columnStrips: AlignmentNode[][] = [];
    for (let index = 0; index < items.length; index += rows) {
      columnStrips.push(items.slice(index, index + rows));
    }
    strips.set(column, columnStrips);
    columnHeight.set(
      column,
      Math.max(
        0,
        ...columnStrips.map((strip) =>
          strip.reduce((sum, node) => sum + node.height + NODE_GAP, -NODE_GAP)
        )
      )
    );
  });

  const tallest = Math.max(0, ...columnHeight.values());
  const placed: AlignmentNode[] = [];
  let cursorX = 0;

  order.forEach((column) => {
    const columnStrips = strips.get(column)!;
    columnStrips.forEach((strip, stripIndex) => {
      let y = (tallest - (columnHeight.get(column) ?? 0)) / 2;
      strip.forEach((node) => {
        placed.push({
          ...node,
          x: cursorX + stripIndex * (NODE_WIDTH + NODE_GAP * 2),
          y,
        });
        y += node.height + NODE_GAP;
      });
    });
    cursorX +=
      columnStrips.length * (NODE_WIDTH + NODE_GAP * 2) - NODE_GAP * 2 + COLUMN_GAP;
  });

  return placed;
}
