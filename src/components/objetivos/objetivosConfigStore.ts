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
 * La configuración de "Estados de los objetivos" del módulo, compartida
 * entre el drawer de ajustes (donde se edita) y cualquier lugar que necesite
 * saber qué estado le corresponde a un porcentaje de cumplimiento — como el
 * simulador del paso "¿Cómo se va a calcular el avance?".
 *
 * Vive fuera de React porque el drawer y el simulador no comparten un
 * ancestro común desde el que pasar props: es un store mínimo (suscripción +
 * snapshot) leído con `useSyncExternalStore`, no una librería de estado.
 */

/**
 * En qué momento del ciclo se le puede poner esta banda a un objetivo.
 *
 * `al-cierre` es un veredicto: solo tiene sentido cuando ya no queda tiempo
 * para mejorar ("No cumplió" a mitad de ciclo sería mentira, todavía puede
 * cumplir). `en-curso` es un logro ya conseguido, que nada de lo que pase
 * después le quita, así que se muestra apenas se alcanza y también al cierre.
 */
export type EstadoAplicaEn = "en-curso" | "al-cierre";

export interface ObjetivoEstadoConfig {
  id: string;
  nombre: string;
  minPorcentaje: number;
  maxPorcentaje: number;
  variant: "neutral" | "warning" | "info" | "positive" | "negative";
  colorHex: string;
  descripcion: string;
  isDefault?: boolean;
  /**
   * El estado lo fija el flujo del objetivo, no la empresa: se sigue usando
   * para resolver un avance, pero no se edita ni se elimina desde el drawer.
   */
  locked?: boolean;
  /**
   * Cuándo aplica la banda. Mientras el ciclo sigue abierto, un objetivo que
   * todavía no alcanza ninguna banda `en-curso` se queda en "En progreso".
   */
  aplicaEn?: EstadoAplicaEn;
}

/** Una banda sin `aplicaEn` explícito se comporta como siempre: aplica siempre. */
export const aplicaEnDe = (estado: ObjetivoEstadoConfig): EstadoAplicaEn =>
  estado.aplicaEn ?? "en-curso";

export const DEFAULT_ESTADOS_OBJETIVOS: ObjetivoEstadoConfig[] = [
  {
    id: "por-iniciar",
    nombre: "Por iniciar",
    minPorcentaje: 0,
    maxPorcentaje: 0,
    variant: "neutral",
    colorHex: "#CBD5E1",
    descripcion: "Aprobado, pero todavía sin ningún avance reportado (0 %).",
    isDefault: true,
    locked: true,
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
    // Un avance negativo ya pasó: no es un veredicto que haya que esperar al
    // cierre, se ve apenas se reporta.
    aplicaEn: "en-curso",
  },
  {
    id: "no-cumplio",
    nombre: "No cumplió",
    minPorcentaje: 0,
    maxPorcentaje: 39,
    variant: "negative",
    colorHex: "#FCA5A5",
    descripcion: "Al cierre del ciclo, el objetivo no alcanzó el umbral mínimo aceptable.",
    isDefault: true,
    aplicaEn: "al-cierre",
  },
  {
    id: "no-cumplio-parcialmente",
    nombre: "No cumplió parcialmente",
    minPorcentaje: 40,
    maxPorcentaje: 69,
    variant: "warning",
    // Un naranja distinto del de "Denegado" (#FDBA74): comparten familia de
    // color pero no pueden ser el mismo hex, porque ese es el que queda
    // reservado para el estado fijo.
    colorHex: "#F97316",
    descripcion: "El objetivo no alcanzó la meta mínima al cierre.",
    isDefault: true,
    aplicaEn: "al-cierre",
  },
  {
    id: "en-progreso",
    nombre: "En progreso",
    minPorcentaje: 1,
    maxPorcentaje: 99,
    variant: "warning",
    colorHex: "#FCD34D",
    descripcion: "Tiene avance reportado y todavía no llega a la primera banda que aplica en curso.",
    isDefault: true,
    locked: true,
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
    aplicaEn: "al-cierre",
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
    aplicaEn: "en-curso",
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
    aplicaEn: "en-curso",
  },
];

/**
 * Hasta dónde llega "En progreso" con una configuración dada: hasta justo
 * antes de la primera banda que sí aplica con el ciclo abierto.
 *
 * No se configura porque no es una decisión aparte: es el hueco que dejan las
 * demás. Si "Cumplido" empieza en 100, un objetivo está "En progreso" de 1 a
 * 99; si la empresa marca "Cumplió parcialmente" (70) como banda en curso,
 * "En progreso" se encoge a 1–69 sola. Dejarlo a mano era pedir que alguien
 * mantuviera sincronizados dos números que siempre significan lo mismo.
 */
export function rangoEnProgreso(estados: readonly ObjetivoEstadoConfig[]): {
  min: number;
  max: number;
} {
  const primeraEnCurso = estados
    .filter((estado) => !estado.locked && aplicaEnDe(estado) === "en-curso")
    .filter((estado) => estado.minPorcentaje > 0)
    .reduce<number | null>(
      (menor, estado) => (menor === null ? estado.minPorcentaje : Math.min(menor, estado.minPorcentaje)),
      null
    );
  // Sin ninguna banda en curso por encima de 0, "En progreso" cubre todo el
  // avance hasta la meta: el ciclo abierto no tiene nada más que mostrar.
  return { min: 1, max: (primeraEnCurso ?? 100) - 1 };
}

/**
 * La lista con el rango de "En progreso" recalculado. Es el invariante que
 * `resolveEstado` necesita para no dejar huecos: se aplica al guardar y al
 * arrancar el store, no en cada lectura.
 */
export function conRangoEnProgreso(
  estados: readonly ObjetivoEstadoConfig[]
): ObjetivoEstadoConfig[] {
  const rango = rangoEnProgreso(estados);
  return estados.map((estado) =>
    estado.id === "en-progreso"
      ? { ...estado, minPorcentaje: rango.min, maxPorcentaje: rango.max }
      : estado
  );
}

/**
 * Un estado fijo del objetivo: los cuatro que no son una opinión de la empresa
 * sino el flujo mismo por el que pasa un objetivo — se envía, el líder lo
 * aprueba o lo deniega, arranca y avanza.
 *
 * Van quemados a propósito. "Por aprobar" y "Denegado" describen la revisión
 * del líder, y "Por iniciar" y "En progreso" el arranque del avance: su
 * significado es absoluto y el módulo lo da por cierto en todas partes
 * (aprobaciones pendientes, cuentas del resumen, cálculo del avance), así que
 * renombrarlos, moverles el rango o borrarlos rompería esa lectura. Lo que sí
 * se configura son las bandas de resultado — cuánto cumplió — más abajo.
 */
export interface EstadoFijoObjetivo {
  id: string;
  nombre: string;
  colorHex: string;
  descripcion: string;
  /** El rango de avance que le corresponde, o null si no depende de un rango. */
  rango: { min: number; max: number } | null;
  /**
   * Qué decir en vez del rango cuando `rango` es null. Por defecto es "Antes
   * de arrancar" —el caso de "Por aprobar" y "Denegado"—, pero "Inactivo"
   * también carece de rango sin ser un estado previo al arranque: puede pasar
   * en cualquier punto del avance.
   */
  rangoLabel?: string;
}

/** Los dos estados de la revisión del líder, previos a que el objetivo arranque. */
const ESTADOS_FIJOS_APROBACION: readonly EstadoFijoObjetivo[] = [
  {
    id: "por-aprobar",
    nombre: "Por aprobar",
    colorHex: "#A78BFA",
    descripcion: "Escrito y enviado. Espera el visto bueno del líder para poder arrancar.",
    rango: null,
  },
  {
    id: "denegado",
    nombre: "Denegado",
    colorHex: "#FDBA74",
    descripcion: "El líder pidió cambios. Vuelve a quien lo escribió y no arranca hasta reenviarlo.",
    rango: null,
  },
];

/**
 * El objetivo dejó de estar en juego porque alguien lo inactivó a mitad de
 * camino, no porque el flujo lo haya movido de etapa. Por eso no tiene rango
 * como los demás: puede pasar en cualquier punto del avance, y lo que importa
 * no es cuánto llevaba sino que ya no cuenta.
 */
const ESTADOS_FIJOS_INACTIVACION: readonly EstadoFijoObjetivo[] = [
  {
    id: "inactivo",
    nombre: "Inactivo",
    colorHex: "#94A3B8",
    descripcion:
      "Se inactivó a mitad de camino y ya no cuenta en el peso ni en el promedio de la persona, pero conserva el avance que había alcanzado.",
    rango: null,
    rangoLabel: "En cualquier momento",
  },
];

/**
 * Los cinco estados fijos como los ve el drawer. Los dos que sí tienen rango
 * salen de `DEFAULT_ESTADOS_OBJETIVOS` —donde viven porque el cálculo del
 * avance los necesita— para no tener su nombre, color y rango escritos dos
 * veces y que se separen con el primer cambio.
 */
export const ESTADOS_FIJOS_OBJETIVO: readonly EstadoFijoObjetivo[] = [
  ...ESTADOS_FIJOS_APROBACION,
  ...DEFAULT_ESTADOS_OBJETIVOS.filter((estado) => estado.locked).map((estado) => ({
    id: estado.id,
    nombre: estado.nombre,
    colorHex: estado.colorHex,
    descripcion: estado.descripcion,
    rango: { min: estado.minPorcentaje, max: estado.maxPorcentaje },
  })),
  ...ESTADOS_FIJOS_INACTIVACION,
];

/**
 * Los mismos cinco fijos, pero con el rango de "En progreso" leído de la
 * configuración que se está editando en vez del de la lista por defecto: es el
 * único de los cinco cuyo rango se mueve cuando alguien cambia las bandas.
 */
export function estadosFijosParaConfig(
  estados: readonly ObjetivoEstadoConfig[]
): EstadoFijoObjetivo[] {
  const rango = rangoEnProgreso(estados);
  return ESTADOS_FIJOS_OBJETIVO.map((fijo) =>
    fijo.id === "en-progreso" ? { ...fijo, rango } : fijo
  );
}

export interface EstadoBadgeConfig {
  bg: string;
  text: string;
  border: string;
  iconColor: string;
  barBg: string;
  Icon: LucideIcon;
}

/**
 * Los colores de "Estados de los objetivos" (`colorHex`) son tonos pastel pensados
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

export const DEFAULT_ALLOW_NEGATIVE_RESULTS = false;

/**
 * Las bandas de cumplimiento, coherentes con el permiso de resultados
 * negativos: sin el permiso, ninguna banda negativa sobrevive.
 *
 * Existe porque `DEFAULT_ESTADOS_OBJETIVOS` trae "Restó (Negativo)" siempre
 * —es una lista de bandas, no sabe de permisos— y antes solo el drawer
 * aplicaba esta regla, al abrirse. Eso dejaba un hueco real: el estado
 * inicial del store combinaba `DEFAULT_ESTADOS_OBJETIVOS` (con "Restó") y
 * `DEFAULT_ALLOW_NEGATIVE_RESULTS` (`false`) sin pasar nunca por el drawer, así
 * que toda la app arrancaba mostrando —en Resumen, en Cumplimiento, en el
 * heatmap, en "Filtros"— una banda que la propia configuración por defecto
 * dice que no está permitida. Se veía como si los resultados no supieran leer
 * lo que ya se configuró.
 *
 * Ahora es la misma regla en un solo lugar: la usa el estado inicial del
 * store (abajo) y el efecto del drawer que reacciona al toggle, en vez de
 * cada uno con su propia copia que podía desalinearse.
 */
export function estadosConPermisoNegativo(
  estados: readonly ObjetivoEstadoConfig[],
  allowNegative: boolean
): ObjetivoEstadoConfig[] {
  if (!allowNegative) {
    // Sin permiso no hay bandas negativas: se quitan las puramente negativas
    // y se recortan a 0 las que asomaban por debajo.
    return estados
      .filter((estado) => estado.maxPorcentaje >= 0)
      .map((estado) => (estado.minPorcentaje < 0 ? { ...estado, minPorcentaje: 0 } : estado));
  }
  // Con el permiso encendido, la banda negativa por defecto vuelve si no hay
  // ninguna: es la que la pantalla de resultados espera encontrar.
  const hasNegative = estados.some((estado) => estado.minPorcentaje < 0 || estado.id === "resto");
  if (hasNegative) return [...estados];
  const restoState = DEFAULT_ESTADOS_OBJETIVOS.find((estado) => estado.id === "resto");
  if (!restoState) return [...estados];
  return [...estados, restoState].sort((a, b) => a.minPorcentaje - b.minPorcentaje);
}

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
 * Si los niveles de desempeño son una copia de las bandas de cumplimiento en
 * vez de una escala propia.
 *
 * Por defecto no: un objetivo y una persona se leen distinto —"Sobrecumplió"
 * describe un resultado, "Excelente" califica a alguien—, y ese es justo el
 * motivo de que sean dos ejes. Pero hay empresas que los quieren idénticos,
 * y mantener a mano dos listas que tienen que coincidir es la vía corta a
 * que dejen de coincidir.
 */
export const DEFAULT_NIVELES_SIGUEN_ESTADOS = false;

/**
 * Las bandas de cumplimiento traducidas a niveles de desempeño: mismo nombre,
 * mismo rango y mismo color.
 *
 * Los estados del flujo quedan fuera —"Por iniciar" y "En progreso" describen
 * el arranque de un objetivo, no cómo cerró una persona—, así que se copian
 * las mismas bandas que se editan en el drawer, incluida la negativa cuando
 * el permiso la mantiene encendida.
 */
export function nivelesDesdeEstados(
  estados: readonly ObjetivoEstadoConfig[]
): NivelDesempenoConfig[] {
  return estados
    .filter((estado) => !estado.locked)
    .map((estado) => ({
      id: `nivel-${estado.id}`,
      nombre: estado.nombre,
      minPorcentaje: estado.minPorcentaje,
      maxPorcentaje: estado.maxPorcentaje,
      colorHex: estado.colorHex,
    }))
    .sort((a, b) => a.minPorcentaje - b.minPorcentaje);
}

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
  /**
   * Los niveles son copia de las bandas de cumplimiento. `niveles` ya viene
   * resuelto con esa copia, así que quien solo necesita leerlos no tiene que
   * saber de dónde salieron; esta bandera es para el drawer, que sí necesita
   * saber si la escala se edita o se espeja.
   */
  nivelesSiguenEstados: boolean;
}

let state: ObjetivosConfigState = {
  // No `DEFAULT_ESTADOS_OBJETIVOS` a secas: esa lista siempre trae "Restó
  // (Negativo)", y arrancar con el permiso apagado y la banda presente es
  // justo la inconsistencia que este arreglo cierra.
  estados: conRangoEnProgreso(
    estadosConPermisoNegativo(DEFAULT_ESTADOS_OBJETIVOS, DEFAULT_ALLOW_NEGATIVE_RESULTS)
  ),
  niveles: DEFAULT_NIVELES_DESEMPENO,
  estadosParticipante: DEFAULT_ESTADOS_PARTICIPANTE,
  allowNegativeResults: DEFAULT_ALLOW_NEGATIVE_RESULTS,
  nivelesSiguenEstados: DEFAULT_NIVELES_SIGUEN_ESTADOS,
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

/** El estado (de "Estados de los objetivos") al que pertenece un porcentaje dado, o
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
