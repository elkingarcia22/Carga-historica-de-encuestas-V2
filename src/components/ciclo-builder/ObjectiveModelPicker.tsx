import * as React from "react";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { toneChip } from "@/lib/tone";
import { Button } from "@/components/ui/button";
import { ObjectiveOptionCard } from "./ObjectiveOptionCard";
import { ObjectiveModelDrawer } from "./ObjectiveModelDrawer";
import {
  OBJECTIVE_MODEL_META,
  OBJECTIVE_MODEL_ORDER,
  isObjectiveModelAdjusted,
  objectiveModelPreset,
  objectiveModelVocab,
  summarizeObjectiveModelRules,
  type ObjectiveModelId,
  type ObjectiveModelRules,
} from "./objectiveModel";

interface ObjectiveModelPickerProps {
  model: ObjectiveModelId | null;
  rules: ObjectiveModelRules;
  /** Un solo callback: el modelo y sus reglas siempre viajan juntos. */
  onChange: (model: ObjectiveModelId, rules: ObjectiveModelRules) => void;
  error?: string;
}

/**
 * Con qué gramática se escriben los objetivos del ciclo.
 *
 * Seis tarjetas en una fila, la misma hilera que el periodo un poco más
 * abajo. Nada las explica al pasar el cursor: una tarjeta que además abre
 * un panel al rozarla convierte recorrer la fila con el ratón en una
 * sucesión de cosas que aparecen y tapan lo de al lado.
 *
 * Toda la explicación vive donde se toma la decisión. Tocar una tarjeta no
 * la cierra: abre el drawer del modelo, que es donde se ve entero lo que
 * trae —cómo se arma un objetivo, uno de ejemplo, sus seis reglas— y se
 * puede cambiar cualquiera antes de aceptarlo. Elegir OKR decide qué se le
 * pedirá a cada objetivo del ciclo durante meses, y eso merece una
 * confirmación, no un clic.
 */
export function ObjectiveModelPicker({ model, rules, onChange, error }: ObjectiveModelPickerProps) {
  // Qué modelo está mirando el drawer. Puede no ser el del ciclo: es el que
  // se acaba de tocar y todavía no se acepta. `session` cuenta las aperturas
  // y va en la `key` del drawer, así cada vez que se abre estrena borrador —
  // cancelar no puede dejar rastros para la próxima.
  const [pending, setPending] = React.useState<ObjectiveModelId | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [session, setSession] = React.useState(0);

  const openModel = (next: ObjectiveModelId) => {
    setPending(next);
    setSession((current) => current + 1);
    setIsDrawerOpen(true);
  };

  // El drawer abre con el preset del modelo tocado. "Personalizado" y el
  // modelo que ya está puesto abren con las reglas que el ciclo tiene, para
  // no deshacer ajustes al volver a mirarlas.
  const pendingRules =
    pending === null
      ? rules
      : pending === model || pending === "custom"
        ? rules
        : (objectiveModelPreset(pending) ?? rules);

  const meta = model ? OBJECTIVE_MODEL_META[model] : null;
  const vocab = objectiveModelVocab(model, rules);
  const facts = summarizeObjectiveModelRules(rules, vocab);
  const isAdjusted = model !== null && isObjectiveModelAdjusted(model, rules);

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {OBJECTIVE_MODEL_ORDER.map((option) => (
          <ObjectiveOptionCard
            key={option}
            icon={OBJECTIVE_MODEL_META[option].icon}
            tone={OBJECTIVE_MODEL_META[option].tone}
            label={OBJECTIVE_MODEL_META[option].label}
            tagline={OBJECTIVE_MODEL_META[option].tagline}
            align="center"
            isSelected={model === option}
            onClick={() => openModel(option)}
            hasError={Boolean(error)}
            className="min-h-[96px] p-2.5"
          />
        ))}
      </div>

      {error && <span className="mt-1.5 text-[12px] text-destructive">{error}</span>}

      {/* Una vez elegido, el paso no repite la explicación: dice con qué
          modelo va el ciclo y deja la puerta abierta a sus ajustes. */}
      {meta && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-border/60 bg-surface-muted/50 px-3.5 py-2.5">
          <span
            aria-hidden
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-lg",
              !meta.tone && "bg-primary/10 text-primary"
            )}
            style={meta.tone ? toneChip(meta.tone) : undefined}
          >
            <meta.icon className="size-3.5" strokeWidth={2.2} />
          </span>
          <span className="flex items-center gap-1.5 text-[12.5px] text-text-secondary">
            Este ciclo usa{" "}
            <span className="font-semibold text-text-primary">
              {model === "custom" ? "un modelo propio" : meta.label}
            </span>
            {/* Afinado pero no roto: sigue siendo el modelo, y el paso lo dice
                sin obligar a abrir el drawer para enterarse. */}
            {isAdjusted && (
              <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-text-secondary ring-1 ring-inset ring-border">
                Ajustado
              </span>
            )}
          </span>
          <span aria-hidden className="hidden h-4 w-px bg-border sm:block" />
          <dl className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-4 gap-y-1">
            {facts.slice(0, 3).map((fact) => (
              <div key={fact.label} className="flex min-w-0 items-baseline gap-1.5">
                <dt className="text-[11px] text-muted-foreground">{fact.label}</dt>
                <dd className="text-[12px] font-semibold text-text-primary">{fact.value}</dd>
              </div>
            ))}
          </dl>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => openModel(model!)}
            className="shrink-0 text-text-secondary hover:text-text-primary"
          >
            <SlidersHorizontal data-icon="inline-start" />
            Ver ajustes
          </Button>
        </div>
      )}

      {pending && (
        // Se queda montado al cerrarse para no cortarle la animación de
        // salida; la `key` es la que garantiza el borrador limpio.
        <ObjectiveModelDrawer
          key={`${pending}-${session}`}
          open={isDrawerOpen}
          onOpenChange={setIsDrawerOpen}
          model={pending}
          rules={pendingRules}
          isApplied={pending === model}
          onConfirm={onChange}
        />
      )}
    </div>
  );
}
