import {
  HeartHandshake,
  Megaphone,
  Settings2,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Tone } from "@/lib/tone";
import {
  AMBITION_FACTOR,
  type AmbitionLevel,
} from "./aiObjectiveGenerator";
import {
  createBlankObjective,
  type MeasureType,
  type Objective,
  type ObjectiveDirection,
} from "./cicloBuilderTypes";

/**
 * El banco de objetivos: la taxonomía con la que se recorre y las reglas que
 * convierten una entrada del banco en un objetivo real.
 *
 * Está montado sobre los mismos ejes que el banco de preguntas de encuestas
 * —un primer nivel ancho, un segundo nivel dentro— porque es el recorrido que
 * la gente ya sabe hacer aquí: allí es *tipo de encuesta → sección*, aquí es
 * *área → tema*. Y las áreas son deliberadamente las mismas que ordenan las
 * plantillas de ciclo, así que una plantilla no es otra cosa que una
 * selección ya hecha de este banco.
 *
 * Lo que **no** es una carpeta es el nivel de ambición. "Subir las ventas"
 * retador y "subir las ventas" agresivo no son dos objetivos: son el mismo con
 * otra meta. Guardarlos por separado triplicaría el banco a base de duplicados
 * casi idénticos, así que cada entrada trae una sola pareja de cifras —la
 * retadora— y las otras dos se derivan estirando la distancia entre salida y
 * meta, exactamente con el mismo factor que ya usa el generador de IA.
 */

/**
 * A quién se le pone el objetivo.
 *
 * No es un filtro más: es lo que hace que el banco sirva en los tres pasos.
 * Un objetivo de compañía ("la facturación del negocio") no se le puede pedir
 * a una persona, y uno individual ("cerrar mis 8 negocios del trimestre") no
 * dice nada puesto a nivel de empresa. El paso en el que está abierto el
 * constructor decide cuál de los tres se muestra, sin preguntar.
 */
export type ObjectiveScope = "empresa" | "grupo" | "individual";

export interface ObjectiveScopeMeta {
  label: string;
  /** Cómo se presenta el banco cuando está filtrado a este alcance. */
  headline: string;
}

export const OBJECTIVE_SCOPE_META: Readonly<Record<ObjectiveScope, ObjectiveScopeMeta>> = {
  empresa: {
    label: "Objetivos de empresa",
    headline: "Resultados de toda la compañía, a los que después se alinea el resto.",
  },
  grupo: {
    label: "Objetivos para grupos",
    headline: "Resultados de un área o un equipo, compartidos por todos sus miembros.",
  },
  individual: {
    label: "Objetivos individuales",
    headline: "Lo que una sola persona puede mover con su propio trabajo.",
  },
};

/** Una entrada del banco: la redacción, cómo se mide, y las cifras retadoras
 *  de las que salen los otros dos niveles. */
export interface ObjectiveBankItem {
  id: string;
  scope: ObjectiveScope;
  title: string;
  description: string;
  measure: MeasureType;
  /** Siempre null cuando `measure` es "boolean": no hay nada que mover. */
  direction: ObjectiveDirection | null;
  /** Punto de partida y meta del nivel retador. Ambos 0 en los de hito. */
  initial: number;
  target: number;
  /** Ausente (equivale a "ubits") en todo el catálogo semilla. Solo lo trae
   *  un objetivo que un autor guardó desde el constructor. */
  origin?: "ubits" | "custom";
}

export interface ObjectiveBankTheme {
  id: string;
  name: string;
  /** Qué resultado agrupa — la línea bajo el nombre en el selector. */
  description: string;
  items: readonly ObjectiveBankItem[];
  /** Igual que en un objetivo: ausente para los temas del catálogo, presente
   *  solo en uno que un autor creó al guardar su primer objetivo ahí. */
  origin?: "ubits" | "custom";
}

export interface ObjectiveBankArea {
  id: string;
  name: string;
  icon: LucideIcon;
  tone: Tone;
  themes: readonly ObjectiveBankTheme[];
}

/**
 * Los iconos y tonos de las áreas, tomados tal cual de las plantillas.
 *
 * Es la parte visible de que banco y plantillas hablan del mismo mapa: quien
 * reconoce la tile "Comercial" del home reconoce el área "Comercial" del
 * banco sin tener que releerla.
 */
export const BANK_AREA_VISUAL: Readonly<Record<string, { icon: LucideIcon; tone: Tone }>> = {
  comercial: { icon: TrendingUp, tone: "brand" },
  marketing: { icon: Megaphone, tone: "brand" },
  servicio: { icon: HeartHandshake, tone: "positive" },
  operaciones: { icon: Settings2, tone: "warning" },
  finanzas: { icon: Wallet, tone: "positive" },
  gente: { icon: Users, tone: "neutral" },
};

// ── Cifras ─────────────────────────────────────────────────────────────────

const NUMBER_FORMAT = new Intl.NumberFormat("es-CO");

/** Cómo se escribe una cifra según lo que mide: el dinero con separador de
 *  miles, el resto tal cual — los campos del constructor guardan texto, no
 *  números, y ahí es donde acaba esto. */
const writeValue = (measure: MeasureType, value: number): string =>
  measure === "money" ? NUMBER_FORMAT.format(value) : String(Math.round(value));

/**
 * Las cifras de una entrada en el nivel pedido.
 *
 * Lo que estira la ambición es la distancia entre salida y meta, nunca la
 * salida: dónde está hoy la compañía es un hecho, no una decisión. Un
 * porcentaje además se queda dentro de 0–100, que es la única frontera que
 * este dominio tiene de verdad.
 */
export function bankItemValues(
  item: ObjectiveBankItem,
  ambition: AmbitionLevel
): { initialValue: string; targetValue: string } {
  if (item.measure === "boolean") return { initialValue: "", targetValue: "" };

  const stretched = item.initial + (item.target - item.initial) * AMBITION_FACTOR[ambition];
  const bounded =
    item.measure === "percentage" ? Math.min(100, Math.max(0, stretched)) : Math.max(0, stretched);

  return {
    initialValue: writeValue(item.measure, item.initial),
    targetValue: writeValue(item.measure, bounded),
  };
}

/**
 * Una entrada del banco como objetivo real, listo para el constructor.
 *
 * Se construye de nuevo en cada llamada: dos objetivos nacidos de la misma
 * entrada no pueden compartir id, o editar uno editaría el otro.
 */
export const bankItemToObjective = (
  item: ObjectiveBankItem,
  ambition: AmbitionLevel,
  weight: number
): Objective => ({
  ...createBlankObjective(weight),
  title: item.title,
  description: item.description,
  measure: item.measure,
  direction: item.direction,
  ...bankItemValues(item, ambition),
});
