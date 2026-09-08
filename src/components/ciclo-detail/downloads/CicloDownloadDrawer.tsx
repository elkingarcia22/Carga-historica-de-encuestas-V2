import * as React from "react";
import { Download, FileDown, FileSignature, UserRound, Users, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SheetFooter } from "@/components/ui/sheet";
import { DrawerSection, DrawerShell } from "@/components/overlays";
import { UbitsTabs } from "@/components/navigation";
import {
  CICLO_INDIVIDUAL_SECTIONS,
  CICLO_REPORT_TYPES,
  cicloReportTypeFor,
  type CicloAudienceMode,
  type CicloDemographicKey,
  type CicloDownloadEntry,
  type CicloIndividualSectionId,
  type CicloReportKind,
  type CicloReportRequest,
} from "./cicloDownloadTypes";
import {
  CICLO_DEMOGRAPHICS,
  count,
  demographicFor,
  demographicValues,
  objectiveDetailRows,
  personOptions,
  scopeFor,
  type CicloReportSource,
} from "./cicloReportModel";
import { CicloDownloadsList } from "./CicloDownloadsList";
import {
  ConfigSectionRow,
  DrawerTabs,
  PickerRow,
  ReportTypeRow,
  SelectRow,
  ToggleMultiSelectRow,
  type DownloadTab,
} from "./downloadDrawerParts";

/**
 * El centro de descargas del ciclo: elige un reporte, ajusta a quién cubre,
 * sigue su preparación.
 *
 * Dos pestañas a propósito. "Reportes" es configuración —elegir y darle forma
 * al archivo que viene—; "Descargas" es estado —qué se pidió y en qué va—.
 * Mezclarlas mete una barra de progreso dentro de un formulario; separarlas
 * deja que "Minimizar y continuar" cierre el formulario mientras el estado
 * sigue vivo en el widget flotante.
 */

interface CicloDownloadDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: CicloReportSource;
  entries: readonly CicloDownloadEntry[];
  onStart: (request: CicloReportRequest) => void;
  onDeliver: (id: string) => void;
  onShare: (id: string) => void;
  /**
   * Con qué llega el drawer cuando lo abrió "Exportar seleccionados": el filtro
   * de la selección ya puesto, porque el clic que lo abrió ya lo dijo.
   */
  startWithSelection?: boolean;
}

export function CicloDownloadDrawer({
  open,
  onOpenChange,
  source,
  entries,
  onStart,
  onDeliver,
  onShare,
  startWithSelection = false,
}: CicloDownloadDrawerProps) {
  const [activeTab, setActiveTab] = React.useState<DownloadTab>("reports");
  const [kind, setKind] = React.useState<CicloReportKind>("detalle");

  const hasSelection = source.selectedIds.size > 0;

  // --- Bloques de la carta individual --------------------------------------

  const [sections, setSections] = React.useState<ReadonlySet<CicloIndividualSectionId>>(
    () => new Set(CICLO_INDIVIDUAL_SECTIONS.map((section) => section.id))
  );

  // --- A quién cubre --------------------------------------------------------

  /**
   * Los dos modos guardan su elección por separado.
   *
   * Cambiar de "individual" a "masivo" y volver no puede borrar los nombres que
   * ya se habían marcado: son dos formas de pedir lo mismo, y quien tantea las
   * dos antes de decidir espera encontrar su trabajo donde lo dejó.
   */
  const [audienceMode, setAudienceMode] = React.useState<CicloAudienceMode>("masivo");
  const [personIds, setPersonIds] = React.useState<ReadonlySet<string>>(() => new Set());
  const [demographicKey, setDemographicKey] = React.useState<CicloDemographicKey>("area");
  const [demographicPick, setDemographicPick] = React.useState<ReadonlySet<string>>(
    () => new Set()
  );

  const [estadoFilterEnabled, setEstadoFilterEnabled] = React.useState(false);
  const [estadoFilter, setEstadoFilter] = React.useState<ReadonlySet<string>>(() => new Set());
  const [nivelFilterEnabled, setNivelFilterEnabled] = React.useState(false);
  const [nivelFilter, setNivelFilter] = React.useState<ReadonlySet<string>>(() => new Set());

  const peopleItems = React.useMemo(() => personOptions(source.rows), [source.rows]);
  const demographicItems = React.useMemo(
    () => CICLO_DEMOGRAPHICS.map((item) => ({ id: item.key, label: item.label })),
    []
  );
  const valueItems = React.useMemo(
    () => demographicValues(source.rows, demographicKey).map((value) => ({ id: value, label: value })),
    [source.rows, demographicKey]
  );

  // Abrir desde "Exportar seleccionados" ya dijo a quién: el drawer llega en
  // modo individual con esas personas puestas, en vez de pedirlas otra vez.
  React.useEffect(() => {
    if (!open) return;
    setActiveTab("reports");
    if (startWithSelection && hasSelection) {
      setAudienceMode("individual");
      setPersonIds(new Set(source.selectedIds));
    }
  }, [open, startWithSelection, hasSelection, source.selectedIds]);

  // Cambiar de demográfico deja atrás valores de otro corte —"Tecnología" no
  // significa nada bajo "País"—, así que la elección arranca vacía otra vez.
  React.useEffect(() => {
    setDemographicPick(new Set());
  }, [demographicKey]);

  // Los filtros de estado y nivel recortan un corte del directorio; sobre
  // nombres elegidos uno por uno no aplican, así que se apagan al entrar a
  // "Individual" en vez de quedar prendidos pero invisibles.
  React.useEffect(() => {
    if (audienceMode !== "individual") return;
    setEstadoFilterEnabled(false);
    setNivelFilterEnabled(false);
  }, [audienceMode]);

  // La gente y los valores se recalculan cuando alguien reporta un avance: una
  // elección que quedó apuntando a alguien que ya no está deja el reporte vacío
  // sin decir por qué.
  React.useEffect(() => {
    const alive = new Set(peopleItems.map((item) => item.id));
    setPersonIds((current) => {
      const kept = new Set([...current].filter((id) => alive.has(id)));
      return kept.size === current.size ? current : kept;
    });
  }, [peopleItems]);

  const estadoItems = React.useMemo(
    () => source.estados.map((estado) => ({ id: estado.id, label: estado.nombre })),
    [source.estados]
  );
  const nivelItems = React.useMemo(
    () => source.niveles.map((nivel) => ({ id: nivel.id, label: nivel.nombre })),
    [source.niveles]
  );

  const activeType = cicloReportTypeFor(kind);
  const preparingCount = entries.filter((entry) => entry.status === "preparing").length;

  const request = React.useMemo<CicloReportRequest>(
    () => ({
      kind,
      individualSections: CICLO_INDIVIDUAL_SECTIONS.map((section) => section.id).filter((id) =>
        sections.has(id)
      ),
      audience:
        audienceMode === "individual"
          ? { mode: "individual", personIds: [...personIds] }
          : { mode: "masivo", key: demographicKey, values: [...demographicPick] },
      estadoFilter: estadoFilterEnabled ? [...estadoFilter] : [],
      nivelFilter: nivelFilterEnabled ? [...nivelFilter] : [],
    }),
    [
      kind,
      sections,
      audienceMode,
      personIds,
      demographicKey,
      demographicPick,
      estadoFilterEnabled,
      estadoFilter,
      nivelFilterEnabled,
      nivelFilter,
    ]
  );

  /**
   * Qué va a traer el archivo, contado antes de pedirlo.
   *
   * Un reporte se pide para mandarlo, y descubrir después de abrirlo que salió
   * con cero filas —porque un filtro dejó fuera a todo el mundo— cuesta un
   * viaje completo. El conteo va en la tarjeta del formato, donde se decide.
   */
  const summary = React.useMemo(() => {
    const scope = scopeFor(source, request);
    const people = scope.rows.length;
    if (kind === "detalle") {
      return { people, units: objectiveDetailRows(source, scope).length, noun: "filas" };
    }
    if (kind === "individual") return { people, units: people, noun: "cartas" };
    return { people, units: people, noun: "filas" };
  }, [source, request, kind]);

  // Un filtro encendido y vacío no recorta: deja el reporte sin nadie. Es un
  // estado que se alcanza a un clic, así que se avisa en vez de producir un
  // archivo en blanco.
  const filtersEmpty =
    (estadoFilterEnabled && estadoFilter.size === 0) ||
    (nivelFilterEnabled && nivelFilter.size === 0);

  const canDownload = !filtersEmpty && summary.units > 0;

  const handleDownload = () => {
    onStart(request);
    setActiveTab("downloads");
  };

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title="Reportes del ciclo"
      description="Configura y descarga el avance de este ciclo"
      size="md"
      // 30 % del viewport con piso en el ancho `md`: por debajo de ~1500px el
      // 30vw es más *angosto* que ese ancho y las tarjetas de configuración
      // empiezan a romperse. Así se ensancha en un monitor grande y nunca se
      // encoge en un portátil.
      //
      // `!bg-background` en vez del blanco por defecto del Sheet: el gap-4
      // entre el header y el cuerpo (y entre el cuerpo y el footer) es parte
      // del propio Sheet, así que ese hueco siempre queda pintado con el
      // fondo del panel — con el blanco de fábrica se veía como una franja
      // en blanco entre el borde del header y las pestañas. Pintado del
      // mismo tono que el resto del contenido, el hueco desaparece.
      className="!w-[30vw] !max-w-[30vw] !min-w-[28rem] !bg-background"
      disablePadding
      footer={
        <SheetFooter className="border-t border-border/60 bg-surface px-4 py-3">
          {activeTab === "reports" ? (
            <Button className="w-full gap-2" onClick={handleDownload} disabled={!canDownload}>
              <Download className="h-4 w-4" />
              Descargar {activeType.format}
            </Button>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
              Minimizar y continuar
            </Button>
          )}
        </SheetFooter>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col bg-background">
        <DrawerTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          downloadsBadge={preparingCount}
        />

        {activeTab === "reports" ? (
          /* Cada parte de la configuración —qué formato, qué lleva dentro, de
             quién— en su propia tarjeta sobre el fondo del drawer, con la misma
             anatomía que el drawer de actualizar un objetivo: chip del icono,
             título, la línea que explica para qué sirve y, bajo una divisoria,
             sus controles. */
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4 pt-1">
            <DrawerSection
              icon={FileDown}
              tone="brand"
              title="Tipo de reporte"
              hint={
                summary.units === 0
                  ? "Con los filtros actuales no queda nadie en el reporte."
                  : `Con los filtros actuales: ${count(summary.units)} ${summary.noun} de ${count(summary.people)} colaboradores.`
              }
            >
              <fieldset className="rounded-xl border border-border/60 bg-background p-2">
                <legend className="sr-only">Tipo de reporte</legend>
                <div className="flex flex-col gap-2">
                  {CICLO_REPORT_TYPES.map((type) => (
                    <ReportTypeRow
                      key={type.kind}
                      type={type}
                      selected={kind === type.kind}
                      onSelect={() => setKind(type.kind)}
                    />
                  ))}
                </div>
              </fieldset>
            </DrawerSection>

            {kind === "individual" && (
              <DrawerSection
                icon={FileSignature}
                tone="brand"
                title="Bloques de la carta"
                hint="Los datos del colaborador y el encabezado del ciclo van siempre: son el documento."
                badge={`${request.individualSections.length}`}
              >
                <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background p-2">
                  {CICLO_INDIVIDUAL_SECTIONS.map((section) => {
                    const enabled = sections.has(section.id);
                    const printedIndex = CICLO_INDIVIDUAL_SECTIONS.filter((candidate) =>
                      sections.has(candidate.id)
                    ).findIndex((candidate) => candidate.id === section.id);

                    return (
                      <ConfigSectionRow
                        key={section.id}
                        index={printedIndex >= 0 ? `${printedIndex + 1}` : null}
                        label={section.label}
                        description={section.description}
                        unavailableReason={null}
                        enabled={enabled}
                        onEnabledChange={(next) =>
                          setSections((current) => {
                            const set = new Set(current);
                            if (next) set.add(section.id);
                            else set.delete(section.id);
                            return set;
                          })
                        }
                        picker={null}
                      />
                    );
                  })}
                </div>
              </DrawerSection>
            )}

            <DrawerSection
              icon={Users}
              tone="neutral"
              title="A quién cubre"
              hint="Elige personas una por una, o un corte del directorio para bajar un equipo completo."
            >
              <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background p-2">
                <UbitsTabs
                  tabs={[
                    { id: "individual", label: "Individual", icon: <UserRound className="size-4" /> },
                    { id: "masivo", label: "Masivo", icon: <UsersRound className="size-4" /> },
                  ]}
                  activeTabId={audienceMode}
                  onTabChange={(id) => setAudienceMode(id as CicloAudienceMode)}
                  className="mb-0"
                />

                {audienceMode === "individual" ? (
                  <PickerRow
                    title="Colaboradores"
                    hint={
                      personIds.size === 0
                        ? `Sin elegir a nadie entra todo el ciclo (${count(peopleItems.length)}).`
                        : `${count(personIds.size)} de ${count(peopleItems.length)} elegidos.`
                    }
                    action={
                      hasSelection ? (
                        <button
                          type="button"
                          onClick={() => setPersonIds(new Set(source.selectedIds))}
                          className="shrink-0 rounded-lg border border-border/60 px-2.5 py-1 text-[12px] font-semibold text-text-secondary transition-colors hover:border-primary/30 hover:text-primary"
                        >
                          Usar los {count(source.selectedIds.size)} de la tabla
                        </button>
                      ) : null
                    }
                    items={peopleItems}
                    selected={personIds}
                    onChange={setPersonIds}
                    placeholder="Todo el ciclo"
                    searchable
                  />
                ) : (
                  <>
                    <SelectRow
                      title="Corte del directorio"
                      hint="Por cuál de los datos del colaborador se agrupa la descarga."
                      value={demographicKey}
                      items={demographicItems}
                      onChange={(next) => setDemographicKey(next as CicloDemographicKey)}
                    />
                    <PickerRow
                      title={demographicFor(demographicKey).label}
                      hint={
                        demographicPick.size === 0
                          ? `Sin elegir ninguno entra todo el ciclo (${count(valueItems.length)} valores).`
                          : `${count(demographicPick.size)} de ${count(valueItems.length)} elegidos.`
                      }
                      items={valueItems}
                      selected={demographicPick}
                      onChange={setDemographicPick}
                      placeholder="Todo el ciclo"
                      searchable={valueItems.length > 12}
                    />
                  </>
                )}

                {audienceMode === "masivo" && (
                  <>
                    <ToggleMultiSelectRow
                      title="Filtrar por estado"
                      hint="Apagado, entran los colaboradores de todos los estados."
                      enabled={estadoFilterEnabled}
                      onEnabledChange={(next) => {
                        setEstadoFilterEnabled(next);
                        if (next && estadoFilter.size === 0) {
                          setEstadoFilter(new Set(estadoItems.map((item) => item.id)));
                        }
                      }}
                      items={estadoItems}
                      selected={estadoFilter}
                      onChange={setEstadoFilter}
                      pickerLabel="Estados"
                      placeholder="Selecciona estados"
                      emptyWarning="Elige al menos un estado: así el reporte saldría vacío."
                    />
                    <ToggleMultiSelectRow
                      title="Filtrar por nivel de desempeño"
                      hint="Apagado, entran los colaboradores de todos los niveles."
                      enabled={nivelFilterEnabled}
                      onEnabledChange={(next) => {
                        setNivelFilterEnabled(next);
                        if (next && nivelFilter.size === 0) {
                          setNivelFilter(new Set(nivelItems.map((item) => item.id)));
                        }
                      }}
                      items={nivelItems}
                      selected={nivelFilter}
                      onChange={setNivelFilter}
                      pickerLabel="Niveles"
                      placeholder="Selecciona niveles"
                      emptyWarning="Elige al menos un nivel: así el reporte saldría vacío."
                    />
                  </>
                )}
              </div>
            </DrawerSection>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <CicloDownloadsList entries={entries} onDeliver={onDeliver} onShare={onShare} />
          </div>
        )}
      </div>
    </DrawerShell>
  );
}
