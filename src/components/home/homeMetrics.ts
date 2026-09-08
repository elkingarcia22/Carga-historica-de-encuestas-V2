import { AlertTriangle, CalendarClock, type LucideIcon } from "lucide-react";
import {
  CLOSING_SOON_DAYS,
  NO_FILTERS,
  OPEN_ESTADO,
  type CicloListFilters,
} from "@/components/ciclo-list/cicloListFilters";

/**
 * What each home alert counts, expressed as the column filters it applies.
 *
 * An alert is nothing but a shortcut to the table's own filters, so its number
 * is the row count under `filters` and its click sets exactly those — the
 * alert and the column menus can never tell different stories.
 */

export interface MetricPreset {
  id: string;
  label: string;
  /** Shown in the alert's own tooltip. */
  hint: string;
  tone: "brand" | "warning" | "negative" | undefined;
  filters: CicloListFilters;
}

export const METRIC_PRESETS: readonly MetricPreset[] = [
  {
    id: "closing",
    label: "Por cerrar",
    hint: `Ciclos abiertos cuyo cierre llega en ${CLOSING_SOON_DAYS} días o menos: es la última ventana para actualizar resultados. Filtra Estado y Fecha cierre.`,
    tone: "warning",
    filters: {
      ...NO_FILTERS,
      estado: [OPEN_ESTADO],
      close: ["Cierra en 7 días o menos"],
    },
  },
  {
    id: "low",
    label: "Avance bajo",
    hint: "Ciclos abiertos por debajo del 50 % de avance: todavía hay tiempo de acompañar a los equipos. Filtra Estado y % Avance.",
    tone: "negative",
    filters: {
      ...NO_FILTERS,
      estado: [OPEN_ESTADO],
      progress: ["Menos de 50%"],
    },
  },
];

/** One icon per alert, so the row is scannable by shape as well as by name. */
export const PRESET_ICONS: Readonly<Record<string, LucideIcon>> = {
  closing: CalendarClock,
  low: AlertTriangle,
};

export const formatCount = (value: number): string => value.toLocaleString("es-CO");
