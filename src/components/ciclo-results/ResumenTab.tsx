import * as React from "react";
import {
  CheckCircle2,
  MessageSquareText,
  PenLine,
  TriangleAlert,
  UserPlus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AttentionAction, AttentionStrip } from "@/components/feedback";
import { formatPercent, formatLongDate } from "@/components/ciclo-detail";
import { MetricReadingBadge, MetricSummaryCard } from "@/components/survey-results";
import { Sparkline } from "@/components/survey-analytics/pulseCharts";
import { APPROVAL_META, APPROVAL_ORDER } from "./objectiveLifecycle";
import { toneForEstado } from "./resultsTone";
import { CicloTimePanel } from "./CicloTimePanel";
import { RISK_META, RISK_ORDER, type CicloResults } from "./resultsModel";
import {
  AreaRanking,
  DonutDistribution,
  FlowDistribution,
  StatCard,
  WaffleDistribution,
} from "./ResumenPanels";
import type { ResultsFiltersState } from "./useResultsFilters";

/**
 * El panorama del ciclo.
 *
 * La referencia pone diez donuts del mismo tamaño en una grilla: nada manda y
 * el lector no sabe por dónde empezar. Aquí hay jerarquía —un número grande,
 * tres que lo enmarcan, cuatro repartos que lo explican y una comparación
 * entre áreas— y todo tramo de todo gráfico es un filtro que se lleva a las
 * demás pestañas. Un gráfico que no se puede pulsar en una herramienta de
 * análisis es un adorno.
 *
 * Y cada reparto se dibuja con la forma que le corresponde, no con la misma
 * barra apilada seis veces: un flujo por etapas se lee como medidores, un
 * total con un tramo dominante como anillo, un reparto casi parejo como
 * cuadrícula de cien celdas. Seis tarjetas idénticas eran seis tarjetas que
 * el ojo dejaba de leer a la tercera.
 *
 * Lo que la referencia trata como métricas y no lo son —"15 colaboradores sin
 * objetivos", "112 por aprobar"— sube a la franja de pendientes: son acciones,
 * y una acción escondida entre tarjetas de lectura no se ejecuta nunca.
 */

interface ResumenTabProps {
  results: CicloResults;
  filters: ResultsFiltersState;
  onOpenPending: (kind: "sin-objetivos" | "por-aprobar" | "por-ajustar") => void;
}

export function ResumenTab({ results, filters, onOpenPending }: ResumenTabProps) {
  /**
   * El avance promedio de cada área y cuánta gente hay detrás, ordenadas de
   * la más rezagada a la que va mejor: la primera fila es el titular.
   *
   * Todas las barras van del mismo azul: no hay un estado configurado detrás
   * de "área" —a diferencia del riesgo o del estado del objetivo, que sí
   * vienen de una configuración con su propio color— así que colorear cada
   * barra según qué tan atrás va sería inventarle un semáforo que nadie
   * definió. La comparación contra el calendario la sigue dando la guía
   * punteada, no el color.
   */
  const areaBars = React.useMemo(() => {
    const byArea = new Map<string, number[]>();
    results.scored.forEach((row) => {
      const bucket = byArea.get(row.area);
      if (bucket) bucket.push(row.percent);
      else byArea.set(row.area, [row.percent]);
    });
    return [...byArea.entries()]
      .map(([area, percents]) => ({
        id: area,
        label: area,
        percent: percents.reduce((a, b) => a + b, 0) / percents.length,
        people: percents.length,
      }))
      .sort((a, b) => a.percent - b.percent)
      .map((item) => ({
        id: item.id,
        label: item.label,
        percent: item.percent,
        detail: `${item.people} ${item.people === 1 ? "persona" : "personas"}`,
        color: "var(--color-brand)",
        active: filters.isOn("areas", item.id),
      }));
  }, [results.scored, filters]);

  // Las tres áreas de la cabecera son las tres primeras de esa misma lista:
  // un solo cálculo, y la tarjeta grande y la de abajo nunca discrepan.
  const laggingAreas = React.useMemo(
    () =>
      areaBars
        .filter(() => areaBars.length >= 3)
        .slice(0, 3)
        .map((bar) => ({
          id: bar.id,
          label: bar.label,
          value: bar.percent,
          displayValue: formatPercent(bar.percent),
        })),
    [areaBars]
  );

  const porAprobar = results.lifecycleCounts.get("por-aprobar") ?? 0;
  const porAjustar = results.lifecycleCounts.get("por-ajustar") ?? 0;
  // Objetivos y personas suman en la misma cifra porque "pendiente" es lo que
  // tienen en común; cada botón dice de qué es el suyo.
  const pendientes = porAprobar + porAjustar + results.withoutObjectives.length;
  const completados = results.lifecycleCounts.get("completado") ?? 0;
  const excluded = results.rows.length - results.scored.length;

  /*
   * Las secciones salen como hermanas sueltas, no dentro de un contenedor
   * propio: la pantalla ya envuelve la pestaña en `.cascade-enter`, que
   * escalona a sus hijos directos. Montar encima una cascada de
   * framer-motion sería la segunda animación sobre las mismas filas que la
   * vista de seguimiento ya aprendió a no hacer.
   */
  return (
    <>
      {/* ── La tarjeta de métrica que abre todas las pestañas del reporte ── */}
      <MetricSummaryCard
        accentColor={toneForEstado(results.overallEstado).accent}
        title="Avance general del ciclo"
        hint={
          <div className="flex flex-col gap-2 text-[12px] leading-relaxed">
            <p>
              <strong>Avance general:</strong> promedio del cumplimiento ponderado de las personas que
              cuentan en los resultados{excluded > 0 && ` (${excluded} quedan fuera por su estado de participante)`}.
            </p>
            <p>Cada anillo es una persona por nivel de desempeño; pulsarlo filtra el resto de la vista.</p>
          </div>
        }
        bigValue={formatPercent(results.overallPercent)}
        bigValueBadge={
          results.overallEstado && (
            <MetricReadingBadge
              tone={toneForEstado(results.overallEstado).tone}
              label={results.overallEstado.nombre}
            />
          )
        }
        caption={
          results.showsRisk
            ? `${Math.round(results.elapsed)} % del calendario corrido · ${results.daysLeft} ${results.daysLeft === 1 ? "día restante" : "días restantes"} · ${RISK_META[results.risk].label}`
            : `Cerró el ${formatLongDate(`${results.data.endDate}T12:00:00`)} · ${results.scored.length} personas`
        }
        ringsLabel="Niveles de desempeño"
        ringsTotal={`${results.scored.length} personas`}
        // Todos los niveles configurados, también los que quedaron en cero:
        // "Excelente: 0" es la lectura más dura que puede dar un ciclo y
        // esconderla haría creer que ese nivel no está definido. El que va en
        // cero no se puede pulsar —filtrar por él dejaría la vista vacía—,
        // que es justo lo que `interactive` apaga.
        rings={[...results.nivelCounts.entries()].map(([id, count]) => {
          const nivel = results.niveles.find((item) => item.id === id);
          return {
            id,
            label: nivel?.nombre ?? id,
            percentage: Math.round((count / Math.max(1, results.scored.length)) * 100),
            color: nivel?.colorHex ?? "#CBD5E1",
            count: String(count),
            active: filters.isOn("niveles", id),
            interactive: count > 0,
            onToggle: () => filters.toggle("niveles", id),
          };
        })}
        topAreasTitle="Top 3 áreas más rezagadas"
        topAreas={laggingAreas}
        chartTitle="Avance en el tiempo"
        chart={
          <Sparkline
            points={results.timeline.map((point) => ({
              id: point.date,
              name: point.label,
              value: point.percent,
            }))}
            target={100}
            format={formatPercent}
            ariaLabel="Avance del ciclo mes a mes"
            height={56}
            showPoints
            fitTarget={false}
          />
        }
      />

      {/* ── Pendientes: acciones, no métricas ──
          En la franja de avisos del home, no en tres banderolas teñidas a lo
          ancho: eran el único bloque de la pantalla con fondo de color, y
          apiladas empujaban las cifras del ciclo media pantalla hacia abajo.
          Ahora es una fila —cuántos pendientes hay— con un botón por motivo,
          y lo que cada banderola explicaba en línea lo dice el tooltip de su
          botón, igual que las alertas de la lista de ciclos. */}
      {pendientes > 0 && (
        <AttentionStrip
          label="Pendientes del ciclo"
          icon={TriangleAlert}
          title={`${pendientes} ${pendientes === 1 ? "pendiente" : "pendientes"} por resolver`}
          detail="Toca un pendiente para ver a quién le toca y avisarle"
        >
          {porAprobar > 0 && (
            <AttentionAction
              icon={CheckCircle2}
              label="Por aprobar"
              hint="Objetivos escritos y enviados que esperan el visto bueno de su líder. No arrancan hasta que lo tengan."
              value={porAprobar}
              tone="brand"
              onClick={() => onOpenPending("por-aprobar")}
            />
          )}
          {porAjustar > 0 && (
            <AttentionAction
              icon={PenLine}
              label="Devueltos"
              hint="Su líder pidió cambios y volvieron a manos de quien los escribió. Tampoco cuentan hasta que se reenvíen."
              value={porAjustar}
              tone="warning"
              onClick={() => onOpenPending("por-ajustar")}
            />
          )}
          {results.withoutObjectives.length > 0 && (
            <AttentionAction
              icon={UserPlus}
              label="Sin objetivos"
              hint="Personas de un grupo que sí recibió objetivos, pero a las que no les asignaron ninguno. Mientras sigan así no entran en ningún promedio."
              value={results.withoutObjectives.length}
              tone="neutral"
              onClick={() => onOpenPending("sin-objetivos")}
            />
          )}
        </AttentionStrip>
      )}

      {/* ── Los tres que enmarcan el número grande ── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label="Cifras del ciclo">
        <StatCard
          icon={Users}
          label="Reportaron avance"
          value={`${results.peopleWithProgress}`}
          total={`${results.scored.length}`}
          share={(results.peopleWithProgress / Math.max(1, results.scored.length)) * 100}
          hint={`${results.peopleCount} personas en el ciclo`}
        />
        <StatCard
          icon={CheckCircle2}
          label="Objetivos en meta"
          value={`${completados}`}
          total={`${results.objectiveCount}`}
          share={(completados / Math.max(1, results.objectiveCount)) * 100}
          hint={`${results.objectiveCount - completados} todavía no llegan`}
        />
        <StatCard
          icon={MessageSquareText}
          label="Objetivos con conversación"
          value={`${results.commentedCount}`}
          total={`${results.objectiveCount}`}
          share={(results.commentedCount / Math.max(1, results.objectiveCount)) * 100}
          hint={`${results.objectiveCount - results.commentedCount} avanzan sin un solo comentario`}
        />
      </section>

      {/* ── El calendario, la aprobación y el riesgo ──
          Las tres preguntas que se hacen antes de mirar cifras: cuánto
          tiempo queda, cuántos objetivos siguen sin permiso para arrancar y
          quién no va a llegar. */}
      <section
        className={cn(
          "grid grid-cols-1 gap-4",
          results.showsRisk ? "lg:grid-cols-3" : "lg:grid-cols-2"
        )}
        aria-label="Estado del ciclo"
      >
        <CicloTimePanel results={results} />
        <DonutDistribution
          title="Aprobación de objetivos"
          hint="Cuántos pasaron la revisión del líder. Los otros no suman avance."
          total={results.objectiveCount}
          filters={filters}
          filterKey="approvals"
          headline={{ id: "aprobado", label: "aprobados" }}
          segments={APPROVAL_ORDER.map((id) => ({
            id,
            label: APPROVAL_META[id].label,
            color: APPROVAL_META[id].colorHex,
            count: results.approvalCounts.get(id) ?? 0,
          }))}
        />
        {/* Un ciclo cerrado no tiene riesgo que mostrar —el riesgo es un
            pronóstico— así que la fila baja a dos columnas en vez de dejar un
            hueco o rellenarlo con algo que ya está arriba. */}
        {results.showsRisk && (
          <DonutDistribution
            title="Riesgo"
            hint="Avance comparado con el calendario ya corrido."
            total={results.scored.length}
            filters={filters}
            filterKey="risks"
            headline={{ id: "sin-riesgo", label: "sin riesgo" }}
            segments={RISK_ORDER.map((id) => ({
              id,
              label: RISK_META[id].label,
              color: RISK_META[id].colorHex,
              count: results.riskCounts.get(id) ?? 0,
            }))}
          />
        )}
      </section>

      {/* ── Cómo va cada objetivo aprobado y cómo va cada área ── */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2" aria-label="Cumplimiento del ciclo">
        {/* Las bandas de "Estados de los objetivos" tal como están
            configuradas, todas y en orden de cumplimiento. Solo cuenta los
            aprobados: uno que espera visto bueno tiene 0 % y saldría en la
            primera banda como si hubiera arrancado y no reportado, que es
            otra cosa. Los no aprobados están en la tarjeta de aprobación. */}
        <FlowDistribution
          title="Estado de los objetivos"
          hint={
            results.showsRisk
              ? "Las bandas de cumplimiento configuradas, sobre los objetivos ya aprobados."
              : "Con qué banda de cumplimiento cerró cada objetivo aprobado."
          }
          total={results.committedCount}
          filters={filters}
          filterKey="estados"
          segments={results.estados.map((estado) => ({
            id: estado.id,
            label: estado.nombre,
            color: estado.colorHex,
            count: results.estadoCounts.get(estado.id) ?? 0,
          }))}
        />
        <AreaRanking
          bars={areaBars}
          hint={
            results.showsRisk
              ? "La guía punteada marca el calendario ya corrido."
              : "El avance con el que cerró cada área."
          }
          reference={
            results.showsRisk
              ? { value: results.elapsed, label: `${Math.round(results.elapsed)} % del calendario` }
              : undefined
          }
          filters={filters}
        />
      </section>

      {/* ── El tipo de medida, a lo ancho ──
          Las cuatro medidas no caben legibles en un tercio de fila: las
          celdas quedaban en cinco píxeles y la leyenda a dos columnas se
          cortaba antes de nombrarlas todas. Aquí la cuadrícula respira y la
          leyenda va completa al lado. */}
      <section aria-label="Composición del ciclo">
        <WaffleDistribution
          title="Tipo de medida"
          hint="Con qué se está midiendo el ciclo."
          total={results.objectiveCount}
          filters={filters}
          filterKey="measures"
          segments={results.measureMix.map((share, index) => ({
            id: share.measure,
            label: share.label,
            color: MEASURE_COLORS[index % MEASURE_COLORS.length],
            count: share.count,
          }))}
        />
      </section>
    </>
  );
}

/** Cuatro tonos para las cuatro medidas. No son estados configurados, pero sí
 *  categorías que hay que poder distinguir de un vistazo en la cuadrícula: sin
 *  color no habría cómo separar un tramo del siguiente. */
const MEASURE_COLORS = ["#4F46E5", "#0EA5E9", "#8B5CF6", "#14B8A6"];
