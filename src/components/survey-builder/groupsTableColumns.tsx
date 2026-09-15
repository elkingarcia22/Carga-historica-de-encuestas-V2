import type * as React from "react";
import { cn } from "@/lib/utils";
import type { TableColumnCells, TableColumnSpec } from "@/components/data-display";
import { COLLABORATOR_COUNT } from "@/mocks/collaborators";

/**
 * Las columnas de la tabla de grupos del paso de participantes.
 *
 * Fuera del panel porque `ParticipantsEditor` ya lleva cuatro modos, el
 * importador y dos tablas más: una columna dicha aquí —su título y su dato
 * juntos— es una que no hay que buscar entre mil quinientas líneas.
 */

/** Una fila: el nombre del grupo y cuánta gente tiene. */
export type GroupCountRow = readonly [group: string, count: number];

export const GROUP_COLUMNS: readonly TableColumnSpec[] = [
  { id: "seleccion", label: "Selección", fixed: true },
  { id: "group", label: "Grupo" },
  { id: "count", label: "Cantidad" },
  { id: "share", label: "% del total" },
];

export function groupsTableCells({
  formatCount,
  disabledReasonFor,
}: {
  formatCount: (value: number) => string;
  /**
   * Por qué este grupo no se puede elegir, si es que no se puede. Lo decide el
   * cajón de asignación —un grupo que ya carga un juego de objetivos no puede
   * recibir un segundo— y se dice en la propia fila, no en un aviso aparte.
   */
  disabledReasonFor: (group: string) => string | null;
}): TableColumnCells<GroupCountRow> {
  const numeric = "py-2.5 text-right tabular-nums text-[13px]";

  return {
    group: {
      headClassName: "min-w-[200px] py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
      head: "Grupo",
      cellClassName: "py-2.5 text-[13px] text-text-secondary",
      cell: ([group]) => {
        const reason = disabledReasonFor(group);
        return (
          <span className="flex flex-wrap items-center gap-2">
            {group}
            {reason && (
              <span className="inline-flex rounded-full bg-surface-muted px-2 py-0.5 text-[10.5px] font-bold text-text-muted">
                {reason}
              </span>
            )}
          </span>
        );
      },
    },

    count: {
      headClassName:
        "w-[120px] py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
      head: "Cantidad",
      cellClassName: cn("w-[120px] text-text-secondary", numeric),
      cell: ([, count]) => formatCount(count),
    },

    share: {
      headClassName:
        "w-[80px] py-3 pr-4 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
      head: "%",
      cellClassName: cn("w-[80px] pr-4 text-muted-foreground", numeric),
      cell: ([, count]) => `${Math.round((count / COLLABORATOR_COUNT) * 100)}%`,
    },
  };
}

/**
 * El desglose de "Toda la empresa": las mismas tres columnas que la tabla de
 * grupos, pero sin casillas —aquí no se elige nada, se mira cómo se reparte la
 * gente— y con el título de la primera columna cambiando según el demográfico
 * por el que se corte.
 */
export const COMPANY_BREAKDOWN_COLUMNS: readonly TableColumnSpec[] = [
  { id: "segment", label: "Segmento" },
  { id: "count", label: "Cantidad" },
  { id: "share", label: "% del total" },
];

export function companyBreakdownCells({
  formatCount,
  segmentHead,
  countHead,
}: {
  formatCount: (value: number) => string;
  /** El encabezado de la primera columna: ordena y filtra por el demográfico. */
  segmentHead: React.ReactNode;
  countHead: React.ReactNode;
}): TableColumnCells<GroupCountRow> {
  const numeric = "py-2.5 text-right tabular-nums text-[13px] text-text-secondary";

  return {
    segment: {
      headClassName: "py-3 pl-4",
      head: segmentHead,
      cellClassName: "py-2.5 pl-4 text-[13px] text-text-secondary",
      cell: ([segment]) => segment,
    },
    count: {
      headClassName: "w-[120px] py-3 text-right",
      head: countHead,
      cellClassName: cn("w-[120px]", numeric),
      cell: ([, count]) => formatCount(count),
    },
    share: {
      headClassName:
        "w-[80px] py-3 pr-4 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
      head: "%",
      cellClassName: cn("w-[80px] pr-4", numeric),
      cell: ([, count]) => `${Math.round((count / COLLABORATOR_COUNT) * 100)}%`,
    },
  };
}
