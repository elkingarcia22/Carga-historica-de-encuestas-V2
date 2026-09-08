import * as React from "react";
import { toast } from "sonner";
import { BarChart3, ListTree, Sparkles, Trophy, Users } from "lucide-react";
import { ShellRailSlot } from "@/components/app-shell";
import { CURRENT_USER } from "@/components/app-shell/appShellData";
import { UbitsTabs, type TabItem } from "@/components/navigation";
import { useObjetivosConfig } from "@/components/objetivos/objetivosConfigStore";
import {
  CicloDownloadDrawer,
  CicloDownloadsWidget,
  buildCicloDetail,
  buildGroupRows,
  buildPersonRows,
  objectiveCompliance,
  summarize,
  useCicloDownloadCenter,
  type CicloListRow,
  type CicloReportSource,
} from "@/components/ciclo-detail";
import {
  AnalisisIaTab,
  CicloResultsActionRail,
  ColaboradoresTab,
  CumplimientoTab,
  PendingDrawer,
  PersonResultSheet,
  RankingTab,
  ResultsGlobalFilters,
  ResumenTab,
  buildCicloResults,
  filterResults,
  narrowResults,
  useResultsFilters,
  type CumplimientoView,
  type PendingKind,
  type RankingAxis,
  type ResultsAxis,
} from "@/components/ciclo-results";

/**
 * Los resultados de un ciclo.
 *
 * Pantalla aparte del seguimiento a propósito. Seguimiento responde "¿quién
 * falta por reportar?" y por eso es editable, con su drawer de actualización;
 * resultados responde "¿cómo nos fue?" y por eso es de lectura, agregados y
 * exportable. Meterlas en una sola pantalla obliga a que cada control diga en
 * cuál de los dos modos está, que es exactamente el problema que tiene hoy el
 * reporte de la plataforma.
 *
 * Cinco pestañas sobre un mismo agregado, con filtros que viven arriba de
 * todas: pasar de "Comercial en el resumen" a "Comercial en el árbol" es un
 * solo pensamiento, y volver a elegir el área en cada pestaña lo rompería.
 */

type ResultsTab = "resumen" | "cumplimiento" | "colaboradores" | "ranking" | "ia";

const TABS: readonly TabItem[] = [
  { id: "resumen", label: "Resumen", icon: <BarChart3 className="h-4 w-4" /> },
  { id: "cumplimiento", label: "Cumplimiento", icon: <ListTree className="h-4 w-4" /> },
  { id: "colaboradores", label: "Colaboradores", icon: <Users className="h-4 w-4" /> },
  { id: "ranking", label: "Ranking", icon: <Trophy className="h-4 w-4" /> },
  { id: "ia", label: "Análisis con IA", icon: <Sparkles className="h-4 w-4 text-ai-gradient" /> },
];

export function CicloResults({ ciclo }: { ciclo: CicloListRow }) {
  // Estado, no memo: inactivar un objetivo edita esta copia in-memoria. La
  // pantalla monta de cero con `key={ciclo.id}` en el dashboard, así que el
  // inicializador perezoso no necesita resincronizarse si `ciclo` cambia.
  const [data, setData] = React.useState(() => buildCicloDetail(ciclo));
  const config = useObjetivosConfig();

  const toggleObjectiveInactivation = React.useCallback((personId: string, objectiveId: string) => {
    setData((current) => ({
      ...current,
      people: current.people.map((person) => {
        if (person.id !== personId) return person;
        return {
          ...person,
          objectives: person.objectives.map((tracked) => {
            if (tracked.objective.id !== objectiveId) return tracked;
            if (tracked.inactivation) {
              return { ...tracked, inactivation: null };
            }
            return {
              ...tracked,
              inactivation: {
                date: new Date().toISOString(),
                authorName: CURRENT_USER.name,
                percentAtInactivation: objectiveCompliance(tracked, config.allowNegativeResults),
              },
            };
          }),
        };
      }),
    }));
  }, [config.allowNegativeResults]);

  const resultsConfig = React.useMemo(
    () => ({
      estados: config.estados,
      niveles: config.niveles,
      estadosParticipante: config.estadosParticipante,
      allowNegative: config.allowNegativeResults,
    }),
    [config]
  );

  const results = React.useMemo(
    () => buildCicloResults(data, resultsConfig),
    [data, resultsConfig]
  );

  const [tab, setTab] = React.useState<ResultsTab>("resumen");
  const [axis, setAxis] = React.useState<ResultsAxis>("objetivos");
  const [view, setView] = React.useState<CumplimientoView>("arbol");
  const [heatmapRowBy, setHeatmapRowBy] = React.useState<"area" | "grupo">("area");
  const [rankingAxis, setRankingAxis] = React.useState<RankingAxis>("area");
  const [selectedIds, setSelectedIds] = React.useState<ReadonlySet<string>>(() => new Set());
  const [openPersonId, setOpenPersonId] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<PendingKind | null>(null);

  const filters = useResultsFilters();
  const filtered = React.useMemo(() => filterResults(results, filters.filters), [results, filters.filters]);

  /*
   * El resumen se lee sobre lo que dejaron los filtros; la barra de filtros y
   * la barra flotante, sobre el ciclo completo. Es a propósito: si las
   * opciones del popover salieran de lo ya filtrado, marcar "Colombia" borraría
   * los otros cinco países de la lista y no habría forma de cambiar de idea.
   */
  const viewResults = React.useMemo(
    () => narrowResults(results, filtered, filters.filters, resultsConfig),
    [results, filtered, filters.filters, resultsConfig]
  );

  const openPerson = React.useMemo(
    () => results.rows.find((row) => row.person.id === openPersonId) ?? null,
    [results.rows, openPersonId]
  );

  const blockedCount =
    (results.lifecycleCounts.get("por-aprobar") ?? 0) +
    (results.lifecycleCounts.get("por-ajustar") ?? 0);

  /**
   * El centro de descargas de la vista de seguimiento, tal cual. Un reporte de
   * un ciclo es el mismo papel se pida desde donde se pida, y tener dos
   * generadores sería la vía más corta a que discrepen en un número.
   */
  const reportSource = React.useMemo<CicloReportSource>(() => {
    const progressConfig = {
      estados: config.estados,
      niveles: config.niveles,
      allowNegative: config.allowNegativeResults,
    };
    const rows = buildPersonRows(data, progressConfig);
    return {
      data,
      rows,
      groups: buildGroupRows(data, rows, progressConfig),
      stats: summarize(data, rows, progressConfig),
      estados: config.estados,
      niveles: config.niveles,
      allowNegative: config.allowNegativeResults,
      selectedIds,
    };
  }, [data, config, selectedIds]);

  const downloads = useCicloDownloadCenter(reportSource);
  const [isDownloadOpen, setIsDownloadOpen] = React.useState(false);
  const [isWidgetDismissed, setIsWidgetDismissed] = React.useState(false);
  // El drawer llega con el filtro de la selección ya puesto cuando lo abrió
  // "Exportar seleccionados": el clic que lo abrió ya lo dijo.
  const [downloadsFromSelection, setDownloadsFromSelection] = React.useState(false);

  const openDownloads = (onlySelected: boolean) => {
    if (onlySelected && selectedIds.size === 0) {
      toast.info("Marca colaboradores en la tabla para exportar solo a ellos.");
      return;
    }
    setDownloadsFromSelection(onlySelected);
    setIsDownloadOpen(true);
    setIsWidgetDismissed(false);
  };

  // La selección solo tiene sentido sobre la tabla de colaboradores: en el
  // árbol y en el ranking no hay casillas que marcar, así que salir de esa
  // pestaña la suelta en vez de dejar acciones apuntando a un fantasma.
  const changeTab = (next: ResultsTab) => {
    setTab(next);
    if (next !== "colaboradores") setSelectedIds(new Set());
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Las pestañas y los filtros comparten renglón: los filtros valen para
          las cinco por igual —ese es el punto de tenerlos aquí y no dentro de
          cada tarjeta— y separarlos en dos franjas costaba alto de pantalla
          sin decir nada nuevo. Cuando hay fichas puestas bajan a su propia
          línea, que es cuando de verdad hacen falta. */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-2">
        <UbitsTabs
          tabs={[...TABS]}
          activeTabId={tab}
          onTabChange={(id) => changeTab(id as ResultsTab)}
          variant="page"
          fitContent
          className="mb-0 w-auto"
        />
        <ResultsGlobalFilters results={results} state={filters} />
      </div>

      {/* El mismo contenedor de scroll que la vista de seguimiento —y un
          `div`, no un `main`: la concha de la app ya tiene el suyo y dos
          `main` anidados no son HTML válido. El espaciador pegado arriba es el
          del reporte de encuestas: las cabeceras fijas de cada tarjeta
          (`top-3`) se detienen justo debajo de él, no contra las pestañas. */}
      <div
        data-slot="results-scroll"
        className="-mr-1 flex min-h-0 flex-1 flex-col overflow-y-auto pb-28 pr-1 [scrollbar-gutter:stable]"
      >
        <div aria-hidden className="sticky top-0 z-40 h-4 shrink-0 bg-background" />
        <div key={tab} className="cascade-enter flex min-h-0 flex-col gap-4">
          {tab === "resumen" && (
            <ResumenTab
              results={viewResults}
              filters={filters}
              onOpenPending={setPending}
            />
          )}

          {tab === "cumplimiento" && (
            <CumplimientoTab
              results={viewResults}
              entries={filtered.entries}
              config={resultsConfig}
              filters={filters}
              axis={axis}
              onAxisChange={setAxis}
              view={view}
              onViewChange={setView}
              heatmapRowBy={heatmapRowBy}
              onHeatmapRowByChange={setHeatmapRowBy}
              onSelectPerson={setOpenPersonId}
            />
          )}

          {tab === "colaboradores" && (
            <ColaboradoresTab
              results={viewResults}
              rows={filtered.rows}
              filters={filters}
              showsRisk={results.showsRisk}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onOpenPerson={setOpenPersonId}
            />
          )}

          {tab === "ranking" && (
            <RankingTab
              results={viewResults}
              rows={filtered.rows}
              config={resultsConfig}
              filters={filters}
              axis={rankingAxis}
              onAxisChange={setRankingAxis}
              onOpenPerson={setOpenPersonId}
            />
          )}

          {tab === "ia" && (
            <AnalisisIaTab
              results={viewResults}
              rows={filtered.rows}
              entries={filtered.entries}
              filters={filters}
              onGoTo={(next) => changeTab(next as ResultsTab)}
            />
          )}
        </div>
      </div>

      <ShellRailSlot>
        <CicloResultsActionRail
          results={results}
          selectedCount={selectedIds.size}
          blockedCount={blockedCount}
          onClearSelection={() => setSelectedIds(new Set())}
          onDownload={openDownloads}
          onRemindProgress={() =>
            toast.success(
              `Recordatorio enviado a ${selectedIds.size} ${
                selectedIds.size === 1 ? "colaborador" : "colaboradores"
              }`
            )
          }
          onRemindApproval={() => setPending("por-aprobar")}
          onCreateObjectives={() => setPending("sin-objetivos")}
        />
      </ShellRailSlot>

      <PersonResultSheet
        row={openPerson}
        showsRisk={results.showsRisk}
        open={openPersonId !== null}
        onOpenChange={(open) => {
          if (!open) setOpenPersonId(null);
        }}
        onToggleInactivation={
          openPersonId
            ? (objectiveId) => toggleObjectiveInactivation(openPersonId, objectiveId)
            : undefined
        }
      />

      {pending && (
        <PendingDrawer
          key={pending}
          kind={pending}
          results={results}
          open
          onOpenChange={(open) => {
            if (!open) setPending(null);
          }}
          onAct={(kind, count) => {
            toast.success(
              kind === "sin-objetivos"
                ? `Se abrirá el constructor para ${count} colaboradores`
                : `Recordatorio enviado por ${count} ${count === 1 ? "objetivo" : "objetivos"}`
            );
            setPending(null);
          }}
        />
      )}

      <CicloDownloadDrawer
        open={isDownloadOpen}
        onOpenChange={setIsDownloadOpen}
        source={reportSource}
        entries={downloads.entries}
        onStart={downloads.start}
        onDeliver={downloads.deliver}
        onShare={downloads.share}
        startWithSelection={downloadsFromSelection}
      />
      {!isWidgetDismissed && (
        <CicloDownloadsWidget
          entries={downloads.entries}
          onDeliver={downloads.deliver}
          onShare={downloads.share}
          onOpenDrawer={() => openDownloads(false)}
          onDismiss={() => setIsWidgetDismissed(true)}
        />
      )}
    </div>
  );
}
