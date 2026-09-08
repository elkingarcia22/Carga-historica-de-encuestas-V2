import * as React from "react";

/**
 * Utilidades de tabla sin JSX, separadas de `tablePieces.tsx` para que ese
 * archivo exporte solo componentes y el hot reload de React lo acepte.
 */

export const PAGE_SIZES = [10, 25, 50] as const;

export const formatCount = (value: number): string =>
  new Intl.NumberFormat("es-CO").format(value);

/** Paginación local: la página actual recortada a lo que realmente existe. */
export function usePagedSlice<T>(items: readonly T[], page: number, pageSize: number) {
  return React.useMemo(() => {
    const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
    const current = Math.min(page, pageCount);
    const first = (current - 1) * pageSize;
    return { paged: items.slice(first, first + pageSize), current, pageCount };
  }, [items, page, pageSize]);
}
