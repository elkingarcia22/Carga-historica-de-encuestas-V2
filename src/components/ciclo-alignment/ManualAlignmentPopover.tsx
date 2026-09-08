import * as React from "react";
import { Check, ChevronLeft, ChevronRight, Plus, Search, Building2, Link2, Link2Off, Users2, UserRound } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SegmentedControl } from "@/components/selection/SegmentedControl";
import { RailButton } from "@/components/action-rail";
import { cn } from "@/lib/utils";
import type { CicloDraft } from "@/components/ciclo-builder";
import type { CompanyOption } from "./AlignmentNodeCard";
import type { ObjectiveRef, AlignmentNode } from "./alignmentGraph";
import { targetLabel } from "@/components/ciclo-builder";

interface ManualAlignmentPopoverProps {
  draft: CicloDraft;
  companyOptions: readonly CompanyOption[];
  selectedNode: AlignmentNode | undefined;
  onAlign: (refs: readonly ObjectiveRef[], companyObjectiveId: string | null) => void;
  onUnalign: (refs: readonly ObjectiveRef[]) => void;
}

export function ManualAlignmentPopover({
  draft,
  companyOptions,
  selectedNode,
  onAlign,
  onUnalign,
}: ManualAlignmentPopoverProps) {
  const [open, setOpen] = React.useState(false);
  
  const [step, setStep] = React.useState<0 | 1 | 2>(0);
  const [selectedSetId, setSelectedSetId] = React.useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = React.useState<string | null>(null);
  const [selectedObjectiveId, setSelectedObjectiveId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  const [activeTab, setActiveTab] = React.useState<"grupal" | "individual">("grupal");

  React.useEffect(() => {
    if (open) {
      setStep(0);
      setSelectedSetId(null);
      setSelectedTargetId(null);
      setSelectedObjectiveId(null);
      setSearch("");
      
      const hasGroups = draft.objectiveSets.some((s) => s.kind === "grupal");
      setActiveTab(hasGroups ? "grupal" : "individual");
    }
  }, [open, draft.objectiveSets]);

  const activeSets = draft.objectiveSets.filter((s) => s.kind === activeTab);
  
  const allTargets = React.useMemo(() => {
    return activeSets.flatMap((set) => 
      set.targetIds.map((targetId) => ({
        setId: set.id,
        targetId,
        label: targetLabel(set, targetId),
      }))
    );
  }, [activeSets]);

  const filteredTargets = allTargets.filter(t => t.label.toLowerCase().includes(search.toLowerCase()));

  const selectedSet = draft.objectiveSets.find((s) => s.id === selectedSetId);
  const selectedObjective = selectedSet?.objectives.find((o) => o.id === selectedObjectiveId);
  
  const handleDirectAlign = (companyId: string) => {
    if (selectedNode) {
      onAlign(selectedNode.objectiveRefs, companyId);
    }
    setOpen(false);
  };

  const handleWizardAlign = (companyId: string) => {
    if (selectedSetId && selectedObjectiveId && selectedTargetId) {
      const ref: ObjectiveRef = {
        setId: selectedSetId,
        targetId: selectedTargetId,
        objectiveId: selectedObjectiveId,
      };
      onAlign([ref], companyId);
    }
    setOpen(false);
  };

  const directNodeLinkedTo = (companyId: string) => {
    return selectedNode?.alignedTo.includes(companyId) ?? false;
  };

  const wizardNodeLinkedTo = (companyId: string) => {
    if (!selectedObjective) return false;
    return selectedObjective.companyObjectiveId === companyId;
  };

  const renderContent = () => {
    if (selectedNode) {
      if (selectedNode.objectiveRefs.length === 0) {
        return (
          <div className="p-4 text-center text-[12px] text-text-secondary">
            Esta tarjeta no se puede alinear. Selecciona una tarjeta de origen, grupo o persona.
          </div>
        );
      }
      return (
        <div className="flex flex-col gap-0.5 p-1.5">
          <p className="px-2 pb-1.5 pt-1 text-[11px] font-semibold text-text-muted">
            Contribuye a…
          </p>
          <div className="flex max-h-[280px] flex-col gap-0.5 overflow-y-auto">
            {companyOptions.map((option) => {
              const isLinked = directNodeLinkedTo(option.id);
              return (
                <button
                  key={option.id}
                  onClick={() => handleDirectAlign(option.id)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-text-primary transition-colors hover:bg-surface-muted"
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full border",
                      isLinked ? "border-transparent bg-primary text-white" : "border-border"
                    )}
                  >
                    {isLinked && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{option.title}</span>
                </button>
              );
            })}
          </div>
          {selectedNode.alignedTo.length > 0 && (
            <>
              <div className="my-1 h-px bg-border/70" />
              <button
                type="button"
                onClick={() => {
                  onUnalign(selectedNode.objectiveRefs);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-text-secondary transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Link2Off className="size-3.5" strokeWidth={2.2} />
                Quitar alineación
              </button>
            </>
          )}
        </div>
      );
    }

    if (step === 0) {
      const hasGroups = draft.objectiveSets.some((s) => s.kind === "grupal");
      const hasIndividuals = draft.objectiveSets.some((s) => s.kind === "individual");

      return (
        <div className="flex flex-col gap-2 p-3">
          <div className="flex items-center gap-2 pb-1">
            <h4 className="flex-1 text-[13px] font-bold text-text-primary">¿A quién quieres alinear?</h4>
          </div>
          
          {hasGroups && hasIndividuals && (
            <SegmentedControl
              options={[
                { value: "grupal", label: "Grupos", icon: Users2 },
                { value: "individual", label: "Colaboradores", icon: UserRound },
              ]}
              value={activeTab}
              onChange={(v) => { setActiveTab(v as any); setSearch(""); }}
              size="sm"
            />
          )}

          <div className="relative mt-1">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" strokeWidth={2.2} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="h-8 w-full rounded-lg border border-border/70 bg-surface pl-8 pr-3 text-[12px] font-medium text-text-primary placeholder:text-text-muted focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="mt-1 flex max-h-[220px] flex-col gap-0.5 overflow-y-auto">
            {filteredTargets.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-text-muted">No hay resultados</p>
            ) : (
              filteredTargets.map((t) => (
                <button
                  key={`${t.setId}-${t.targetId}`}
                  onClick={() => {
                    setSelectedSetId(t.setId);
                    setSelectedTargetId(t.targetId);
                    setStep(1);
                  }}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-text-primary hover:bg-surface-muted"
                >
                  <span className="truncate">{t.label}</span>
                  <ChevronRight className="size-3.5 text-text-muted" strokeWidth={2.4} />
                </button>
              ))
            )}
          </div>
        </div>
      );
    }

    if (step === 1) {
      if (!selectedSet) return null;
      return (
        <div className="flex flex-col gap-2 p-3">
          <div className="flex items-center gap-2 pb-1">
            <button onClick={() => setStep(0)} className="rounded p-1 text-text-muted hover:bg-surface-muted hover:text-text-primary">
              <ChevronLeft className="size-4" strokeWidth={2.5} />
            </button>
            <h4 className="flex-1 truncate text-[13px] font-bold text-text-primary">¿Qué objetivo?</h4>
          </div>
          <div className="flex max-h-[260px] flex-col gap-0.5 overflow-y-auto">
            {selectedSet.objectives.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-text-muted">Este ente no tiene objetivos asignados</p>
            ) : (
              selectedSet.objectives.map((obj) => (
                <button
                  key={obj.id}
                  onClick={() => {
                    setSelectedObjectiveId(obj.id);
                    setStep(2);
                  }}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-text-primary hover:bg-surface-muted"
                >
                  <span className="truncate">{obj.title.trim() || "Objetivo sin título"}</span>
                  <ChevronRight className="size-3.5 text-text-muted" strokeWidth={2.4} />
                </button>
              ))
            )}
          </div>
        </div>
      );
    }

    if (step === 2) {
      return (
        <div className="flex flex-col gap-0.5 p-1.5">
          <div className="flex items-center gap-2 px-2 pb-1.5 pt-1">
            <button onClick={() => setStep(1)} className="rounded p-1 text-text-muted hover:bg-surface-muted hover:text-text-primary">
              <ChevronLeft className="size-4" strokeWidth={2.5} />
            </button>
            <p className="flex-1 text-[11px] font-semibold text-text-muted">
              Contribuye a…
            </p>
          </div>
          <div className="flex max-h-[280px] flex-col gap-0.5 overflow-y-auto">
            {companyOptions.map((option) => {
              const isLinked = wizardNodeLinkedTo(option.id);
              return (
                <button
                  key={option.id}
                  onClick={() => handleWizardAlign(option.id)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-text-primary transition-colors hover:bg-surface-muted"
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full border",
                      isLinked ? "border-transparent bg-primary text-white" : "border-border"
                    )}
                  >
                    {isLinked && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{option.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div>
          <RailButton
            icon={<Link2 className="h-[20px] w-[20px]" strokeWidth={2} />}
            label="Crear alineación"
            onClick={() => {}}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent align="center" side="top" sideOffset={16} className="w-[280px] p-0 shadow-lg">
        {renderContent()}
      </PopoverContent>
    </Popover>
  );
}
