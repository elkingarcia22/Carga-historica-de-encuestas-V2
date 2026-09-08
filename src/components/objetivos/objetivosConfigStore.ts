import * as React from "react";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Info,
  Loader,
  XCircle,
  type LucideIcon,
} from "lucide-react";

/**
 * La configuración de "Estados y rangos" del módulo de objetivos, compartida
 * entre el drawer de ajustes (donde se edita) y cualquier lugar que necesite
 * saber qué estado le corresponde a un porcentaje de cumplimiento — como el
 * simulador del paso "¿Cómo se va a calcular el avance?".
 *
 * Vive fuera de React porque el drawer y el simulador no comparten un
 * ancestro común desde el que pasar props: es un store mínimo (suscripción +
 * snapshot) leído con `useSyncExternalStore`, no una librería de estado.
 */

export interface ObjetivoEstadoConfig {
  id: string;
  nombre: string;
  minPorcentaje: number;
  maxPorcentaje: number;
  variant: "neutral" | "warning" | "info" | "positive" | "negative";
  colorHex: string;
  descripcion: string;
  isDefault?: boolean;
}

export const DEFAULT_ESTADOS_OBJETIVOS: ObjetivoEstadoConfig[] = [
  {
    id: "por-iniciar",
    nombre: "Por iniciar",
    minPorcentaje: 0,
    maxPorcentaje: 0,
    variant: "neutral",
    colorHex: "#CBD5E1",
    descripcion: "El objetivo ha sido creado pero aún no reporta avances (0%).",
    isDefault: true,
  },
  {
    id: "resto",
    nombre: "Restó (Negativo)",
    minPorcentaje: -100,
    maxPorcentaje: -1,
    variant: "negative",
    colorHex: "#EF4444",
    descripcion: "El desempeño restó o fue negativo.",
    isDefault: true,
  },
  {
    id: "no-cumplio",
    nombre: "No cumplió",
    minPorcentaje: 0,
    maxPorcentaje: 0,
    variant: "negative",
    colorHex: "#FCA5A5",
    descripcion: "Al cierre del ciclo, el objetivo no alcanzó el umbral mínimo aceptable.",
    isDefault: true,
  },
  {
    id: "no-cumplio-parcialmente",
    nombre: "No cumplió parcialmente",
    minPorcentaje: 1,
    maxPorcentaje: 69,
    variant: "warning",
    colorHex: "#FDBA74",
    descripcion: "El objetivo no alcanzó la meta mínima al cierre.",
    isDefault: true,
  },
  {
    id: "en-progreso",
    nombre: "En progreso",
    minPorcentaje: 1,
    maxPorcentaje: 69,
    variant: "warning",
    colorHex: "#FCD34D",
    descripcion: "El objetivo tiene avances registrados pero está por debajo del umbral esperado.",
    isDefault: true,
  },
  {
    id: "cumplio-parcialmente",
    nombre: "Cumplió parcialmente",
    minPorcentaje: 70,
    maxPorcentaje: 99,
    variant: "info",
    colorHex: "#93C5FD",
    descripcion: "Avance significativo cercano a la meta total.",
    isDefault: true,
  },
  {
    id: "cumplido",
    nombre: "Cumplido",
    minPorcentaje: 100,
    maxPorcentaje: 100,
    variant: "positive",
    colorHex: "#86EFAC",
    descripcion: "El objetivo alcanzó el 100% de la meta fijada.",
    isDefault: true,
  },
  {
    id: "sobrecumplio",
    nombre: "Sobrecumplió",
    minPorcentaje: 101,
    maxPorcentaje: 150,
    variant: "positive",
    colorHex: "#22C55E",
    descripcion: "El objetivo superó el 100% de la meta fijada.",
    isDefault: true,
  },
];

export interface EstadoBadgeConfig {
  bg: string;
  text: string;
  border: string;
  iconColor: string;
  barBg: string;
  Icon: LucideIcon;
}

/**
 * Los colores de "Estados y rangos" (`colorHex`) son tonos pastel pensados
 * para la barra de distribución, no para texto: usarlos tal cual como color
 * de letra sobre su propio fondo tintado da muy poco contraste (el verde
 * pastel de "Cumplió" o el gris de "Por iniciar" son casi ilegibles). Esta
 * función traduce cada estado a la pareja fondo claro / texto oscuro (con su
 * variante `dark:`) que sí cumple contraste, y le suma un ícono.
 */
export function getEstadoBadgeConfig(est: ObjetivoEstadoConfig): EstadoBadgeConfig {
  const hex = est.colorHex?.toUpperCase();
  const id = est.id?.toLowerCase() || "";

  if (hex === "#22C55E" || id === "sobrecumplio") {
    return {
      bg: "bg-green-100/60 dark:bg-green-500/15",
      text: "text-green-800 dark:text-green-300",
      border: "border-green-200/60 dark:border-green-700/40",
      iconColor: "text-green-700 dark:text-green-400",
      barBg: "bg-green-600",
      Icon: CheckCircle,
    };
  }

  if (hex === "#86EFAC" || hex === "#10B981" || est.variant === "positive" || id.includes("cumplido")) {
    if (!id.includes("no-cumplio")) {
      return {
        bg: "bg-emerald-100/60 dark:bg-emerald-500/15",
        text: "text-emerald-800 dark:text-emerald-300",
        border: "border-emerald-200/60 dark:border-emerald-700/40",
        iconColor: "text-emerald-600 dark:text-emerald-400",
        barBg: "bg-emerald-400",
        Icon: CheckCircle,
      };
    }
  }

  if (hex === "#FCD34D" || hex === "#EAB308" || (est.variant === "warning" && id === "en-progreso")) {
    return {
      bg: "bg-amber-100/60 dark:bg-amber-500/15",
      text: "text-amber-800 dark:text-amber-300",
      border: "border-amber-200/60 dark:border-amber-700/40",
      iconColor: "text-amber-600 dark:text-amber-400",
      barBg: "bg-amber-400",
      Icon: Loader,
    };
  }

  if (hex === "#FDBA74" || hex === "#F97316" || id.includes("no-cumplio-parcialmente")) {
    return {
      bg: "bg-orange-100/60 dark:bg-orange-500/15",
      text: "text-orange-800 dark:text-orange-300",
      border: "border-orange-200/60 dark:border-orange-700/40",
      iconColor: "text-orange-600 dark:text-orange-400",
      barBg: "bg-orange-400",
      Icon: AlertTriangle,
    };
  }

  if (hex === "#93C5FD" || hex === "#3B82F6" || est.variant === "info" || id.includes("parcialmente")) {
    return {
      bg: "bg-blue-100/60 dark:bg-blue-500/15",
      text: "text-blue-800 dark:text-blue-300",
      border: "border-blue-200/60 dark:border-blue-700/40",
      iconColor: "text-blue-600 dark:text-blue-400",
      barBg: "bg-blue-400",
      Icon: Info,
    };
  }

  if (hex === "#EF4444" || id === "resto") {
    return {
      bg: "bg-red-200/60 dark:bg-red-500/15",
      text: "text-red-900 dark:text-red-200",
      border: "border-red-300/60 dark:border-red-700/40",
      iconColor: "text-red-700 dark:text-red-400",
      barBg: "bg-red-600",
      Icon: XCircle,
    };
  }

  if (hex === "#FCA5A5" || est.variant === "negative" || id === "no-cumplio") {
    return {
      bg: "bg-red-100/60 dark:bg-red-500/15",
      text: "text-red-800 dark:text-red-300",
      border: "border-red-200/60 dark:border-red-700/40",
      iconColor: "text-red-600 dark:text-red-400",
      barBg: "bg-red-400",
      Icon: XCircle,
    };
  }

  return {
    bg: "bg-slate-100/80 dark:bg-slate-800/40",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-200/60 dark:border-slate-700/50",
    iconColor: "text-slate-500 dark:text-slate-400",
    barBg: "bg-slate-300 dark:bg-slate-600",
    Icon: Clock,
  };
}

export const DEFAULT_ALLOW_NEGATIVE_RESULTS = true;

/**
 * Un nivel de desempeño: la calificación que recibe una persona según su
 * cumplimiento ponderado del ciclo ("Por mejorar", "Bueno", "Excelente").
 * A diferencia de los estados —que describen un objetivo— el nivel describe
 * al colaborador, así que se resuelve sobre su avance total, no por objetivo.
 */
export interface NivelDesempenoConfig {
  id: string;
  nombre: string;
  minPorcentaje: number;
  maxPorcentaje: number;
  colorHex: string;
}

export const DEFAULT_NIVELES_DESEMPENO: NivelDesempenoConfig[] = [
  { id: "nivel-1", nombre: "Por mejorar", minPorcentaje: 0, maxPorcentaje: 33, colorHex: "#FCA5A5" },
  { id: "nivel-2", nombre: "Bueno", minPorcentaje: 34, maxPorcentaje: 66, colorHex: "#FCD34D" },
  { id: "nivel-3", nombre: "Excelente", minPorcentaje: 67, maxPorcentaje: 100, colorHex: "#86EFAC" },
];

/**
 * Un estado del participante: en qué situación está una persona dentro del
 * ciclo, al margen de cómo le esté yendo.
 *
 * No es un rango de porcentaje —eso ya lo cubren los estados del objetivo y
 * los niveles de desempeño— sino una lista de situaciones que la empresa
 * define: activo, en periodo de prueba, en licencia, retirado.
 *
 * `cuentaEnResultados` es el campo que hace que valga la pena configurarlo:
 * el promedio de un área no debería cargar con el 0 % de alguien que se
 * retiró a mitad del ciclo. Quien está en un estado que no cuenta sigue
 * apareciendo en las listas —con su estado a la vista— pero queda fuera de
 * promedios, rankings y distribuciones.
 */
export interface EstadoParticipanteConfig {
  id: string;
  nombre: string;
  colorHex: string;
  descripcion: string;
  cuentaEnResultados: boolean;
  isDefault?: boolean;
}

export const DEFAULT_ESTADOS_PARTICIPANTE: EstadoParticipanteConfig[] = [
  {
    id: "activo",
    nombre: "Activo",
    colorHex: "#22C55E",
    descripcion: "Participa normalmente del ciclo y sus resultados cuentan.",
    cuentaEnResultados: true,
    isDefault: true,
  },
  {
    id: "en-prueba",
    nombre: "En periodo de prueba",
    colorHex: "#93C5FD",
    descripcion: "Ingresó hace poco. Cuenta en resultados, pero conviene leerlo aparte.",
    cuentaEnResultados: true,
    isDefault: true,
  },
  {
    id: "licencia",
    nombre: "En licencia",
    colorHex: "#FCD34D",
    descripcion: "Ausente por licencia o incapacidad. No cuenta en promedios ni rankings.",
    cuentaEnResultados: false,
    isDefault: true,
  },
  {
    id: "retirado",
    nombre: "Retirado",
    colorHex: "#CBD5E1",
    descripcion: "Ya no está en la empresa. Queda en el histórico, fuera de los promedios.",
    cuentaEnResultados: false,
    isDefault: true,
  },
];

/** El estado de participante por id, o el primero como último recurso. */
export function findEstadoParticipante(
  estados: readonly EstadoParticipanteConfig[],
  id: string | null
): EstadoParticipanteConfig | null {
  if (estados.length === 0) return null;
  return estados.find((estado) => estado.id === id) ?? estados[0];
}

interface ObjetivosConfigState {
  estados: ObjetivoEstadoConfig[];
  niveles: NivelDesempenoConfig[];
  estadosParticipante: EstadoParticipanteConfig[];
  allowNegativeResults: boolean;
}

let state: ObjetivosConfigState = {
  estados: DEFAULT_ESTADOS_OBJETIVOS,
  niveles: DEFAULT_NIVELES_DESEMPENO,
  estadosParticipante: DEFAULT_ESTADOS_PARTICIPANTE,
  allowNegativeResults: DEFAULT_ALLOW_NEGATIVE_RESULTS,
};

const listeners = new Set<() => void>();

export function getObjetivosConfig(): ObjetivosConfigState {
  return state;
}

/**
 * Comitea la configuración editada en el drawer: todo lo que lea el store
 * (incluido el simulador) se entera en el siguiente render.
 *
 * Acepta un parche en vez del estado completo porque el drawer guarda por
 * pestañas: la de estados no tiene por qué conocer los estados de
 * participante para poder guardar los suyos.
 */
export function setObjetivosConfig(next: Partial<ObjetivosConfigState>): void {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** El estado (de "Estados y rangos") al que pertenece un porcentaje dado, o
 * null si ningún rango configurado lo cubre. */
export function findEstadoForPercent(
  estados: readonly ObjetivoEstadoConfig[],
  percent: number
): ObjetivoEstadoConfig | null {
  return (
    estados.find((estado) => percent >= estado.minPorcentaje && percent <= estado.maxPorcentaje) ??
    null
  );
}

/**
 * El nivel de desempeño al que pertenece un cumplimiento ponderado. Un avance
 * por encima del último rango (sobrecumplimiento) cae en el nivel más alto y
 * uno negativo en el más bajo: la escala califica a la persona, y "fuera de
 * escala" no es una calificación.
 */
export function findNivelForPercent(
  niveles: readonly NivelDesempenoConfig[],
  percent: number
): NivelDesempenoConfig | null {
  if (niveles.length === 0) return null;
  const exact = niveles.find(
    (nivel) => percent >= nivel.minPorcentaje && percent <= nivel.maxPorcentaje
  );
  if (exact) return exact;
  const sorted = [...niveles].sort((a, b) => a.minPorcentaje - b.minPorcentaje);
  if (percent > sorted[sorted.length - 1].maxPorcentaje) return sorted[sorted.length - 1];
  if (percent < sorted[0].minPorcentaje) return sorted[0];
  // Un hueco entre rangos (34–66 y 70–100, por ejemplo): se redondea al
  // nivel cuyo inicio quedó más cerca por debajo.
  return [...sorted].reverse().find((nivel) => nivel.minPorcentaje <= percent) ?? sorted[0];
}

/** Se re-renderiza cuando la configuración cambia en el drawer de ajustes. */
export function useObjetivosConfig(): ObjetivosConfigState {
  return React.useSyncExternalStore(subscribe, getObjetivosConfig);
}
