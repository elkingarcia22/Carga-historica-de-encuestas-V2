/**
 * Lo que la barra flotante puede hacer con las filas marcadas del paso de
 * objetivos asignados.
 *
 * El paso ya no lleva botones en cada fila: marcar es la forma de elegir sobre
 * qué se actúa, y las acciones aparecen todas juntas en la barra, igual que en
 * la tabla de colaboradores del home. Por eso lo que viaja hacia arriba no es
 * un número y dos callbacks sueltos, sino la selección entera —cuántas filas,
 * de cuántas agrupaciones, y qué se puede hacer con ellas—: la barra se limita
 * a dibujarlo, y es el paso, que sí sabe cómo están repartidos los objetivos,
 * el que decide qué acción tiene sentido.
 *
 * Una acción en `null` no es una acción que falta: es una que no aplica a esta
 * selección, y la barra la deja visible pero desactivada con el porqué en su
 * tooltip. Esconderla haría que la barra cambie de forma entre una fila y dos,
 * que es justo cuando hace falta entender por qué ya no se puede.
 */
export interface AssignmentSelection {
  /** Filas marcadas: un grupo, o una persona, dentro de su agrupación. */
  count: number;
  /** Cómo se nombra lo marcado, que cambia con la pestaña. */
  unit: "grupo" | "persona";
  /** Cuántas agrupaciones distintas toca la selección. */
  setCount: number;
  /** Filas que comparten agrupación con otras y por eso se pueden separar. */
  detachableCount: number;
  /** Quita las marcas sin tocar nada de lo repartido. */
  clear: () => void;
  /** Abre los objetivos de la agrupación marcada. Null con más de una. */
  editObjectives: (() => void) | null;
  /** Abre sus destinatarios. Null con más de una agrupación. */
  editTargets: (() => void) | null;
  /** Cuadra los pesos de las agrupaciones marcadas — vale para varias. */
  adjustWeights: () => void;
  /** Saca a lo marcado a su propia agrupación, con copia de los objetivos. */
  detach: (() => void) | null;
  /** Deja sin objetivos a lo marcado. */
  remove: () => void;
}
