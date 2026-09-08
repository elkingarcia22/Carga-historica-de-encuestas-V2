import { Users2, UserRound } from "lucide-react";
import { ObjectiveOptionCard } from "./ObjectiveOptionCard";
import { CicloField } from "./CicloField";

interface AssignmentConfigStepProps {
  useGroups: boolean;
  useIndividual: boolean;
  onChange: (groups: boolean, individual: boolean) => void;
}

/**
 * HR-only step: decides which assignment types the ciclo will use.
 *
 * Rendered as two `ObjectiveOptionCard`s — the same component used for
 * creator and period choices in `CicloGeneralEditor` — so the step reads as
 * one more choice in the same language. Both can be active simultaneously
 * (multi-select), so each card toggles independently rather than enforcing
 * mutual exclusion. Continuing is handled by the floating rail, exactly like
 * every other step.
 */
export function AssignmentConfigStep({
  useGroups,
  useIndividual,
  onChange,
}: AssignmentConfigStepProps) {
  return (
    <section className="flex min-w-0 flex-1 flex-col self-start rounded-2xl border border-border/60 bg-surface p-6 shadow-card">
      <header className="mb-5 flex flex-col gap-1.5">
        <h2 className="text-[16px] font-bold tracking-tight text-text-primary">
          ¿Quieres agregar objetivos asignados?
        </h2>
        <p className="text-[13px] leading-relaxed text-text-secondary">
          Además de los objetivos de la empresa, puedes repartir objetivos a grupos o a personas
          concretas. Elige uno, los dos, o ninguno —el ciclo funciona igual solo con los objetivos
          de empresa.
        </p>
      </header>

      <CicloField label="Tipo de asignación">
        <div className="grid grid-cols-2 gap-2">
          <ObjectiveOptionCard
            icon={Users2}
            label="Por grupos"
            tagline="Un set compartido por todo un área o equipo"
            isSelected={useGroups}
            onClick={() => onChange(!useGroups, useIndividual)}
            className="min-h-[92px] p-2.5"
            align="center"
          />
          <ObjectiveOptionCard
            icon={UserRound}
            label="Por colaborador"
            tagline="Objetivos propios de cada persona"
            isSelected={useIndividual}
            onClick={() => onChange(useGroups, !useIndividual)}
            className="min-h-[92px] p-2.5"
            align="center"
          />
        </div>
      </CicloField>

      {!useGroups && !useIndividual && (
        <p className="mt-2 text-[12px] leading-relaxed text-text-secondary">
          Si no eliges ninguna opción, el ciclo solo tendrá objetivos de empresa.
        </p>
      )}
    </section>
  );
}
