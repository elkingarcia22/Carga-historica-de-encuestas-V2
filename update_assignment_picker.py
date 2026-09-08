import re

with open("src/components/ciclo-builder/AssignmentPicker.tsx", "r") as f:
    content = f.read()

# Replace the whole file with the new content
new_content = """import * as React from "react";
import { motion } from "framer-motion";
import { Check, CheckIcon, Search, User, Users, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { MagicCard } from "@/components/ui/magic-card";
import { COLLABORATORS } from "@/mocks/collaborators";
import { formatCount } from "@/components/survey-builder";
import { GroupsPanel } from "@/components/survey-builder/ParticipantsEditor";
import { CollaboratorTable } from "@/components/survey-builder/CollaboratorTable";
import { groupMemberIds } from "@/components/survey-builder/participants";
import type { AssignmentMode, CicloAssignment } from "./cicloBuilderTypes";

interface AssignmentPickerProps {
  assignment: CicloAssignment;
  onChange: (patch: Partial<CicloAssignment>) => void;
  showValidation: boolean;
}

const MODE_COPY: Readonly<Record<AssignmentMode, { label: string; description: string }>> = {
  grupal: {
    label: "Objetivos grupales",
    description:
      "Un mismo set de objetivos para uno o varios grupos. Quien entre después al grupo los hereda.",
  },
  individual: {
    label: "Objetivos individuales",
    description:
      "Eliges a las personas una por una. Úsalo cuando lo que se mide cambia de persona a persona.",
  },
};

export function AssignmentPicker({ assignment, onChange, showValidation }: AssignmentPickerProps) {
  const modeError = showValidation && assignment.modes.length === 0;

  const toggleMode = (mode: AssignmentMode) => {
    onChange({
      modes: assignment.modes.includes(mode)
        ? assignment.modes.filter((m) => m !== mode)
        : [...assignment.modes, mode],
    });
  };

  const hasGrupal = assignment.modes.includes("grupal");
  const hasIndividual = assignment.modes.includes("individual");

  // Protect group selections when in individual mode
  const groupProtectedIds = React.useMemo(
    () => groupMemberIds(assignment.groupSegmentBy, assignment.groupIds),
    [assignment.groupSegmentBy, assignment.groupIds]
  );
  
  const groupLabelById = React.useMemo(() => {
    const map = new Map<string, string>();
    if (assignment.groupIds.length === 0) return map;
    const groups = new Set(assignment.groupIds);
    COLLABORATORS.forEach((person) => {
      const value = person[assignment.groupSegmentBy] ?? "Sin asignar";
      if (groups.has(value)) map.set(person.id, value);
    });
    return map;
  }, [assignment.groupSegmentBy, assignment.groupIds]);

  // Combine both groups for the individual selection list
  const individualEffectiveIds = React.useMemo(
    () => Array.from(new Set([...groupProtectedIds, ...assignment.userIds])),
    [groupProtectedIds, assignment.userIds]
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(MODE_COPY) as AssignmentMode[]).map((mode) => (
          <ModeCard
            key={mode}
            mode={mode}
            isSelected={assignment.modes.includes(mode)}
            hasError={modeError}
            state={describeModeState(mode, assignment)}
            onSelect={() => toggleMode(mode)}
          />
        ))}
      </div>

      {hasGrupal && (
        <div className="rounded-xl border border-border/60 bg-surface shadow-card overflow-hidden cascade-enter">
          <div className="bg-surface-muted px-6 py-4 border-b border-border/60">
            <h3 className="text-[14px] font-bold text-text-primary">Configuración de grupos</h3>
            <p className="text-[12.5px] text-text-secondary mt-0.5">Elige los grupos a evaluar de forma unificada.</p>
          </div>
          <div className="p-6">
            <GroupsPanel
              segmentBy={assignment.groupSegmentBy}
              onSegmentByChange={(groupSegmentBy) => onChange({ groupSegmentBy, groupIds: [] })}
              selectedGroups={assignment.groupIds}
              onToggleGroup={(value) => {
                onChange({
                  groupIds: assignment.groupIds.includes(value)
                    ? assignment.groupIds.filter(v => v !== value)
                    : [...assignment.groupIds, value]
                });
              }}
              onSelectAll={(values) => onChange({ groupIds: values })}
              onClearAll={() => onChange({ groupIds: [] })}
              autoInclude={assignment.groupsAutoInclude}
              onAutoIncludeChange={(groupsAutoInclude) => onChange({ groupsAutoInclude })}
            />
          </div>
        </div>
      )}

      {hasIndividual && (
        <div className="rounded-xl border border-border/60 bg-surface shadow-card overflow-hidden cascade-enter">
          <div className="bg-surface-muted px-6 py-4 border-b border-border/60">
            <h3 className="text-[14px] font-bold text-text-primary">Configuración individual</h3>
            <p className="text-[12.5px] text-text-secondary mt-0.5">Elige las personas que tendrán objetivos propios.</p>
          </div>
          <div className="p-0 border-x-0 border-b-0">
            <CollaboratorTable
              collaborators={COLLABORATORS}
              selectedIds={individualEffectiveIds}
              onChange={(userIds) => onChange({ userIds, groupIds: [] })}
              onToggleIndividual={(id) => {
                const next = new Set(assignment.userIds);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                onChange({ userIds: [...next] });
              }}
              groupProtectedIds={hasGrupal ? groupProtectedIds : new Set()}
              groupLabelFor={(id) => hasGrupal ? groupLabelById.get(id) ?? null : null}
              onDeselectGroup={(groupValue) => onChange({ groupIds: assignment.groupIds.filter(v => v !== groupValue) })}
              onKeepGroupRestIndividually={(groupValue, personId) => {
                const rest = COLLABORATORS.filter(c => c[assignment.groupSegmentBy] === groupValue && c.id !== personId).map(c => c.id);
                onChange({
                  groupIds: assignment.groupIds.filter(v => v !== groupValue),
                  userIds: Array.from(new Set([...assignment.userIds, ...rest]))
                });
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ModeCard({
  mode,
  isSelected,
  hasError,
  state,
  onSelect,
}: {
  mode: AssignmentMode;
  isSelected: boolean;
  hasError: boolean;
  state: string;
  onSelect: () => void;
}) {
  const { label, description } = MODE_COPY[mode];
  const Icon = mode === "grupal" ? UsersRound : User;

  return (
    <MagicCard
      isSelected={isSelected}
      onClick={onSelect}
      className={cn("w-full", hasError && !isSelected && "border-destructive/40")}
      contentClassName="h-full w-full flex-col gap-3 text-left"
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors",
            isSelected ? "bg-primary/10 text-primary" : "bg-muted/60 text-muted-foreground"
          )}
        >
          <Icon className="size-[18px]" strokeWidth={2} />
        </span>
        <span
          aria-hidden
          data-state={isSelected ? "checked" : "unchecked"}
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-xs border transition-colors",
            isSelected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input dark:bg-input/30"
          )}
        >
          {isSelected && <CheckIcon className="size-3.5" />}
        </span>
      </div>

      <div className="w-full">
        <h3
          className={cn(
            "text-[13px] font-bold leading-none tracking-tight",
            isSelected ? "text-text-primary" : "text-text-secondary"
          )}
        >
          {label}
        </h3>
        <p className="mt-1.5 text-[11px] font-medium leading-[1.35] text-text-muted">
          {description}
        </p>
      </div>

      <div className="mt-auto w-full pt-1">
        <span className="inline-flex rounded-full bg-surface-muted px-2 py-0.5 text-[9.5px] font-bold tracking-tight text-text-secondary">
          {state}
        </span>
      </div>
    </MagicCard>
  );
}

function describeModeState(mode: AssignmentMode, assignment: CicloAssignment): string {
  if (mode === "grupal") {
    const count = assignment.groupIds.length;
    if (count === 0) return "Ningún grupo seleccionado";
    const reach = groupMemberIds(assignment.groupSegmentBy, assignment.groupIds).size;
    return `${count} ${count === 1 ? "grupo" : "grupos"} · ${formatCount(reach)} personas`;
  }

  const count = assignment.userIds.length;
  if (count === 0) return "Sin seleccionar";
  return `${formatCount(count)} ${count === 1 ? "persona" : "personas"}`;
}
"""

with open("src/components/ciclo-builder/AssignmentPicker.tsx", "w") as f:
    f.write(new_content)
