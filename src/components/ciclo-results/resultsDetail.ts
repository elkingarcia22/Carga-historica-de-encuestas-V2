/**
 * El detalle que hay detrás de cada tramo del resumen.
 *
 * Un gráfico del resumen contesta "cuántos"; la pregunta que sigue siempre es
 * "cuáles". Hasta ahora esa segunda pregunta se contestaba yéndose a otra
 * pestaña con un filtro puesto y buscando a mano en una tabla de mil filas, y
 * el camino de vuelta —quitar el filtro, volver al resumen— había que
 * desandarlo entero para mirar el tramo de al lado.
 *
 * Aquí cada tarjeta del resumen se describe como una *dimensión*: un reparto
 * con sus tramos y, dentro de cada tramo, la lista de quién o de qué está
 * ahí. El drawer que la muestra es uno solo para todas —el mismo armazón, la
 * misma lista, el mismo pie— y los tramos de la dimensión son sus pestañas:
 * se entra por el tramo que se pulsó y se salta a "Bueno" o a "Excelente" sin
 * cerrar nada.
 *
 * Los tramos no viajan con su color crudo sino con un *tono* del sistema, y
 * las filas con el estado configurado entero en vez de un hex: las píldoras y
 * los contadores del drawer se pintan con las mismas parejas legibles que usa
 * el resto de la app (`getEstadoBadgeConfig`, `toneChip`) y no con el color
 * del gráfico puesto sobre blanco, que en amarillo no se lee.
 *
 * Todo sale del mismo agregado que dibujó el gráfico, así que la cifra de la
 * pestaña y el largo de la lista no pueden discrepar: son la misma población
 * contada y listada.
 */

import {
  Activity,
  BarChart3,
  CheckCircle2,
  Gauge,
  Link2,
  ListChecks,
  MessageSquareText,
  Ruler,
  Target,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import type { Tone } from "@/lib/tone";
import { MEASURE_META, MEASURE_ORDER } from "@/components/ciclo-builder";
import { formatRelativeDate } from "@/components/ciclo-detail";
import type {
  NivelDesempenoConfig,
  ObjetivoEstadoConfig,
} from "@/components/objetivos/objetivosConfigStore";
import {
  APPROVAL_META,
  APPROVAL_ORDER,
  LIFECYCLE_META,
  approvalStateOf,
  type ObjectiveLifecycle,
} from "./objectiveLifecycle";
import {
  RISK_META,
  RISK_ORDER,
  type CicloResults,
  type PersonResultRow,
  type ResultEntry,
  type RiskLevel,
} from "./resultsModel";
import { BREAKDOWN_META, breakdownBars, breakdownValueOf, type BreakdownKey } from "./resultsBreakdown";
import type { FilterKey } from "./useResultsFilters";

/** Qué tarjeta del resumen se está abriendo. */
export type DetailDimensionKey =
  | "alineacion"
  | "niveles"
  | "risks"
  | "approvals"
  | "estados"
  | "measures"
  | "progreso"
  | "meta"
  | "conversacion"
  | "breakdown";

/** Una fila de la lista: una persona o un objetivo, ya resuelto para leerse. */
export interface DetailRow {
  id: string;
  /** El nombre de la persona o el título del objetivo. */
  name: string;
  /** La línea gris de debajo: de dónde es o de quién es. */
  meta: string;
  /** Lo que aporta esta dimensión y no se ve en las otras dos líneas. */
  detail: string;
  /** 0–100, o null cuando el cumplimiento no explica nada en este tramo. */
  percent: number | null;
  /**
   * La banda configurada, entera, para que la fila dibuje la píldora del
   * sistema. Va en null cuando el tramo ya *es* esa banda y repetirla en cada
   * fila sería pintar la misma píldora cien veces.
   */
  estado: ObjetivoEstadoConfig | null;
  /** La etapa del flujo, solo donde es ella la que explica la fila. */
  lifecycle: ObjectiveLifecycle | null;
  /** Para buscar sin volver a componer las tres líneas en cada tecla. */
  haystack: string;
}

/** Un tramo del reparto, con su gente o sus objetivos dentro. */
export interface DetailBucket {
  id: string;
  label: string;
  /** El tono del sistema con el que se pinta su contador en la pestaña. */
  tone: Tone;
  /** Qué significa este tramo, en la voz de quien lo va a leer. */
  hint: string;
  rows: readonly DetailRow[];
  /**
   * Con qué valor se angosta el reporte entero a este tramo, o null cuando el
   * tramo no es un filtro —"los que no llegaron a la meta" son cuatro etapas
   * distintas y no hay un valor que las nombre—.
   */
  filterValue: string | null;
}

export interface DetailDimension {
  key: DetailDimensionKey;
  title: string;
  /** El glifo de la tarjeta, en el chip de tono que usa todo drawer. */
  icon: LucideIcon;
  /** La línea bajo el título del drawer. */
  hint: string;
  /** Qué se lista: gente u objetivos. Decide la forma de cada fila. */
  subject: "persona" | "objetivo";
  /** El filtro global al que pertenecen los tramos, si tienen uno. */
  filterKey: FilterKey | null;
  buckets: readonly DetailBucket[];
}

/** Los cuatro tonos de la cuadrícula de medidas. Viven aquí porque el gráfico
 *  y su drawer tienen que pintar el mismo tramo del mismo color. */
export const MEASURE_COLORS = ["#4F46E5", "#0EA5E9", "#8B5CF6", "#14B8A6"];

/**
 * La paleta para repartos cuyas categorías no traen color configurado —los
 * objetivos de la empresa, por ejemplo—.
 *
 * Son matices sin lectura a propósito: sirven para distinguir tramos, no para
 * decir que uno va bien y otro mal. El gris del final es del cajón de "nada":
 * lo que no está alineado a ningún objetivo de empresa no es una categoría
 * más, es la ausencia de una.
 */
export const CATEGORY_COLORS = [
  "#4F46E5",
  "#0EA5E9",
  "#8B5CF6",
  "#14B8A6",
  "#F59E0B",
  "#EC4899",
];

export const EMPTY_BUCKET_COLOR = "#CBD5E1";

/** El color de cada banda de alineación. Vive aquí, junto a la dimensión que
 *  abre su drawer, por la misma razón que los tonos de las medidas: el
 *  gráfico y su detalle tienen que pintar el mismo tramo del mismo color.
 *  No es un semáforo inventado — la escala tiene dirección: estar conectado
 *  con la estrategia es mejor que no estarlo. */
export const ALIGNMENT_COLORS: Readonly<Record<string, string>> = {
  total: "var(--color-positive)",
  parcial: "var(--color-warning)",
  ninguna: "var(--color-negative)",
};

// ── Del color configurado al tono del sistema ──────────────────────────────

/**
 * El tono con el que se pinta un tramo.
 *
 * Los estados traen su `variant`, que ya es esta misma escala con otro
 * nombre; los niveles de cumplimiento solo traen un hex, así que se reconoce por
 * la paleta con la que se configuran —la misma tabla que `getEstadoBadgeConfig`
 * usa para traducir un hex a una pareja de clases legible—. Lo que no se
 * reconozca cae en el azul de marca, que es el tono sin lectura: es mejor no
 * decir nada que decir "esto va mal" por un color parecido.
 */
const HEX_TONES: Readonly<Record<string, Tone>> = {
  "#22C55E": "positive",
  "#86EFAC": "positive",
  "#10B981": "positive",
  "#FCD34D": "warning",
  "#EAB308": "warning",
  "#F59E0B": "warning",
  "#FDBA74": "warning",
  "#F97316": "warning",
  "#EF4444": "negative",
  "#FCA5A5": "negative",
  "#DC2626": "negative",
  "#CBD5E1": "neutral",
  "#A78BFA": "neutral",
};

export const toneForHex = (hex: string): Tone => HEX_TONES[hex.toUpperCase()] ?? "brand";

const toneForEstadoConfig = (estado: ObjetivoEstadoConfig): Tone =>
  estado.variant === "info" ? "brand" : estado.variant;

const toneForNivel = (nivel: NivelDesempenoConfig): Tone => toneForHex(nivel.colorHex);

const RISK_TONES: Readonly<Record<RiskLevel, Tone>> = {
  alto: "negative",
  medio: "warning",
  bajo: "brand",
  "sin-riesgo": "positive",
};

// ── Filas ──────────────────────────────────────────────────────────────────

interface RowOptions {
  /** Repetir la píldora de estado en cada fila. Falso cuando el tramo ya es
   *  ese estado y la píldora no distinguiría una fila de la siguiente. */
  estado?: boolean;
  percent?: boolean;
  lifecycle?: boolean;
}

function personRow(row: PersonResultRow, options?: RowOptions): DetailRow {
  const total = row.entries.length;
  return {
    id: row.person.id,
    name: row.collaborator.name,
    meta: `${row.area} · ${row.leader}`,
    detail:
      total === 0
        ? "Sin objetivos asignados"
        : `${row.reportedCount} de ${total} ${total === 1 ? "objetivo" : "objetivos"} con avance`,
    percent: options?.percent === false ? null : row.percent,
    estado: options?.estado === false ? null : row.estado,
    lifecycle: null,
    haystack: `${row.collaborator.name} ${row.area} ${row.leader}`.toLowerCase(),
  };
}

function entryRow(entry: ResultEntry, options?: RowOptions): DetailRow {
  const name = entry.objective.title || "Objetivo sin nombre";
  const person = entry.person.collaborator;
  return {
    id: `${entry.personId}::${entry.objective.id}`,
    name,
    meta: `${person.name} · ${person.area}`,
    detail: entry.lastUpdate
      ? `Último avance ${formatRelativeDate(entry.lastUpdate.date)}`
      : "Sin avances reportados",
    percent: options?.percent === false ? null : entry.percent,
    estado: options?.estado === false ? null : entry.estado,
    lifecycle: options?.lifecycle ? entry.lifecycle : null,
    haystack: `${name} ${person.name} ${person.area}`.toLowerCase(),
  };
}

/** El que va más atrás primero: la lista se abre por donde hay que actuar. */
const byPercent = (a: DetailRow, b: DetailRow): number =>
  (a.percent ?? 0) - (b.percent ?? 0) || a.name.localeCompare(b.name, "es");

const people = (rows: readonly PersonResultRow[], options?: RowOptions): DetailRow[] =>
  rows.map((row) => personRow(row, options)).sort(byPercent);

const objectives = (entries: readonly ResultEntry[], options?: RowOptions): DetailRow[] =>
  entries.map((entry) => entryRow(entry, options)).sort(byPercent);

// ── Dimensiones ────────────────────────────────────────────────────────────

/**
 * La dimensión que hay detrás de una tarjeta del resumen.
 *
 * `results` es el mismo agregado que dibujó el gráfico —el ya recortado por
 * los filtros, si los hay—, así que los tramos traen exactamente la población
 * que la tarjeta contó.
 */
export function buildDetailDimension(
  results: CicloResults,
  key: DetailDimensionKey,
  breakdown: BreakdownKey
): DetailDimension {
  switch (key) {
    case "niveles":
      return {
        key,
        icon: Gauge,
        title: "Niveles de cumplimiento",
        hint: "Cada persona cae en un nivel según su cumplimiento ponderado del ciclo.",
        subject: "persona",
        filterKey: "niveles",
        buckets: results.niveles.map((nivel) => ({
          id: nivel.id,
          label: nivel.nombre,
          tone: toneForNivel(nivel),
          hint: `Cumplimiento entre ${nivel.minPorcentaje} % y ${nivel.maxPorcentaje} %.`,
          filterValue: nivel.id,
          rows: people(results.scored.filter((row) => row.nivel?.id === nivel.id)),
        })),
      };

    case "risks":
      return {
        key,
        icon: TrendingDown,
        title: "Riesgo",
        hint: "El avance de cada persona comparado con el calendario ya corrido.",
        subject: "persona",
        filterKey: "risks",
        buckets: RISK_ORDER.map((id) => ({
          id,
          label: RISK_META[id].label,
          tone: RISK_TONES[id],
          hint: RISK_META[id].description,
          filterValue: id,
          rows: people(results.scored.filter((row) => row.risk === id)),
        })),
      };

    case "approvals":
      return {
        key,
        icon: CheckCircle2,
        title: "Aprobación de objetivos",
        hint: "En qué punto de la revisión del líder está cada objetivo.",
        subject: "objetivo",
        filterKey: "approvals",
        buckets: APPROVAL_ORDER.map((id) => ({
          id,
          label: APPROVAL_META[id].label,
          tone: id === "aprobado" ? "positive" : id === "denegado" ? "warning" : "neutral",
          hint: APPROVAL_META[id].description,
          filterValue: id,
          // Un objetivo sin aprobar tiene 0 % porque todavía no puede
          // reportar, no porque vaya mal: mostrar ese cero como cumplimiento
          // lo leería como desempeño. En su lugar va la etapa en la que está.
          rows: objectives(
            results.scoredEntries.filter((entry) => approvalStateOf(entry.lifecycle) === id),
            id === "aprobado" ? undefined : { percent: false, estado: false, lifecycle: true }
          ),
        })),
      };

    case "estados":
      return {
        key,
        icon: ListChecks,
        title: "Estado de los objetivos",
        hint: "Las bandas de cumplimiento configuradas, sobre los objetivos ya aprobados.",
        subject: "objetivo",
        filterKey: "estados",
        buckets: results.estados.map((estado) => ({
          id: estado.id,
          label: estado.nombre,
          tone: toneForEstadoConfig(estado),
          hint: `Cumplimiento entre ${estado.minPorcentaje} % y ${estado.maxPorcentaje} %.`,
          filterValue: estado.id,
          rows: objectives(
            results.scoredEntries.filter(
              (entry) => LIFECYCLE_META[entry.lifecycle].isCommitted && entry.estado?.id === estado.id
            ),
            { estado: false }
          ),
        })),
      };

    case "measures":
      return {
        key,
        icon: Ruler,
        title: "Tipo de medida",
        hint: "Con qué unidad se está midiendo cada objetivo del ciclo.",
        subject: "objetivo",
        filterKey: "measures",
        // Las medidas no son estados: ninguna es mejor ni peor que otra, así
        // que ninguna se gana un tono con lectura. El contador va en el azul
        // sólido que el sistema le da a una cantidad sin más.
        buckets: MEASURE_ORDER.map((measure) => ({
          id: measure,
          label: MEASURE_META[measure].label,
          tone: "brand" as Tone,
          hint: `Objetivos medidos con «${MEASURE_META[measure].label}».`,
          filterValue: measure,
          rows: objectives(
            results.scoredEntries.filter((entry) => entry.objective.measure === measure)
          ),
        })),
      };

    case "alineacion": {
      // Solo cuentan los objetivos de empresa que existen: un `alignedTo` que
      // apunta a uno borrado no es una alineación, es una referencia rota.
      const ids = new Set(results.data.companyObjectives.map((objective) => objective.id));
      const bandOf = (row: PersonResultRow): "total" | "parcial" | "ninguna" | null => {
        const active = row.entries.filter((entry) => entry.inactivation === null);
        if (active.length === 0) return null;
        const aligned = active.filter(
          (entry) =>
            entry.objective.alignedTo !== null && ids.has(entry.objective.alignedTo)
        ).length;
        if (aligned === active.length) return "total";
        return aligned === 0 ? "ninguna" : "parcial";
      };

      return {
        key,
        icon: Link2,
        title: "Alineación con la estrategia",
        hint: "Cuántos de los objetivos de cada persona cuelgan de un objetivo de la empresa.",
        subject: "persona",
        // La alineación no es un filtro del reporte: es una lectura que se
        // calcula, no un atributo configurado que se pueda marcar.
        filterKey: null,
        buckets: [
          {
            id: "total",
            label: "Todos sus objetivos alineados",
            tone: "positive" as const,
            hint: "Todo lo que tienen en juego cuelga de un objetivo de la empresa.",
            filterValue: null,
            rows: people(results.scored.filter((row) => bandOf(row) === "total")),
          },
          {
            id: "parcial",
            label: "Solo algunos alineados",
            tone: "warning" as const,
            hint: "Parte de su peso está puesto en objetivos que no cuelgan de ninguno.",
            filterValue: null,
            rows: people(results.scored.filter((row) => bandOf(row) === "parcial")),
          },
          {
            id: "ninguna",
            label: "Ninguno alineado",
            tone: "negative" as const,
            hint: "Todo su peso está fuera de los objetivos de la empresa.",
            filterValue: null,
            rows: people(results.scored.filter((row) => bandOf(row) === "ninguna")),
          },
        ],
      };
    }

    case "progreso":
      return {
        key,
        icon: Activity,
        title: "Avance reportado",
        hint: "Quién ha reportado al menos un avance en alguno de sus objetivos y quién no.",
        subject: "persona",
        // "Reportó" no es un filtro del reporte: es una lectura de la persona
        // y no un atributo configurado, así que el pie de este drawer no
        // ofrece angostar por él.
        filterKey: null,
        buckets: [
          {
            id: "con-avance",
            label: "Reportaron avance",
            tone: "positive",
            hint: "Tienen al menos un avance reportado en el ciclo.",
            filterValue: null,
            rows: people(results.scored.filter((row) => row.reportedCount > 0)),
          },
          {
            id: "sin-avance",
            label: "Sin reportar",
            tone: "neutral",
            hint: "Cuentan en los resultados pero todavía no reportaron nada.",
            filterValue: null,
            rows: people(results.scored.filter((row) => row.reportedCount === 0)),
          },
        ],
      };

    case "meta":
      return {
        key,
        icon: Target,
        title: "Objetivos en meta",
        hint: "Cuáles llegaron al 100 % de su meta y cuáles siguen en camino.",
        subject: "objetivo",
        filterKey: "lifecycles",
        buckets: [
          {
            id: "completado",
            label: "En meta",
            tone: "positive",
            hint: LIFECYCLE_META.completado.description,
            filterValue: "completado",
            rows: objectives(
              results.scoredEntries.filter((entry) => entry.lifecycle === "completado"),
              { estado: false }
            ),
          },
          {
            id: "en-camino",
            label: "Todavía no llegan",
            tone: "neutral",
            hint: "Todo lo demás: desde los que esperan aprobación hasta los que van a mitad de camino.",
            // Cuatro etapas distintas, ningún valor que las nombre: filtrar
            // por "no llegaron" pediría un filtro que el reporte no tiene.
            filterValue: null,
            rows: objectives(
              results.scoredEntries.filter((entry) => entry.lifecycle !== "completado")
            ),
          },
        ],
      };

    case "conversacion":
      return {
        key,
        icon: MessageSquareText,
        title: "Objetivos con conversación",
        hint: "Dónde hubo comentarios en los avances y dónde el objetivo avanza en silencio.",
        subject: "objetivo",
        filterKey: null,
        buckets: [
          {
            id: "con-conversacion",
            label: "Con conversación",
            tone: "positive",
            hint: "Tienen al menos un comentario escrito en su historial de avances.",
            filterValue: null,
            rows: results.scoredEntries
              .filter((entry) => entry.commentCount > 0)
              .map((entry) => ({
                ...entryRow(entry),
                detail: `${entry.commentCount} ${entry.commentCount === 1 ? "comentario" : "comentarios"}`,
              }))
              .sort(byPercent),
          },
          {
            id: "sin-conversacion",
            label: "Sin un solo comentario",
            tone: "neutral",
            hint: "Avanzan sin que nadie haya escrito nada sobre ellos.",
            filterValue: null,
            rows: objectives(results.scoredEntries.filter((entry) => entry.commentCount === 0)),
          },
        ],
      };

    case "breakdown":
    default: {
      const meta = BREAKDOWN_META[breakdown];
      return {
        key: "breakdown",
        icon: BarChart3,
        title: `Avance por ${meta.noun}`,
        hint: `Quién está detrás del promedio de cada ${meta.noun}.`,
        subject: "persona",
        filterKey: meta.filterKey,
        buckets: breakdownBars(results.scored, breakdown).map((bar) => ({
          id: bar.id,
          label: bar.label,
          tone: "brand" as Tone,
          hint: `${bar.people} ${bar.people === 1 ? "persona" : "personas"} · ${Math.round(bar.percent)} % de avance promedio.`,
          filterValue: meta.filterKey === null ? null : bar.id,
          rows: people(
            results.scored.filter(
              (row) =>
                breakdownValueOf(
                  { collaborator: row.collaborator, groupId: row.person.groupId },
                  breakdown
                ) === bar.id
            )
          ),
        })),
      };
    }
  }
}
