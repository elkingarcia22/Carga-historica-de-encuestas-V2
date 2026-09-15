import * as React from "react";
import {
  DEFAULT_ROWS_MODE,
  type StoredTableConfig,
  type TableColumnSpec,
  type TableRowsMode,
} from "./tableConfigTypes";

/**
 * El estado de "cómo quiero ver esta tabla": qué columnas, en qué orden y si
 * las filas se cargan de corrido o por páginas.
 *
 * Vive en `localStorage` por tabla y no en la URL: es una preferencia de quien
 * mira, no parte de lo que se comparte. Un enlace a "los colaboradores en
 * riesgo" tiene que llegarle igual al otro aunque él tenga ocultas otras
 * columnas.
 *
 * El orden recordado guarda también las columnas que ahora mismo no aplican
 * —`available: false`—, así que salir de un ciclo cerrado y entrar a uno
 * abierto devuelve "Riesgo" a donde el usuario la había dejado en vez de al
 * final de la fila.
 */

const STORAGE_PREFIX = "ubits.tabla.";

const readStored = (tableId: string): StoredTableConfig | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + tableId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredTableConfig>;
    if (!Array.isArray(parsed.order) || !Array.isArray(parsed.hidden)) return null;
    return {
      order: parsed.order.filter((id): id is string => typeof id === "string"),
      hidden: parsed.hidden.filter((id): id is string => typeof id === "string"),
      // `pinned` llegó después: lo guardado antes de eso se lee sin columnas
      // fijadas en vez de descartarse entero.
      pinned: Array.isArray(parsed.pinned)
        ? parsed.pinned.filter((id): id is string => typeof id === "string")
        : [],
      mode: parsed.mode === "paged" ? "paged" : "lazy",
    };
  } catch {
    // Una pestaña de incógnito o un almacenamiento bloqueado no son un error
    // que tenga que ver el usuario: la tabla arranca con lo de fábrica.
    return null;
  }
};

const writeStored = (tableId: string, value: StoredTableConfig): void => {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + tableId, JSON.stringify(value));
  } catch {
    /* Sin persistencia la tabla sigue funcionando; solo se olvida al recargar. */
  }
};

const clearStored = (tableId: string): void => {
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + tableId);
  } catch {
    /* Ídem. */
  }
};

/**
 * Mezcla el orden recordado con las columnas que la tabla declara hoy.
 *
 * Las que ya se conocían conservan su sitio; una columna nueva —porque el
 * producto la añadió después— entra donde la declaró la tabla y no al final,
 * que es donde nadie la vería.
 */
function reconcileOrder(stored: readonly string[], specIds: readonly string[]): string[] {
  const kept = stored.filter((id, index) => stored.indexOf(id) === index);
  const known = new Set(kept);
  const order = [...kept];

  specIds.forEach((id) => {
    if (known.has(id)) return;
    const natural = specIds.indexOf(id);
    const at = order.findIndex((other) => {
      const otherNatural = specIds.indexOf(other);
      return otherNatural > natural;
    });
    order.splice(at === -1 ? order.length : at, 0, id);
  });

  return order;
}

export interface TableConfig {
  /** Las columnas movibles visibles, ya en el orden elegido. */
  columns: readonly TableColumnSpec[];
  /** Todas las movibles disponibles —visibles y ocultas—, para el panel. */
  movableColumns: readonly TableColumnSpec[];
  /** Las que nunca se mueven ni se ocultan. Se pintan aparte, siempre primero. */
  fixedColumns: readonly TableColumnSpec[];
  hidden: ReadonlySet<string>;
  hiddenCount: number;
  /** Las columnas que se quedan quietas mientras la tabla se desplaza de lado. */
  pinned: ReadonlySet<string>;
  pinnedCount: number;
  /**
   * A cuántos píxeles del borde izquierdo se para una columna fijada, o
   * `undefined` si no lo está. Es la suma de lo que miden las fijadas que van
   * antes, para que se apilen en vez de taparse entre ellas.
   */
  pinnedOffset: (id: string) => number | undefined;
  /** La fila de encabezados reporta aquí lo que mide cada columna. */
  reportWidths: (widths: Record<string, number>) => void;
  mode: TableRowsMode;
  isLazy: boolean;
  /** Cierto cuando algo se salió de fábrica: enciende el punto del botón. */
  isDirty: boolean;
  setMode: (mode: TableRowsMode) => void;
  toggleVisibility: (id: string) => void;
  togglePin: (id: string) => void;
  showAllColumns: () => void;
  /** Mueve `sourceId` justo antes o después de `targetId`. */
  moveColumn: (sourceId: string, targetId: string, before: boolean) => void;
  reset: () => void;
}

export function useTableConfig(
  /** Único por tabla: es la llave con la que se recuerda. */
  tableId: string,
  columns: readonly TableColumnSpec[],
  options?: { defaultMode?: TableRowsMode }
): TableConfig {
  const defaultMode = options?.defaultMode ?? DEFAULT_ROWS_MODE;

  const fixedColumns = React.useMemo(
    () => columns.filter((column) => column.fixed && column.available !== false),
    [columns]
  );
  const movableSpecs = React.useMemo(
    () => columns.filter((column) => !column.fixed),
    [columns]
  );
  const specById = React.useMemo(
    () => new Map(movableSpecs.map((column) => [column.id, column])),
    [movableSpecs]
  );
  const specIds = React.useMemo(() => movableSpecs.map((column) => column.id), [movableSpecs]);

  const defaultHidden = React.useMemo(
    () => movableSpecs.filter((column) => column.hiddenByDefault).map((column) => column.id),
    [movableSpecs]
  );

  // Una sola lectura del almacenamiento, en el primer render: leerlo en un
  // efecto haría que la tabla se pintara con lo de fábrica y saltara después.
  const [state, setState] = React.useState<StoredTableConfig>(() => {
    const stored = readStored(tableId);
    return {
      order: reconcileOrder(stored?.order ?? [], specIds),
      hidden: stored?.hidden ?? defaultHidden,
      pinned: stored?.pinned ?? [],
      mode: stored?.mode ?? defaultMode,
    };
  });

  /*
   * Lo que mide cada columna, para apilar las fijadas. Sale del DOM y no de
   * las clases porque los anchos son porcentajes y `w-[30%]` no dice cuántos
   * píxeles son hasta que la tabla está puesta.
   */
  const [widths, setWidths] = React.useState<Record<string, number>>({});
  const reportWidths = React.useCallback((next: Record<string, number>) => {
    setWidths((current) => {
      const keys = Object.keys(next);
      const same =
        keys.length === Object.keys(current).length &&
        keys.every((key) => Math.abs((current[key] ?? -1) - next[key]) < 0.5);
      return same ? current : next;
    });
  }, []);

  /*
   * Si la tabla declara columnas nuevas a mitad de vida —una pestaña que cambia
   * de lectura—, el orden las acoge sin perder lo que ya había. Se ajusta
   * durante el render y no en un efecto: en un efecto la tabla se pintaría una
   * vez sin la columna nueva y otra con ella.
   */
  const [seenSpecIds, setSeenSpecIds] = React.useState(specIds);
  if (seenSpecIds !== specIds) {
    setSeenSpecIds(specIds);
    const next = reconcileOrder(state.order, specIds);
    const same =
      next.length === state.order.length && next.every((id, i) => id === state.order[i]);
    if (!same) setState({ ...state, order: next });
  }

  const update = React.useCallback(
    (next: StoredTableConfig) => {
      setState(next);
      writeStored(tableId, next);
    },
    [tableId]
  );

  const hidden = React.useMemo(() => new Set(state.hidden), [state.hidden]);
  const pinned = React.useMemo(() => new Set(state.pinned), [state.pinned]);

  const movableColumns = React.useMemo(
    () =>
      state.order
        .map((id) => specById.get(id))
        .filter(
          (column): column is TableColumnSpec => column !== undefined && column.available !== false
        ),
    [state.order, specById]
  );

  const visibleColumns = React.useMemo(
    () => movableColumns.filter((column) => !hidden.has(column.id)),
    [movableColumns, hidden]
  );

  /*
   * "Salido de fábrica", y por eso enciende el punto del botón y saca
   * "Restablecer".
   *
   * El orden se compara solo sobre lo que esta lectura conoce: una columna que
   * hoy no aplica sigue recordada en `state.order`, y contarla como cambio
   * dejaría el botón marcado en un ciclo cerrado sin que nadie haya tocado
   * nada.
   */
  const defaultOrder = React.useMemo(() => reconcileOrder([], specIds), [specIds]);
  const knownOrder = state.order.filter((id) => specById.has(id));
  const isDirty =
    state.mode !== defaultMode ||
    state.hidden.length !== defaultHidden.length ||
    !state.hidden.every((id) => defaultHidden.includes(id)) ||
    state.pinned.length > 0 ||
    !knownOrder.every((id, index) => id === defaultOrder[index]);

  return {
    columns: visibleColumns,
    movableColumns,
    fixedColumns,
    hidden,
    hiddenCount: movableColumns.filter((column) => hidden.has(column.id)).length,
    pinned,
    pinnedCount: visibleColumns.filter((column) => pinned.has(column.id)).length,
    pinnedOffset: (id) => {
      if (!pinned.has(id)) return undefined;
      let left = 0;
      for (const column of visibleColumns) {
        if (column.id === id) return left;
        if (pinned.has(column.id)) left += widths[column.id] ?? 0;
      }
      return left;
    },
    reportWidths,
    mode: state.mode,
    isLazy: state.mode === "lazy",
    isDirty,
    setMode: (mode) => update({ ...state, mode }),
    toggleVisibility: (id) =>
      update({
        ...state,
        hidden: hidden.has(id)
          ? state.hidden.filter((other) => other !== id)
          : [...state.hidden, id],
        // Esconder una columna fijada la suelta: una columna que no se ve no
        // puede estar quieta en ninguna parte.
        pinned: hidden.has(id) ? state.pinned : state.pinned.filter((other) => other !== id),
      }),
    togglePin: (id) =>
      update({
        ...state,
        pinned: pinned.has(id)
          ? state.pinned.filter((other) => other !== id)
          : [...state.pinned, id],
        // Y fijar una escondida la devuelve a la vista, por lo mismo.
        hidden: pinned.has(id) ? state.hidden : state.hidden.filter((other) => other !== id),
      }),
    showAllColumns: () => update({ ...state, hidden: [] }),
    moveColumn: (sourceId, targetId, before) => {
      if (sourceId === targetId) return;
      const order = state.order.filter((id) => id !== sourceId);
      const at = order.indexOf(targetId);
      if (at === -1) return;
      order.splice(before ? at : at + 1, 0, sourceId);
      update({ ...state, order });
    },
    reset: () => {
      clearStored(tableId);
      setState({
        order: reconcileOrder([], specIds),
        hidden: defaultHidden,
        pinned: [],
        mode: defaultMode,
      });
    },
  };
}
