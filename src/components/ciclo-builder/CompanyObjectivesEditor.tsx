import * as React from "react";
import { Building2, Plus, Target } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ObjectiveCardCompact } from "./ObjectiveCardCompact";
import { AiObjectiveComposer, type AiComposerMode, type AiReviewActions } from "./AiObjectiveComposer";
import { AiTriggerButton } from "./AiObjectiveControls";
import { MAX_AI_OBJECTIVES } from "./aiObjectiveBrief";
import type { Objective } from "./cicloBuilderTypes";

interface CompanyObjectivesEditorProps {
  objectives: readonly Objective[];
  expandedIds: ReadonlySet<string>;
  onToggleExpanded: (id: string) => void;
  onChange: (id: string, patch: Partial<Objective>) => void;
  onAdd: () => void;
  /** Los objetivos que la IA propuso y el autor aceptó, ya completos. */
  onAddFromAI: (objectives: Objective[]) => void;
  /** Sube al ciclo si el generador de IA está trabajando ahora mismo, para
   * que la barra de acciones se bloquee mientras dura. */
  onAiWorkingChange?: (isWorking: boolean) => void;
  /** Sube las cuatro salidas de la revisión de una tanda de IA (o `null`
   * cuando no aplica) para que la barra de acciones del constructor las
   * muestre en vez de la propia tarjeta. */
  onReviewActionsChange?: (actions: AiReviewActions | null) => void;
  onRemove: (id: string) => void;
  /** Quita varios objetivos de una vez, en un solo cambio de estado: lo que
   * usa la tarjeta de IA para deshacer una tanda entera al descartarla,
   * regenerarla o volver a las preguntas. */
  onRemoveMany: (ids: readonly string[]) => void;
  showValidation: boolean;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  composerMode: AiComposerMode | null;
  onComposerModeChange: (mode: AiComposerMode | null) => void;
}

/**
 * The company-level objectives everything else in the ciclo hangs from.
 *
 * They are built with exactly the same card as the assigned ones — same
 * questions, same explanations — minus the weight, because a company objective
 * is not something one person is scored against. Keeping the two identical is
 * deliberate: the author learns the objective form once, on the three or four
 * objectives that matter most, and then already knows it when they get to the
 * step that hands objectives out.
 *
 * El generador de IA entra por la misma puerta y ocupa el mismo hueco que la
 * creación manual: donde estaría la tarjeta que se abre al pulsar "crear
 * manualmente" aparece la que hace las preguntas del brief. No es un modal
 * ni un panel aparte porque no es otra tarea, es la misma con las respuestas
 * rellenas por otro.
 */
export function CompanyObjectivesEditor({
  objectives,
  expandedIds,
  onToggleExpanded,
  onChange,
  onAdd,
  onAddFromAI,
  onAiWorkingChange,
  onReviewActionsChange,
  onRemove,
  onRemoveMany,
  showValidation,
  enabled,
  onEnabledChange,
  composerMode,
  onComposerModeChange,
}: CompanyObjectivesEditorProps) {
  // Los objetivos de empresa no llevan peso, así que el único tope es que
  // sigan siendo "los dos o tres resultados del ciclo" y no una lista.
  const remaining = Math.max(1, MAX_AI_OBJECTIVES - objectives.length);

  // Los que ya existían antes de abrir el generador: mientras dura esa
  // experiencia se quitan de la vista, así la atención queda solo en la
  // tanda que la IA está armando y revisando. Se capturan una vez al abrir
  // —no en cada render— porque lo que entra durante la revisión (la propia
  // tanda nueva) sí debe verse.
  const [hiddenWhileComposing, setHiddenWhileComposing] = React.useState<ReadonlySet<string> | null>(
    null
  );
  React.useEffect(() => {
    setHiddenWhileComposing(
      composerMode === null ? null : new Set(objectives.map((objective) => objective.id))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composerMode]);

  const visibleObjectives = hiddenWhileComposing
    ? objectives.filter((objective) => !hiddenWhileComposing.has(objective.id))
    : objectives;
  const isEmpty = visibleObjectives.length === 0;

  const composer =
    composerMode === null ? null : (
      <AiObjectiveComposer
        mode={composerMode}
        onConfirm={onAddFromAI}
        onCancel={() => onComposerModeChange(null)}
        onRemoveObjectives={onRemoveMany}
        maxCount={remaining}
        scopeLabel="de la empresa"
        onWorkingChange={onAiWorkingChange}
        onReviewActionsChange={onReviewActionsChange}
      />
    );

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-4 self-start">
      <header className="rounded-2xl border border-border/60 bg-surface shadow-card">
        <div className="flex items-start gap-3 px-6 py-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="size-[18px]" strokeWidth={2.2} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <h2 className="truncate text-[15px] font-bold tracking-tight text-text-primary">
                Objetivos de la empresa
              </h2>
              {enabled && objectives.length > 0 && (
                <span className="shrink-0 rounded-full bg-status-positive/10 px-2.5 py-1 text-[12px] font-semibold tabular-nums text-status-positive">
                  {objectives.length === 1 ? "1 objetivo" : `${objectives.length} objetivos`}
                </span>
              )}
            </div>
            <p className="text-[13px] leading-relaxed text-text-secondary">
              Los resultados de la compañía en este ciclo. No se asignan a nadie:
              los demás objetivos pueden alinearse a ellos.
            </p>
          </div>

          <label className="ml-4 flex shrink-0 cursor-pointer items-center gap-2 text-[12px] font-medium text-text-primary mt-1">
            <span>Usar objetivos de empresa</span>
            <Switch
              checked={enabled}
              onCheckedChange={onEnabledChange}
              aria-label="Usar objetivos de empresa"
              className="data-[state=checked]:bg-status-positive"
            />
          </label>
        </div>
      </header>

      {/* Posición fija, ajena a si la lista está vacía: la generación mete
          objetivos en la lista de verdad sin cerrar la tarjeta, y si esta
          viviera dentro de la rama de "vacío" perdería su estado —fase,
          brief, la tanda pendiente de revisión— en cuanto isEmpty pasa a
          false a mitad de esa misma generación. */}
      {enabled && composer}

      {enabled && isEmpty && composerMode === null && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface px-6 py-12 text-center">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-surface-muted text-text-secondary">
            <Target className="size-5" strokeWidth={2} />
          </span>
          <p className="text-[14px] font-semibold text-text-primary">
            Todavía no hay objetivos de la empresa
          </p>
          <p className="max-w-[46ch] text-[12.5px] leading-relaxed text-text-secondary">
            Empieza por el resultado más importante del ciclo. Te vamos guiando campo por
            campo, no necesitas saber la terminología.
          </p>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2.5">
            <AddButton onClick={onAdd} label="Crear manualmente" />
            <AiTriggerButton
              label="Crear objetivos con IA"
              onClick={() => onComposerModeChange("set")}
              animated={false}
            />
          </div>
        </div>
      )}

      {enabled && !isEmpty && (
        <>
          <div className="flex flex-col gap-3">
            {objectives.map((objective, index) => {
              // El índice se calcula sobre la lista completa y no sobre la
              // visible, para que el número no salte cuando el generador se
              // cierra y los ocultos vuelven a aparecer.
              if (hiddenWhileComposing?.has(objective.id)) return null;
              return (
              <ObjectiveCardCompact
                key={objective.id}
                objective={objective}
                position={index + 1}
                variant="company"
                scope="empresa"
                isExpanded={expandedIds.has(objective.id)}
                onToggleExpanded={() => onToggleExpanded(objective.id)}
                onChange={(patch) => onChange(objective.id, patch)}
                onRemove={() => onRemove(objective.id)}
                canRemove={true}
                showValidation={showValidation}
              />
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 items-center justify-center gap-2 self-start rounded-xl border border-border px-4 text-[13px] font-semibold text-text-secondary hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <Plus className="size-4" strokeWidth={2.4} />
      {label}
    </button>
  );
}
