import type { LucideIcon } from "lucide-react";
import { FileSignature, FileSpreadsheet, ListChecks, Users } from "lucide-react";

/**
 * El catálogo del centro de descargas del ciclo.
 *
 * Cuatro archivos y tres preguntas distintas. Los dos CSV son los que el
 * producto ya entrega —el detalle, una fila por objetivo de cada persona, y el
 * progreso, una fila por persona— con sus mismas columnas, para que un archivo
 * bajado de este prototipo se pueda pegar al lado de uno real sin traducir
 * nada. El tercero es el que faltaba: la lectura general de cada colaborador
 * —estado, avance, desempeño— sin el detalle objetivo por objetivo. Y el
 * cuarto no es data sino un documento: la carta individual que se firma.
 */

/** Cada archivo que el centro de descargas puede producir. */
export type CicloReportKind = "detalle" | "progreso" | "usuarios" | "individual";

/**
 * Los bloques de la carta individual, en el orden en que se imprimen.
 *
 * Los datos del colaborador y el encabezado del ciclo no están en la lista: son
 * el documento mismo, no contenido opcional. Lo que se puede apagar es lo que
 * cambia según para qué se imprime — una copia para el archivo de Gestión
 * Humana lleva firmas; una para revisar avance en un uno a uno, no.
 */
export type CicloIndividualSectionId = "avance" | "objetivos" | "firmas";

export interface CicloIndividualSectionDefinition {
  id: CicloIndividualSectionId;
  label: string;
  description: string;
}

export const CICLO_INDIVIDUAL_SECTIONS: readonly CicloIndividualSectionDefinition[] = [
  {
    id: "avance",
    label: "Avance y nivel de desempeño",
    description: "El porcentaje del colaborador, su estado y el nivel de la escala configurada",
  },
  {
    id: "objetivos",
    label: "Detalle por objetivo",
    description:
      "Un bloque por objetivo: valor inicial, meta, dirección, avance reportado, peso, cumplimiento y estado",
  },
  {
    id: "firmas",
    label: "Bloque de firmas",
    description: "La firma del líder con la fecha de emisión, y la del colaborador en blanco",
  },
];

/**
 * Los cortes por los que se puede pedir un reporte masivo.
 *
 * Son los campos que el directorio ya trae, no una lista deseada: el grupo del
 * ciclo, y del colaborador su área, su líder, su país, su rango de edad, su
 * género y el grupo ad-hoc en el que esté. No hay ciudad — el directorio de
 * este prototipo llega hasta país.
 */
export type CicloDemographicKey =
  | "grupo"
  | "area"
  | "leader"
  | "country"
  | "age"
  | "gender"
  | "customGroup";

/**
 * A quién cubre el reporte: o a las personas que se eligieron una por una, o a
 * todo el que caiga en un corte del directorio.
 *
 * Son dos modos y no un solo saco de filtros porque son dos intenciones
 * distintas: "la carta de estas tres personas" y "las cartas de todo
 * Tecnología". Mezclarlas en una sola lista de casillas obliga a quien pide un
 * equipo completo a marcar sus cuarenta nombres a mano.
 */
export type CicloAudience =
  | { mode: "individual"; personIds: readonly string[] }
  | { mode: "masivo"; key: CicloDemographicKey; values: readonly string[] };

export type CicloAudienceMode = CicloAudience["mode"];

/**
 * Todo lo que un clic en "Descargar" carga: qué producir y sobre quién.
 *
 * La audiencia y los filtros son los mismos para los cuatro archivos — un
 * reporte recortado a un área tiene que decir lo mismo en el CSV y en la
 * carta— y los bloques solo los usa la carta individual.
 */
export interface CicloReportRequest {
  kind: CicloReportKind;
  /** Los bloques que imprime la carta, en el orden del catálogo. */
  individualSections: readonly CicloIndividualSectionId[];
  /**
   * A quién cubre: personas elegidas una por una, o un corte del directorio
   * (área, líder, país…). Vacío en cualquiera de los dos modos es todo el ciclo.
   */
  audience: CicloAudience;
  /** Estados de avance que entran. Vacío es todos. */
  estadoFilter: readonly string[];
  /** Niveles de desempeño que entran. Vacío es todos. */
  nivelFilter: readonly string[];
}

export interface CicloReportTypeDefinition {
  kind: CicloReportKind;
  title: string;
  description: string;
  /** Chip corto del formato y la palabra que usa el botón: "Descargar CSV". */
  format: "CSV" | "PDF";
  icon: LucideIcon;
  /** Con qué arranca el nombre del archivo. */
  fileSlug: string;
  /** Tamaño aproximado de la preparación simulada, en milisegundos. */
  prepareMs: number;
}

export const CICLO_REPORT_TYPES: readonly CicloReportTypeDefinition[] = [
  {
    kind: "detalle",
    title: "Detalle del ciclo (CSV)",
    description: "Una fila por objetivo de cada colaborador, con su meta, sus límites y su avance",
    format: "CSV",
    icon: ListChecks,
    fileSlug: "detalle-ciclo",
    prepareMs: 4200,
  },
  {
    kind: "progreso",
    title: "Progreso del ciclo (CSV)",
    description: "Una fila por participante con su porcentaje de avance",
    format: "CSV",
    icon: FileSpreadsheet,
    fileSlug: "progreso-ciclo",
    prepareMs: 2600,
  },
  {
    kind: "usuarios",
    title: "Estado por usuario (CSV)",
    description: "Una fila por persona: avance, estado y nivel de desempeño, sin el detalle por objetivo",
    format: "CSV",
    icon: Users,
    fileSlug: "estado-usuarios-ciclo",
    prepareMs: 3000,
  },
  {
    kind: "individual",
    title: "Reporte individual (PDF)",
    description: "Una carta por colaborador con su avance, sus objetivos y el espacio para firmar",
    format: "PDF",
    icon: FileSignature,
    fileSlug: "reporte-individual",
    prepareMs: 6800,
  },
];

export const cicloReportTypeFor = (kind: CicloReportKind): CicloReportTypeDefinition =>
  CICLO_REPORT_TYPES.find((candidate) => candidate.kind === kind) ?? CICLO_REPORT_TYPES[0];

/** Una entrada de la lista de "Descargas" y del widget flotante. */
export interface CicloDownloadEntry {
  id: string;
  kind: CicloReportKind;
  fileName: string;
  format: "CSV" | "PDF";
  status: "preparing" | "ready";
  /** 0–100 mientras `preparing`; clavado en 100 al pasar a `ready`. */
  progress: number;
  startedAt: number;
  /**
   * Cierto en cuanto el archivo llegó al navegador. La entrega es automática al
   * terminar la preparación, así que normalmente es `true` en el mismo momento
   * en que `status` pasa a `ready`: solo se queda en `false` cuando el
   * navegador rechazó el traspaso, que es lo que hace aparecer "Reintentar".
   */
  delivered: boolean;
  /** Genera y entrega el archivo. `false` cuando el navegador lo rechazó. */
  deliver: () => boolean;
  /** La configuración con la que se armó, para poder mostrarla en el detalle. */
  request: CicloReportRequest;
}
