import * as React from "react";
import { Compass, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/feedback";
import { FilterSortHeader, SortOnlyHeader } from "@/components/data-display/TableHeaderControls";
import {
  ConfigurableHeaderCells,
  ConfigurableRowCells,
  LazyRowsSentinel,
  LazyRowsSummary,
  TableConfigButton,
  useColumnDrag,
  useLazyRows,
  useTableConfig,
  type TableColumnCells,
  type TableColumnSpec,
} from "@/components/data-display/table-config";
import {
  InitialsAvatar,
  NivelChip,
  formatPercent,
  formatRelativeDate,
} from "@/components/ciclo-detail";
import {
  CollapsibleSearchBox,
  HEADER_CELL_CLASS,
  HeaderCell,
  TablePager,
  usePagedSlice,
} from "./tableBridge";
import { AvancePill, EstadoBar, RiskChip } from "./ResultsChips";
import { ResultsDetailCard } from "./ResultsDetailCard";
import { ResultsGlobalFilters } from "./ResultsGlobalFilters";
import {
  ACTUALIZACION_BUCKETS,
  AVANCE_BUCKETS,
  NO_COLUMN_FILTERS,
  OBJETIVOS_BUCKETS,
  clearColumnFilter,
  countColumnFilters,
  matchesColumnFilters,
  toggleColumnFilter,
  type ColumnFilterKey,
  type ColumnFilters,
} from "./colaboradoresColumns";
import { RISK_META, RISK_ORDER } from "./resultsModel";
import type { CicloResults, PersonResultRow } from "./resultsModel";
import type { ResultsFiltersState } from "./useResultsFilters";

/**
 * El padrón del ciclo.
 *
 * Cada columna se ordena y se filtra desde su propio encabezado, con el mismo
 * embudo que la tabla de ciclos del home: ordenar dice en qué orden mirar,
 * filtrar dice a quiénes mirar, y son dos preguntas distintas que no tenían
 * por qué compartir un solo control.
 *
 * "Estado" es el nivel de cumplimiento configurado —la escala que la empresa
 * define en la configuración de objetivos—, y quien no ha reportado un solo
 * avance sale "Por iniciar": calificar a alguien por un trabajo que nadie ha
 * visto todavía sería inventarse una nota. El riesgo es un pronóstico sobre el
 * calendario, no una calificación, así que tiene su propia columna en vez de
 * apilarse debajo del estado.
 *
 * Lo que describe a la persona —área, líder, país, edad, género, grupo
 * personalizado— vive en "Segmentación", el mismo desplegable de un demográfico
 * a la vez que usa el informe de una encuesta: filtrarlo aquí sería una segunda
 * forma de hacer lo mismo con otro control. A qué objetivo de empresa apunta
 * cada quien no es una columna —una persona puede apuntar a varios objetivos
 * distintos a la vez, así que una celda nunca lo diría bien—: es el mapa que
 * se abre al entrar a su ficha.
 *
 * Una fila abre la ficha de esa persona: el mismo árbol de la pestaña de
 * cumplimiento, recortado a ella, más su mapa de alineación.
 *
 * La caja de la tabla es la misma de la lista de ciclos del home: va de lado
 * a lado de la tarjeta —sin margen ni recuadro propio, solo una regla arriba
 * y otra abajo—, arranca en diez filas por página y hace su propio scroll
 * hasta donde termina la pantalla, con el encabezado quieto y el paginador
 * siempre a la vista. Antes la tabla arrastraba la página entera: con 50
 * filas había que bajar hasta el final para saber en qué página se estaba, y
 * a mitad de camino las columnas ya no tenían título.
 */

type SortKey =
  | "nombre"
  | "objetivos"
  | "avance"
  | "estado"
  | "lider"
  | "riesgo"
  | "actualizacion";

interface ColaboradoresTabProps {
  /** El ciclo ya recortado por los filtros: lo que la tabla pinta. */
  results: CicloResults;
  /**
   * El ciclo completo. De aquí salen las opciones de cada menú: si salieran
   * de lo ya filtrado, marcar un valor borraría a los demás de la lista y no
   * habría forma de cambiar de idea.
   */
  baseResults: CicloResults;
  rows: readonly PersonResultRow[];
  filters: ResultsFiltersState;
  /** Falso en un ciclo cerrado: el riesgo es un pronóstico y ya no hay. */
  showsRisk: boolean;
  selectedIds: ReadonlySet<string>;
  onSelectionChange: (ids: ReadonlySet<string>) => void;
  onOpenPerson: (personId: string) => void;
  /** Las fichas de lo que está filtrado, bajo la fila de controles. */
  globalChips?: React.ReactNode;
  /** El switch Colaboradores / Alineación, al final de la fila de controles. */
  viewSwitch?: React.ReactNode;
}

export function ColaboradoresTab({
  results,
  baseResults,
  rows,
  filters,
  showsRisk,
  selectedIds,
  onSelectionChange,
  onOpenPerson,
  globalChips,
  viewSwitch,
}: ColaboradoresTabProps) {
  const [sort, setSort] = React.useState<{ key: SortKey; desc: boolean }>({
    key: "avance",
    desc: true,
  });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [columns, setColumns] = React.useState<ColumnFilters>(NO_COLUMN_FILTERS);

  /*
   * La tabla no tiene caja propia con scroll: baja con la página, igual que la
   * lista de ciclos del home.
   *
   * Acotarla a lo que cabía en pantalla parecía lo correcto —el pie siempre a
   * la vista— pero es lo que la hacía verse cortada a media pantalla: por
   * debajo quedaba una franja muerta y el pie flotaba en ella. Así las filas
   * siguen hasta el final y pasan por detrás de la barra flotante, y el pie
   * con el promedio y el conteo aparece donde corresponde: después de la
   * última fila, cuando de verdad se llegó al final.
   */

  // Resuelto una sola vez por render para que todas las filas caigan en el
  // mismo tramo de "hace cuánto reportó".
  const now = React.useMemo(() => new Date(), []);

  // ── Opciones de cada menú, sobre el ciclo completo ──
  // El nivel se filtra por id en el estado global y se ofrece por nombre en el
  // menú, así que el menú traduce en los dos sentidos con esta lista.
  const nivelOptions = React.useMemo(
    () => baseResults.niveles.map((nivel) => nivel.nombre),
    [baseResults.niveles]
  );
  const nivelIdByName = React.useMemo(
    () => new Map(baseResults.niveles.map((nivel) => [nivel.nombre, nivel.id])),
    [baseResults.niveles]
  );
  const nivelOrder = React.useMemo(
    () => new Map(baseResults.niveles.map((nivel, index) => [nivel.id, index])),
    [baseResults.niveles]
  );
  const selectedNiveles = React.useMemo(
    () =>
      new Set(
        baseResults.niveles
          .filter((nivel) => filters.filters.niveles.has(nivel.id))
          .map((nivel) => nivel.nombre)
      ),
    [baseResults.niveles, filters.filters.niveles]
  );

  // El riesgo tiene un orden propio —de más a menos urgente— que no es
  // alfabético, así que se ordena por posición en `RISK_ORDER`.
  const riskOptions = React.useMemo(() => RISK_ORDER.map((id) => RISK_META[id].label), []);
  const riskIdByLabel = React.useMemo(
    () => new Map(RISK_ORDER.map((id) => [RISK_META[id].label, id])),
    []
  );
  const selectedRiskLabels = React.useMemo(
    () =>
      new Set(RISK_ORDER.filter((id) => filters.filters.risks.has(id)).map((id) => RISK_META[id].label)),
    [filters.filters.risks]
  );
  const riskOrder = React.useMemo(
    () => new Map(RISK_ORDER.map((id, index) => [id, index])),
    []
  );

  const columnCount = countColumnFilters(columns);

  const toggleColumn = (column: ColumnFilterKey, value: string) => {
    setColumns((current) => toggleColumnFilter(current, column, value));
    setPage(1);
  };

  const clearColumn = (column: ColumnFilterKey) => {
    setColumns((current) => clearColumnFilter(current, column));
    setPage(1);
  };

  /*
   * Lo que filtran los encabezados que no tienen un filtro global detrás. Las
   * cuentas de abajo —el total de la tarjeta, el promedio, el paginador—
   * salen todas de aquí: una tabla que dice "128 colaboradores" y muestra 14
   * está mintiendo en la mitad que se lee primero.
   */
  const visible = React.useMemo(
    () => rows.filter((row) => matchesColumnFilters(row, columns, now)),
    [rows, columns, now]
  );

  const sorted = React.useMemo(() => {
    const factor = sort.desc ? -1 : 1;
    const byName = (a: PersonResultRow, b: PersonResultRow) =>
      a.collaborator.name.localeCompare(b.collaborator.name, "es");
    return [...visible].sort((a, b) => {
      switch (sort.key) {
        case "nombre":
          return factor * byName(a, b);
        case "objetivos":
          return factor * (a.entries.length - b.entries.length) || byName(a, b);
        case "estado":
          return (
            factor *
              ((nivelOrder.get(a.nivel?.id ?? "") ?? -1) -
                (nivelOrder.get(b.nivel?.id ?? "") ?? -1)) || byName(a, b)
          );
        case "lider":
          return factor * a.leader.localeCompare(b.leader, "es") || byName(a, b);
        case "riesgo":
          return (
            factor * ((riskOrder.get(a.risk) ?? 0) - (riskOrder.get(b.risk) ?? 0)) || byName(a, b)
          );
        case "actualizacion":
          return (
            factor * (a.lastUpdate?.date ?? "").localeCompare(b.lastUpdate?.date ?? "") ||
            byName(a, b)
          );
        default:
          return factor * (a.percent - b.percent) || byName(a, b);
      }
    });
  }, [visible, sort, nivelOrder, riskOrder]);

  /*
   * Cómo se mira la tabla —qué columnas, en qué orden y cómo llegan las
   * filas— vive en "Configurar", el botón vecino de "Filtros": filtrar cambia
   * a quién se mira y configurar cambia cómo, y son dos preguntas distintas.
   *
   * "Riesgo" entra y sale de la lista según el ciclo. En uno cerrado no hay
   * pronóstico que dar, y una columna que hoy no aplica no tiene por qué
   * ofrecerse en el panel —pero su sitio en el orden se recuerda para cuando
   * vuelva.
   */
  const columnSpecs = React.useMemo<TableColumnSpec[]>(
    () => [
      { id: "seleccion", label: "Selección", fixed: true },
      { id: "nombre", label: "Colaborador" },
      { id: "objetivos", label: "Objetivos" },
      { id: "avance", label: "Avance" },
      { id: "estado", label: "Estado" },
      { id: "lider", label: "Líder" },
      { id: "riesgo", label: "Riesgo", available: showsRisk },
      { id: "actualizacion", label: "Última actualización" },
    ],
    [showsRisk]
  );
  const config = useTableConfig("ciclo-resultados-colaboradores", columnSpecs);
  const drag = useColumnDrag({ axis: "x", onReorder: config.moveColumn });

  // `usePagedSlice` ya recorta la página a las que existen, así que filtrar
  // hasta dejar menos páginas no necesita corregir el estado: `current` es la
  // página real y es la que se pinta y se le pasa al paginador.
  const { paged, current } = usePagedSlice(sorted, page, pageSize);

  /*
   * Y el tramo cargado, cuando la tabla va de corrido. El paso es el mismo
   * tamaño de página que ya eligió la pantalla, así que la primera carga
   * llena la caja igual en los dos modos. `sorted` como llave de reinicio:
   * cambia de identidad en cuanto se filtra u ordena, y seguir en la fila 300
   * de otra lista no significa nada.
   */
  const lazy = useLazyRows({
    total: sorted.length,
    enabled: config.isLazy,
    resetKey: sorted,
  });

  /** Lo que se pinta: el tramo cargado o la página, según el modo. */
  const shown = config.isLazy ? sorted.slice(0, lazy.count) : paged;

  const toggleSort = (key: SortKey) =>
    setSort((currentSort) =>
      currentSort.key === key
        ? { key, desc: !currentSort.desc }
        : { key, desc: key !== "nombre" && key !== "riesgo" }
    );

  // Sobre lo que hay en pantalla, sea una página o el tramo ya cargado: la
  // casilla del encabezado marca lo que se está viendo, no una página que en
  // scroll infinito no existe.
  const pageIds = shown.map((row) => row.person.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));

  const togglePage = () => {
    const next = new Set(selectedIds);
    if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
    else pageIds.forEach((id) => next.add(id));
    onSelectionChange(next);
  };

  const toggleRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  /**
   * Cada columna dicha una sola vez: su encabezado y su celda, juntos.
   *
   * Antes el orden estaba escrito tres veces —los `<th>`, los `<td>` y
   * cualquier menú de columnas—, y esa repetición es justo lo que hace
   * imposible mover una columna sin desalinear el título del dato. Aquí el
   * orden lo pone `config` y las dos mitades viajan pegadas.
   */
  const cells: TableColumnCells<PersonResultRow> = {
    // Solo el nombre: quién es cada quien se recorta desde "Segmentación"
    // (área, líder…), no desde aquí.
    nombre: {
      headClassName: "px-4",
      head: (
        <SortOnlyHeader
          label="Colaborador"
          sortActive={sort.key === "nombre"}
          onSort={() => toggleSort("nombre")}
        />
      ),
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <InitialsAvatar name={row.collaborator.name} size="sm" />
          <p className="truncate text-[13px] font-semibold text-text-primary">
            {row.collaborator.name}
          </p>
        </div>
      ),
    },
    objetivos: {
      headClassName: "w-[10rem] px-4",
      head: (
        <FilterSortHeader
          label="Objetivos"
          options={OBJETIVOS_BUCKETS}
          selected={columns.objetivos}
          onToggleFilter={(value) => toggleColumn("objetivos", value)}
          onClearFilter={() => clearColumn("objetivos")}
          sortActive={sort.key === "objetivos"}
          onSort={() => toggleSort("objetivos")}
        />
      ),
      cell: (row) => (
        <div className="flex items-center gap-2">
          <span className="w-6 shrink-0 text-[12.5px] font-bold tabular-nums text-text-primary">
            {row.entries.length}
          </span>
          <EstadoBar counts={row.estadoCounts} estados={results.estados} width="w-16" />
        </div>
      ),
    },
    avance: {
      headClassName: "w-[8rem] px-4",
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
      cell: (row) => <AvancePill percent={row.percent} estado={row.estado} labeled={false} />,
    },
    estado: {
      headClassName: "px-4",
      head: (
        <FilterSortHeader
          label="Estado"
          options={nivelOptions}
          selected={selectedNiveles}
          onToggleFilter={(value) => {
            const id = nivelIdByName.get(value);
            if (id) filters.toggle("niveles", id);
          }}
          onClearFilter={() => filters.clearKey("niveles")}
          sortActive={sort.key === "estado"}
          onSort={() => toggleSort("estado")}
        />
      ),
      cell: (row) => <NivelChip nivel={row.nivel} />,
    },
    lider: {
      headClassName: "px-4",
      head: (
        <SortOnlyHeader
          label="Líder"
          sortActive={sort.key === "lider"}
          onSort={() => toggleSort("lider")}
        />
      ),
      cell: (row) => (
        <p className="truncate text-[12.5px] text-text-secondary">{row.leader}</p>
      ),
    },
    riesgo: {
      headClassName: "px-4",
      head: (
        <FilterSortHeader
          label="Riesgo"
          options={riskOptions}
          selected={selectedRiskLabels}
          onToggleFilter={(value) => {
            const id = riskIdByLabel.get(value);
            if (id) filters.toggle("risks", id);
          }}
          onClearFilter={() => filters.clearKey("risks")}
          sortActive={sort.key === "riesgo"}
          onSort={() => toggleSort("riesgo")}
        />
      ),
      cell: (row) => <RiskChip risk={row.risk} />,
    },
    actualizacion: {
      headClassName: "px-4",
      cellClassName: "text-[12.5px] text-text-secondary",
      head: (
        <FilterSortHeader
          label="Última actualización"
          options={ACTUALIZACION_BUCKETS}
          selected={columns.actualizacion}
          onToggleFilter={(value) => toggleColumn("actualizacion", value)}
          onClearFilter={() => clearColumn("actualizacion")}
          sortActive={sort.key === "actualizacion"}
          onSort={() => toggleSort("actualizacion")}
        />
      ),
      cell: (row) =>
        row.lastUpdate ? formatRelativeDate(row.lastUpdate.date) : "Sin reportes",
    },
  };

  // Con "Segmentación": lo que describe a la persona se recorta ahí, no en la
  // tabla. Sin "Ver por" —esta tabla ya lista a cada persona, no hay un corte
  // que aplicarle encima—. El buscador va primero y "Segmentación" justo
  // después —es el mismo botón que se abre a un campo, el que ya usa la
  // lista de ciclos del home—, y "Filtros" queda último por ser lo que se
  // toca justo antes de recortar la tabla.
  const controls = (
    <>
      <ResultsGlobalFilters
        results={baseResults}
        state={filters}
        showBreakdown={false}
        showSegmentation
        segmentationAfterSearch
        searchSlot={
          <CollapsibleSearchBox
            value={filters.filters.search}
            onChange={filters.setSearch}
            placeholder="Buscar colaborador…"
          />
        }
      />
      <TableConfigButton config={config} noun="colaboradores" />
      {viewSwitch}
    </>
  );

  if (visible.length === 0) {
    return (
      <ResultsDetailCard
        title="Detalle por colaborador"
        count={0}
        controls={controls}
        chips={globalChips}
        wide
      >
        <div className="-mx-4 flex items-center justify-center border-y border-border/60 p-8">
          <EmptyState
            title="Ninguna persona cumple con los filtros"
            description={
              columnCount > 0
                ? "Las columnas están recortando la tabla. Quítales el filtro o ajusta los de arriba para volver a ver colaboradores."
                : "Ajusta los filtros para volver a ver colaboradores del ciclo."
            }
            action={
              columnCount > 0 ? (
                <Button variant="outline" size="sm" onClick={() => setColumns(NO_COLUMN_FILTERS)}>
                  Quitar filtros de columna ({columnCount})
                </Button>
              ) : undefined
            }
            className="border-none bg-transparent shadow-none"
          />
        </div>
      </ResultsDetailCard>
    );
  }

  return (
    <ResultsDetailCard
      title="Detalle por colaborador"
      count={visible.length}
      controls={controls}
      chips={globalChips}
      wide
    >
      <div className="-mx-4 border-y border-border/60">
        {/* Una `<table>` a secas y no el `Table` del sistema: ese la envuelve
            en un `div` con `overflow-x`, y cualquier eje que deje de ser
            `visible` convierte al otro en `auto`: el `div` pasaría a ser el
            contenedor con scroll al que se ancla el `sticky` del encabezado, y
            como crece con el contenido y nunca desborda, el encabezado no se
            quedaría quieto nunca. Sin envoltorio, se ancla al scroll de la
            página, que es el que de verdad baja. */}
        <table className="w-full caption-bottom border-collapse text-sm">
          <TableHeader className="[&_tr]:border-b-0">
            {/* Pegado justo debajo de la cabecera de la tarjeta, que también
                se queda quieta: `--results-sticky-top` la mide por nosotros. */}
            <TableRow className="sticky top-[var(--results-sticky-top,72px)] z-20 border-b-0 bg-muted-solid shadow-[0_1px_0_0_hsl(var(--border)/0.6)] hover:bg-muted-solid">
              <HeaderCell className="w-[50px] pl-7 pr-5">
                <Checkbox
                  checked={allOnPageSelected}
                  onCheckedChange={togglePage}
                  aria-label="Seleccionar las filas visibles"
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
            {shown.map((row) => {
              const selected = selectedIds.has(row.person.id);
              return (
                <TableRow
                  key={row.person.id}
                  data-state={selected ? "selected" : undefined}
                  onClick={() => onOpenPerson(row.person.id)}
                  className={cn(
                    "cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/30",
                    !row.counts && "opacity-70"
                  )}
                >
                  <TableCell className="py-3 pl-7 pr-5" onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => toggleRow(row.person.id)}
                      aria-label={`Seleccionar a ${row.collaborator.name}`}
                    />
                  </TableCell>
                  <ConfigurableRowCells
                    config={config}
                    cells={cells}
                    row={row}
                    className="px-4 py-3"
                  />
                </TableRow>
              );
            })}
            <LazyRowsSentinel
              lazy={lazy}
              colSpan={config.columns.length + 1}
              noun="colaboradores"
            />
          </TableBody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[12px] text-muted-foreground">
            Promedio de los mostrados:{" "}
            <span className="font-semibold tabular-nums text-text-primary">
              {formatPercent(visible.reduce((sum, row) => sum + row.percent, 0) / visible.length)}
            </span>
          </p>
          {columnCount > 0 && (
            <button
              type="button"
              onClick={() => setColumns(NO_COLUMN_FILTERS)}
              className="text-[12px] font-semibold text-primary transition-colors hover:underline"
            >
              Quitar filtros de columna ({columnCount})
            </button>
          )}
        </div>
        {/* De corrido el paginador no tiene nada que decir: lo que hace falta
            saber es por dónde va la carga, y para elegir el otro modo está
            "Configurar". */}
        {config.isLazy ? (
          <LazyRowsSummary lazy={lazy} total={sorted.length} noun="colaboradores" />
        ) : (
          <TablePager
            total={sorted.length}
            page={current}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            noun="colaboradores"
          />
        )}
      </div>
    </ResultsDetailCard>
  );
}

/**
 * Las dos lecturas de esta pestaña, con el mismo control segmentado con el
 * que Cumplimiento cambia de árbol a heatmap.
 *
 * La tabla dice quién va cómo; la alineación dice hacia dónde empuja toda esa
 * gente. Son la misma población leída por dos preguntas distintas, así que
 * comparten pestaña y filtros en vez de partirse en dos.
 */
export type ColaboradoresView = "detalle" | "alineacion";

export function ColaboradoresViewSwitch({
  value,
  onChange,
}: {
  value: ColaboradoresView;
  onChange: (value: ColaboradoresView) => void;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onChange(next as ColaboradoresView)}
      className="w-auto shrink-0"
    >
      <TabsList>
        <TabsTrigger value="detalle">
          <Users className="h-3.5 w-3.5" />
          Colaboradores
        </TabsTrigger>
        <TabsTrigger value="alineacion">
          <Compass className="h-3.5 w-3.5" />
          Alineación estratégica
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
