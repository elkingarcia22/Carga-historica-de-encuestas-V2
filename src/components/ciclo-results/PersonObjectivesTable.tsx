import * as React from "react";
import { motion } from "framer-motion";
import { Building2, ChevronRight, MessageSquareText, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { cascadeContainer, cascadeItem } from "@/lib/cascadeAnimation";
import { useFillHeight } from "@/lib/useFillHeight";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/feedback";
import { FilterSortHeader, SortOnlyHeader } from "@/components/data-display/TableHeaderControls";
import {
  ConfigurableHeaderCells,
  ConfigurableRowCells,
  LazyRowsSentinel,
  useColumnDrag,
  useLazyRows,
  type TableColumnCells,
  type TableColumnSpec,
  type TableConfig,
} from "@/components/data-display/table-config";
import { ComplianceBar, formatPercent, formatRelativeDate } from "@/components/ciclo-detail";
import type { ObjetivoEstadoConfig } from "@/components/objetivos/objetivosConfigStore";
import type { Objective } from "@/components/ciclo-builder";
import { HEADER_CELL_CLASS, HeaderCell } from "./tableBridge";
import { LIFECYCLE_META, editIntentOf } from "./objectiveLifecycle";
import { ObjectiveThread, type ThreadPost } from "./ObjectiveThread";
import type { ObjectivePatch } from "./PersonObjectiveDialogs";
import {
  ACTIVIDAD_BUCKETS,
  AVANCE_BUCKETS,
  ESTADO_INACTIVO,
  NO_OBJECTIVE_FILTERS,
  SIN_OBJETIVO_EMPRESA,
  clearObjectiveFilter,
  countObjectiveFilters,
  empujaLabelOf,
  estadoLabelOf,
  lastActivityOf,
  matchesObjectiveFilters,
  toggleObjectiveFilter,
  type ObjectiveColumnFilters,
  type ObjectiveColumnKey,
} from "./objectiveColumns";
import {
  LastActivity,
  ObjectiveEditRow,
  ObjectiveMetaLine,
  ObjectiveStateChip,
} from "./ObjectiveRowPieces";
import type { ResultEntry } from "./resultsModel";

/**
 * Los objetivos de una persona, con la anatomía de tabla del home.
 *
 * De lado a lado dentro de su tarjeta —se cancela el `p-4` y la tabla va a
 * sangre entre dos reglas—, encabezado quieto mientras se recorre, y cada
 * columna con su orden y su embudo en los mismos controles que usan la lista
 * de ciclos y la tabla de colaboradores. No hay una segunda forma de ordenar
 * ni de filtrar una tabla en este producto.
 *
 * Cinco columnas y ni una más: qué es el objetivo, a qué empuja, en qué banda
 * quedó, cuánto lleva y qué fue lo último que pasó en él. Lo demás —el peso,
 * la medida, la meta— cabe bajo el título, que es donde se lee sin gastar una
 * columna entera.
 *
 * La fila se abre como cualquier acordeón del reporte: chevron a la derecha
 * que gira, la fila abierta en el lavado de marca y el detalle sobre
 * `bg-muted/30` con su cascada. Dentro no hay una ficha de lectura sino el
 * hilo del objetivo, donde el líder y quien lo lleva se responden.
 *
 * Las acciones no viven en la fila: se marca y se actúa desde la barra
 * flotante, como en el resto de las tablas del módulo. La excepción es editar,
 * y lo es por donde ocurre: corregir un objetivo no abre una caja aparte sino
 * que convierte su fila en el formulario, columna por columna, con lo que no se
 * edita —su estado, su avance— todavía a la vista al lado. Como se escribe
 * donde se estaba leyendo, el lápiz que lo abre también vive ahí, al final de
 * la fila y al pasar por encima.
 */
/**
 * Las columnas de los objetivos de una persona. Viven aquí y la ficha las usa
 * para armar la configuración: el botón "Configurar" se sienta en la cabecera
 * de la tarjeta, junto al resto de los controles, y no dentro de la tabla.
 */
export const PERSON_OBJECTIVES_COLUMNS: readonly TableColumnSpec[] = [
  { id: "seleccion", label: "Selección", fixed: true },
  { id: "objetivo", label: "Objetivo" },
  { id: "empuja", label: "Empuja a" },
  { id: "estado", label: "Estado" },
  { id: "avance", label: "Avance" },
  { id: "actividad", label: "Última actividad" },
  { id: "acciones", label: "Acciones" },
];

export function PersonObjectivesTable({
  config,
  entries,
  companyObjectives,
  estados,
  selectedIds,
  onSelectionChange,
  onPost,
  editingId,
  onRequestEdit,
  editSubmitLabel = "Guardar",
  onSaveEdit,
  onCancelEdit,
  className,
}: {
  /** Armada por la ficha con `PERSON_OBJECTIVES_COLUMNS`. */
  config: TableConfig;
  entries: readonly ResultEntry[];
  companyObjectives: readonly Objective[];
  /** Las bandas configuradas, para el embudo de la columna "Estado". */
  estados: readonly ObjetivoEstadoConfig[];
  selectedIds: ReadonlySet<string>;
  onSelectionChange: (ids: ReadonlySet<string>) => void;
  /** Publica un mensaje en el hilo de un objetivo. Sin ella el hilo es de solo lectura. */
  onPost?: (objectiveId: string, post: ThreadPost) => void;
  /** El objetivo que ahora mismo se edita en línea, si hay alguno. */
  editingId?: string | null;
  /** Abre la edición de una fila desde su propio lápiz. Sin ella la tabla es
   *  de solo lectura y editar solo se puede desde la barra flotante. */
  onRequestEdit?: (objectiveId: string) => void;
  /** Qué dice el botón que cierra la edición: "Ajustar" también reenvía. */
  editSubmitLabel?: string;
  onSaveEdit?: (objectiveId: string, patch: ObjectivePatch) => void;
  onCancelEdit?: () => void;
  className?: string;
}) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [sort, setSort] = React.useState<{ key: SortKey; desc: boolean }>({
    key: "objetivo",
    desc: false,
  });
  const [columns, setColumns] = React.useState<ObjectiveColumnFilters>(NO_OBJECTIVE_FILTERS);

  /*
   * La caja de la tabla llega hasta abajo del panel, sea cual sea la pantalla.
   * Va como tope y no como alto fijo: con tres objetivos se encoge a lo que
   * miden, en vez de dejar media ventana en blanco bajo tres filas.
   */
  const tableBoxRef = React.useRef<HTMLDivElement>(null);
  const tableHeight = useFillHeight(tableBoxRef, 220);

  const companyTitleById = React.useMemo(
    () =>
      new Map(
        companyObjectives.map((objective) => [
          objective.id,
          objective.title.trim() === "" ? "Objetivo sin nombre" : objective.title,
        ])
      ),
    [companyObjectives]
  );

  /*
   * Las opciones de cada embudo salen del conjunto completo y no de lo ya
   * filtrado: si salieran de ahí, marcar un valor borraría a los demás de la
   * lista y no habría forma de cambiar de idea.
   */
  const empujaOptions = React.useMemo(() => {
    const present = new Set(entries.map((entry) => empujaLabelOf(entry, companyTitleById)));
    const ordered = companyObjectives
      .map((objective) => companyTitleById.get(objective.id) ?? "")
      .filter((label) => present.has(label));
    if (present.has(SIN_OBJETIVO_EMPRESA)) ordered.push(SIN_OBJETIVO_EMPRESA);
    return ordered;
  }, [entries, companyObjectives, companyTitleById]);

  const estadoOptions = React.useMemo(() => {
    const present = new Set(entries.map(estadoLabelOf));
    const ordered = estados.map((estado) => estado.nombre).filter((name) => present.has(name));
    if (present.has(ESTADO_INACTIVO)) ordered.push(ESTADO_INACTIVO);
    return ordered;
  }, [entries, estados]);

  const estadoOrder = React.useMemo(
    () => new Map(estados.map((estado, index) => [estado.nombre, index])),
    [estados]
  );

  const filterCount = countObjectiveFilters(columns);

  const toggleColumn = (column: ObjectiveColumnKey, value: string) =>
    setColumns((current) => toggleObjectiveFilter(current, column, value));
  const clearColumn = (column: ObjectiveColumnKey) =>
    setColumns((current) => clearObjectiveFilter(current, column));

  const visible = React.useMemo(
    () => entries.filter((entry) => matchesObjectiveFilters(entry, columns, companyTitleById)),
    [entries, columns, companyTitleById]
  );

  const sorted = React.useMemo(() => {
    const factor = sort.desc ? -1 : 1;
    const byTitle = (a: ResultEntry, b: ResultEntry) =>
      (a.objective.title || "").localeCompare(b.objective.title || "", "es");
    return [...visible].sort((a, b) => {
      switch (sort.key) {
        case "empuja":
          return (
            factor *
              empujaLabelOf(a, companyTitleById).localeCompare(
                empujaLabelOf(b, companyTitleById),
                "es"
              ) || byTitle(a, b)
          );
        case "estado":
          return (
            factor *
              ((estadoOrder.get(estadoLabelOf(a)) ?? -1) -
                (estadoOrder.get(estadoLabelOf(b)) ?? -1)) || byTitle(a, b)
          );
        case "avance":
          return factor * (a.percent - b.percent) || byTitle(a, b);
        case "actividad":
          return (
            factor * (lastActivityOf(a)?.date ?? "").localeCompare(lastActivityOf(b)?.date ?? "") ||
            byTitle(a, b)
          );
        default:
          return factor * byTitle(a, b);
      }
    });
  }, [visible, sort, companyTitleById, estadoOrder]);

  const toggleSort = (key: SortKey) =>
    setSort((current) =>
      current.key === key ? { key, desc: !current.desc } : { key, desc: key !== "objetivo" }
    );

  const visibleIds = sorted.map((entry) => entry.objective.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someSelected = !allSelected && visibleIds.some((id) => selectedIds.has(id));

  const toggleAll = () => {
    const next = new Set(selectedIds);
    if (allSelected) visibleIds.forEach((id) => next.delete(id));
    else visibleIds.forEach((id) => next.add(id));
    onSelectionChange(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const drag = useColumnDrag({ axis: "x", onReorder: config.moveColumn });

  /*
   * Esta tabla nunca tuvo paginador —es la lista de objetivos de una sola
   * persona, dentro de su ficha—, así que va siempre de corrido: carga por
   * tramos al bajar y el panel de configuración no ofrece el otro modo.
   */
  const lazy = useLazyRows({ total: sorted.length, enabled: true, resetKey: sorted });
  const shown = sorted.slice(0, lazy.count);

  /**
   * Cada columna dicha una sola vez: su encabezado y su celda. Las celdas
   * salen de aquí y no de la fila porque el orden se aplica una sola vez,
   * sobre el par, y así el título nunca se despega de su dato.
   */
  const cells: TableColumnCells<ResultEntry> = {
    objetivo: {
      headClassName: "px-4",
      head: (
        <SortOnlyHeader
          label="Objetivo"
          sortActive={sort.key === "objetivo"}
          onSort={() => toggleSort("objetivo")}
        />
      ),
      cell: (entry) => (
        <>
          <p className="truncate text-[13px] font-semibold text-text-primary">
            {entry.objective.title || "Objetivo sin nombre"}
          </p>
          <p className="mt-0.5 truncate text-[11.5px] text-text-muted">
            <ObjectiveMetaLine objective={entry.objective} />
          </p>
        </>
      ),
    },

    empuja: {
      headClassName: "w-[15rem] px-4",
      head: (
        <FilterSortHeader
          label="Empuja a"
          options={empujaOptions}
          selected={columns.empuja}
          onToggleFilter={(value) => toggleColumn("empuja", value)}
          onClearFilter={() => clearColumn("empuja")}
          sortActive={sort.key === "empuja"}
          onSort={() => toggleSort("empuja")}
        />
      ),
      cell: (entry) => {
        const companyTitle = entry.objective.alignedTo
          ? companyTitleById.get(entry.objective.alignedTo) ?? null
          : null;
        if (!companyTitle) {
          return <span className="text-[12px] text-text-muted">{SIN_OBJETIVO_EMPRESA}</span>;
        }
        return (
          <span className="flex min-w-0 items-center gap-2 text-[12.5px] font-medium text-text-primary">
            <span
              aria-hidden
              className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
            >
              <Building2 className="size-3" strokeWidth={2.4} />
            </span>
            <span className="truncate" title={companyTitle}>
              {companyTitle}
            </span>
          </span>
        );
      },
    },

    estado: {
      headClassName: "w-[11rem] px-4",
      head: (
        <FilterSortHeader
          label="Estado"
          options={estadoOptions}
          selected={columns.estado}
          onToggleFilter={(value) => toggleColumn("estado", value)}
          onClearFilter={() => clearColumn("estado")}
          sortActive={sort.key === "estado"}
          onSort={() => toggleSort("estado")}
        />
      ),
      cell: (entry) => <ObjectiveStateChip entry={entry} />,
    },

    avance: {
      headClassName: "w-[9.5rem] px-4",
      head: (
        <FilterSortHeader
          label="Avance"
          options={AVANCE_BUCKETS}
          selected={columns.avance}
          onToggleFilter={(value) => toggleColumn("avance", value)}
          onClearFilter={() => clearColumn("avance")}
          sortActive={sort.key === "avance"}
          onSort={() => toggleSort("avance")}
        />
      ),
      cell: (entry) => <ComplianceBar percent={entry.percent} estado={entry.estado} />,
    },

    actividad: {
      headClassName: "w-[11rem] px-4",
      head: (
        <FilterSortHeader
          label="Última actividad"
          options={ACTIVIDAD_BUCKETS}
          selected={columns.actividad}
          onToggleFilter={(value) => toggleColumn("actividad", value)}
          onClearFilter={() => clearColumn("actividad")}
          sortActive={sort.key === "actividad"}
          onSort={() => toggleSort("actividad")}
        />
      ),
      cell: (entry) => <LastActivity entry={entry} />,
    },

    acciones: {
      headClassName: "w-[5.5rem] pr-4",
      head: <span className="sr-only">Editar y abrir el hilo</span>,
      cellClassName: "py-3 pr-4",
      cell: (entry) => {
        const canEdit = onRequestEdit && editIntentOf(entry) !== null;
        return (
          <div className="flex items-center justify-end gap-0.5">
            {/* El lápiz aparece al pasar por la fila —y se queda si recibe el
                foco por teclado—: es una acción de esta fila, no del reporte,
                y estar siempre encendido en seis filas gana ruido sin ganar
                claridad. */}
            {canEdit && (
              <button
                type="button"
                aria-label={`Editar ${entry.objective.title || "objetivo sin nombre"}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onRequestEdit?.(entry.objective.id);
                }}
                className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground/70 opacity-0 transition-all hover:bg-muted hover:text-text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 group-hover:opacity-100"
              >
                <Pencil className="size-3.5" strokeWidth={2.2} />
              </button>
            )}
            <ChevronRight
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform duration-200 group-hover:text-text-primary",
                expandedId === entry.objective.id && "rotate-90"
              )}
              strokeWidth={2}
            />
          </div>
        );
      },
    },
  };

  if (sorted.length === 0) {
    return (
      <div className={cn("-mx-4 border-y border-border/60 p-8", className)}>
        <EmptyState
          title="Ningún objetivo cumple con los filtros"
          description="Las columnas están recortando la tabla. Quítales el filtro para volver a ver sus objetivos."
          action={
            filterCount > 0 ? (
              <Button variant="outline" size="sm" onClick={() => setColumns(NO_OBJECTIVE_FILTERS)}>
                Quitar filtros de columna ({filterCount})
              </Button>
            ) : undefined
          }
          className="border-none bg-transparent shadow-none"
        />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        ref={tableBoxRef}
        style={{ maxHeight: tableHeight ?? "70vh" }}
        className="-mx-4 overflow-auto border-y border-border/60"
      >
        {/* Una `<table>` a secas y no el `Table` del sistema: ese envuelve la
            tabla en un `div` con `overflow-x`, y un `sticky` dentro de él se
            ancla a ese `div` —que crece con el contenido— en vez de a esta
            caja con tope, así que el encabezado nunca se quedaría quieto. */}
        <table className="w-full min-w-[54rem] caption-bottom border-collapse text-sm">
          <TableHeader className="[&_tr]:border-b-0">
            <TableRow className="sticky top-0 z-20 border-b-0 bg-muted-solid shadow-[0_1px_0_0_hsl(var(--border)/0.6)] hover:bg-muted-solid">
              <HeaderCell className="w-[50px] pl-7 pr-5">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={toggleAll}
                  aria-label="Seleccionar todos los objetivos"
                />
              </HeaderCell>
              <ConfigurableHeaderCells
                config={config}
                drag={drag}
                cells={cells}
                className={HEADER_CELL_CLASS}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((entry) =>
              entry.objective.id === editingId ? (
                <ObjectiveEditRow
                  // La llave lleva el id: pasar de editar un objetivo a otro
                  // monta una fila nueva, con su borrador recién sacado del
                  // objetivo, en vez de arrastrar lo escrito en el anterior.
                  key={`editar:${entry.objective.id}`}
                  entry={entry}
                  companyObjectives={companyObjectives}
                  submitLabel={editSubmitLabel}
                  colSpan={config.columns.length + 1}
                  onSave={(patch) => onSaveEdit?.(entry.objective.id, patch)}
                  onCancel={() => onCancelEdit?.()}
                />
              ) : (
                <ObjectiveRow
                  key={entry.objective.id}
                  entry={entry}
                  config={config}
                  cells={cells}
                  selected={selectedIds.has(entry.objective.id)}
                  expanded={expandedId === entry.objective.id}
                  onToggleSelect={() => toggleOne(entry.objective.id)}
                  onToggleExpand={() =>
                    setExpandedId((current) =>
                      current === entry.objective.id ? null : entry.objective.id
                    )
                  }
                  onPost={onPost ? (post) => onPost(entry.objective.id, post) : undefined}
                />
              )
            )}
            <LazyRowsSentinel
              lazy={lazy}
              colSpan={config.columns.length + 1}
              noun="objetivos"
            />
          </TableBody>
        </table>
      </div>

      {filterCount > 0 && (
        <button
          type="button"
          onClick={() => setColumns(NO_OBJECTIVE_FILTERS)}
          className="self-start text-[12px] font-semibold text-primary transition-colors hover:underline"
        >
          Quitar filtros de columna ({filterCount})
        </button>
      )}
    </div>
  );
}

type SortKey = "objetivo" | "empuja" | "estado" | "avance" | "actividad";

// ── La fila ────────────────────────────────────────────────────────────────

function ObjectiveRow({
  entry,
  config,
  cells,
  selected,
  expanded,
  onToggleSelect,
  onToggleExpand,
  onPost,
}: {
  entry: ResultEntry;
  /** El orden y las columnas visibles; las celdas salen del diccionario. */
  config: TableConfig;
  cells: TableColumnCells<ResultEntry>;
  selected: boolean;
  expanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onPost?: (post: ThreadPost) => void;
}) {
  const inactivation = entry.inactivation;
  const review = entry.tracked.review;

  return (
    <>
      <TableRow
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        data-state={selected ? "selected" : undefined}
        onClick={onToggleExpand}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          onToggleExpand();
        }}
        className={cn(
          "group cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30",
          expanded && "border-b-0 bg-primary/[0.03]",
          inactivation && "opacity-70"
        )}
      >
        <TableCell className="py-3 pl-7 pr-5" onClick={(event) => event.stopPropagation()}>
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            aria-label={`Seleccionar ${entry.objective.title || "objetivo sin nombre"}`}
          />
        </TableCell>

        <ConfigurableRowCells
          config={config}
          cells={cells}
          row={entry}
          className="px-4 py-3"
        />
      </TableRow>

      {expanded && (
        <TableRow className="border-b border-border/60 bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={config.columns.length + 1} className="px-4 py-4">
            <motion.div
              className="flex flex-col gap-3"
              initial="hidden"
              animate="show"
              variants={cascadeContainer}
            >
              {inactivation && (
                <motion.p
                  variants={cascadeItem}
                  className="rounded-lg bg-surface px-3 py-2 text-[12px] text-text-secondary"
                >
                  Inactivo desde {formatRelativeDate(inactivation.date)} por{" "}
                  {inactivation.authorName}. No cuenta en el peso ni en el promedio de esta persona,
                  pero conserva el {formatPercent(inactivation.percentAtInactivation)} que había
                  alcanzado.
                </motion.p>
              )}

              {review?.status === "ajustes" && review.comment && (
                <motion.div
                  variants={cascadeItem}
                  className={cn(
                    "flex gap-2.5 rounded-xl border px-3 py-2.5",
                    LIFECYCLE_META["por-ajustar"].bg,
                    LIFECYCLE_META["por-ajustar"].border
                  )}
                >
                  <MessageSquareText
                    className={cn("mt-0.5 size-3.5 shrink-0", LIFECYCLE_META["por-ajustar"].text)}
                    strokeWidth={2.3}
                  />
                  <div className="min-w-0">
                    <p className={cn("text-[11.5px] font-bold", LIFECYCLE_META["por-ajustar"].text)}>
                      {review.reviewerName ?? "Su líder"} pidió cambios
                      {review.date && ` · ${formatRelativeDate(review.date)}`}
                    </p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-text-secondary">
                      {review.comment}
                    </p>
                  </div>
                </motion.div>
              )}

              <motion.div variants={cascadeItem}>
                <ObjectiveThread
                  objective={entry.objective}
                  updates={entry.tracked.updates}
                  onPost={onPost}
                />
              </motion.div>
            </motion.div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
