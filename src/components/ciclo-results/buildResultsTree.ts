/**
 * El árbol de resultados, siempre de objetivos para abajo:
 *
 *   objetivo de empresa → {el corte del "Ver por"} → objetivo → persona
 *
 * Un ciclo de objetivos tiene jerarquía de verdad —un objetivo de empresa se
 * reparte entre grupos y personas— y leerla como una tabla plana pierde la
 * única pregunta que importa: *qué está frenando qué*.
 *
 * El segundo nivel no está quemado: es el mismo "Ver por" de la barra de
 * arriba. Así "¿cómo va el objetivo de ingresos por área?" y "¿y por país?"
 * son el mismo árbol leído con otro corte, en vez de tres árboles distintos
 * con su propio selector. Antes había uno —ejes "organización" y "medida"—
 * que competía con el "Ver por" global: dos controles con la misma etiqueta
 * al lado, contestando cosas distintas.
 */

import { average, resolveEstado, type CicloDetailData } from "@/components/ciclo-detail";
import { countLifecycles } from "./objectiveLifecycle";
import { BREAKDOWN_META, breakdownValueOf, type BreakdownKey } from "./resultsBreakdown";
import {
  countEstados,
  riskFor,
  type PersonResultRow,
  type ResultEntry,
  type ResultNode,
  type ResultsConfig,
} from "./resultsModel";

/** Sin objetivo de empresa al que colgarse, un objetivo va a su propia rama. */
const UNALIGNED_ID = "__sin-alineacion__";
const UNALIGNED_TITLE = "Sin objetivo de empresa";

const plural = (count: number, singular: string, many: string) =>
  `${count} ${count === 1 ? singular : many}`;

interface NodeSeed {
  id: string;
  kind: ResultNode["kind"];
  title: string;
  subtitle: string;
  entries: readonly ResultEntry[];
  children: readonly ResultNode[];
  /** Cuando el avance del nodo no es el promedio de sus entradas sino el
   *  cumplimiento ponderado de unas personas (un área, un grupo). */
  percentOverride?: number;
  weight?: number | null;
  lifecycle?: ResultNode["lifecycle"];
}

function makeNode(seed: NodeSeed, data: CicloDetailData, config: ResultsConfig, elapsed: number): ResultNode {
  const percent =
    seed.percentOverride ?? average(seed.entries.map((entry) => entry.percent));
  const personIds = [...new Set(seed.entries.map((entry) => entry.personId))];
  return {
    id: seed.id,
    kind: seed.kind,
    title: seed.title,
    subtitle: seed.subtitle,
    percent,
    estado: resolveEstado(config.estados, percent, data.status),
    lifecycle: seed.lifecycle ?? null,
    weight: seed.weight ?? null,
    peopleCount: personIds.length,
    objectiveCount: seed.entries.length,
    reportedCount: seed.entries.filter((entry) => entry.hasProgress).length,
    lifecycleCounts: countLifecycles(seed.entries.map((entry) => entry.lifecycle)),
    estadoCounts: countEstados(seed.entries),
    risk: riskFor(percent, elapsed),
    personIds,
    children: seed.children,
  };
}

/** Agrupa entradas por una llave, conservando el orden de aparición. */
function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  items.forEach((item) => {
    const id = key(item);
    const bucket = groups.get(id);
    if (bucket) bucket.push(item);
    else groups.set(id, [item]);
  });
  return groups;
}

interface BuildArgs {
  data: CicloDetailData;
  rows: readonly PersonResultRow[];
  entries: readonly ResultEntry[];
  config: ResultsConfig;
  elapsed: number;
  /** El corte del "Ver por" con el que se abre cada objetivo de empresa. */
  breakdown: BreakdownKey;
}

/** El nodo hoja de una persona dentro de un objetivo. */
function personLeaf(entry: ResultEntry, args: BuildArgs): ResultNode {
  return makeNode(
    {
      id: `${entry.objective.id}::${entry.personId}`,
      kind: "persona",
      title: entry.person.collaborator.name,
      subtitle: entry.person.collaborator.area,
      entries: [entry],
      children: [],
      weight: entry.objective.weight,
      lifecycle: entry.lifecycle,
    },
    args.data,
    args.config,
    args.elapsed
  );
}

/** Un objetivo con las personas que lo llevan colgando. */
function objectiveNode(
  idPrefix: string,
  objectiveEntries: readonly ResultEntry[],
  args: BuildArgs
): ResultNode {
  const first = objectiveEntries[0];
  const people = objectiveEntries.length;
  const achieved = objectiveEntries.filter((entry) => entry.percent >= 100).length;
  return makeNode(
    {
      id: `${idPrefix}::${first.objective.id}`,
      kind: "objetivo",
      title: first.objective.title || "Objetivo sin nombre",
      subtitle:
        people === 1
          ? `${first.person.collaborator.name} · peso ${first.objective.weight} %`
          : `${plural(people, "persona", "personas")} · ${achieved} en meta · peso ${first.objective.weight} %`,
      entries: objectiveEntries,
      children: people === 1 ? [] : objectiveEntries.map((entry) => personLeaf(entry, args)),
      weight: first.objective.weight,
      lifecycle: people === 1 ? first.lifecycle : null,
    },
    args.data,
    args.config,
    args.elapsed
  );
}

function buildByObjectives(args: BuildArgs): ResultNode[] {
  const { data, entries, breakdown } = args;
  const companyById = new Map(data.companyObjectives.map((objective) => [objective.id, objective]));

  const byCompany = groupBy(entries, (entry) => {
    const aligned = entry.objective.alignedTo;
    return aligned && companyById.has(aligned) ? aligned : UNALIGNED_ID;
  });

  // Las ramas salen en el orden en que la empresa escribió sus objetivos; la
  // rama de huérfanos siempre al final, porque es la excepción.
  const order = [...data.companyObjectives.map((objective) => objective.id), UNALIGNED_ID];

  return order
    .filter((companyId) => (byCompany.get(companyId)?.length ?? 0) > 0)
    .map((companyId) => {
      const companyEntries = byCompany.get(companyId) ?? [];
      const company = companyById.get(companyId);

      // El corte del "Ver por": por asignación son los grupos de siempre, por
      // área son las áreas, y así. La rama "Individual" de la asignación se
      // nombra por lo que es —objetivos que nadie recibió por grupo—.
      const byCut = groupBy(companyEntries, (entry) =>
        breakdownValueOf(
          { collaborator: entry.person.collaborator, groupId: entry.person.groupId },
          breakdown
        )
      );
      const children = [...byCut.entries()].map(([cutLabel, cutEntries]) => {
        const byObjective = groupBy(cutEntries, (entry) => entry.objective.id);
        const memberPercents = [
          ...new Set(cutEntries.map((entry) => entry.personId)),
        ].map(
          (personId) => args.rows.find((row) => row.person.id === personId)?.percent ?? 0
        );
        return makeNode(
          {
            id: `${companyId}::${cutLabel}`,
            kind: "grupo",
            title:
              breakdown === "grupo" && cutLabel === "Individual"
                ? "Objetivos individuales"
                : cutLabel,
            subtitle: `${plural(
              new Set(cutEntries.map((entry) => entry.personId)).size,
              "persona",
              "personas"
            )} · ${plural(byObjective.size, "objetivo", "objetivos")}`,
            entries: cutEntries,
            percentOverride: average(memberPercents),
            children: [...byObjective.values()].map((objectiveEntries) =>
              objectiveNode(`${companyId}::${cutLabel}`, objectiveEntries, args)
            ),
          },
          args.data,
          args.config,
          args.elapsed
        );
      });

      return makeNode(
        {
          id: companyId,
          kind: "empresa",
          title: company?.title ?? UNALIGNED_TITLE,
          subtitle:
            company?.description ||
            (companyId === UNALIGNED_ID
              ? "Objetivos que no se alinearon a ninguno de empresa."
              : ""),
          entries: companyEntries,
          percentOverride: average(children.map((child) => child.percent)),
          children,
        },
        args.data,
        args.config,
        args.elapsed
      );
    });
}

// ── Entrada pública ────────────────────────────────────────────────────────

/**
 * `elapsed` es el calendario contra el que se mide el riesgo de cada nodo.
 * Negativo lo apaga —así entra un ciclo cerrado— y `riskFor` responde
 * "sin riesgo" sin que el árbol tenga que saber por qué.
 */
export function buildResultsTree(
  breakdown: BreakdownKey,
  data: CicloDetailData,
  rows: readonly PersonResultRow[],
  entries: readonly ResultEntry[],
  config: ResultsConfig,
  elapsed: number
): readonly ResultNode[] {
  return buildByObjectives({ data, rows, entries, config, elapsed, breakdown });
}

/** Como se titula el árbol con el corte puesto: "Objetivos de empresa por área". */
export const resultsTreeTitle = (breakdown: BreakdownKey): string =>
  `Objetivos de empresa por ${BREAKDOWN_META[breakdown].noun}`;

/** Todos los nodos de un árbol, en orden de lectura. */
export function flattenNodes(nodes: readonly ResultNode[]): ResultNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)]);
}
