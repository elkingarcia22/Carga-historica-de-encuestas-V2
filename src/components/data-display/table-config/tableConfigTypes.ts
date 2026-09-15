/**
 * El contrato que comparten todas las tablas de la aplicación.
 *
 * Una tabla declara sus columnas una sola vez —`TableColumnSpec[]`— y a partir
 * de ahí el encabezado, las celdas y el panel de configuración salen de la
 * misma lista. Antes cada tabla repetía el orden tres veces (los `<th>`, los
 * `<td>` y cualquier menú de columnas), y esa repetición es justo lo que hace
 * imposible mover una columna sin romper otra.
 */

/** Cómo se sirven las filas: de corrido o página por página. */
export type TableRowsMode = "lazy" | "paged";

/**
 * "Lazy" por defecto en toda la aplicación: bajar es más barato que buscar en
 * qué página quedó lo que se estaba leyendo. La paginación sigue estando a un
 * clic para quien necesita saber "voy en la 3 de 12".
 */
export const DEFAULT_ROWS_MODE: TableRowsMode = "lazy";

export interface TableColumnSpec {
  /** Identificador estable: es lo que se guarda, así que no puede cambiar. */
  id: string;
  /** Cómo se nombra la columna en el panel de configuración. */
  label: string;
  /**
   * Una columna fija no se arrastra, ni se oculta, ni se fija —ya está puesta
   * donde tiene que estar—. Solo la de selección lo es: sin ella no hay forma
   * de marcar filas, y moverla dejaría la casilla en mitad de la tabla.
   *
   * Ojo con el nombre: "fija" aquí es *inamovible*, no es lo mismo que
   * "fijada" (`pinned`), que es quedarse quieta mientras la tabla se desplaza
   * de lado.
   */
  fixed?: boolean;
  /** Arranca oculta y se pide desde el panel. */
  hiddenByDefault?: boolean;
  /**
   * Falso cuando la columna no aplica a esta lectura —el riesgo de un ciclo
   * cerrado, por ejemplo—. Desaparece de la tabla y del panel, pero su sitio
   * en el orden se recuerda por si vuelve.
   */
  available?: boolean;
}

/** Lo que se guarda por tabla entre sesiones. */
export interface StoredTableConfig {
  order: string[];
  hidden: string[];
  /** Las que se quedan quietas a la izquierda al desplazar la tabla de lado. */
  pinned: string[];
  mode: TableRowsMode;
}

/**
 * Una columna dicha una sola vez: su encabezado y su celda, juntos.
 *
 * Tenerlos pegados es lo que permite mover una columna sin desalinear el
 * título del dato: el orden se aplica una vez, sobre el par.
 */
export interface TableColumnCell<T> {
  head: import("react").ReactNode;
  /** Clases propias del encabezado, sobre las que la tabla ya pone. */
  headClassName?: string;
  cell: (row: T) => import("react").ReactNode;
  cellClassName?: string;
}

export type TableColumnCells<T> = Record<string, TableColumnCell<T>>;
