import * as React from "react";
import { toast } from "sonner";
import { UserRound, UsersRound } from "lucide-react";
import { motion } from "framer-motion";
import { cascadeItem } from "@/lib/cascadeAnimation";
import { ShellRailSlot } from "@/components/app-shell";
import { UbitsTabs } from "@/components/navigation";
import { useObjetivosConfig } from "@/components/objetivos/objetivosConfigStore";
import {
  CicloDetailActionRail,
  CicloDownloadDrawer,
  CicloDownloadsWidget,
  CicloGroupsTable,
  CicloPeopleTable,
  CicloSummary,
  INDIVIDUAL_GROUP_LABEL,
  ObjectiveUpdateDrawer,
  buildCicloDetail,
  buildGroupRows,
  buildPersonRows,
  summarize,
  useCicloDownloadCenter,
  type CicloDetailData,
  type CicloListRow,
  type CicloReportSource,
  type ObjectiveUpdate,
  type ObjectiveUpdateInput,
  type ObjectiveUpdateTarget,
} from "@/components/ciclo-detail";
import { CargaObjetivosDrawer, buildCycleRoster, buildUbitsDirectory } from "@/components/carga-objetivos";

type DetailTab = "grupos" | "colaboradores";

/** Quien está usando la pantalla. En producción viene de la sesión. */
const CURRENT_USER = { id: "me", name: "Elkin García" } as const;

const createUpdateId = (): string =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 15);

/**
 * Aplica una actualización a un objetivo de una persona: el valor nuevo (si lo
 * hay) pasa a ser el actual y la entrada se suma al historial. Todo copia,
 * nada se muta.
 */
function applyUpdate(
  data: CicloDetailData,
  personId: string,
  objectiveId: string,
  update: ObjectiveUpdate
): CicloDetailData {
  return {
    ...data,
    people: data.people.map((person) =>
      person.id !== personId
        ? person
        : {
            ...person,
            objectives: person.objectives.map((tracked) =>
              tracked.objective.id !== objectiveId
                ? tracked
                : {
                    ...tracked,
                    currentValue: update.value ?? tracked.currentValue,
                    updates: [...tracked.updates, update],
                  }
            ),
          }
    ),
  };
}

/**
 * La vista de seguimiento de un ciclo ya creado.
 *
 * Arriba, cómo va el ciclo en conjunto. Debajo, la misma tabla con la que se
 * asignaron los objetivos, en dos lecturas —por grupo y por persona— ahora
 * con estados, niveles y avance; cada fila se abre en sus objetivos, y cada
 * objetivo se actualiza en un drawer que guarda valor, comentario y
 * evidencias en la misma conversación.
 */
export function CicloDetail({ ciclo }: { ciclo: CicloListRow }) {
  const [data, setData] = React.useState<CicloDetailData>(() => buildCicloDetail(ciclo));
  const config = useObjetivosConfig();
  const progressConfig = React.useMemo(
    () => ({
      estados: config.estados,
      niveles: config.niveles,
      allowNegative: config.allowNegativeResults,
    }),
    [config]
  );

  const rows = React.useMemo(() => buildPersonRows(data, progressConfig), [data, progressConfig]);
  const groups = React.useMemo(() => buildGroupRows(data, rows, progressConfig), [data, rows, progressConfig]);
  const stats = React.useMemo(() => summarize(data, rows, progressConfig), [data, rows, progressConfig]);

  const groupOptions = React.useMemo(() => {
    const labels = groups.map((group) => (group.kind === "individual" ? INDIVIDUAL_GROUP_LABEL : group.label));
    return [...new Set(labels)];
  }, [groups]);

  const [tab, setTab] = React.useState<DetailTab>("grupos");
  const [groupFilter, setGroupFilter] = React.useState<ReadonlySet<string>>(() => new Set());
  const [selectedIds, setSelectedIds] = React.useState<ReadonlySet<string>>(() => new Set());
  const [target, setTarget] = React.useState<ObjectiveUpdateTarget | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  /**
   * Todo lo que un reporte del ciclo lee, en un solo objeto: los archivos
   * salen del mismo agregado que pinta esta pantalla, así que el papel y la
   * tabla no pueden discrepar sobre un número.
   */
  const reportSource = React.useMemo<CicloReportSource>(
    () => ({
      data,
      rows,
      groups,
      stats,
      estados: config.estados,
      niveles: config.niveles,
      allowNegative: config.allowNegativeResults,
      selectedIds,
    }),
    [data, rows, groups, stats, config, selectedIds]
  );

  // El centro de descargas es de la pantalla, no del drawer: cerrarlo no puede
  // matar un reporte a medio preparar, y el widget flotante lee la misma lista.
  const downloads = useCicloDownloadCenter(reportSource);
  const [downloadsOpen, setDownloadsOpen] = React.useState(false);
  const [downloadsFromSelection, setDownloadsFromSelection] = React.useState(false);
  const [widgetDismissed, setWidgetDismissed] = React.useState(false);

  // La carga masiva resuelve el archivo contra la gente del ciclo y el resto
  // del directorio; ambas listas salen del mismo agregado que pinta la tabla.
  const [isUploadOpen, setIsUploadOpen] = React.useState(false);
  const roster = React.useMemo(() => buildCycleRoster(data), [data]);
  const directory = React.useMemo(() => buildUbitsDirectory(roster), [roster]);
  const isDownloadsWidgetVisible = !downloadsOpen && !widgetDismissed && downloads.entries.length > 0;

  const openDownloads = (onlySelected: boolean) => {
    setDownloadsFromSelection(onlySelected);
    setDownloadsOpen(true);
    setWidgetDismissed(false);
  };

  const openObjective = (personId: string, objectiveId: string) => {
    const person = data.people.find((item) => item.id === personId);
    const tracked = person?.objectives.find((item) => item.objective.id === objectiveId);
    if (!person || !tracked) return;
    setTarget({ person, tracked });
    setIsDrawerOpen(true);
  };

  const handleSubmit = (input: ObjectiveUpdateInput) => {
    if (!target) return;
    const update: ObjectiveUpdate = {
      id: `update-${createUpdateId()}`,
      authorId: CURRENT_USER.id,
      authorName: CURRENT_USER.name,
      authorRole: "admin",
      date: new Date().toISOString(),
      value: input.value,
      comment: input.comment,
      evidences: input.files.map((file) => ({
        id: `evidence-${createUpdateId()}`,
        name: file.name,
        size: file.size,
        type: file.type,
      })),
    };
    setData((current) => applyUpdate(current, target.person.id, target.tracked.objective.id, update));
    setIsDrawerOpen(false);
    toast.success(input.value !== null ? "Avance actualizado" : "Comentario publicado", {
      description: `${target.tracked.objective.title} · ${target.person.collaborator.name}`,
    });
  };

  const viewPeopleOf = (groupLabel: string) => {
    setGroupFilter(new Set([groupLabel]));
    setTab("colaboradores");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ShellRailSlot>
        <CicloDetailActionRail
          selectedCount={selectedIds.size}
          onClearSelection={() => setSelectedIds(new Set())}
          onAddUsers={() => toast("Agregar usuarios al ciclo", { description: "Disponible próximamente en este prototipo." })}
          onExport={openDownloads}
          onUploadObjectives={() => setIsUploadOpen(true)}
          isUploadOpen={isUploadOpen}
          onRemind={() => {
            toast.success(`Recordatorio enviado a ${selectedIds.size} ${selectedIds.size === 1 ? "colaborador" : "colaboradores"}`);
            setSelectedIds(new Set());
          }}
        />
      </ShellRailSlot>

      <div className="-mr-1 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pb-28 pr-1 [scrollbar-gutter:stable]">
        <CicloSummary data={data} stats={stats} estados={config.estados} niveles={config.niveles} />

        <motion.section
          variants={cascadeItem}
          initial="hidden"
          animate="show"
          transition={{ delay: 0.25 }}
          className="flex flex-col gap-5 rounded-2xl border border-border/60 bg-surface p-6 shadow-card"
          aria-label="Seguimiento por grupos y colaboradores"
        >
          <UbitsTabs
            tabs={[
              { id: "grupos", label: "Por grupos", icon: <UsersRound className="size-4" /> },
              { id: "colaboradores", label: "Por colaboradores", icon: <UserRound className="size-4" /> },
            ]}
            activeTabId={tab}
            onTabChange={(id) => setTab(id as DetailTab)}
            fitContent
            className="mb-0"
          />

          {tab === "grupos" ? (
            <CicloGroupsTable
              groups={groups}
              niveles={config.niveles}
              companyObjectives={data.companyObjectives}
              onViewPeople={viewPeopleOf}
            />
          ) : (
            <CicloPeopleTable
              rows={rows}
              cicloStatus={data.status}
              estados={config.estados}
              niveles={config.niveles}
              allowNegative={config.allowNegativeResults}
              companyObjectives={data.companyObjectives}
              groupOptions={groupOptions}
              groupFilter={groupFilter}
              onGroupFilterChange={setGroupFilter}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onOpenObjective={openObjective}
            />
          )}
        </motion.section>
      </div>

      <ObjectiveUpdateDrawer
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        target={target}
        cicloStatus={data.status}
        companyObjectives={data.companyObjectives}
        onSubmit={handleSubmit}
      />

      <CicloDownloadDrawer
        open={downloadsOpen}
        onOpenChange={setDownloadsOpen}
        source={reportSource}
        entries={downloads.entries}
        onStart={downloads.start}
        onDeliver={downloads.deliver}
        onShare={downloads.share}
        startWithSelection={downloadsFromSelection}
      />

      <CargaObjetivosDrawer
        open={isUploadOpen}
        onOpenChange={setIsUploadOpen}
        cycleName={data.name}
        roster={roster}
        directory={directory}
        dodgeWidget={isDownloadsWidgetVisible}
      />

      {!downloadsOpen && !widgetDismissed && (
        <CicloDownloadsWidget
          entries={downloads.entries}
          onDeliver={downloads.deliver}
          onShare={downloads.share}
          onOpenDrawer={() => openDownloads(false)}
          onDismiss={() => setWidgetDismissed(true)}
        />
      )}
    </div>
  );
}
