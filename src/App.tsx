import * as React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UbitsToaster } from "@/components/feedback";
import { AdminShell, ShellHeaderSlot } from "@/components/app-shell";
import { ObjetivosDashboard } from "@/screens/ObjetivosDashboard";
import { CicloBuilder } from "@/screens/CicloBuilder";
import { UbitsTabs } from "@/components/navigation";
import { ArrowLeft, Target, UserX } from "lucide-react";
import { HomePulseStrip, TemplatesStrip, AlertsRow } from "@/components/home";
import {
  CicloTemplatesDrawer,
  cicloTemplateAlignedObjectives,
  cicloTemplateObjectives,
  type CicloTemplate,
} from "@/components/ciclo-templates";
import { createBlankCicloDraft } from "@/screens/CicloBuilder";
import { cicloRowToDraft } from "@/screens/cicloDraftFromRow";
import {
  CICLO_PERIOD_LABELS,
  CICLO_STATUS_LABELS,
  assignedObjectiveCount,
  type CicloBuilderAssignmentSeed,
  type CicloDraft,
  type CicloStepId,
} from "@/components/ciclo-builder";
import { CICLOS, type CicloRow } from "@/mocks/ciclos";
import {
  NO_FILTERS,
  mapEstadoToStatusState,
  type CicloListFilters,
} from "@/components/ciclo-list/cicloListFilters";
import { StatusBadge } from "@/components/status-badge";
import { useElementHeight } from "@/lib/useElementHeight";

const SPANISH_MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-07-01" → "01 julio 2026", the long form the list table prints. */
function formatSpanishDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return `${String(day).padStart(2, "0")} ${SPANISH_MONTHS[month - 1]} ${year}`;
}

/**
 * Turns a builder draft into the row the home list reads — used when the
 * author leaves the wizard with something worth keeping (autosaved or
 * finalized) so it doesn't vanish instead of landing in "Lista de ciclos".
 *
 * `previous` es la fila del ciclo cuando se editaba uno que ya existía. Su
 * avance no sale del constructor —nadie reporta progreso ahí—, así que se
 * conserva: sin esto, entrar a editar un ciclo al 65 % y salir lo dejaría en
 * la lista como si nadie hubiera reportado nada.
 */
function draftToCicloRow(draft: CicloDraft, previous?: CicloRow): CicloRow {
  const numObjetivos = draft.companyObjectives.length + assignedObjectiveCount(draft.objectiveSets);
  return {
    id: draft._id || `draft-${Date.now()}`,
    nombre: draft.name.trim() || "Ciclo sin título",
    periodo: draft.period ? CICLO_PERIOD_LABELS[draft.period] : "Personalizado",
    fechaInicio: formatSpanishDate(draft.startDate),
    fechaCierre: formatSpanishDate(draft.endDate),
    estado: CICLO_STATUS_LABELS[draft.status],
    numObjetivos,
    progreso: previous?.progreso ?? 0,
    avance: previous?.avance ?? "0%",
    tipoProgreso: previous?.tipoProgreso ?? "neutral",
    _draft: draft,
  };
}

type HomeTab = "ciclos" | "usuarios";

function App() {
  const [homeTab, setHomeTab] = React.useState<HomeTab>("ciclos");

  /*
   * La tira de pestañas va pegada arriba del contenido que baja. Su alto se
   * mide y viaja como `--home-sticky-top` para que el encabezado de la tabla
   * se pegue exactamente debajo: uno solo de los dos escrito a mano dejaría
   * un hueco o un solape en cuanto las pestañas cambien de alto.
   */
  const homeTabsRef = React.useRef<HTMLDivElement>(null);
  const homeTabsHeight = useElementHeight(homeTabsRef);
  // Una segunda lectura del mismo ciclo —con su propia cabecera, sus tablas y
  // su barra— y obligaba a elegir por cuál entrar; ya no existe.
  const [resultsCiclo, setResultsCiclo] = React.useState<CicloRow | null>(null);
  const [ciclos, setCiclos] = React.useState<readonly CicloRow[]>(CICLOS);
  // The creation wizard takes over the whole content area — it owns its own
  // scroll, stepper and action bar, so the list's tabs step aside while it is up.
  const [isCreatingCiclo, setIsCreatingCiclo] = React.useState(false);
  // The draft the wizard opens on: blank from the rail, pre-written when the
  // author picked a template.
  const [builderDraft, setBuilderDraft] = React.useState<CicloDraft | undefined>();
  // Which step the wizard lands on — "general" for a new ciclo, "participants"
  // when it was reopened just to add users to an existing one.
  const [builderInitialStep, setBuilderInitialStep] = React.useState<CicloStepId | undefined>(
    "general"
  );
  const [builderInitialObjectiveTab, setBuilderInitialObjectiveTab] = React.useState<"groups" | "individual" | undefined>();
  // Objetivos de grupo/individual de una plantilla, todavía sin destinatario
  // — el constructor los ofrece solo al llegar a cada paso.
  const [builderAssignmentSeeds, setBuilderAssignmentSeeds] = React.useState<
    readonly CicloBuilderAssignmentSeed[]
  >([]);
  // Owned here rather than inside the table: the alert buttons that set these
  // live above the tabs, outside the table's own subtree.
  const [listFilters, setListFilters] = React.useState<CicloListFilters>(NO_FILTERS);
  const [isTemplateCatalogOpen, setIsTemplateCatalogOpen] = React.useState(false);
  // Con qué plantilla abre el catálogo: su ficha cuando se pulsó una tile del
  // home, la lista completa cuando se pulsó "Ver más plantillas".
  const [templateCatalogEntry, setTemplateCatalogEntry] = React.useState<string | null>(null);

  /** Abre el catálogo en la ficha de una plantilla. Mirar una plantilla ya no
   *  crea nada: la decisión de estrenarla se toma dentro de la ficha. */
  const openTemplateDetail = (template: CicloTemplate) => {
    setTemplateCatalogEntry(template.id);
    setIsTemplateCatalogOpen(true);
  };

  const openTemplateCatalog = () => {
    setTemplateCatalogEntry(null);
    setIsTemplateCatalogOpen(true);
  };

  /**
   * Estrena una plantilla: siempre en un ciclo nuevo, arrancando en Datos
   * generales — nunca en un ciclo existente ni en un paso de configuración
   * aparte. Los objetivos de empresa entran ya puestos; los de grupo y de
   * individuo viajan como "seeds" sin destinatario, y es el propio paso de
   * cada uno el que pide a quién pertenecen en cuanto se llega a él.
   *
   * `companyObjectives` se calcula una sola vez y se reutiliza para el draft
   * y para la alineación: son sus ids reales los que `alignedTo` necesita, y
   * `cicloTemplateObjectives` genera ids nuevos en cada llamada, así que una
   * segunda llamada produciría ids que no coinciden con los del ciclo.
   */
  const useTemplate = (template: CicloTemplate) => {
    setIsTemplateCatalogOpen(false);
    const companyObjectives = cicloTemplateObjectives(template);
    const groupObjectives = cicloTemplateAlignedObjectives(template, "grupal", companyObjectives);
    const individualObjectives = cicloTemplateAlignedObjectives(
      template,
      "individual",
      companyObjectives
    );

    setBuilderDraft({
      ...createBlankCicloDraft(),
      name: template.name,
      period: template.period,
      description: template.description,
      useCompanyObjectives: true,
      companyObjectives,
    });
    setBuilderAssignmentSeeds(
      [
        groupObjectives.length > 0 ? { kind: "grupal" as const, objectives: groupObjectives } : null,
        individualObjectives.length > 0
          ? { kind: "individual" as const, objectives: individualObjectives }
          : null,
      ].filter((seed): seed is CicloBuilderAssignmentSeed => seed !== null)
    );
    setBuilderInitialStep("general");
    setIsCreatingCiclo(true);
  };

  const startBlank = () => {
    setBuilderDraft(undefined);
    setBuilderInitialStep("general");
    setBuilderInitialObjectiveTab(undefined);
    setBuilderAssignmentSeeds([]);
    setIsCreatingCiclo(true);
  };

  /** Reopens the wizard on an existing ciclo, landing on the given step —
   * Participantes from "Agregar usuarios al ciclo", Datos generales from
   * "Editar ciclo". */
  const startEditCiclo = (
    ciclo: CicloRow,
    step: CicloStepId | undefined,
    tab?: "groups" | "individual"
  ) => {
    setBuilderDraft(cicloRowToDraft(ciclo));
    setBuilderInitialStep(step);
    setBuilderInitialObjectiveTab(tab);
    setBuilderAssignmentSeeds([]);
    setIsCreatingCiclo(true);
  };

  const startEditParticipants = (ciclo: CicloRow) => startEditCiclo(ciclo, "participants");
  /** "Editar ciclo" no pide ningún paso: un borrador se retoma donde lo dejó
   *  su autor, y el constructor es quien sabe dónde fue (`resumeCicloStep`). */
  const startEditGeneral = (ciclo: CicloRow) => startEditCiclo(ciclo, undefined);
  /** El botón "Editar" global de la ficha de resultados, sin nada
   *  seleccionado: abre el constructor en el paso de objetivos. */
  const startEditObjectives = (ciclo: CicloRow, tab?: "groups" | "individual") => startEditCiclo(ciclo, "objectives", tab);

  const saveDraft = (draft: CicloDraft) => {
    setCiclos((current) => {
      const existing = current.find((c) => c.id === draft._id);
      const row = draftToCicloRow(draft, existing);
      if (existing) {
        return current.map((c) => (c.id === row.id ? row : c));
      }
      return [row, ...current];
    });
  };

  /** Leaves the wizard. A `draft` here means there's something to keep — the
   *  author finished the ciclo, or exited after it autosaved — so it lands in
   *  the list instead of disappearing with the rest of the builder state. */
  const leaveBuilder = (draft?: CicloDraft) => {
    if (draft) {
      saveDraft(draft);
    }
    setIsCreatingCiclo(false);
    setBuilderDraft(undefined);
    setBuilderInitialStep("general");
    setBuilderInitialObjectiveTab(undefined);
    setBuilderAssignmentSeeds([]);
  };

  /** "Objetivos" in the rail: back to the list, wherever you were. */
  const goHome = () => {
    leaveBuilder();
    setResultsCiclo(null);
  };

  if (isCreatingCiclo) {
    return (
      <TooltipProvider>
        <UbitsToaster />
        <AdminShell
          scrollContent={false}
          showFooter={false}
          onNavigateHome={goHome}
        >
          {/* Keyed on the draft so abrir otro ciclo —u otra plantilla—
              remonta el constructor sobre él en vez de quedarse con los
              objetivos del primero en estado. */}
          <CicloBuilder
            key={builderDraft?._id ?? builderDraft?.name ?? "blank"}
            initialDraft={builderDraft}
            initialStep={builderInitialStep}
            initialObjectiveTab={builderInitialObjectiveTab}
            initialAssignmentSeeds={builderAssignmentSeeds}
            onExit={leaveBuilder}
            onSaveDraft={saveDraft}
          />
        </AdminShell>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <UbitsToaster />
      <AdminShell
        // The list scrolls as one page — title, shelf, pulse, alerts and the
        // table below them. A ciclo's results view owns its own scroll.
        scrollContent={resultsCiclo === null}
        showFooter={true}
        onNavigateHome={goHome}
      >
        {/* El título de la pantalla vive en la cabecera del shell — el mismo
            hueco que antes ocupaba el breadcrumb — en vez de su propio
            renglón dentro del contenido. "Objetivos" en el home, nombre +
            estado del ciclo en resultados: es la misma idea que ya usa el
            constructor con `CicloIdentity`, la pantalla es la dueña de su
            identidad y el shell solo le presta el lugar donde mostrarla. */}
        <ShellHeaderSlot>
          {resultsCiclo ? (
            <>
              <button
                onClick={() => setResultsCiclo(null)}
                aria-label="Volver a la lista de ciclos"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-surface transition-colors hover:bg-surface-muted focus:outline-none"
              >
                <ArrowLeft className="h-4 w-4 text-text-primary" />
              </button>
              <h1 className="truncate text-sm font-semibold text-text-primary">
                {resultsCiclo.nombre}
              </h1>
              <StatusBadge
                state={mapEstadoToStatusState(resultsCiclo.estado)}
                labels={{ [mapEstadoToStatusState(resultsCiclo.estado)]: resultsCiclo.estado }}
              />
            </>
          ) : (
            <h1 className="truncate text-2xl font-bold tracking-tight text-text-primary">Objetivos</h1>
          )}
        </ShellHeaderSlot>

        <div
          className="h-full px-1 pt-2 pb-6 flex-1 flex flex-col min-h-0"
          style={{ "--home-sticky-top": `${homeTabsHeight}px` } as React.CSSProperties}
        >
          {resultsCiclo ? null : (
            <>
              {/* "What can I start from" comes first, then "how are my ciclos
                  doing", then what needs a hand — each step narrower than the
                  last. */}
              <TemplatesStrip
                className="mb-4 shrink-0"
                onSelectTemplate={openTemplateDetail}
                onViewAll={openTemplateCatalog}
              />

              <HomePulseStrip className="mb-4 shrink-0" ciclos={ciclos} />

              {/* Alerts filter the Ciclos tab, so pressing one also brings that
                  tab forward if the reader was on Usuarios sin objetivos. */}
              <AlertsRow
                className="mb-4 shrink-0"
                ciclos={ciclos}
                filters={listFilters}
                onFiltersChange={(filters) => {
                  setHomeTab("ciclos");
                  setListFilters(filters);
                }}
              />

              <CicloTemplatesDrawer
                open={isTemplateCatalogOpen}
                onOpenChange={setIsTemplateCatalogOpen}
                onUseTemplate={useTemplate}
                initialTemplateId={templateCatalogEntry}
              />

              {/* Pinned to the top of the scroll area — Ciclos can hold far
                  more rows than fit on screen, and losing the way back to
                  Usuarios sin objetivos on every scroll defeats the tab.
                  Su alto se mide y se publica como `--home-sticky-top`: el
                  encabezado de la tabla se pega justo debajo, y así los dos
                  se quedan quietos sin pisarse. */}
              <div ref={homeTabsRef} className="sticky top-0 z-20 bg-background pb-4 pt-2 shrink-0">
                <UbitsTabs
                  tabs={[
                    { id: "ciclos", label: "Ciclos de objetivos", icon: <Target className="w-4 h-4" /> },
                    { id: "usuarios", label: "Usuarios sin objetivos", icon: <UserX className="w-4 h-4" /> },
                  ]}
                  activeTabId={homeTab}
                  onTabChange={(id) => setHomeTab(id as HomeTab)}
                  variant="page"
                  fitContent
                  className="mb-0 shrink-0"
                />
              </div>
            </>
          )}

          {/* Keyed on the active tab so switching remounts the dashboard and
              replays its own entrance cascade (it runs one in framer-motion,
              so this wrapper must not add the CSS `.cascade-enter` on top —
              two staggered reveals over the same rows read as a stutter).
              `contents` keeps it a layout passthrough in the column. */}
          <div key={resultsCiclo ? "resultados" : homeTab} className="contents">
            <ObjetivosDashboard
              activeTab={homeTab}
              ciclos={ciclos}
              onCiclosChange={setCiclos}
              filters={listFilters}
              onFiltersChange={setListFilters}
              resultsCiclo={resultsCiclo}
              onViewResults={setResultsCiclo}
              onCreateCiclo={startBlank}
              onAddUsersToCiclo={startEditParticipants}
              onEditCiclo={startEditGeneral}
              onEditCicloObjectives={startEditObjectives}
            />
          </div>
        </div>
      </AdminShell>
    </TooltipProvider>
  );
}

export default App;
