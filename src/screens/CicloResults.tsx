import * as React from "react";
import { toast } from "sonner";
import { BarChart3, ListTree, Sparkles, Trophy, Users } from "lucide-react";
import { ShellRailSlot } from "@/components/app-shell";
import { UbitsTabs, type TabItem } from "@/components/navigation";
import { useObjetivosConfig } from "@/components/objetivos/objetivosConfigStore";
import {
  CicloDownloadDrawer,
  CicloDownloadsWidget,
  buildCicloDetail,
  buildGroupRows,
  buildPersonRows,
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
  ResumenTab,
  buildCicloResults,
  filterResults,
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
  const data = React.useMemo(() => buildCicloDetail(ciclo), [ciclo]);
  const config = useObjetivosConfig();

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
      <div className="shrink-0 pb-2">
        <UbitsTabs
          tabs={[...TABS]}
          activeTabId={tab}
          onTabChange={(id) => changeTab(id as ResultsTab)}
          variant="page"
          fitContent
          className="mb-0"
        />
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
              results={results}
              filters={filters}
              onOpenPending={setPending}
              onSuggestMetric={() =>
                toast("Sugerir una métrica", {
                  description: "El formulario de sugerencias llega en la siguiente iteración.",
                })
              }
            />
          )}

          {tab === "cumplimiento" && (
            <CumplimientoTab
              results={results}
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
              results={results}
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
              results={results}
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
              results={results}
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
