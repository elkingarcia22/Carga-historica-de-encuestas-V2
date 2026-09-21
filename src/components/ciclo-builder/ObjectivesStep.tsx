import * as React from "react";
import { Users2, UserRound, CheckIcon, Users, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { MagicCard } from "@/components/ui/magic-card";
import { toneChip, toneSolid, toneText, type Tone } from "@/lib/tone";
import { ObjectiveSetsEditor } from "./ObjectiveSetsEditor";
import type { ObjectiveSetsEditorProps } from "./ObjectiveSetsEditor";
import { assignedObjectiveCount, type CicloDraft, type ObjectiveSet } from "./cicloBuilderTypes";

interface ObjectivesStepProps {
  draft: CicloDraft;
  onChange: (patch: Partial<CicloDraft>) => void;
  activeTab: "groups" | "individual";
  onActiveTabChange: (tab: "groups" | "individual") => void;
  /**
   * El nivel —por grupos, por persona o los dos— ya se decidió en la
   * parametrización. El paso no vuelve a preguntarlo: no hay arranque de
   * "¿cómo quieres crear los objetivos?", las tarjetas de arriba son solo
   * pestañas (o no están, si hay un único nivel), y nada aquí apaga un nivel.
   */
  levelsDecidedUpstream?: boolean;
  /** Vuelve al primer paso, donde sí se cambia el nivel. */
  onGoToSetup?: () => void;
  // Pasamos todos los callbacks necesarios para los ObjectiveSetsEditor
  editorProps: {
    groupSets: ObjectiveSetsEditorProps["sets"];
    individualSets: ObjectiveSetsEditorProps["sets"];
    drawerRequest: ObjectiveSetsEditorProps["drawerRequest"];
    onDrawerRequestChange: ObjectiveSetsEditorProps["onDrawerRequestChange"];
    onSaveSet: ObjectiveSetsEditorProps["onSaveSet"];
    onRemoveTargets: ObjectiveSetsEditorProps["onRemoveTargets"];
    onSelectionChange: ObjectiveSetsEditorProps["onSelectionChange"];
    onAiWorkingChange: ObjectiveSetsEditorProps["onAiWorkingChange"];
    showValidation: boolean;
    groupCoverage: ObjectiveSetsEditorProps["coveredElsewhere"];
    noCoverage: ObjectiveSetsEditorProps["coveredElsewhere"];
    pendingSeedObjectivesGroup: ObjectiveSetsEditorProps["pendingSeedObjectives"];
    pendingSeedObjectivesIndividual: ObjectiveSetsEditorProps["pendingSeedObjectives"];
    onResumeTemplateSeedGroup: ObjectiveSetsEditorProps["onResumeTemplateSeed"];
    onResumeTemplateSeedIndividual: ObjectiveSetsEditorProps["onResumeTemplateSeed"];
  };
}

type ObjectiveMode = "groups" | "individual";

const MODE_COPY = {
  groups: {
    icon: Users2,
    title: "Por grupos",
    description: "Un mismo set de objetivos para toda un área, equipo o grupo.",
    empty: "Sin objetivos por grupo",
  },
  individual: {
    icon: UserRound,
    title: "Por colaborador",
    description: "Cada persona recibe sus propios objetivos individuales.",
    empty: "Sin objetivos individuales",
  },
} as const;

/** Lo que esta vía ya reparte, en una línea: destinatarios y objetivos. */
function modeSummary(mode: ObjectiveMode, sets: readonly ObjectiveSet[]): string {
  const targets = sets.reduce((sum, set) => sum + set.targetIds.length, 0);
  if (targets === 0) return MODE_COPY[mode].empty;
  const objectives = assignedObjectiveCount(sets);
  const unit =
    mode === "groups"
      ? targets === 1
        ? "1 grupo"
        : `${targets} grupos`
      : targets === 1
        ? "1 persona"
        : `${targets} personas`;
  return `${unit} · ${objectives} ${objectives === 1 ? "objetivo" : "objetivos"}`;
}

function ModeCard({
  mode,
  isActive,
  hasSelection,
  summary,
  hasContent,
  onSelect,
  onToggle,
  showToggle = true,
}: {
  mode: ObjectiveMode;
  isActive: boolean;
  hasSelection: boolean;
  /** Sin la casilla la tarjeta es solo una pestaña: el nivel se decidió antes. */
  showToggle?: boolean;
  /** El chip de abajo: qué lleva repartido esta vía. */
  summary: string;
  /** Si ya reparte algo — es lo que pinta el chip de verde, no el encendido. */
  hasContent: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const { icon: Icon, title, description } = MODE_COPY[mode];
  const isMarked = isActive || hasSelection;
  const tone: Tone = "brand";

  return (
    <MagicCard
      isSelected={isMarked}
      variant="primary"
      tone={tone}
      onClick={onSelect}
      className="w-full"
      contentClassName="flex-col gap-3 h-full text-left w-full"
    >
      <div className="flex items-start justify-between gap-2 w-full">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105",
            !isMarked && "tone-reveal-chip"
          )}
          style={isMarked ? toneChip(tone) : undefined}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
        </span>
        {/* El checkbox es el interruptor real —enciende o apaga este modo sin
            cambiar de pestaña— separado del resto de la tarjeta, que solo
            cambia cuál panel se ve. Va como `span` con rol y foco propios, no
            como `<button>`: la tarjeta entera ya es un botón, y anidar uno
            dentro es HTML inválido (y dos cosas pulsables para una decisión). */}
        {showToggle ? (
        <span
          role="checkbox"
          tabIndex={0}
          aria-checked={hasSelection}
          aria-label={`${hasSelection ? "Desactivar" : "Activar"} ${title}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          onKeyDown={(event) => {
            if (event.key !== " " && event.key !== "Enter") return;
            event.preventDefault();
            event.stopPropagation();
            onToggle();
          }}
          className={cn(
            "flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
            hasSelection ? "border-transparent" : "border-input bg-surface"
          )}
          style={hasSelection ? toneSolid(tone) : undefined}
        >
          {hasSelection && <CheckIcon className="size-3.5" strokeWidth={2.5} />}
        </span>
        ) : (
          // Con el nivel decidido arriba la tarjeta ya no apaga nada, pero si
          // esta vía ya tiene grupos o personas con objetivos, esa marca se
          // sigue viendo aquí —el mismo lugar donde vivía el interruptor— en
          // vez de desaparecer del todo.
          hasContent && (
            <span
              aria-hidden
              className="flex size-5 shrink-0 items-center justify-center rounded-sm border border-transparent"
              style={toneSolid(tone)}
            >
              <CheckIcon className="size-3.5" strokeWidth={2.5} />
            </span>
          )
        )}
      </div>

      <div className="w-full">
        <h3
          className={cn(
            "text-[13px] font-bold leading-none tracking-tight",
            !isMarked && "tone-reveal-text"
          )}
          style={isMarked ? toneText(tone) : undefined}
        >
          {title}
        </h3>
        <p className="mt-1.5 text-[11px] font-medium leading-[1.35] text-text-muted line-clamp-2">
          {description}
        </p>
      </div>

      {/* Mismo chip que las tarjetas de participantes: gris mientras la vía no
          reparte nada, y en cuanto lleva algo, el verde con la cuenta de lo que
          tiene asignado. Es lo único de la tarjeta que responde a lo hecho y no
          a lo elegido. */}
      <div className="mt-auto w-full pt-1">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
            !hasContent && "bg-surface-muted"
          )}
          style={hasContent ? toneChip("positive") : undefined}
        >
          {hasContent && <CheckIcon className="size-3 shrink-0" strokeWidth={2.5} />}
          <span className="text-[11px] font-medium leading-none tracking-tight text-current">
            {summary}
          </span>
        </span>
      </div>
    </MagicCard>
  );
}

export function ObjectivesStep({
  draft,
  onChange,
  activeTab,
  onActiveTabChange,
  levelsDecidedUpstream = false,
  onGoToSetup,
  editorProps,
}: ObjectivesStepProps) {
  const { groupSets, individualSets } = editorProps;
  const hasAnyAssignment = groupSets.length > 0 || individualSets.length > 0;
  const bothLevels = draft.useGroupObjectives && draft.useIndividualObjectives;

  /**
   * Si el paso ya se contestó.
   *
   * Vacío, el paso no arranca en dos pestañas y una tabla en blanco: arranca
   * preguntando lo único que hay que decidir primero —a grupos o a personas—
   * y esa respuesta abre directamente el drawer que lo crea. Una vez hay algo
   * repartido (o alguien dijo que por ahora nada), el paso se convierte en el
   * registro de lo hecho y esta pregunta ya no vuelve a aparecer.
   */
  const [hasAnswered, setHasAnswered] = React.useState(
    hasAnyAssignment || levelsDecidedUpstream
  );
  React.useEffect(() => {
    if (hasAnyAssignment || levelsDecidedUpstream) setHasAnswered(true);
  }, [hasAnyAssignment, levelsDecidedUpstream]);

  // Con el nivel decidido arriba, la pestaña abierta tiene que ser uno de los
  // niveles que existen: llegar a "por grupos" en un ciclo solo individual
  // sería mirar un panel que la parametrización apagó.
  React.useEffect(() => {
    if (!levelsDecidedUpstream) return;
    if (activeTab === "groups" && !draft.useGroupObjectives && draft.useIndividualObjectives) {
      onActiveTabChange("individual");
    }
    if (activeTab === "individual" && !draft.useIndividualObjectives && draft.useGroupObjectives) {
      onActiveTabChange("groups");
    }
  }, [
    levelsDecidedUpstream,
    activeTab,
    draft.useGroupObjectives,
    draft.useIndividualObjectives,
    onActiveTabChange,
  ]);

  React.useEffect(() => {
    // La parametrización ya fijó los niveles: dejar una pestaña vacía no los
    // apaga, los deja pendientes (y el stepper lo dice).
    if (levelsDecidedUpstream) return;
    if (activeTab !== "groups" && draft.useGroupObjectives && groupSets.length === 0) {
      onChange({ useGroupObjectives: false });
    }
    if (activeTab !== "individual" && draft.useIndividualObjectives && individualSets.length === 0) {
      onChange({ useIndividualObjectives: false });
    }
  }, [
    levelsDecidedUpstream,
    activeTab,
    draft.useGroupObjectives,
    draft.useIndividualObjectives,
    groupSets.length,
    individualSets.length,
    onChange,
  ]);

  /** Arranca una vía: la enciende, se planta en su pestaña y abre el drawer. */
  const startWith = (mode: ObjectiveMode) => {
    setHasAnswered(true);
    onActiveTabChange(mode);
    onChange(
      mode === "groups" ? { useGroupObjectives: true } : { useIndividualObjectives: true }
    );
    editorProps.onDrawerRequestChange({ setId: null, phase: "targets", intent: "manual" });
  };

  const sharedEditorProps = {
    allSets: draft.objectiveSets,
    onAllSetsChange: (objectiveSets: readonly ObjectiveSet[]) => onChange({ objectiveSets }),
    segmentBy: draft.assignment.groupSegmentBy,
    onSegmentByChange: (groupSegmentBy: typeof draft.assignment.groupSegmentBy) =>
      onChange({ assignment: { ...draft.assignment, groupSegmentBy } }),
    autoInclude: draft.assignment.groupsAutoInclude,
    onAutoIncludeChange: (groupsAutoInclude: boolean) =>
      onChange({ assignment: { ...draft.assignment, groupsAutoInclude } }),
    // Un ciclo sin norte no tiene a qué alinear, aunque el borrador arrastre
    // objetivos de empresa de antes de apagarlo: es la misma lectura que hace
    // el mapa de alineación (`AlignmentStep`), y sin ella el chat de IA
    // preguntaba a qué objetivo de la empresa apunta un grupo en ciclos que
    // no tienen ninguno.
    companyObjectives: draft.useCompanyObjectives ? draft.companyObjectives : [],
    rules: draft.modelRules,
    model: draft.objectiveModel,
    drawerRequest: editorProps.drawerRequest,
    onDrawerRequestChange: editorProps.onDrawerRequestChange,
    onSaveSet: editorProps.onSaveSet,
    onRemoveTargets: editorProps.onRemoveTargets,
    onSelectionChange: editorProps.onSelectionChange,
    onAiWorkingChange: editorProps.onAiWorkingChange,
    showValidation: editorProps.showValidation,
  };

  return (
    <section className="flex min-w-0 flex-1 flex-col self-start rounded-2xl border border-border/60 bg-surface shadow-card">
      {/* Header. Con un solo nivel decidido en la parametrización, el header
          es todo lo que hay: título y descripción a la izquierda, el nivel y
          "Cambiar" como un chip aparte a la derecha — nada de un segundo
          título ni una caja repitiendo lo mismo más abajo. */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-2xl border-b border-border/60 bg-surface px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/5 text-primary">
            <Users className="h-[18px] w-[18px]" strokeWidth={2} />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="min-w-0 truncate text-[14px] font-bold tracking-tight text-text-primary">
              {levelsDecidedUpstream && !bothLevels
                ? activeTab === "groups"
                  ? "Objetivos por grupos"
                  : "Objetivos por colaborador"
                : "Objetivos asignados"}
            </h2>
            {hasAnswered && levelsDecidedUpstream && bothLevels && (
              <p className="min-w-0 text-[12.5px] leading-snug text-text-secondary">
                Reparte los objetivos en los dos niveles que definiste en la parametrización.
              </p>
            )}
            {hasAnswered && levelsDecidedUpstream && !bothLevels && (
              <p className="min-w-0 truncate text-[12.5px] leading-snug text-text-secondary">
                {activeTab === "groups"
                  ? "Un mismo set de objetivos para cada grupo; quien pertenezca al grupo lo hereda."
                  : "Cada persona recibe sus propios objetivos."}
              </p>
            )}
          </div>
        </div>

        {hasAnswered && levelsDecidedUpstream && onGoToSetup && (
          <div className="flex shrink-0 items-center gap-2 rounded-full border border-border/60 bg-surface-muted/60 py-1 pl-3 pr-1">
            <span className="text-[11.5px] font-semibold text-text-secondary">
              {bothLevels ? "Mixto" : activeTab === "groups" ? "Por grupos" : "Individual"}
            </span>
            <button
              type="button"
              onClick={onGoToSetup}
              className="rounded-full bg-primary/10 px-2.5 py-1 text-[11.5px] font-semibold text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              Cambiar
            </button>
          </div>
        )}
      </div>

      {!hasAnswered ? (
        <AssignmentKickoff
          onPick={startWith}
          onSkip={() => {
            setHasAnswered(true);
            onChange({ useGroupObjectives: false, useIndividualObjectives: false });
          }}
        />
      ) : (
        <div className="flex flex-col gap-6 px-6 py-6 cascade-enter">
          {/* Con el nivel decidido en la parametrización el header ya lo dice
              todo (título, descripción y "Cambiar"); este bloque solo hace
              falta en el flujo guiado, donde el paso mismo hace la pregunta. */}
          {!levelsDecidedUpstream && (
            <div className="flex flex-col gap-1.5">
              <h3 className="text-[14px] font-bold tracking-tight text-text-primary">
                ¿Cómo quieres asignar los objetivos?
              </h3>
              <p className="text-[13px] leading-relaxed text-text-secondary">
                Reparte los objetivos entre los participantes del ciclo. Puedes hacerlo por grupos
                o de forma individual.
              </p>
            </div>
          )}

          {(!levelsDecidedUpstream || bothLevels) && (
          <div
            role="radiogroup"
            aria-label="Tipos de objetivos"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2"
          >
            <ModeCard
              mode="groups"
              isActive={activeTab === "groups"}
              hasSelection={levelsDecidedUpstream ? false : draft.useGroupObjectives}
              showToggle={!levelsDecidedUpstream}
              summary={modeSummary("groups", groupSets)}
              hasContent={groupSets.length > 0}
              onSelect={() => {
                onActiveTabChange("groups");
                if (levelsDecidedUpstream) return;
                if (!draft.useGroupObjectives) {
                  onChange({ useGroupObjectives: true });
                }
                if (draft.useIndividualObjectives && individualSets.length === 0) {
                  onChange({ useIndividualObjectives: false });
                }
              }}
              onToggle={() => onChange({ useGroupObjectives: !draft.useGroupObjectives })}
            />
            <ModeCard
              mode="individual"
              isActive={activeTab === "individual"}
              hasSelection={levelsDecidedUpstream ? false : draft.useIndividualObjectives}
              showToggle={!levelsDecidedUpstream}
              summary={modeSummary("individual", individualSets)}
              hasContent={individualSets.length > 0}
              onSelect={() => {
                onActiveTabChange("individual");
                if (levelsDecidedUpstream) return;
                if (!draft.useIndividualObjectives) {
                  onChange({ useIndividualObjectives: true });
                }
                if (draft.useGroupObjectives && groupSets.length === 0) {
                  onChange({ useGroupObjectives: false });
                }
              }}
              onToggle={() =>
                onChange({ useIndividualObjectives: !draft.useIndividualObjectives })
              }
            />
          </div>
          )}

          {activeTab === "groups" && (
            <ObjectiveSetsEditor
              {...sharedEditorProps}
              kind="grupal"
              sets={groupSets}
              coveredElsewhere={editorProps.noCoverage}
              pendingSeedObjectives={editorProps.pendingSeedObjectivesGroup}
              onResumeTemplateSeed={editorProps.onResumeTemplateSeedGroup}
              enabled={draft.useGroupObjectives}
              onEnabledChange={(enabled) => onChange({ useGroupObjectives: enabled })}
              hideSwitch={levelsDecidedUpstream}
            />
          )}

          {activeTab === "individual" && (
            <ObjectiveSetsEditor
              {...sharedEditorProps}
              kind="individual"
              sets={individualSets}
              coveredElsewhere={editorProps.groupCoverage}
              pendingSeedObjectives={editorProps.pendingSeedObjectivesIndividual}
              onResumeTemplateSeed={editorProps.onResumeTemplateSeedIndividual}
              enabled={draft.useIndividualObjectives}
              onEnabledChange={(enabled) => onChange({ useIndividualObjectives: enabled })}
              hideSwitch={levelsDecidedUpstream}
            />
          )}
        </div>
      )}
    </section>
  );
}

/**
 * La primera pantalla del paso: una pregunta, dos respuestas.
 *
 * Es deliberadamente más grande que las tarjetas que la sustituyen después.
 * Aquí no se está eligiendo una pestaña sino empezando el trabajo, y lo que
 * sigue a la respuesta no es un panel vacío: es el drawer que lo crea, ya
 * abierto en la pregunta siguiente.
 */
function AssignmentKickoff({
  onPick,
  onSkip,
}: {
  onPick: (mode: ObjectiveMode) => void;
  onSkip: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 px-6 py-12 cascade-enter">
      <div className="flex max-w-[56ch] flex-col items-center gap-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="size-6" strokeWidth={2} />
        </span>
        <h3 className="text-[18px] font-bold tracking-tight text-text-primary">
          ¿Cómo quieres crear los objetivos?
        </h3>
        <p className="text-[13px] leading-relaxed text-text-secondary">
          Puedes repartir un mismo set de objetivos a grupos enteros, o darle a cada persona los
          suyos. Elige por dónde empezar — después podrás usar las dos formas en el mismo ciclo.
        </p>
      </div>

      <div className="grid w-full max-w-[720px] gap-4 sm:grid-cols-2">
        <KickoffCard
          icon={Users2}
          title="Asignar a grupos"
          description="Un set compartido por un área, un equipo o cualquier grupo. Quien entre después lo hereda."
          example="Ej.: los mismos 3 objetivos para Marketing y Comercial"
          onClick={() => onPick("groups")}
        />
        <KickoffCard
          icon={UserRound}
          title="Asignar individualmente"
          description="Objetivos propios de cada persona, cuando lo que se mide cambia de una a otra."
          example="Ej.: la meta de ventas de cada ejecutivo"
          onClick={() => onPick("individual")}
        />
      </div>

      <button
        type="button"
        onClick={onSkip}
        className="rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-text-muted underline-offset-4 transition-colors hover:text-text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        Por ahora no asignaré objetivos
      </button>
    </div>
  );
}

function KickoffCard({
  icon: Icon,
  title,
  description,
  example,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
  example: string;
  onClick: () => void;
}) {
  return (
    <MagicCard
      onClick={onClick}
      tone="brand"
      className="w-full"
      contentClassName="flex-col items-start gap-3 h-full text-left w-full"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-105">
        <Icon className="size-5" strokeWidth={2.1} />
      </span>
      <div className="flex flex-col gap-1.5">
        <h4 className="text-[14px] font-bold tracking-tight text-text-primary">{title}</h4>
        <p className="text-[12.5px] leading-relaxed text-text-secondary">{description}</p>
      </div>
      <span className="mt-auto rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-medium text-text-muted">
        {example}
      </span>
    </MagicCard>
  );
}
