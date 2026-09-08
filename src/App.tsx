import * as React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UbitsToaster } from "@/components/feedback";
import { AdminShell } from "@/components/app-shell";
import { ObjetivosDashboard } from "@/screens/ObjetivosDashboard";
import { CicloBuilder } from "@/screens/CicloBuilder";
import { UbitsTabs } from "@/components/navigation";
import { parseSpanishDate, type CicloListRow } from "@/components/ciclo-detail";
import { ArrowLeft, Target, UserX } from "lucide-react";
import { HomePulseStrip, TemplatesStrip, AlertsRow } from "@/components/home";
import {
  CicloTemplatesDrawer,
  cicloTemplateAlignedObjectives,
  cicloTemplateObjectives,
  type CicloTemplate,
} from "@/components/ciclo-templates";
import { createBlankCicloDraft } from "@/screens/CicloBuilder";
import type {
  CicloBuilderAssignmentSeed,
  CicloDraft,
  CicloPeriod,
  CicloStepId,
} from "@/components/ciclo-builder";
import { CICLOS, type CicloRow } from "@/mocks/ciclos";
import { NO_FILTERS, type CicloListFilters } from "@/components/ciclo-list/cicloListFilters";

/** Maps the list's free-text `periodo` label to the builder's period key. */
const PERIOD_LABEL_TO_KEY: Readonly<Record<string, CicloPeriod>> = {
  mes: "mes",
  bimestre: "bimestre",
  trimestre: "trimestre",
  semestre: "semestre",
  año: "anio",
  personalizado: "personalizado",
};

/**
 * Seeds a draft from a listed ciclo's known fields, for the "edit" entry
 * points that reopen the wizard on an existing ciclo — participants are left
 * blank rather than guessed, since the list doesn't carry who's already in it.
 */
function cicloRowToDraft(
  row: Pick<CicloListRow, "nombre" | "periodo" | "fechaInicio" | "fechaCierre">
): CicloDraft {
  return {
    ...createBlankCicloDraft(),
    name: row.nombre,
    period: PERIOD_LABEL_TO_KEY[row.periodo.trim().toLowerCase()] ?? null,
    startDate: parseSpanishDate(row.fechaInicio),
    endDate: parseSpanishDate(row.fechaCierre),
  };
}

type HomeTab = "ciclos" | "usuarios";

/** El estado del ciclo en el tono que usa la insignia de la miga de pan. */
function cicloBadgeTone(estado: string): "positive" | "neutral" | "warning" {
  if (estado === "Finalizado") return "positive";
  if (estado === "En curso") return "warning";
  return "neutral";
}

function App() {
  const [homeTab, setHomeTab] = React.useState<HomeTab>("ciclos");
  // Un ciclo se abre en una sola pantalla: sus resultados. El seguimiento era
  // una segunda lectura del mismo ciclo —con su propia cabecera, sus tablas y
  // su barra— y obligaba a elegir por cuál entrar; ya no existe.
  const [resultsCiclo, setResultsCiclo] = React.useState<CicloListRow | null>(null);
  const [ciclos, setCiclos] = React.useState<readonly CicloRow[]>(CICLOS);
  // The creation wizard takes over the whole content area — it owns its own
  // scroll, stepper and action bar, so the list's tabs step aside while it is up.
  const [isCreatingCiclo, setIsCreatingCiclo] = React.useState(false);
  // The draft the wizard opens on: blank from the rail, pre-written when the
  // author picked a template.
  const [builderDraft, setBuilderDraft] = React.useState<CicloDraft | undefined>();
  // Which step the wizard lands on — "general" for a new ciclo, "participants"
  // when it was reopened just to add users to an existing one.
  const [builderInitialStep, setBuilderInitialStep] = React.useState<CicloStepId>("general");
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
    setBuilderAssignmentSeeds([]);
    setIsCreatingCiclo(true);
  };

  /** Reopens the wizard on an existing ciclo, landing on the given step —
   * Participantes from "Agregar usuarios al ciclo", Datos generales from
   * "Editar ciclo". */
  const startEditCiclo = (ciclo: CicloListRow, step: CicloStepId) => {
    setBuilderDraft(cicloRowToDraft(ciclo));
    setBuilderInitialStep(step);
    setBuilderAssignmentSeeds([]);
    setIsCreatingCiclo(true);
  };

  const startEditParticipants = (ciclo: CicloListRow) => startEditCiclo(ciclo, "participants");
  const startEditGeneral = (ciclo: CicloListRow) => startEditCiclo(ciclo, "general");

  const leaveBuilder = () => {
    setIsCreatingCiclo(false);
    setBuilderDraft(undefined);
    setBuilderInitialStep("general");
    setBuilderAssignmentSeeds([]);
  };

  /** "Objetivos" in the rail: back to the list, wherever you were. */
  const goHome = () => {
    leaveBuilder();
    setSelectedCiclo(null);
  };

  if (isCreatingCiclo) {
    return (
      <TooltipProvider>
        <UbitsToaster />
        <AdminShell
          breadcrumb={{
            parent: "Objetivos",
            onParentClick: leaveBuilder,
          }}
          scrollContent={false}
          showFooter={false}
          onNavigateHome={goHome}
        >
          {/* Keyed on the draft's name so picking a different template
              remounts the wizard on it instead of keeping the first one's
              objectives in state. */}
          <CicloBuilder
            key={builderDraft?.name ?? "blank"}
            initialDraft={builderDraft}
            initialStep={builderInitialStep}
            initialAssignmentSeeds={builderAssignmentSeeds}
            onExit={leaveBuilder}
          />
        </AdminShell>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <UbitsToaster />
      <AdminShell
        breadcrumb={
          resultsCiclo
            ? {
                parent: "Objetivos",
                label: resultsCiclo.nombre,
                badge: { label: resultsCiclo.estado, tone: cicloBadgeTone(resultsCiclo.estado) },
                onParentClick: () => setResultsCiclo(null),
              }
            : { parent: "Desempeño", label: "Objetivos" }
        }
        // The list scrolls as one page — title, shelf, pulse, alerts and the
        // table below them. A ciclo's results view owns its own scroll.
        scrollContent={resultsCiclo === null}
        showFooter={true}
        onNavigateHome={goHome}
      >
        <div className="h-full px-1 pt-2 pb-6 flex-1 flex flex-col min-h-0">
          {resultsCiclo ? (
            <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  onClick={() => setResultsCiclo(null)}
                  aria-label="Volver a la lista de ciclos"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-surface transition-colors hover:bg-surface-muted focus:outline-none"
                >
                  <ArrowLeft className="h-4 w-4 text-text-primary" />
                </button>
                <h1 className="truncate text-[20px] font-bold text-text-primary">
                  Resultados del ciclo
                </h1>
              </div>
            </div>
          ) : (
            <>
              <h1 className="mb-4 shrink-0 text-2xl font-bold tracking-tight text-text-primary">Objetivos</h1>

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
                  Usuarios sin objetivos on every scroll defeats the tab. */}
              <div className="sticky top-0 z-20 bg-background pb-4 pt-2 shrink-0">
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
            />
          </div>
        </div>
      </AdminShell>
    </TooltipProvider>
  );
}

export default App;
