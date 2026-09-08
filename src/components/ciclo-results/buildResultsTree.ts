/**
 * El árbol de resultados: secciones y subsecciones.
 *
 * Un ciclo de objetivos tiene jerarquía de verdad —un objetivo de empresa se
 * reparte en objetivos de área, que se reparten en objetivos de persona— y
 * leerla como una tabla plana pierde la única pregunta que importa: *qué está
 * frenando qué*.
 *
 * El mismo árbol se puede recorrer por tres ejes distintos, y son tres
 * lecturas del mismo dato, no tres pantallas:
 *
 *   objetivos     empresa → grupo → objetivo → persona
 *   organización  área → líder → persona → objetivo
 *   medida        tipo de medida → objetivo → persona
 *
 * El primero responde "¿qué objetivo de empresa está en riesgo y por culpa de
 * quién?". El segundo, "¿qué área va mal?". El tercero es el que descubre que
 * todos los objetivos de tipo "Se cumple / No se cumple" están sin reportar.
 */

import { MEASURE_META, MEASURE_ORDER, type MeasureType } from "@/components/ciclo-builder";
import { average, resolveEstado, type CicloDetailData } from "@/components/ciclo-detail";
import { countLifecycles } from "./objectiveLifecycle";
import {
  riskFor,
  type PersonResultRow,
  type ResultEntry,
  type ResultNode,
  type ResultsAxis,
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

// ── Eje: objetivos de empresa ──────────────────────────────────────────────

function buildByObjectives(args: BuildArgs): ResultNode[] {
  const { data, entries } = args;
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

      const byGroup = groupBy(companyEntries, (entry) => entry.person.groupId ?? "Individual");
      const children = [...byGroup.entries()].map(([groupLabel, groupEntries]) => {
        const byObjective = groupBy(groupEntries, (entry) => entry.objective.id);
        const memberPercents = [
          ...new Set(groupEntries.map((entry) => entry.personId)),
        ].map(
          (personId) => args.rows.find((row) => row.person.id === personId)?.percent ?? 0
        );
        return makeNode(
          {
            id: `${companyId}::${groupLabel}`,
            kind: "grupo",
            title: groupLabel === "Individual" ? "Objetivos individuales" : groupLabel,
            subtitle: `${plural(
              new Set(groupEntries.map((entry) => entry.personId)).size,
              "persona",
              "personas"
            )} · ${plural(byObjective.size, "objetivo", "objetivos")}`,
            entries: groupEntries,
            percentOverride: average(memberPercents),
            children: [...byObjective.values()].map((objectiveEntries) =>
              objectiveNode(`${companyId}::${groupLabel}`, objectiveEntries, args)
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

// ── Eje: organización ──────────────────────────────────────────────────────

function buildByOrganization(args: BuildArgs): ResultNode[] {
  const { rows, entries } = args;
  const rowById = new Map(rows.map((row) => [row.person.id, row]));

  const byArea = groupBy(entries, (entry) => entry.person.collaborator.area);

  return [...byArea.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "es"))
    .map(([area, areaEntries]) => {
      const byLeader = groupBy(
        areaEntries,
        (entry) => entry.person.collaborator.leader ?? "Sin líder"
      );

      const leaderNodes = [...byLeader.entries()].map(([leader, leaderEntries]) => {
        const byPerson = groupBy(leaderEntries, (entry) => entry.personId);
        const personNodes = [...byPerson.entries()].map(([personId, personEntries]) => {
          const row = rowById.get(personId);
          return makeNode(
            {
              id: `${area}::${leader}::${personId}`,
              kind: "persona",
              title: row?.collaborator.name ?? personId,
              subtitle: `${plural(personEntries.length, "objetivo", "objetivos")} · ${
                row?.estadoParticipante?.nombre ?? "Activo"
              }`,
              entries: personEntries,
              percentOverride: row?.percent,
              children: personEntries.map((entry) =>
                makeNode(
                  {
                    id: `${area}::${leader}::${personId}::${entry.objective.id}`,
                    kind: "objetivo",
                    title: entry.objective.title || "Objetivo sin nombre",
                    subtitle: `Peso ${entry.objective.weight} %`,
                    entries: [entry],
                    children: [],
                    weight: entry.objective.weight,
                    lifecycle: entry.lifecycle,
                  },
                  args.data,
                  args.config,
                  args.elapsed
                )
              ),
            },
            args.data,
            args.config,
            args.elapsed
          );
        });

        return makeNode(
          {
            id: `${area}::${leader}`,
            kind: "lider",
            title: leader,
            subtitle: plural(personNodes.length, "persona a cargo", "personas a cargo"),
            entries: leaderEntries,
            percentOverride: average(personNodes.map((node) => node.percent)),
            children: personNodes,
          },
          args.data,
          args.config,
          args.elapsed
        );
      });

      return makeNode(
        {
          id: area,
          kind: "area",
          title: area,
          subtitle: `${plural(leaderNodes.length, "líder", "líderes")} · ${plural(
            new Set(areaEntries.map((entry) => entry.personId)).size,
            "persona",
            "personas"
          )}`,
          entries: areaEntries,
          percentOverride: average(leaderNodes.map((node) => node.percent)),
          children: leaderNodes,
        },
        args.data,
        args.config,
        args.elapsed
      );
    });
}

// ── Eje: tipo de medida ────────────────────────────────────────────────────

function buildByMeasure(args: BuildArgs): ResultNode[] {
  const byMeasure = groupBy(
    args.entries,
    (entry) => (entry.objective.measure ?? "numeric") as MeasureType
  );

  return MEASURE_ORDER.filter((measure) => (byMeasure.get(measure)?.length ?? 0) > 0).map(
    (measure) => {
      const measureEntries = byMeasure.get(measure) ?? [];
      const byObjective = groupBy(measureEntries, (entry) => entry.objective.id);
      return makeNode(
        {
          id: `medida::${measure}`,
          kind: "medida",
          title: MEASURE_META[measure].label,
          subtitle: `${MEASURE_META[measure].tagline} · ${plural(
            byObjective.size,
            "objetivo",
            "objetivos"
          )}`,
          entries: measureEntries,
          children: [...byObjective.values()].map((objectiveEntries) =>
            objectiveNode(`medida::${measure}`, objectiveEntries, args)
          ),
        },
        args.data,
        args.config,
        args.elapsed
      );
    }
  );
}

// ── Entrada pública ────────────────────────────────────────────────────────

/**
 * `elapsed` es el calendario contra el que se mide el riesgo de cada nodo.
 * Negativo lo apaga —así entra un ciclo cerrado— y `riskFor` responde
 * "sin riesgo" sin que el árbol tenga que saber por qué.
 */
export function buildResultsTree(
  axis: ResultsAxis,
  data: CicloDetailData,
  rows: readonly PersonResultRow[],
  entries: readonly ResultEntry[],
  config: ResultsConfig,
  elapsed: number
): readonly ResultNode[] {
  const args: BuildArgs = { data, rows, entries, config, elapsed };
  if (axis === "organizacion") return buildByOrganization(args);
  if (axis === "medida") return buildByMeasure(args);
  return buildByObjectives(args);
}

/** Todos los nodos de un árbol, en orden de lectura. */
export function flattenNodes(nodes: readonly ResultNode[]): ResultNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)]);
}
