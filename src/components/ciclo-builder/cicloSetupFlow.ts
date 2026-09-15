import * as React from "react";

/**
 * Con qué versión del primer paso arranca el constructor.
 *
 *   guided        "Datos generales": cinco preguntas reveladas de a una
 *                 (`CicloGeneralEditor`). El reparto por grupos o personas se
 *                 decide después, en el paso de objetivos asignados.
 *   parametrizado "Parametrización": cuatro bloques —identidad y tiempos,
 *                 metodología, gobierno, estructura de asignación— que
 *                 mandan sobre el resto del recorrido (`CicloSetupEditor`).
 *                 Quién escribe los objetivos decide dónde termina el flujo
 *                 del administrador, y el modelo decide qué pasos existen.
 *
 * Las dos conviven detrás de este interruptor para poder compararlas con el
 * mismo borrador y volver a la anterior sin costo. Cuando se decida, la que
 * pierda se borra junto con este archivo.
 */
export type CicloSetupFlow = "guided" | "parametrizado";

export const CICLO_SETUP_FLOW_LABELS: Readonly<Record<CicloSetupFlow, string>> = {
  guided: "Guiado",
  parametrizado: "Parametrizador",
};

const STORAGE_KEY = "ciclo-setup-flow";
const DEFAULT_FLOW: CicloSetupFlow = "parametrizado";

const isFlow = (value: unknown): value is CicloSetupFlow =>
  value === "guided" || value === "parametrizado";

function readStoredFlow(): CicloSetupFlow {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isFlow(stored) ? stored : DEFAULT_FLOW;
  } catch {
    return DEFAULT_FLOW;
  }
}

let currentFlow: CicloSetupFlow = typeof window === "undefined" ? DEFAULT_FLOW : readStoredFlow();
const listeners = new Set<() => void>();

function setCicloSetupFlow(next: CicloSetupFlow) {
  if (next === currentFlow) return;
  currentFlow = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Sin almacenamiento el interruptor sigue funcionando; solo no persiste.
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => currentFlow;

/** El flujo activo y cómo cambiarlo. Persistido para sobrevivir recargas. */
export function useCicloSetupFlow(): [CicloSetupFlow, (flow: CicloSetupFlow) => void] {
  const flow = React.useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_FLOW);
  return [flow, setCicloSetupFlow];
}
