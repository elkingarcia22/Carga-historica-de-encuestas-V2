/**
 * Las piezas de tabla que la vista de seguimiento ya resolvió —encabezado,
 * paginador, corte de página—, reexportadas para que resultados las use tal
 * cual en vez de tener una segunda tabla con otras proporciones.
 */
export {
  HEADER_CELL_CLASS,
  HeaderCell,
  TablePager,
  SearchBox,
  CollapsibleSearchBox,
  ExpandButton,
} from "@/components/ciclo-detail/tablePieces";
export { usePagedSlice, formatCount, PAGE_SIZES } from "@/components/ciclo-detail/tableUtils";
