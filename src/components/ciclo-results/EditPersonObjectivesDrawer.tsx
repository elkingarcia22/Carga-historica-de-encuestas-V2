import * as React from "react";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DrawerShell } from "@/components/overlays";
import { InitialsAvatar } from "@/components/ciclo-detail";
import {
  ObjectiveCardCompact,
  SetWeightSummary,
  distributeWeights,
  objectiveIssue,
  TOTAL_WEIGHT,
  type Objective,
} from "@/components/ciclo-builder";
import type { PersonResultRow } from "./resultsModel";

/**
 * Editar los objetivos de una persona sin salir de los resultados.
 *
 * La tarjeta es la misma del constructor —`ObjectiveCardCompact`, con sus
 * pasos numerados, su medida, su recorrido y su peso—: corregir un objetivo
 * en marcha y escribirlo por primera vez son la misma pregunta, y dos formas
 * distintas de contestarla acabarían discrepando en qué se puede pedir.
 *
 * Abre con los objetivos que se le pasen: todos los de la persona desde la
 * barra flotante, o uno solo cuando el gesto venía de una fila. La lista se
 * comporta como en el constructor —una tarjeta abierta a la vez, para que el
 * peso de las demás siga a la vista mientras se toca el de una—, así que en
 * los dos casos es el mismo drawer y no dos pantallas parecidas.
 *
 * Nada se escribe hasta "Guardar": el borrador vive aquí, y cerrar sin
 * guardar deja el ciclo exactamente como estaba.
 */
export function EditPersonObjectivesDrawer({
  row,
  companyObjectives,
  objectiveIds,
  open,
  onOpenChange,
  onSave,
}: {
  row: PersonResultRow | null;
  companyObjectives: readonly Objective[];
  /** Cuáles editar. Ausente —el caso de la barra— significa todos los suyos. */
  objectiveIds?: readonly string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Los objetivos editados, ya con sus cambios, en el orden en que se abrieron. */
  onSave: (objectives: readonly Objective[]) => void;
}) {
  const [draft, setDraft] = React.useState<readonly Objective[]>([]);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [showValidation, setShowValidation] = React.useState(false);

  // Los objetivos de la persona que este drawer NO edita. Su peso sigue
  // ocupando sitio en el 100 % del colaborador, así que entra en la cuenta
  // aunque sus tarjetas no estén en pantalla.
  const untouched = React.useMemo(() => {
    if (!row) return [] as readonly Objective[];
    const editing = new Set(draft.map((objective) => objective.id));
    return row.entries
      .map((entry) => entry.objective)
      .filter((objective) => !editing.has(objective.id));
  }, [row, draft]);

  const untouchedWeight = untouched.reduce((sum, objective) => sum + objective.weight, 0);
  const draftWeight = draft.reduce((sum, objective) => sum + objective.weight, 0);
  const total = untouchedWeight + draftWeight;

  /*
   * Cada apertura arranca de lo que hay hoy en el ciclo: un borrador viejo
   * propondría cifras de un objetivo que ya nadie está mirando. Con una sola
   * tarjeta se abre sola —es a lo que se entró—; con varias arrancan todas
   * cerradas, que es la lista del constructor.
   */
  const [seen, setSeen] = React.useState(open);
  if (seen !== open) {
    setSeen(open);
    if (open && row) {
      const wanted = objectiveIds ? new Set(objectiveIds) : null;
      const next = row.entries
        .map((entry) => entry.objective)
        .filter((objective) => (wanted ? wanted.has(objective.id) : true));
      setDraft(next);
      setExpandedId(next.length === 1 ? next[0].id : null);
      setShowValidation(false);
    }
  }

  const changeObjective = (id: string, patch: Partial<Objective>) =>
    setDraft((current) =>
      current.map((objective) => (objective.id === id ? { ...objective, ...patch } : objective))
    );

  /** Reparte entre las tarjetas abiertas lo que dejan libre las demás. */
  const distribute = () => {
    const budget = Math.max(0, TOTAL_WEIGHT - untouchedWeight);
    const weights = distributeWeights(draft.length, budget);
    setDraft((current) => current.map((objective, index) => ({ ...objective, weight: weights[index] })));
  };

  const firstIssue = draft.find((objective) =>
    objectiveIssue(objective, { requireWeight: true, requireAlignment: false })
  );

  const save = () => {
    if (firstIssue) {
      setShowValidation(true);
      setExpandedId(firstIssue.id);
      return;
    }
    onSave(draft);
    onOpenChange(false);
  };

  const count = draft.length;

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      size="5xl"
      // El mismo ancho que el drawer de asignaciones del constructor, porque
      // lleva la misma tarjeta: "Tipo de medida" y "Dirección" comparten fila
      // y por debajo de ~1000 px las opciones se aprietan hasta recortar sus
      // nombres. Pide 1280 px y cede solo donde no los hay.
      className="!w-[min(1280px,96vw)] !max-w-[min(1280px,96vw)]"
      title={count === 1 ? "Editar objetivo" : "Editar objetivos"}
      description={
        row
          ? `${row.collaborator.name} · ${count} ${count === 1 ? "objetivo" : "objetivos"} en edición`
          : undefined
      }
      // `footer` y no `actions`: el pie del shell apila en columna, y a este
      // ancho dos botones de lado a lado se leen como una barra de carga.
      footer={
        <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/30 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={count === 0}>
            {count > 1 ? `Guardar ${count} objetivos` : "Guardar"}
          </Button>
        </div>
      }
    >
      {row && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface-muted/40 px-3.5 py-3">
            <InitialsAvatar name={row.collaborator.name} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-text-primary">
                {row.collaborator.name}
              </p>
              <p className="truncate text-[12px] text-text-secondary">
                {row.area} · {row.leader}
              </p>
            </div>
          </div>

          {/* El peso solo significa algo como parte de un todo, y aquí el todo
              es el ciclo entero de la persona: los objetivos que este drawer no
              abrió siguen ocupando su parte. */}
          <SetWeightSummary total={total} count={count} onDistribute={distribute} />

          {count === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface-muted/30 px-6 py-10 text-center">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-surface text-text-secondary">
                <Target className="size-5" strokeWidth={2} />
              </span>
              <p className="text-[13.5px] font-semibold text-text-primary">
                Este colaborador no tiene objetivos que editar
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {draft.map((objective, index) => (
                <ObjectiveCardCompact
                  key={objective.id}
                  objective={objective}
                  position={index + 1}
                  variant="assigned"
                  scope="individual"
                  isExpanded={expandedId === objective.id}
                  onToggleExpanded={() =>
                    setExpandedId((current) => (current === objective.id ? null : objective.id))
                  }
                  onChange={(patch) => changeObjective(objective.id, patch)}
                  // Sacar un objetivo del ciclo no es corregirlo: se hace desde
                  // la barra flotante, con su propia confirmación.
                  onRemove={() => undefined}
                  canRemove={false}
                  showValidation={showValidation}
                  otherObjectivesWeight={total - objective.weight}
                  weightBudget={TOTAL_WEIGHT}
                  companyObjectives={companyObjectives}
                  cycleObjectives={draft.filter((other) => other.id !== objective.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </DrawerShell>
  );
}
