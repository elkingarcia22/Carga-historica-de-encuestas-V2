import * as React from "react";
import { Share2, Target, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { MiniMetricCard } from "@/components/survey-results/MiniMetricCard";
import { RingGauge } from "@/components/survey-analytics/pulseCharts";
import { MeterList, RankedBarList } from "@/components/survey-analytics/compositionCharts";
import {
  DistributionBar,
  EstadoChip,
  InitialsAvatar,
  NivelChip,
  formatPercent,
} from "@/components/ciclo-detail";
import type { ObjetivoEstadoConfig } from "@/components/objetivos/objetivosConfigStore";
import type { Objective } from "@/components/ciclo-builder";
import { ParticipanteChip, RiskChip } from "./ResultsChips";
import type { PersonResultRow } from "./resultsModel";

/**
 * El encabezado de la ficha de una persona: tres lecturas en una franja.
 *
 * Antes era una columna lateral a la altura del panel entero, y esa altura no
 * la pedía el contenido —la pedía el hueco—: tres cifras y dos repartos
 * estirados hasta el pie de la ventana, robándole el ancho a la tabla que sí
 * lo necesita. Puestas arriba en una fila, ocupan lo que miden y el detalle se
 * queda con la ventana completa.
 *
 * Son las mismas tarjetas de KPI del home y de las pestañas del reporte
 * (`MiniMetricCard` en su talla compacta): franja de acento junto al título,
 * la cifra grande neutra, una línea que dice de qué es, y el gráfico en el
 * tono de la tarjeta. Lo que el reporte hace con el ciclo entero, esta franja
 * lo hace con una persona.
 *
 * El desglose de cada cifra —objetivo por objetivo, banda por banda, frente
 * por frente— no desapareció al encoger las tarjetas: vive detrás del hover
 * de cada una. Una tarjeta contesta "¿cómo va?" de un vistazo; su hover
 * contesta "¿de dónde sale ese número?" sin gastar alto en quien no lo
 * pregunta.
 */
export function PersonSummaryStrip({
  row,
  companyObjectives,
  estados,
  showsRisk,
  className,
}: {
  row: PersonResultRow;
  companyObjectives: readonly Objective[];
  /** Las bandas de cumplimiento del ciclo, para el reparto de sus objetivos. */
  estados: readonly ObjetivoEstadoConfig[];
  showsRisk: boolean;
  className?: string;
}) {
  const objectives = describeObjectives(row, estados);
  const impact = describeImpact(row, companyObjectives);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Quién es y cómo quedó calificado, en un renglón. El nombre, el área y
          el líder ya los dice la cabecera del panel: repetirlos aquí sería
          gastar la primera línea en algo que el lector acaba de leer. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <InitialsAvatar name={row.collaborator.name} size="sm" />
        <span className="min-w-0 truncate text-[12px] text-text-muted">
          {row.collaborator.email}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ParticipanteChip estado={row.estadoParticipante} />
          <NivelChip nivel={row.nivel} />
          {showsRisk && <RiskChip risk={row.risk} />}
        </div>
      </div>

      {!row.counts && (
        <p className="rounded-lg border border-border/60 bg-surface-muted px-3 py-2 text-[11.5px] leading-relaxed text-text-secondary">
          Su estado de participante no cuenta en los resultados: aparece en las listas, pero queda
          fuera de promedios, rankings y distribuciones.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricWithDetail
          detail={
            <DetailPanel
              title="Cómo se compone el avance"
              hint="El promedio de sus objetivos activos, pesado por el peso de cada uno. Un objetivo inactivo no entra ni en el promedio ni en el peso."
            >
              <ObjectiveBreakdown row={row} />
            </DetailPanel>
          }
        >
          <MiniMetricCard
            size="compact"
            icon={TrendingUp}
            label="Avance ponderado"
            color={row.estado?.colorHex}
            value={formatPercent(row.percent)}
            valueAside={row.estado ? <EstadoChip estado={row.estado} size="sm" /> : undefined}
            caption={
              objectives.active === row.entries.length
                ? `Sobre sus ${row.entries.length} objetivos del ciclo`
                : `Sobre ${objectives.active} de sus ${row.entries.length} objetivos`
            }
            chart={
              <RingGauge
                value={row.percent}
                size={44}
                strokeWidth={5}
                ariaLabel={`${formatPercent(row.percent)} de avance ponderado`}
              />
            }
          />
        </MetricWithDetail>

        <MetricWithDetail
          detail={
            <DetailPanel
              title="Sus objetivos por banda"
              hint="En qué banda de cumplimiento cayó cada uno de sus objetivos ya calificados."
              badge={`${objectives.graded} ${objectives.graded === 1 ? "calificado" : "calificados"}`}
            >
              {objectives.graded === 0 ? (
                <p className="text-[11.5px] text-white/55">
                  Ninguno de sus objetivos tiene todavía una banda de cumplimiento.
                </p>
              ) : (
                <MeterList
                  slices={objectives.segments.map((segment) => ({
                    id: segment.id,
                    label: segment.label,
                    value: segment.count,
                    color: segment.color,
                  }))}
                  total={objectives.graded}
                />
              )}
            </DetailPanel>
          }
        >
          <MiniMetricCard
            size="compact"
            icon={Target}
            label="Sus objetivos"
            tone="brand"
            value={row.entries.length}
            caption={objectives.caption}
            chartPlacement="bottom"
            chart={<StripBar segments={objectives.segments} />}
          />
        </MetricWithDetail>

        <MetricWithDetail
          detail={
            <DetailPanel
              title="A qué empuja su trabajo"
              hint="Qué parte de su peso recibe cada objetivo de la empresa. El mapa de la pestaña siguiente dibuja estas mismas conexiones."
            >
              <StrategyBreakdown row={row} companyObjectives={companyObjectives} />
            </DetailPanel>
          }
        >
          <MiniMetricCard
            size="compact"
            icon={Share2}
            label="Impacto en la estrategia"
            tone="brand"
            value={`${impact.alignedWeight} %`}
            caption={impact.caption}
            chartPlacement="bottom"
            chart={<StripBar segments={impact.segments} />}
          />
        </MetricWithDetail>
      </div>
    </div>
  );
}

// ── Hover ──────────────────────────────────────────────────────────────────

/**
 * Una tarjeta de la franja con su desglose detrás del hover.
 *
 * El envoltorio existe porque `MiniMetricCard` no reenvía su ref, así que el
 * disparador tiene que ser un elemento propio; `[&>*]:h-full` le devuelve a la
 * tarjeta el estirado que tenía siendo hija directa de la rejilla —sin él, la
 * que no lleva gráfico al pie queda más baja que sus vecinas—.
 */
function MetricWithDetail({
  detail,
  children,
}: {
  detail: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <HoverCard openDelay={140} closeDelay={80}>
      <HoverCardTrigger asChild>
        <div className="h-full [&>*]:h-full">{children}</div>
      </HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="start"
        sideOffset={8}
        className="w-[24rem] gap-0 rounded-2xl border border-white/10 bg-surface-nav p-4 text-white shadow-rail"
        /*
         * Los gráficos de dentro son los del resumen y pintan con los tokens
         * de texto del sistema, pensados para papel blanco. En vez de
         * duplicarlos con clases claras, la tarjeta redefine esos tokens para
         * su propio subárbol: los mismos componentes, leídos sobre oscuro.
         */
        style={
          {
            "--color-text-primary": "#FFFFFF",
            "--color-text-secondary": "rgba(255,255,255,0.78)",
            "--color-text-muted": "rgba(255,255,255,0.5)",
            "--muted": "222 30% 24%",
          } as React.CSSProperties
        }
      >
        {detail}
      </HoverCardContent>
    </HoverCard>
  );
}

/** El armazón de un desglose: título, la línea que lo explica y el contenido. */
function DetailPanel({
  title,
  hint,
  badge,
  children,
}: {
  title: string;
  hint: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        <h4 className="min-w-0 flex-1 text-[12.5px] font-bold text-white">{title}</h4>
        {badge && (
          <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10.5px] font-semibold tabular-nums text-white/80">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[11px] leading-relaxed text-white/55">{hint}</p>
      <div className="mt-3 border-t border-white/10 pt-3">{children}</div>
    </div>
  );
}

/** Objetivo por objetivo: su peso y cuánto lleva. De ahí sale el ponderado. */
function ObjectiveBreakdown({ row }: { row: PersonResultRow }) {
  return (
    <ul className="flex flex-col gap-2">
      {row.entries.map((entry) => {
        const inactive = entry.inactivation !== null;
        return (
          <li key={entry.objective.id} className={cn("flex flex-col gap-1", inactive && "opacity-55")}>
            <div className="flex items-baseline justify-between gap-2">
              <span
                className="min-w-0 truncate text-[11.5px] font-medium text-white"
                title={entry.objective.title || "Objetivo sin nombre"}
              >
                {entry.objective.title || "Objetivo sin nombre"}
              </span>
              <span className="shrink-0 text-[11.5px] font-bold tabular-nums text-white">
                {formatPercent(entry.percent)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
                <span
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${Math.max(2, Math.min(100, entry.percent))}%`,
                    backgroundColor: entry.estado?.colorHex ?? "var(--color-border-strong)",
                  }}
                />
              </span>
              <span className="shrink-0 text-[10.5px] font-medium tabular-nums text-white/50">
                {inactive ? "no cuenta" : `Peso ${entry.objective.weight} %`}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** El peso repartido entre los objetivos de la empresa a los que apunta. */
function StrategyBreakdown({
  row,
  companyObjectives,
}: {
  row: PersonResultRow;
  companyObjectives: readonly Objective[];
}) {
  const companyIds = new Set(companyObjectives.map((objective) => objective.id));
  const weightByCompany = new Map<string, number>();
  let unaligned = 0;
  let inactive = 0;

  row.entries.forEach((entry) => {
    if (entry.inactivation) {
      inactive += entry.objective.weight;
      return;
    }
    const target = entry.objective.alignedTo;
    if (target && companyIds.has(target)) {
      weightByCompany.set(target, (weightByCompany.get(target) ?? 0) + entry.objective.weight);
    } else {
      unaligned += entry.objective.weight;
    }
  });

  const bars = companyObjectives
    .filter((objective) => weightByCompany.has(objective.id))
    .map((objective) => {
      const weight = weightByCompany.get(objective.id) ?? 0;
      return {
        id: objective.id,
        label: objective.title.trim() === "" ? "Objetivo sin nombre" : objective.title,
        percent: weight,
        valueLabel: `${weight} %`,
        color: "var(--color-brand)",
      };
    })
    .sort((a, b) => b.percent - a.percent);

  if (unaligned > 0) {
    bars.push({
      id: "unaligned",
      label: "Sin objetivo de empresa",
      percent: unaligned,
      valueLabel: `${unaligned} %`,
      // Sobre el panel oscuro, el gris de los bordes se hunde en el fondo.
      color: "rgba(255,255,255,0.42)",
    });
  }

  if (bars.length === 0) {
    return (
      <p className="text-[11.5px] text-white/55">
        Ninguno de sus objetivos activos apunta a un objetivo de la empresa.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <RankedBarList bars={bars} format={(percent) => `${percent} %`} />
      {inactive > 0 && (
        <p className="flex items-baseline justify-between gap-3 border-t border-white/10 pt-2 text-[11px] text-white/55">
          <span>Inactivo · no cuenta</span>
          <span className="font-semibold tabular-nums">{inactive} %</span>
        </p>
      )}
    </div>
  );
}

/**
 * La barra apilada al pie de una tarjeta.
 *
 * `chartPlacement="bottom"` sangra el gráfico hasta los bordes para que una
 * curva se apoye en ellos; una barra redondeada ahí se vería cortada, así que
 * este envoltorio le devuelve el aire de la tarjeta sin tocar la anatomía.
 */
function StripBar({
  segments,
}: {
  segments: readonly { id: string; label: string; count: number; color: string }[];
}) {
  return (
    <div className="px-3.5 pb-3 pt-0.5">
      <DistributionBar segments={segments} height="h-1.5" />
    </div>
  );
}

// ── Lecturas ───────────────────────────────────────────────────────────────

/** Cuántos objetivos lleva, en qué estado están y cómo se reparten por banda. */
function describeObjectives(row: PersonResultRow, estados: readonly ObjetivoEstadoConfig[]) {
  const active = row.entries.filter((entry) => entry.inactivation === null).length;
  const inactive = row.entries.length - active;
  const blocked =
    (row.lifecycleCounts.get("por-aprobar") ?? 0) + (row.lifecycleCounts.get("por-ajustar") ?? 0);

  const parts = [`${row.reportedCount} con avance`];
  if (blocked > 0) parts.push(`${blocked} sin aprobar`);
  if (inactive > 0) parts.push(inactive === 1 ? "1 inactivo" : `${inactive} inactivos`);

  // Todas las bandas configuradas, incluidas las que van en cero: la barra no
  // las dibuja, pero contarlas mal sería peor que no contarlas.
  const segments = estados.map((estado) => ({
    id: estado.id,
    label: estado.nombre,
    count: row.estadoCounts.get(estado.id) ?? 0,
    color: estado.colorHex,
  }));

  return {
    active,
    inactive,
    graded: segments.reduce((sum, segment) => sum + segment.count, 0),
    caption: parts.join(" · "),
    segments,
  };
}

/**
 * Qué parte de su peso empuja la estrategia.
 *
 * Tres tramos y no uno por objetivo de empresa: lo que esta tarjeta contesta
 * es "¿su trabajo apunta a algo?", y el reparto fino —cuál objetivo recibe
 * cuánto— está detrás de su hover y dibujado entero en el mapa.
 */
function describeImpact(row: PersonResultRow, companyObjectives: readonly Objective[]) {
  const companyIds = new Set(companyObjectives.map((objective) => objective.id));
  const targets = new Set<string>();
  let alignedWeight = 0;
  let unalignedWeight = 0;
  let inactiveWeight = 0;

  row.entries.forEach((entry) => {
    if (entry.inactivation) {
      inactiveWeight += entry.objective.weight;
      return;
    }
    const target = entry.objective.alignedTo;
    if (target && companyIds.has(target)) {
      targets.add(target);
      alignedWeight += entry.objective.weight;
    } else {
      unalignedWeight += entry.objective.weight;
    }
  });

  const caption =
    targets.size === 0
      ? "Ninguno de sus objetivos apunta a la estrategia"
      : `de su peso empuja ${targets.size} ${
          targets.size === 1 ? "objetivo de la empresa" : "objetivos de la empresa"
        }`;

  return {
    alignedWeight,
    caption,
    segments: [
      {
        id: "aligned",
        label: "Empuja la estrategia",
        count: alignedWeight,
        color: "var(--color-brand)",
      },
      {
        id: "unaligned",
        label: "Sin objetivo de empresa",
        count: unalignedWeight,
        color: "var(--color-border-strong)",
      },
      {
        id: "inactive",
        label: "Inactivo · no cuenta",
        count: inactiveWeight,
        color: "color-mix(in srgb, var(--color-border-strong) 40%, transparent)",
      },
    ],
  };
}
