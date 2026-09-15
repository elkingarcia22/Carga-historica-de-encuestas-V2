import * as React from "react";
import { toast } from "sonner";
import type { ConfigTab, PermissionDefinition } from "./objetivosConfigParts";
import {
  ESTADOS_FIJOS_OBJETIVO,
  estadosConPermisoNegativo,
  getObjetivosConfig,
  nivelesDesdeEstados,
  setObjetivosConfig,
  type EstadoParticipanteConfig,
  type NivelDesempenoConfig,
  type ObjetivoEstadoConfig,
} from "./objetivosConfigStore";

/**
 * El borrador de la configuración de objetivos: lo que el drawer edita antes
 * de comitearlo al store compartido con "Guardar cambios".
 *
 * Vive en un hook y no dentro del drawer porque hay dos drawers que lo editan
 * —el de pestañas y el ancho con menú lateral— y la lógica de rangos que se
 * empujan, del tope de estados o de la banda negativa que aparece y
 * desaparece con su permiso es la misma en los dos. Aquí se escribe una vez.
 */

export const COLOR_VARIANTS: { label: string; variant: ObjetivoEstadoConfig["variant"]; hex: string }[] = [
  { label: "Verde", variant: "positive", hex: "#86EFAC" },
  { label: "Verde Intenso", variant: "positive", hex: "#22C55E" },
  { label: "Amarillo", variant: "warning", hex: "#FCD34D" },
  { label: "Naranja", variant: "warning", hex: "#F97316" },
  { label: "Azul", variant: "info", hex: "#93C5FD" },
  { label: "Rojo", variant: "negative", hex: "#FCA5A5" },
  { label: "Rojo Intenso", variant: "negative", hex: "#EF4444" },
  { label: "Gris", variant: "neutral", hex: "#CBD5E1" },
];

/**
 * Los permisos del módulo, escritos como datos y no como catorce filas
 * repetidas: la única diferencia entre una y otra era su etiqueta y si venía
 * encendida.
 */
export const PERMISOS_LIDER_PROPIOS: readonly PermissionDefinition[] = [
  { label: "Ver", defaultEnabled: true },
  { label: "Crear", defaultEnabled: true },
  { label: "Actualizar", defaultEnabled: true },
  { label: "Editar", defaultEnabled: true },
  { label: "Eliminar", defaultEnabled: true },
  { label: "Subir sin aprobación", defaultEnabled: true },
  { label: "Inactivar / Activar", defaultEnabled: true },
];

export const PERMISOS_LIDER_EQUIPO: readonly PermissionDefinition[] = [
  { label: "Ver", defaultEnabled: true },
  { label: "Crear", defaultEnabled: true },
  { label: "Actualizar", defaultEnabled: true },
  { label: "Editar", defaultEnabled: true },
  { label: "Eliminar", defaultEnabled: true },
  { label: "Aprobar / Denegar", defaultEnabled: true },
  { label: "Inactivar / Activar", defaultEnabled: true },
];

export const PERMISOS_COLABORADOR: readonly PermissionDefinition[] = [
  { label: "Ver", defaultEnabled: true },
  { label: "Crear", defaultEnabled: true },
  { label: "Actualizar", defaultEnabled: true },
  { label: "Editar", defaultEnabled: false },
  { label: "Eliminar", defaultEnabled: false },
  { label: "Subir sin aprobación", defaultEnabled: false },
  { label: "Inactivar / Activar", defaultEnabled: false },
];

/**
 * Los colores que puede elegir un estado configurable, sin los que ya
 * pertenecen a un estado fijo del flujo ("Por aprobar", "Denegado", "Por
 * iniciar", "En progreso", "Inactivo"): si un estado que sí se edita pudiera
 * repetir ese color, el mismo tono dejaría de identificar una sola cosa en el
 * resto del módulo (la tarjeta de resumen, el ranking, la carta de resultados).
 */
const LOCKED_COLOR_HEXES = new Set(
  ESTADOS_FIJOS_OBJETIVO.map((estado) => estado.colorHex.toUpperCase())
);
export const EDITABLE_COLOR_VARIANTS = COLOR_VARIANTS.filter(
  (color) => !LOCKED_COLOR_HEXES.has(color.hex.toUpperCase())
);

export const MIN_ESTADOS = 3;
/**
 * El tope de "Estados de cumplimiento" ya no cuenta la banda negativa: esa se
 * configura aparte, dentro de "Resultados negativos". Con ella afuera, el
 * resto de bandas por defecto (No cumplió, No cumplió parcialmente, Cumplió
 * parcialmente, Cumplido, Sobrecumplió) ya son cinco, así que cinco es también
 * el tope.
 */
export const MAX_ESTADOS = 5;
export const MIN_NIVELES = 1;
export const MAX_NIVELES = 5;

/**
 * Empuja los rangos vecinos cuando uno cambia de borde, para que una banda
 * que iba pegada a la siguiente (69 → 70) siga pegada después de moverla. Es
 * la misma regla para estados y para niveles.
 */
function adjustNeighbours<T extends { minPorcentaje: number; maxPorcentaje: number }>(
  prev: readonly T[],
  index: number,
  patch: Partial<T>
): T[] {
  const oldState = prev[index];
  const nextStates = [...prev];
  nextStates[index] = { ...oldState, ...patch };

  if (patch.maxPorcentaje !== undefined && patch.maxPorcentaje !== oldState.maxPorcentaje) {
    let currentMax = patch.maxPorcentaje;
    for (let i = index + 1; i < nextStates.length; i++) {
      const wasConnected = prev[i].minPorcentaje === prev[i - 1].maxPorcentaje + 1;
      if (!wasConnected) break;
      nextStates[i] = { ...nextStates[i], minPorcentaje: currentMax + 1 };
      if (nextStates[i].maxPorcentaje < nextStates[i].minPorcentaje) {
        nextStates[i] = { ...nextStates[i], maxPorcentaje: nextStates[i].minPorcentaje };
      }
      currentMax = nextStates[i].maxPorcentaje;
    }
  }

  if (patch.minPorcentaje !== undefined && patch.minPorcentaje !== oldState.minPorcentaje) {
    let currentMin = patch.minPorcentaje;
    for (let i = index - 1; i >= 0; i--) {
      const wasConnected = prev[i].maxPorcentaje === prev[i + 1].minPorcentaje - 1;
      if (!wasConnected) break;
      nextStates[i] = { ...nextStates[i], maxPorcentaje: currentMin - 1 };
      if (nextStates[i].minPorcentaje > nextStates[i].maxPorcentaje) {
        nextStates[i] = { ...nextStates[i], minPorcentaje: nextStates[i].maxPorcentaje };
      }
      currentMin = nextStates[i].minPorcentaje;
    }
  }

  return nextStates;
}

/** Nombre no vacío, no el placeholder, no repetido, color no repetido, rango en orden. */
function validateRanges<T extends { nombre: string; colorHex: string; minPorcentaje: number; maxPorcentaje: number }>(
  items: readonly T[],
  noun: "estado" | "nivel",
  placeholder: string
): boolean {
  const names = new Set<string>();
  const colors = new Set<string>();
  const plural = noun === "estado" ? "estados" : "niveles";

  for (const item of items) {
    const nombre = item.nombre.trim();
    if (!nombre) {
      toast.error(`Todos los ${plural} deben tener un nombre.`);
      return false;
    }
    if (nombre.toLowerCase() === placeholder) {
      toast.error(`Debes asignarle un nombre real al nuevo ${noun} que creaste.`);
      return false;
    }
    const lower = nombre.toLowerCase();
    if (names.has(lower)) {
      toast.error(`El nombre de ${noun} "${nombre}" está repetido.`);
      return false;
    }
    names.add(lower);

    if (colors.has(item.colorHex)) {
      toast.error(`El color de "${nombre}" ya está siendo usado. Cada ${noun} debe tener un color único.`);
      return false;
    }
    colors.add(item.colorHex);

    if (item.minPorcentaje > item.maxPorcentaje) {
      toast.error(
        `En "${nombre}", el porcentaje "Desde" (${item.minPorcentaje}%) no puede ser mayor que "Hasta" (${item.maxPorcentaje}%).`
      );
      return false;
    }
  }
  return true;
}

export interface UseObjetivosConfigDraftOptions {
  open: boolean;
  initialTab: ConfigTab;
  /** Se llama cuando el borrador quedó guardado y el drawer puede cerrarse. */
  onSaved: () => void;
}

export function useObjetivosConfigDraft({ open, initialTab, onSaved }: UseObjetivosConfigDraftOptions) {
  const [activeTab, setActiveTab] = React.useState<ConfigTab>(initialTab);
  const [estados, setEstados] = React.useState<ObjetivoEstadoConfig[]>(
    () => getObjetivosConfig().estados
  );
  const [niveles, setNiveles] = React.useState<NivelDesempenoConfig[]>(
    () => getObjetivosConfig().niveles
  );
  const [estadosParticipante, setEstadosParticipante] = React.useState<EstadoParticipanteConfig[]>(
    () => getObjetivosConfig().estadosParticipante
  );
  const [allowNegativeResults, setAllowNegativeResults] = React.useState(
    () => getObjetivosConfig().allowNegativeResults
  );
  const [nivelesSiguenEstados, setNivelesSiguenEstados] = React.useState(
    () => getObjetivosConfig().nivelesSiguenEstados
  );

  /**
   * Las bandas que se configuran en "Estados de cumplimiento". Los estados
   * del flujo están quemados: siguen en la misma lista porque el cálculo del
   * avance los necesita, pero en el drawer se leen aparte y sin controles, y
   * ni el tope de estados ni el mínimo los cuentan. "Restó (Negativo)"
   * tampoco entra aquí: se configura aparte, dentro de "Resultados
   * negativos", porque solo existe cuando ese permiso está encendido.
   */
  const estadosEditables = React.useMemo(
    () => estados.filter((estado) => !estado.locked && estado.id !== "resto"),
    [estados]
  );

  /** La banda negativa, si el permiso la mantiene en la lista. */
  const estadoNegativo = React.useMemo(
    () => estados.find((estado) => estado.id === "resto") ?? null,
    [estados]
  );

  /**
   * Los niveles que se muestran y se guardan: los de la escala propia, o la
   * copia de las bandas de cumplimiento cuando esa opción está encendida. La
   * escala propia no se pierde mientras tanto —sigue en `niveles`—, así que
   * apagar la opción la devuelve tal como estaba.
   */
  const nivelesVisibles = React.useMemo(
    () => (nivelesSiguenEstados ? nivelesDesdeEstados(estados) : niveles),
    [nivelesSiguenEstados, estados, niveles]
  );

  /**
   * La primera tanda de tarjetas llega mientras el panel todavía está
   * entrando, así que espera a que esa animación despeje; a partir del primer
   * cambio de pestaña ya no hay nada que esperar y la cascada corre de una.
   */
  const [hasSwitchedTab, setHasSwitchedTab] = React.useState(false);

  const switchTab = (tab: ConfigTab) => {
    setActiveTab(tab);
    setHasSwitchedTab(true);
  };

  React.useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
      setHasSwitchedTab(false);
      // Vuelve a partir de lo último guardado, no de lo que haya quedado
      // editado sin guardar la vez anterior que se abrió el drawer.
      setEstados(getObjetivosConfig().estados);
      setNiveles(getObjetivosConfig().niveles);
      setEstadosParticipante(getObjetivosConfig().estadosParticipante);
      setAllowNegativeResults(getObjetivosConfig().allowNegativeResults);
      setNivelesSiguenEstados(getObjetivosConfig().nivelesSiguenEstados);
    }
  }, [open, initialTab]);

  // La regla vive en el store (`estadosConPermisoNegativo`), compartida con el
  // estado inicial de la app: dos copias de "sin permiso no hay banda
  // negativa" eran justo lo que dejaba el store arrancar desalineado de su
  // propio permiso por defecto.
  React.useEffect(() => {
    setEstados((prev) => {
      const next = estadosConPermisoNegativo(prev, allowNegativeResults);
      const unchanged =
        next.length === prev.length && next.every((estado, index) => estado === prev[index]);
      return unchanged ? prev : next;
    });
  }, [allowNegativeResults]);

  const handleUpdateEstado = (id: string, patch: Partial<ObjetivoEstadoConfig>) => {
    setEstados((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index === -1) return prev;
      return adjustNeighbours(prev, index, patch);
    });
  };

  const handleAddEstado = () => {
    if (estadosEditables.length >= MAX_ESTADOS) {
      toast.error(`Máximo ${MAX_ESTADOS} estados permitidos`);
      return;
    }
    const highest = estados.length > 0 ? Math.max(...estados.map((e) => e.maxPorcentaje)) : 0;
    const newMin = highest + 1;
    const newEstado: ObjetivoEstadoConfig = {
      id: `custom-estado-${Date.now()}`,
      nombre: "Nuevo estado",
      minPorcentaje: newMin,
      maxPorcentaje: newMin + 49,
      variant: "info",
      colorHex:
        EDITABLE_COLOR_VARIANTS[estadosEditables.length % EDITABLE_COLOR_VARIANTS.length].hex,
      descripcion: "Estado personalizado para seguimiento de objetivos.",
    };
    setEstados((prev) => [...prev, newEstado]);
    toast.success("Nuevo estado agregado");
  };

  const handleDeleteEstado = (id: string) => {
    if (estadosEditables.length <= MIN_ESTADOS) return;
    setEstados((prev) => prev.filter((item) => item.id !== id));
    toast.info("Estado eliminado");
  };

  const handleUpdateNivel = (id: string, patch: Partial<NivelDesempenoConfig>) => {
    setNiveles((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index === -1) return prev;
      return adjustNeighbours(prev, index, patch);
    });
  };

  const handleDeleteNivel = (id: string) => {
    if (niveles.length <= MIN_NIVELES) return;
    setNiveles((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddNivel = () => {
    if (niveles.length >= MAX_NIVELES) {
      toast.error(`Máximo ${MAX_NIVELES} niveles permitidos`);
      return;
    }
    const highest = niveles.length > 0 ? Math.max(...niveles.map((n) => n.maxPorcentaje)) : 0;
    const newMin = highest + 1;
    const newColor = COLOR_VARIANTS[niveles.length % COLOR_VARIANTS.length].hex;
    setNiveles((prev) =>
      [
        ...prev,
        { id: `nivel-${Date.now()}`, nombre: "Nuevo nivel", minPorcentaje: newMin, maxPorcentaje: newMin + 49, colorHex: newColor },
      ].sort((a, b) => a.minPorcentaje - b.minPorcentaje)
    );
    toast.success("Nuevo nivel agregado");
  };

  const handleSaveConfig = () => {
    if (!validateRanges(estados, "estado", "nuevo estado")) return;
    // Los niveles espejo salen de estados ya validados; solo se revisa la
    // escala propia, que es la que alguien escribió a mano.
    if (!nivelesSiguenEstados && !validateRanges(niveles, "nivel", "nuevo nivel")) return;

    // Estados, niveles y el permiso de resultados negativos son la parte de
    // esta pantalla que otros componentes necesitan leer —el simulador de
    // avance de un objetivo, la vista de seguimiento de un ciclo— así que se
    // comitean al store compartido. Los permisos, por ahora, no salen de aquí.
    const participanteNames = new Set<string>();
    for (const estado of estadosParticipante) {
      const nombre = estado.nombre.trim();
      if (!nombre) {
        toast.error("Todos los estados del participante deben tener un nombre.");
        return;
      }
      if (participanteNames.has(nombre.toLowerCase())) {
        toast.error(`Ya existe un estado del participante llamado "${nombre}".`);
        return;
      }
      participanteNames.add(nombre.toLowerCase());
    }
    if (!estadosParticipante.some((estado) => estado.cuentaEnResultados)) {
      toast.error("Al menos un estado del participante tiene que contar en los resultados.");
      return;
    }

    setObjetivosConfig({
      estados,
      // Se guarda la copia ya resuelta: quien lee niveles no tiene por qué
      // saber si vinieron de una escala propia o de las bandas.
      niveles: nivelesVisibles,
      estadosParticipante,
      allowNegativeResults,
      nivelesSiguenEstados,
    });
    toast.success("Configuración de objetivos guardada correctamente");
    onSaved();
  };

  return {
    activeTab,
    switchTab,
    hasSwitchedTab,
    estados,
    estadosEditables,
    estadoNegativo,
    niveles: nivelesVisibles,
    allowNegativeResults,
    setAllowNegativeResults,
    nivelesSiguenEstados,
    setNivelesSiguenEstados,
    handleUpdateEstado,
    handleAddEstado,
    handleDeleteEstado,
    handleUpdateNivel,
    handleAddNivel,
    handleDeleteNivel,
    handleSaveConfig,
  };
}

export type ObjetivosConfigDraft = ReturnType<typeof useObjetivosConfigDraft>;
