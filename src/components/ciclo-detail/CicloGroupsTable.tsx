import * as React from "react";
import { ArrowUpRight, UserRound, UsersRound } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Objective } from "@/components/ciclo-builder";
import type { NivelDesempenoConfig } from "@/components/objetivos/objetivosConfigStore";
import type { GroupRow } from "./cicloProgress";
import { ComplianceBar, DistributionBar, EstadoChip } from "./StatusChips";
import { GroupObjectivesList } from "./ObjectiveProgressList";
import { ExpandButton, HeaderCell } from "./tablePieces";
import { formatCount } from "./tableUtils";

interface CicloGroupsTableProps {
  groups: readonly GroupRow[];
  niveles: readonly NivelDesempenoConfig[];
  companyObjectives: readonly Objective[];
  /** Lleva a la pestaña de colaboradores filtrada por este grupo. */
  onViewPeople: (groupLabel: string) => void;
}

/**
 * "Por grupos": la misma tabla del paso de asignación del builder, ahora con
 * resultados. Una fila por grupo con su promedio, su estado y cómo se
 * reparten sus colaboradores entre los niveles de desempeño; abierta, los
 * objetivos del grupo con cuántos los van cumpliendo.
 */
export function CicloGroupsTable({
  groups,
  niveles,
  companyObjectives,
  onViewPeople,
}: CicloGroupsTableProps) {
  const [expandedIds, setExpandedIds] = React.useState<ReadonlySet<string>>(
    () => new Set(groups.length > 0 ? [groups[0].id] : [])
  );

  const toggle = (id: string) =>
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const totalPeople = groups.reduce((sum, group) => sum + group.rows.length, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-bold text-text-primary">Grupos del ciclo</h3>
          <Badge variant="neutral" className="h-5 px-1.5 text-[11px] font-semibold tabular-nums">
            {groups.length}
          </Badge>
        </div>
        <p className="text-[12px] text-text-muted">
          {formatCount(totalPeople)} colaboradores en total · el avance de un grupo es el promedio de los suyos
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60">
        <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/60 bg-muted/40 hover:bg-muted/40">
                <HeaderCell className="min-w-[260px] pl-5">Grupo</HeaderCell>
                <HeaderCell className="text-right">Colaboradores</HeaderCell>
                <HeaderCell className="text-right">Objetivos</HeaderCell>
                <HeaderCell className="min-w-[180px]">Avance promedio</HeaderCell>
                <HeaderCell>Estado</HeaderCell>
                <HeaderCell className="min-w-[200px]">Niveles de desempeño</HeaderCell>
                <HeaderCell className="w-[180px] pr-5 text-right">
                  <span className="sr-only">Acciones</span>
                </HeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => {
                const isExpanded = expandedIds.has(group.id);
                const Icon = group.kind === "grupal" ? UsersRound : UserRound;
                const segments = niveles.map((nivel) => ({
                  id: nivel.id,
                  label: nivel.nombre,
                  count: group.nivelCounts.get(nivel.id) ?? 0,
                  color: nivel.colorHex,
                }));
                return (
                  <React.Fragment key={group.id}>
                    <TableRow
                      onClick={() => toggle(group.id)}
                      className={cn(
                        "cursor-pointer border-border/60 transition-colors hover:bg-muted/30",
                        isExpanded && "bg-primary/[0.03] hover:bg-primary/[0.04]"
                      )}
                    >
                      <TableCell className="py-3.5 pl-5 pr-3">
                        <span className="flex min-w-0 items-center gap-3">
                          <span
                            className={cn(
                              "flex size-9 shrink-0 items-center justify-center rounded-xl",
                              group.kind === "grupal" ? "bg-primary/10 text-primary" : "bg-surface-muted text-text-secondary"
                            )}
                          >
                            <Icon className="size-[18px]" strokeWidth={2.2} />
                          </span>
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-[13px] font-bold text-text-primary">{group.label}</span>
                            <span className="truncate text-[11.5px] text-text-muted">
                              {group.kind === "individual"
                                ? "Personas con objetivos propios"
                                : group.sharedWith.length > 0
                                  ? `Comparte objetivos con ${group.sharedWith.join(", ")}`
                                  : "Asignación propia del grupo"}
                            </span>
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-right text-[13px] font-semibold tabular-nums text-text-primary">
                        {formatCount(group.rows.length)}
                      </TableCell>
                      <TableCell className="px-3 py-3.5 text-right text-[13px] font-semibold tabular-nums text-text-primary">
                        {group.objectives.length}
                      </TableCell>
                      <TableCell className="px-3 py-3.5">
                        <ComplianceBar percent={group.percent} estado={group.estado} />
                      </TableCell>
                      <TableCell className="px-3 py-3.5">
                        <EstadoChip estado={group.estado} />
                      </TableCell>
                      <TableCell className="px-3 py-3.5">
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>
                            <span className="block w-full cursor-default py-1">
                              <DistributionBar segments={segments} />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="p-3">
                            <ul className="flex flex-col gap-1.5">
                              {segments.map((segment) => (
                                <li key={segment.id} className="flex items-center justify-between gap-4 text-[12px]">
                                  <span className="flex items-center gap-2">
                                    <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: segment.color }} />
                                    {segment.label}
                                  </span>
                                  <span className="font-bold tabular-nums">{formatCount(segment.count)}</span>
                                </li>
                              ))}
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="py-3.5 pl-3 pr-5">
                        <span className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onViewPeople(group.kind === "individual" ? "Individual" : group.label);
                            }}
                            className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                          >
                            Ver colaboradores
                            <ArrowUpRight className="size-3.5" strokeWidth={2.4} />
                          </button>
                          <ExpandButton
                            expanded={isExpanded}
                            onClick={() => toggle(group.id)}
                            label={isExpanded ? "Ocultar objetivos" : "Ver objetivos"}
                          />
                        </span>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="border-border/60 bg-surface-muted/30 hover:bg-surface-muted/30">
                        <TableCell colSpan={7} className="p-0">
                          <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                            className="overflow-x-auto px-4 pb-4 pt-3"
                          >
                            <GroupObjectivesList items={group.objectives} companyObjectives={companyObjectives} />
                          </motion.div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
