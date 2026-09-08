import * as React from "react";
import { toast } from "sonner";
import {
  Bell,
  BellRing,
  CalendarRange,
  ChartColumnIncreasing,
  Download,
  Info,
  Scale,
  SlidersHorizontal,
  Sparkles,
  Target,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  ActionRailShell,
  AnimatedActionItem,
  RailButton,
  RailDivider,
  RailPrimaryAction,
  RailSelectionChip,
  useContextChangeKey,
} from "@/components/action-rail";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { PopoverTitle } from "@/components/ui/popover";
import { CICLO_PERIOD_LABELS } from "@/components/ciclo-builder";
import { formatLongDate, formatPercent } from "@/components/ciclo-detail";
import { ObjetivosConfigDrawerWide } from "@/components/objetivos/ObjetivosConfigDrawerWide";
import { CreateMetricDrawer } from "./CreateMetricDrawer";
import { describeMetric } from "./metricDefinition";
import type { CicloResults } from "./resultsModel";

/**
 * La barra flotante de resultados.
 *
 * Hereda del reporte de encuestas lo que allá ya se probó —el grip, los
 * ajustes, el chip de selección, la descarga y la ficha de detalles bajo el
 * ícono de información— y cambia solo lo que este dominio pide: recordar una
 * aprobación es una acción que una encuesta no tiene, y aquí es la que
 * desatasca el ciclo.
 *
 * No trae "Vista previa": un ciclo cerrado no tiene nada que previsualizar.
 */

interface CicloResultsActionRailProps {
  results: CicloResults;
  selectedCount: number;
  /** Objetivos frenados en aprobación, con o sin selección. */
  blockedCount: number;
  onClearSelection: () => void;
  onDownload: (onlySelected: boolean) => void;
  onRemindProgress: () => void;
  onRemindApproval: () => void;
  onCreateObjectives: () => void;
}

export function CicloResultsActionRail({
  results,
  selectedCount,
  blockedCount,
  onClearSelection,
  onDownload,
  onRemindProgress,
  onRemindApproval,
  onCreateObjectives,
}: CicloResultsActionRailProps) {
  const [isConfigOpen, setIsConfigOpen] = React.useState(false);
  const [isMetricOpen, setIsMetricOpen] = React.useState(false);
  const mode = selectedCount === 0 ? "none" : "selected";
  const animKey = useContextChangeKey(mode);

  const contextual =
    selectedCount === 0 ? null : (
      <>
        <AnimatedActionItem animKey={animKey} staggerIndex={0} skipColorFlash>
          <RailSelectionChip count={selectedCount} onClear={onClearSelection} gender="m" />
        </AnimatedActionItem>
        <AnimatedActionItem animKey={animKey} staggerIndex={1} skipColorFlash>
          <RailDivider />
        </AnimatedActionItem>
        <AnimatedActionItem animKey={animKey} staggerIndex={2}>
          <RailButton
            icon={<BellRing className="h-[20px] w-[20px]" strokeWidth={2} />}
            label={`Recordar avance a los seleccionados (${selectedCount})`}
            onClick={onRemindProgress}
          />
        </AnimatedActionItem>
        <AnimatedActionItem animKey={animKey} staggerIndex={3}>
          <RailButton
            icon={<Download className="h-[20px] w-[20px]" strokeWidth={2} />}
            label={`Exportar seleccionados (${selectedCount})`}
            onClick={() => onDownload(true)}
          />
        </AnimatedActionItem>
      </>
    );

  return (
    <>
      <ActionRailShell
        keepOpen={selectedCount > 0 || isConfigOpen || isMetricOpen}
        contextual={contextual}
        persistent={
          selectedCount === 0 ? (
            <>
              {/* Lo primero de la barra es lo que desatasca el ciclo, no lo
                  que lo describe: mientras haya objetivos sin aprobar, ningún
                  otro número de esta pantalla se puede mover. */}
              {blockedCount > 0 && (
                <>
                  <RailButton
                    icon={<Bell className="h-[20px] w-[20px]" strokeWidth={2} />}
                    label={`Recordar aprobación · ${blockedCount} ${
                      blockedCount === 1 ? "objetivo" : "objetivos"
                    }`}
                    onClick={onRemindApproval}
                  />
                  <RailDivider />
                </>
              )}
              {/* Justo a la izquierda de la configuración: las dos cambian
                  qué se ve en el reporte en vez de actuar sobre el ciclo, y
                  quedan juntas por eso. */}
              <RailButton
                icon={<ChartColumnIncreasing className="h-[20px] w-[20px]" strokeWidth={2} />}
                label="Crear una métrica para este reporte"
                onClick={() => setIsMetricOpen(true)}
              />
              <RailButton
                icon={<SlidersHorizontal className="h-[20px] w-[20px]" strokeWidth={2} />}
                label="Configuración de estados, niveles y participantes"
                onClick={() => setIsConfigOpen(true)}
              />
              <CicloDetailsCard results={results} />
              <RailPrimaryAction
                icon={<Download className="h-4 w-4" strokeWidth={2.5} />}
                label="Descargar información"
                onClick={() => onDownload(false)}
              />
              {results.withoutObjectives.length > 0 && (
                <RailButton
                  icon={<UserPlus className="h-[20px] w-[20px]" strokeWidth={2} />}
                  label={`Crear objetivos · ${results.withoutObjectives.length} personas sin asignar`}
                  onClick={onCreateObjectives}
                />
              )}
            </>
          ) : null
        }
      />
      <ObjetivosConfigDrawerWide
        open={isConfigOpen}
        onOpenChange={setIsConfigOpen}
        initialTab="estados"
      />
      <CreateMetricDrawer
        open={isMetricOpen}
        onOpenChange={setIsMetricOpen}
        cicloName={results.data.name}
        onSubmit={(metric) =>
          toast.success("Métrica creada", {
            description: `"${metric.title.trim()}" — ${describeMetric(metric)}.`,
          })
        }
      />
    </>
  );
}

/**
 * Los hechos del ciclo bajo el ícono de información, igual que en el reporte
 * de una encuesta: lo último antes de sacar conclusiones es una revisión
 * rápida de con qué se están sacando.
 */
function CicloDetailsCard({ results }: { results: CicloResults }) {
  const { data } = results;
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label="Detalles del ciclo"
          className="dock-item relative flex h-10 w-10 items-center justify-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          <Info className="h-[20px] w-[20px]" strokeWidth={2} />
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="center"
        sideOffset={16}
        avoidCollisions={false}
        className="w-80 gap-0 rounded-2xl border border-white/10 bg-surface-nav p-4 shadow-rail"
      >
        <PopoverTitle className="text-[13px] font-semibold text-white">
          Detalles del ciclo
        </PopoverTitle>
        <div className="mb-3 mt-2 h-px bg-white/10" />
        <dl className="flex flex-col gap-2.5">
          <InfoRow icon={CalendarRange} label="Periodo" value={CICLO_PERIOD_LABELS[data.period]} />
          <InfoRow
            icon={CalendarRange}
            label="Fechas"
            value={`${formatLongDate(`${data.startDate}T12:00:00`)} – ${formatLongDate(
              `${data.endDate}T12:00:00`
            )}`}
          />
          <InfoRow icon={Users} label="Participantes" value={results.peopleCount} />
          <InfoRow icon={Target} label="Objetivos" value={results.objectiveCount} />
          <InfoRow icon={Sparkles} label="Avance general" value={formatPercent(results.overallPercent)} />
          <InfoRow
            icon={Scale}
            label="Resultados negativos"
            value={data.status === "closed" ? "Ciclo cerrado" : "Ciclo en curso"}
          />
        </dl>
      </HoverCardContent>
    </HoverCard>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-[13px] leading-none text-white/60">
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
        {label}
      </span>
      <span className="max-w-[60%] truncate text-right text-[12.5px] font-semibold leading-none text-white">
        {value}
      </span>
    </div>
  );
}
