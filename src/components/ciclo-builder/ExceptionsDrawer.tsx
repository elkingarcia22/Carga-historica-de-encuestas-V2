import * as React from "react";
import { ArrowLeft, ChevronRight, Target, UserRound } from "lucide-react";
import { DrawerShell } from "@/components/overlays";
import { COLLABORATORS } from "@/mocks/collaborators";
import { type ObjectiveSet } from "./cicloBuilderTypes";

const PERSON_BY_ID = new Map(COLLABORATORS.map((person) => [person.id, person]));

export interface ExceptionsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quiénes se sacaron de esta agrupación porque ya llevan objetivos propios. */
  excludedIds: readonly string[];
  /** Todo lo repartido del ciclo: de ahí sale el set individual de cada quien. */
  allSets: readonly ObjectiveSet[];
}

/**
 * Quiénes son la excepción, y qué llevan en su lugar.
 *
 * Un mismo cajón, no dos: la lista de excepciones es la puerta y los
 * objetivos propios de cada una son el cuarto de al lado — "Volver" regresa
 * a la lista en vez de cerrar y tener que volver a abrir para ver a otra
 * persona.
 */
export function ExceptionsDrawer({
  open,
  onOpenChange,
  excludedIds,
  allSets,
}: ExceptionsDrawerProps) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // Cada apertura arranca en la lista: quedarse en el detalle de quien se
  // miró la última vez confundiría con quién se está viendo ahora.
  React.useEffect(() => {
    if (!open) setSelectedId(null);
  }, [open]);

  const selectedPerson = selectedId ? (PERSON_BY_ID.get(selectedId) ?? null) : null;

  const ownObjectives = React.useMemo(() => {
    if (!selectedId) return [];
    return allSets
      .filter((set) => set.kind === "individual" && set.targetIds.includes(selectedId))
      .flatMap((set) => set.objectives);
  }, [allSets, selectedId]);

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={
        selectedPerson
          ? selectedPerson.name
          : excludedIds.length === 1
            ? "1 excepción"
            : `${excludedIds.length} excepciones`
      }
      description={
        selectedPerson
          ? "Sus objetivos individuales: por esto se sacó de la agrupación."
          : "Personas del grupo que se sacaron de esta asignación porque llevan objetivos propios."
      }
    >
      {selectedId ? (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-[12.5px] font-semibold text-text-secondary transition-colors hover:bg-muted/40 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <ArrowLeft className="size-3.5" strokeWidth={2.4} />
            Volver a la lista
          </button>

          {ownObjectives.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-surface px-3 py-4 text-center text-[12px] text-text-secondary">
              Todavía no tiene objetivos individuales escritos.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border/50 overflow-hidden rounded-lg border border-border/60 bg-surface">
              {ownObjectives.map((objective, index) => (
                <li
                  key={objective.id}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-[12.5px]"
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[10.5px] font-bold tabular-nums text-text-secondary">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-text-primary">
                    {objective.title.trim() || "Objetivo sin título"}
                  </span>
                  <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-bold tabular-nums text-text-secondary">
                    {objective.weight} %
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border/50 overflow-hidden rounded-lg border border-border/60 bg-surface">
          {excludedIds.map((id) => {
            const person = PERSON_BY_ID.get(id);
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(id)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
                >
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                  >
                    <UserRound className="size-4" strokeWidth={2.2} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[12.5px] font-semibold text-text-primary">
                      {person?.name ?? "Colaborador"}
                    </span>
                    <span className="flex items-center gap-1 truncate text-[11px] font-medium text-text-muted">
                      <Target className="size-3 shrink-0" strokeWidth={2.2} />
                      {person?.area ?? "Sin área"}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-text-muted" strokeWidth={2.2} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </DrawerShell>
  );
}
