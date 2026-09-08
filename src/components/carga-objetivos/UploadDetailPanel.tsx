import * as React from "react";
import { AlertTriangle, Check, ChevronLeft, FileSpreadsheet, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { UbitsTabs } from "@/components/navigation";
import { SearchBox } from "@/components/ciclo-detail/tablePieces";
import { FilterButton } from "./ReviewListControls";
import { MEASURE_SYMBOL, type MeasureType } from "@/lib/objectivesImport";
import type { UploadRowResult, UploadTaskState } from "./uploadTaskTypes";

/**
 * El detalle de una carga terminada: qué entró y qué quedó pendiente, por
 * persona, con búsqueda y filtros por área y líder.
 */

type DetailTab = "exitosos" | "pendientes";

function toggle(current: string[], option: string): string[] {
  return current.includes(option) ? current.filter((entry) => entry !== option) : [...current, option];
}

function describeRow(row: UploadRowResult): string | undefined {
  if (row.measureType === "Se cumple / No se cumple") return "Completar la meta";
  if (row.measureType && row.trend && row.target !== undefined) {
    const symbol = MEASURE_SYMBOL[row.measureType as MeasureType] ?? "";
    return `${row.trend} de ${row.initialValue ?? 0} a ${row.target} (${symbol} ${row.measureType})`;
  }
  return row.description;
}

const RowMark: React.FC<{ status: UploadRowResult["status"] }> = ({ status }) =>
  status === "uploaded" ? (
    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-status-positive/10 text-status-positive">
      <Check className="size-3" strokeWidth={3} />
    </span>
  ) : status === "failed" || status === "analysis_error" ? (
    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-status-negative/10 text-status-negative">
      <AlertTriangle className="size-3" strokeWidth={2.5} />
    </span>
  ) : (
    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-border/60 bg-surface-muted text-text-secondary">
      <Info className="size-3" />
    </span>
  );

export function UploadDetailPanel({
  task,
  onBack,
  onResume,
}: {
  task: UploadTaskState;
  onBack: () => void;
  onResume: () => void;
}) {
  const [activeTab, setActiveTab] = React.useState<DetailTab>("exitosos");
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string[]>([]);
  const [areaFilter, setAreaFilter] = React.useState<string[]>([]);
  const [leaderFilter, setLeaderFilter] = React.useState<string[]>([]);

  const areas = React.useMemo(
    () => [...new Set(task.rows.map((row) => row.userArea).filter((area): area is string => Boolean(area)))],
    [task.rows]
  );
  const leaders = React.useMemo(
    () => [...new Set(task.rows.map((row) => row.userLeader).filter((leader): leader is string => Boolean(leader)))],
    [task.rows]
  );

  const uploadedCount = task.rows.filter((row) => row.status === "uploaded").length;
  const pendingCount = task.rows.length - uploadedCount;

  const filteredRows = task.rows.filter((row) => {
    if (activeTab === "exitosos" && row.status !== "uploaded") return false;
    if (activeTab === "pendientes" && row.status === "uploaded") return false;
    const needle = search.toLowerCase();
    const matchesSearch =
      row.title.toLowerCase().includes(needle) || row.userName.toLowerCase().includes(needle);
    const mappedStatus = row.status === "analysis_error" ? "failed" : row.status;
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(mappedStatus);
    const matchesArea = areaFilter.length === 0 || areaFilter.includes(row.userArea ?? "");
    const matchesLeader = leaderFilter.length === 0 || leaderFilter.includes(row.userLeader ?? "");
    return matchesSearch && matchesStatus && matchesArea && matchesLeader;
  });

  const byUser = filteredRows.reduce<Record<string, UploadRowResult[]>>((grouped, row) => {
    return { ...grouped, [row.userName]: [...(grouped[row.userName] ?? []), row] };
  }, {});
  const userEntries = Object.entries(byUser);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" onClick={onBack} className="gap-1 rounded-full font-bold text-primary hover:bg-primary/10 hover:text-primary">
          <ChevronLeft className="size-4" strokeWidth={2.5} />
          Volver
        </Button>
        {pendingCount > 0 && (
          <Button type="button" variant="outline" onClick={onResume} className="rounded-full font-bold text-primary">
            Retomar pendientes ({pendingCount})
          </Button>
        )}
      </div>

      <div className="flex min-w-0 items-center gap-2 px-1">
        <FileSpreadsheet className="size-4 shrink-0 text-text-muted" strokeWidth={2.2} />
        <p className="truncate text-[13px] font-bold tracking-tight text-text-primary">{task.name}</p>
      </div>

      <UbitsTabs
        tabs={[
          { id: "exitosos", label: "Cargados", badge: uploadedCount },
          { id: "pendientes", label: "Pendientes por cargar", badge: pendingCount },
        ]}
        activeTabId={activeTab}
        onTabChange={(id) => {
          setActiveTab(id as DetailTab);
          setStatusFilter([]);
        }}
        className="mb-0"
      />

      <div className="flex items-center gap-2">
        <SearchBox value={search} onChange={setSearch} placeholder="Buscar por usuario u objetivo" className="w-full" />
        <FilterButton
          onClearAll={() => {
            setStatusFilter([]);
            setAreaFilter([]);
            setLeaderFilter([]);
          }}
          groups={[
            ...(activeTab === "pendientes"
              ? [
                  {
                    id: "estado",
                    label: "Estado",
                    options: ["Con error", "Sin asignar"],
                    selected: statusFilter.map((value) => (value === "failed" ? "Con error" : "Sin asignar")),
                    onToggle: (option: string) =>
                      setStatusFilter((current) => toggle(current, option === "Con error" ? "failed" : "unassigned")),
                  },
                ]
              : []),
            {
              id: "area",
              label: "Área",
              options: areas,
              selected: areaFilter,
              onToggle: (option: string) => setAreaFilter((current) => toggle(current, option)),
            },
            {
              id: "lider",
              label: "Líder",
              options: leaders,
              selected: leaderFilter,
              onToggle: (option: string) => setLeaderFilter((current) => toggle(current, option)),
            },
          ]}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {userEntries.length === 0 ? (
          <p className="p-8 text-center text-sm text-text-muted">No se encontraron resultados.</p>
        ) : (
          <Accordion type="single" collapsible className="flex w-full flex-col gap-2 pb-2">
            {userEntries.map(([user, rows]) => {
              const failed = rows.filter((row) => row.status === "failed" || row.status === "analysis_error").length;
              const uploaded = rows.filter((row) => row.status === "uploaded").length;
              const unassigned = rows.filter((row) => row.status === "unassigned").length;
              return (
                <AccordionItem key={user} value={user} className="rounded-2xl border border-border/60 bg-surface px-3.5 shadow-card">
                  <AccordionTrigger className="py-3 hover:no-underline">
                    <div className="flex w-full items-center justify-between gap-3 pr-2 text-left">
                      <div className="min-w-0">
                        <h4 className="truncate text-[13px] font-bold text-text-primary">{user}</h4>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] font-medium text-text-muted">
                          {rows[0]?.userArea && <span>{rows[0].userArea}</span>}
                          {rows[0]?.userArea && rows[0]?.userLeader && <span className="text-border">•</span>}
                          {rows[0]?.userLeader && <span>Líder: {rows[0].userLeader}</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {failed > 0 && (
                          <Badge className="h-auto gap-1 rounded-full border-none bg-status-negative/10 px-2 py-0.5 text-[10px] font-bold text-status-negative">
                            <AlertTriangle className="size-3" />
                            {failed} {failed === 1 ? "error" : "errores"}
                          </Badge>
                        )}
                        {uploaded > 0 && (
                          <Badge className="h-auto gap-1 rounded-full border-none bg-status-positive/10 px-2 py-0.5 text-[10px] font-bold text-status-positive">
                            <Check className="size-3" strokeWidth={3} />
                            {uploaded} {uploaded === 1 ? "exitoso" : "exitosos"}
                          </Badge>
                        )}
                        {unassigned > 0 && (
                          <Badge className="h-auto gap-1 rounded-full border-none bg-surface-muted px-2 py-0.5 text-[10px] font-bold text-text-secondary">
                            <Info className="size-3" />
                            {unassigned} sin asignar
                          </Badge>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="border-t border-border/40 pb-3 pt-3">
                    <div className="flex flex-col gap-3">
                      {rows.map((row) => (
                        <div key={row.id} className="flex gap-3">
                          <RowMark status={row.status} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-4">
                              <span className="text-[13px] font-bold leading-snug text-text-primary">{row.title}</span>
                              {row.weightPercent !== undefined && (
                                <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-[11px] font-bold tabular-nums text-text-primary">
                                  {row.weightPercent}%
                                </span>
                              )}
                            </div>
                            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-text-secondary">
                              {describeRow(row)}
                            </p>
                            {row.status === "failed" && (
                              <p className="mt-1.5 text-[11px] font-medium text-status-negative">
                                Error al guardar en el servidor.
                              </p>
                            )}
                            {row.status === "analysis_error" && (
                              <p className="mt-1.5 text-[11px] font-medium text-status-negative">
                                {row.analysisError ?? "Error de validación."}
                              </p>
                            )}
                            {row.status === "unassigned" && (
                              <p className={cn("mt-1.5 text-[11px] font-medium text-text-secondary")}>
                                Pendiente de asignación.
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>
    </div>
  );
}
