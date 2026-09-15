import * as React from "react";
import {
  CheckCircle2,
  MessageSquareText,
  PenLine,
  TrendingDown,
  TriangleAlert,
  UserPlus,
  Users,
} from "lucide-react";
import { AttentionAction, AttentionStrip } from "@/components/feedback";
import { AiAnalyzingState } from "@/components/ai-interaction";
import { formatPercent, formatLongDate } from "@/components/ciclo-detail";
import { MetricReadingBadge, MetricSummaryCard } from "@/components/survey-results";
import { Sparkline } from "@/components/survey-analytics/pulseCharts";
import { APPROVAL_META, APPROVAL_ORDER } from "./objectiveLifecycle";
import { toneForEstado } from "./resultsTone";
import { CicloTimePanel } from "./CicloTimePanel";
import { ActivityRhythmPanel } from "./ActivityRhythmPanel";
import { RISK_META, RISK_ORDER, UNALIGNED_OBJECTIVE, type CicloResults } from "./resultsModel";
import {
  BREAKDOWN_META,
  alignmentByBreakdown,
  alignmentSplit,
  breakdownBars,
  pendingApprovalBars,
  weightBars,
  weightByCompanyObjective,
  type BreakdownKey,
} from "./resultsBreakdown";
import {
  ALIGNMENT_COLORS,
  CATEGORY_COLORS,
  EMPTY_BUCKET_COLOR,
  MEASURE_COLORS,
  buildDetailDimension,
  type DetailDimensionKey,
} from "./resultsDetail";
import { ResultsDetailDrawer } from "./ResultsDetailDrawer";
import {
  AlignmentRanking,
  AreaRanking,
  DonutDistribution,
  FlowDistribution,
  PendingApprovals,
  StatCard,
  WaffleDistribution,
  WeightDonut,
  WeightSplit,
} from "./ResumenPanels";
import { CustomMetricPanel } from "./CustomMetricPanel";
import { ResumenBoard, ResumenBoardBlock } from "./ResumenBoard";
import type { CustomMetric } from "./customMetrics";
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
 * Y ningún gráfico se queda en el "cuántos": pulsar un tramo abre el detalle
 * de ese tramo —quiénes son las personas en "Por mejorar", cuáles son los
 * objetivos sin una sola conversación— en un drawer que es el mismo para
 * todas las tarjetas y que lleva los demás tramos como navegación, para
 * comparar sin volver al gráfico. El filtro global no se pierde: se pone
 * desde el pie de ese mismo drawer, que es donde ya se sabe qué se va a
 * filtrar.
 *
 * Lo que la referencia trata como métricas y no lo son —"15 colaboradores sin
 * objetivos", "112 por aprobar"— sube a la franja de pendientes: son acciones,
 * y una acción escondida entre tarjetas de lectura no se ejecuta nunca.
 *
 * El orden de las filas es el orden en que se hacen las preguntas, de la que
 * obliga a actuar hoy a la que solo da contexto:
 *
 *   1. ¿Cómo va?            → el número grande
 *   2. ¿Qué está frenado?   → pendientes
 *   3. ¿Cuánto está vivo?   → las tres cifras de adopción
 *   4. ¿Va a llegar?        → tiempo · riesgo · aprobación
 *   5. ¿Cómo van y quién va atrás? → estado de los objetivos · avance por corte
 *   6. ¿Con qué se mide y cuándo se mueve? → tipo de medida · ritmo
 *
 * Y cada vecino comparte pregunta con el siguiente: el riesgo se lee contra el
 * calendario que tiene al lado, la aprobación empalma con el reparto de
 * estados que solo cuenta aprobados. Una tarjeta cuyo vecino no tiene nada
 * que ver con ella obliga a releer la anterior para entender la siguiente.
 */

interface ResumenTabProps {
  results: CicloResults;
  filters: ResultsFiltersState;
  /** El corte elegido en el "Ver por" de arriba. */
  breakdown: BreakdownKey;
  onOpenPending: (kind: "sin-objetivos" | "por-aprobar" | "por-ajustar" | "riesgo-alto") => void;
  /** Los filtros globales. Aquí no hay tarjeta de tabla donde montarlos, así
   *  que van en su propio renglón, bajo la franja de pendientes. */
  globalControls?: React.ReactNode;
  /** Las fichas de lo que está filtrado, bajo esa misma fila. */
  globalChips?: React.ReactNode;
  /** Las métricas que alguien pidió en el chat del Agente IA. Viven aquí
   *  arriba, antes de las tarjetas del reporte: es lo que esa persona acaba
   *  de pedir y lo que está mirando mientras sigue conversando. */
  customMetrics?: readonly CustomMetric[];
  /** La última que se creó o se cambió, para que se note cuál se está
   *  tocando desde el panel de la izquierda. */
  highlightedMetricId?: string | null;
  onRemoveMetric?: (id: string) => void;
  /** Vuelve a abrir el chat para seguir ajustándola. */
  onAdjustMetric?: (id: string) => void;
  /**
   * La IA trabajando, con el hueco donde va a caer lo que está armando.
   *
   * `metricId` en `null` es una métrica nueva: el hueco se abre arriba de las
   * demás. Con un id, la que se está rehaciendo: el trabajo ocupa el sitio de
   * esa tarjeta y no el final de la página, para que se vea *dónde* se está
   * insertando y no solo *que* algo está pasando.
   */
  workingMetric?: {
    metricId: string | null;
    progress: number;
    caption: string;
    detail: string;
  } | null;
  /** El orden de las filas del tablero, que se puede reordenar arrastrando. */
  boardOrder: readonly string[];
  onBoardOrderChange: (next: string[]) => void;
}

export function ResumenTab({
  results,
  filters,
  breakdown,
  onOpenPending,
  globalControls,
  globalChips,
  customMetrics = [],
  highlightedMetricId = null,
  onRemoveMetric,
  onAdjustMetric,
  workingMetric = null,
  boardOrder,
  onBoardOrderChange,
}: ResumenTabProps) {
  const breakdownMeta = BREAKDOWN_META[breakdown];

  /* Calendario y aprobación se reparten la fila con riesgo cuando lo hay, y
     entre las dos cuando el ciclo ya cerró y el riesgo no existe. */
  const sideBySide = results.showsRisk ? 2 : 3;

  /**
   * Qué tramo de qué tarjeta se está mirando de cerca. Es un solo estado para
   * los nueve repartos porque es un solo drawer: guardarlo por tarjeta sería
   * tener nueve banderas que solo pueden estar encendidas de a una.
   */
  const [detail, setDetail] = React.useState<{ key: DetailDimensionKey; bucketId: string } | null>(
    null
  );

  /**
   * La métrica recién creada se trae a la vista.
   *
   * El chat que la arma vive a la izquierda y el resumen puede estar
   * scrolleado en cualquier parte —o ni siquiera ser la pestaña abierta
   * cuando se pidió—: sin esto, la métrica aparece fuera de pantalla y quien
   * la pidió cree que no pasó nada.
   */
  const metricsRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!highlightedMetricId) return;
    metricsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [highlightedMetricId, customMetrics.length]);

  /** Y el hueco de trabajo, apenas se abre: de nada sirve mostrar dónde se
   *  está insertando si ese sitio queda fuera de pantalla. */
  const workingRef = React.useRef<HTMLDivElement>(null);
  const isWorking = workingMetric !== null;
  React.useEffect(() => {
    if (!isWorking) return;
    workingRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [isWorking]);
  const openDetail = React.useCallback(
    (key: DetailDimensionKey) => (bucketId: string) => setDetail({ key, bucketId }),
    []
  );
  const detailDimension = React.useMemo(
    () => (detail ? buildDetailDimension(results, detail.key, breakdown) : null),
    [detail, results, breakdown]
  );

  /**
   * El avance promedio de cada grupo del corte elegido y cuánta gente hay
   * detrás, ordenados del que va más atrás al que va mejor: la primera fila es
   * el titular.
   *
   * Todas las barras van del mismo azul: no hay un estado configurado detrás
   * de "área" —a diferencia del riesgo o del estado del objetivo, que sí
   * vienen de una configuración con su propio color— así que colorear cada
   * barra según qué tan atrás va sería inventarle un semáforo que nadie
   * definió. La comparación contra el calendario la sigue dando la guía
   * punteada, no el color.
   */
  const areaBars = React.useMemo(
    () =>
      breakdownBars(results.scored, breakdown).map((item) => ({
        id: item.id,
        label: item.label,
        percent: item.percent,
        detail: `${item.people} ${item.people === 1 ? "persona" : "personas"}`,
        color: "var(--color-brand)",
        active:
          breakdownMeta.filterKey !== null && filters.isOn(breakdownMeta.filterKey, item.id),
      })),
    [results.scored, filters, breakdown, breakdownMeta]
  );

  /** Dónde está puesto el peso del ciclo, por el mismo corte del "Ver por". */
  const pesoBars = React.useMemo(
    () => weightBars(results.scoredEntries, breakdown),
    [results.scoredEntries, breakdown]
  );

  /** Y el mismo peso, repartido entre los objetivos de la empresa. */
  const pesoEmpresaBars = React.useMemo(
    () =>
      weightByCompanyObjective(
        results.scoredEntries,
        results.data.companyObjectives,
        UNALIGNED_OBJECTIVE
      ),
    [results.scoredEntries, results.data.companyObjectives]
  );

  /**
   * Los objetivos de empresa que existen de verdad. Un `alignedTo` que apunta
   * a uno que ya no está no es una alineación: es una referencia rota, y
   * contarla como buena esconde justo lo que estas dos tarjetas buscan.
   */
  const alignedIds = React.useMemo(
    () => new Set(results.data.companyObjectives.map((objective) => objective.id)),
    [results.data.companyObjectives]
  );
  const hasCompanyObjectives = alignedIds.size > 0;

  /** Cuánta gente tiene sus objetivos colgando de la estrategia. */
  const alineacionPersonas = React.useMemo(
    () => alignmentSplit(results.scored, alignedIds),
    [results.scored, alignedIds]
  );

  /** Y qué tan enganchado está cada grupo del corte. */
  const alineacionBars = React.useMemo(
    () => alignmentByBreakdown(results.scoredEntries, breakdown, alignedIds),
    [results.scoredEntries, breakdown, alignedIds]
  );

  /** El promedio del ciclo, que es la guía contra la que se leen esas barras. */
  const alineacionPromedio = React.useMemo(() => {
    const active = results.scoredEntries.filter((entry) => entry.inactivation === null);
    const total = active.reduce((sum, entry) => sum + (entry.objective.weight ?? 0), 0);
    const aligned = active.reduce(
      (sum, entry) =>
        entry.objective.alignedTo !== null && alignedIds.has(entry.objective.alignedTo)
          ? sum + (entry.objective.weight ?? 0)
          : sum,
      0
    );
    return total === 0 ? 0 : (aligned / total) * 100;
  }, [results.scoredEntries, alignedIds]);

  /** Quién tiene objetivos esperando su visto bueno. */
  const aprobacionBars = React.useMemo(
    () => pendingApprovalBars(results.scoredEntries, "por-aprobar"),
    [results.scoredEntries]
  );

  /** Y quién devolvió objetivos que nadie ha vuelto a enviar. */
  const devueltosBars = React.useMemo(
    () => pendingApprovalBars(results.scoredEntries, "por-ajustar"),
    [results.scoredEntries]
  );

  // Los tres de la cabecera son los tres primeros de esa misma lista: un solo
  // cálculo, y la tarjeta grande y la de abajo nunca discrepan.
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
  // Un ciclo cerrado no tiene riesgo que mostrar —el riesgo es un pronóstico—
  // así que la alerta de riesgo alto se apaga con el resto de la franja de
  // riesgo en vez de contar gente para un pronóstico que ya no aplica.
  const riesgoAlto = results.showsRisk ? results.riskCounts.get("alto") ?? 0 : 0;
  // Objetivos y personas suman en la misma cifra porque "pendiente" es lo que
  // tienen en común; cada botón dice de qué es el suyo.
  const pendientes = porAprobar + porAjustar + results.withoutObjectives.length + riesgoAlto;
  const completados = results.lifecycleCounts.get("completado") ?? 0;
  const excluded = results.rows.length - results.scored.length;

  /*
   * Las secciones son los bloques del tablero: cada una declara su `id` y el
   * `ResumenBoard` decide en qué orden salen y deja moverlas. La pantalla ya
   * envuelve la pestaña en `.cascade-enter`, que escalona a sus hijos
   * directos; montar encima una cascada de framer-motion sería la segunda
   * animación sobre las mismas filas que la vista de seguimiento ya aprendió
   * a no hacer.
   */
  return (
    <>
      <ResumenBoard order={boardOrder} onOrderChange={onBoardOrderChange}>
      {/* ── La tarjeta de métrica que abre todas las pestañas del reporte ── */}
      <ResumenBoardBlock id="avance" label="Avance general del ciclo" span={6} fixed>
      <MetricSummaryCard
        accentColor={toneForEstado(results.overallEstado).accent}
        title="Avance general del ciclo"
        hint={
          <div className="flex flex-col gap-2 text-[12px] leading-relaxed">
            <p>
              <strong>Avance general:</strong> promedio del cumplimiento ponderado de las personas que
              cuentan en los resultados{excluded > 0 && ` (${excluded} quedan fuera por su estado de participante)`}.
            </p>
            <p>
              Cada anillo es un nivel de cumplimiento; pulsarlo abre quiénes quedaron en él y desde ahí
              se puede filtrar todo el reporte.
            </p>
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
        ringsLabel="Niveles de cumplimiento"
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
            onToggle: () => setDetail({ key: "niveles", bucketId: id }),
          };
        })}
        topAreasTitle={`Top 3 ${breakdownMeta.plural} con menor avance`}
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
      </ResumenBoardBlock>

      {/* ── Pendientes: acciones, no métricas ──
          En la franja de avisos del home, no en tres banderolas teñidas a lo
          ancho: eran el único bloque de la pantalla con fondo de color, y
          apiladas empujaban las cifras del ciclo media pantalla hacia abajo.
          Ahora es una fila —cuántos pendientes hay— con un botón por motivo,
          y lo que cada banderola explicaba en línea lo dice el tooltip de su
          botón, igual que las alertas de la lista de ciclos. */}
      {pendientes > 0 && (
        <ResumenBoardBlock id="pendientes" label="Pendientes del ciclo" span={6} fixed>
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
          {riesgoAlto > 0 && (
            <AttentionAction
              icon={TrendingDown}
              label={RISK_META.alto.label}
              hint={RISK_META.alto.description}
              value={riesgoAlto}
              tone="negative"
              onClick={() => onOpenPending("riesgo-alto")}
            />
          )}
        </AttentionStrip>
        </ResumenBoardBlock>
      )}

      {/* Los filtros, bajo los pendientes: primero qué pasa en el ciclo y qué
          hay que atender, y recién después con qué recortarlo. Arriba, en el
          renglón de las pestañas, competían con ellas por la misma mirada. */}
      {globalControls && (
        <ResumenBoardBlock id="filtros" label="Filtros del reporte" span={6} fixed>
        <section className="flex flex-col gap-2" aria-label="Filtros del reporte">
          <div className="flex flex-wrap items-center justify-end gap-3">{globalControls}</div>
          {globalChips}
        </section>
        </ResumenBoardBlock>
      )}

      {/* ── Lo que pediste tú ──
          Las métricas armadas en el chat del Agente IA, cada una en su propia
          fila del tablero: son las únicas que esta persona pidió a mano, así
          que entran arriba —donde se ven mientras sigue conversando— y de ahí
          se arrastran a donde quiera dejarlas.

          El hueco de trabajo va aquí mismo, en el sitio exacto donde la
          métrica va a caer: una nueva abre su propio hueco arriba de las
          demás, y una que se está rehaciendo lo abre en su propia fila, sin
          moverse del tablero. */}
      {(customMetrics.length > 0 || workingMetric !== null) && (
        <ResumenBoardBlock
          id="sec-tuyas"
          label="Tus métricas"
          heading="Tus métricas"
          hint="Las que armaste conversando con el Agente IA."
        />
      )}

      {workingMetric && workingMetric.metricId === null && (
        <ResumenBoardBlock id="metrica-en-curso" label="Métrica en construcción" span={3} fixed>
          <div ref={workingRef} className="flex h-full flex-col [&>*]:flex-1">
            <AiAnalyzingState
              title="Armando tu métrica"
              progress={workingMetric.progress}
              caption={workingMetric.caption}
              detail={workingMetric.detail}
            />
          </div>
        </ResumenBoardBlock>
      )}

      {customMetrics.map((metric) => (
        <ResumenBoardBlock
          key={metric.id}
          id={metric.id}
          label={metric.definition.title.trim() || "Métrica del Agente IA"}
          span={3}
        >
          {workingMetric && workingMetric.metricId === metric.id ? (
            <div ref={workingRef} className="flex h-full flex-col [&>*]:flex-1">
              <AiAnalyzingState
                title="Rehaciendo la métrica"
                progress={workingMetric.progress}
                caption={workingMetric.caption}
                detail={workingMetric.detail}
              />
            </div>
          ) : (
            <div
              ref={metric.id === highlightedMetricId ? metricsRef : undefined}
              className="flex h-full flex-col [&>*]:flex-1"
            >
              <CustomMetricPanel
                metric={metric}
                highlighted={metric.id === highlightedMetricId}
                onRemove={() => onRemoveMetric?.(metric.id)}
                onAdjust={onAdjustMetric ? () => onAdjustMetric(metric.id) : undefined}
              />
            </div>
          )}
        </ResumenBoardBlock>
      ))}

      {/* ── ¿Cuánto de todo eso está vivo? ──
          Las tres cifras de adopción, justo después de los pendientes: antes
          de mirar calendario o riesgo, cuánta gente y cuántos objetivos hay
          detrás del número grande de arriba. Cada una es su propia pieza: se
          escriben juntas porque así se leen, pero nada obliga a que sigan
          juntas si a alguien le sirven en otro sitio. */}
      <ResumenBoardBlock
        id="sec-vivo"
        label="Cuánto del ciclo está vivo"
        heading="Cuánto del ciclo está vivo"
        hint="Cuánta gente y cuántos objetivos hay de verdad detrás del número de arriba."
      />

      <ResumenBoardBlock id="adopcion-avance" label="Reportaron avance" span={2}>
        <StatCard
          icon={Users}
          label="Reportaron avance"
          value={`${results.peopleWithProgress}`}
          total={`${results.scored.length}`}
          share={(results.peopleWithProgress / Math.max(1, results.scored.length)) * 100}
          hint={`${results.peopleCount} personas en el ciclo`}
          onClick={() => setDetail({ key: "progreso", bucketId: "con-avance" })}
        />
      </ResumenBoardBlock>

      <ResumenBoardBlock id="adopcion-meta" label="Objetivos en meta" span={2}>
        <StatCard
          icon={CheckCircle2}
          label="Objetivos en meta"
          value={`${completados}`}
          total={`${results.objectiveCount}`}
          share={(completados / Math.max(1, results.objectiveCount)) * 100}
          hint={`${results.objectiveCount - completados} todavía no llegan`}
          onClick={() => setDetail({ key: "meta", bucketId: "completado" })}
        />
      </ResumenBoardBlock>

      <ResumenBoardBlock id="adopcion-conversacion" label="Objetivos con conversación" span={2}>
        <StatCard
          icon={MessageSquareText}
          label="Objetivos con conversación"
          value={`${results.commentedCount}`}
          total={`${results.objectiveCount}`}
          share={(results.commentedCount / Math.max(1, results.objectiveCount)) * 100}
          hint={`${results.objectiveCount - results.commentedCount} avanzan sin un solo comentario`}
          onClick={() => setDetail({ key: "conversacion", bucketId: "con-conversacion" })}
        />
      </ResumenBoardBlock>

      {/* ── ¿Va a llegar? ──
          Cuánto calendario queda, quién no va a llegar a ese calendario y
          cuántos objetivos ni siquiera tienen permiso para contar. El tiempo
          y el riesgo van pegados porque son el mismo dato leído dos veces
          —el riesgo *es* el avance comparado con el calendario corrido—;
          tenerlos separados por el anillo de aprobación obligaba a saltar de
          una tarjeta a la otra para cerrar la lectura. La aprobación cierra
          la fila porque empalma con "Estado de los objetivos" justo debajo:
          ese reparto solo cuenta los aprobados y este dice cuántos quedaron
          fuera. */}
      <ResumenBoardBlock
        id="sec-llegar"
        label="¿Va a llegar?"
        heading="¿Va a llegar?"
        hint="El calendario que queda, quién no va a alcanzarlo y qué sigue esperando permiso para contar."
      />

      <ResumenBoardBlock id="tiempo" label="Calendario del ciclo" span={sideBySide}>
        <CicloTimePanel results={results} />
      </ResumenBoardBlock>

      {/* Un ciclo cerrado no tiene riesgo que mostrar —el riesgo es un
          pronóstico—, así que esa pieza no existe y las otras dos se reparten
          el ancho en vez de dejar un hueco. */}
      {results.showsRisk && (
        <ResumenBoardBlock id="riesgo" label="Riesgo" span={2}>
          <DonutDistribution
            title="Riesgo"
            hint="Avance comparado con el calendario ya corrido."
            total={results.scored.length}
            filters={filters}
            filterKey="risks"
            headline={{ id: "sin-riesgo", label: "sin riesgo" }}
            onSelectSegment={openDetail("risks")}
            segments={RISK_ORDER.map((id) => ({
              id,
              label: RISK_META[id].label,
              color: RISK_META[id].colorHex,
              count: results.riskCounts.get(id) ?? 0,
            }))}
          />
        </ResumenBoardBlock>
      )}

      <ResumenBoardBlock id="aprobacion" label="Aprobación de objetivos" span={sideBySide}>
        <DonutDistribution
          title="Aprobación de objetivos"
          hint="Cuántos pasaron la revisión del líder. Los otros no suman avance."
          total={results.objectiveCount}
          filters={filters}
          filterKey="approvals"
          headline={{ id: "aprobado", label: "aprobados" }}
          onSelectSegment={openDetail("approvals")}
          segments={APPROVAL_ORDER.map((id) => ({
            id,
            label: APPROVAL_META[id].label,
            color: APPROVAL_META[id].colorHex,
            count: results.approvalCounts.get(id) ?? 0,
          }))}
        />
      </ResumenBoardBlock>

      {/* La única tarjeta del resumen que no se mira, se usa: cada fila es un
          recordatorio con destinatario. */}
      <ResumenBoardBlock id="aprobacion-lider" label="Aprobaciones pendientes por líder" span={3}>
        <PendingApprovals
          title="Aprobaciones pendientes por líder"
          hint="Objetivos escritos que no cuentan hasta que su líder los apruebe."
          empty="Ningún líder tiene objetivos esperando visto bueno."
          bars={aprobacionBars}
          color={APPROVAL_META["por-aprobar"].colorHex}
          filters={filters}
        />
      </ResumenBoardBlock>

      {/* La otra mitad del atasco: lo que el líder ya devolvió y sigue ahí.
          Una espera al líder, la otra al colaborador —y las dos frenan el
          mismo ciclo—, así que se leen juntas o no se leen. */}
      <ResumenBoardBlock id="devueltos-lider" label="Devueltos sin corregir por líder" span={3}>
        <PendingApprovals
          title="Devueltos sin corregir, por líder"
          hint="Su líder pidió cambios y nadie los ha vuelto a enviar. Tampoco cuentan."
          empty="Nada devuelto esperando corrección."
          bars={devueltosBars}
          color={APPROVAL_META.denegado.colorHex}
          filters={filters}
        />
      </ResumenBoardBlock>

      {/* ── Cómo va cada objetivo aprobado y cómo va cada área ── */}
      {/* Las bandas de "Estados de los objetivos" tal como están
            configuradas, todas y en orden de cumplimiento. Solo cuenta los
            aprobados: uno que espera visto bueno tiene 0 % y saldría en la
            primera banda como si hubiera arrancado y no reportado, que es
          otra cosa. Los no aprobados están en la tarjeta de aprobación. */}
      <ResumenBoardBlock
        id="sec-como-van"
        label="Cómo van los objetivos"
        heading="Cómo van los objetivos"
        hint="En qué banda de cumplimiento cayeron y quién se está quedando atrás."
      />

      <ResumenBoardBlock id="estados" label="Estado de los objetivos" span={3}>
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
          onSelectSegment={openDetail("estados")}
          segments={results.estados.map((estado) => ({
            id: estado.id,
            label: estado.nombre,
            color: estado.colorHex,
            count: results.estadoCounts.get(estado.id) ?? 0,
          }))}
        />
      </ResumenBoardBlock>

      <ResumenBoardBlock id="ranking-corte" label="Avance por corte" span={3}>
        <AreaRanking
          bars={areaBars}
          breakdown={breakdown}
          hint={
            results.showsRisk
              ? "La guía punteada marca el calendario ya corrido."
              : `El avance con el que cerró cada ${breakdownMeta.noun}.`
          }
          reference={
            results.showsRisk
              ? { value: results.elapsed, label: `${Math.round(results.elapsed)} % del calendario` }
              : undefined
          }
          filters={filters}
          onSelectBar={openDetail("breakdown")}
        />
      </ResumenBoardBlock>

      {/* El peso, al lado del avance: son las dos mitades de la misma
          pregunta —cómo va cada área y cuánto mueve el resultado—, y leerlas
          juntas es lo que evita perseguir al último del ranking cuando carga
          el 4 % del ciclo. */}
      <ResumenBoardBlock
        id="sec-peso"
        label="Dónde se está jugando el ciclo"
        heading="Dónde se está jugando el ciclo"
        hint="No cómo va cada quien, sino cuánto del resultado depende de cada uno."
      />

      <ResumenBoardBlock id="peso-corte" label="Reparto del peso" span={3}>
        <WeightSplit
          title={`Reparto del peso por ${breakdownMeta.noun}`}
          bars={pesoBars}
          nouns={{ singular: breakdownMeta.noun, plural: breakdownMeta.plural }}
          filterKey={breakdownMeta.filterKey ?? "areas"}
          filters={filters}
          onSelectBar={openDetail("breakdown")}
        />
      </ResumenBoardBlock>

      {/* El mismo peso, mirado por la estrategia y no por el organigrama: es
          la lectura que dice en qué se está jugando el ciclo, y la única que
          saca a la luz lo que no está alineado a nada. */}
      {hasCompanyObjectives && (
      <ResumenBoardBlock id="peso-empresa" label="Peso por objetivo de empresa" span={3}>
        <WeightDonut
          title="Peso por objetivo de empresa"
          hint="De qué está hecho el 100 % del ciclo, y cuánto no cuelga de nada."
          bars={pesoEmpresaBars}
          colors={CATEGORY_COLORS}
          emptyBucket={{
            id: UNALIGNED_OBJECTIVE,
            label: "sin alinear",
            color: EMPTY_BUCKET_COLOR,
          }}
          filterKey="companyObjectives"
          filters={filters}
        />
      </ResumenBoardBlock>
      )}

      {/* ── Alineación con la estrategia ──
          El anillo de arriba dice de qué cuelga el peso; estas dos dicen
          quién está enganchado y quién no. Un ciclo puede ir perfecto en
          avance y estar tirando hacia donde nadie pidió. */}
      {/* Sin fragmento: el tablero lee sus piezas con `React.Children.toArray`,
          que no aplana fragmentos — envolver tres bloques en uno los hacía
          desaparecer del tablero sin un solo error. */}
      {hasCompanyObjectives && (
        <ResumenBoardBlock
          id="sec-alineacion"
          label="Alineación con la estrategia"
          heading="Alineación con la estrategia"
          hint="Cuánto de lo que se está haciendo cuelga de un objetivo de la empresa."
        />
      )}

      {hasCompanyObjectives && (
        <ResumenBoardBlock id="alineacion-personas" label="Colaboradores por alineación" span={3}>
          <DonutDistribution
            title="Colaboradores por alineación"
            hint="Cuánta gente tiene sus objetivos colgando de la estrategia, y cuánta no."
            total={alineacionPersonas.reduce((sum, band) => sum + band.people, 0)}
            filters={filters}
            headline={{ id: "total", label: "alineados" }}
            onSelectSegment={openDetail("alineacion")}
            segments={alineacionPersonas.map((band) => ({
              id: band.band,
              label: band.label,
              color: ALIGNMENT_COLORS[band.band],
              count: band.people,
            }))}
          />
        </ResumenBoardBlock>
      )}

      {hasCompanyObjectives && (
        <ResumenBoardBlock id="alineacion-corte" label="Alineación por corte" span={3}>
          <AlignmentRanking
            bars={alineacionBars}
            breakdown={breakdown}
            average={alineacionPromedio}
            filters={filters}
            onSelectBar={openDetail("breakdown")}
          />
        </ResumenBoardBlock>
      )}

      {/* ── Con qué se mide el ciclo y cuándo se mueve ──
          Las dos son lecturas del ciclo entero y no de su cumplimiento, así
          que comparten la última fila: media para la cuadrícula de medidas
          —con su leyenda debajo, que a media fila ya no cabe al lado— y media
          para el reloj de actividad. */}
      <ResumenBoardBlock
        id="sec-composicion"
        label="Con qué se mide y cuándo se mueve"
        heading="Con qué se mide y cuándo se mueve"
        hint="Dos lecturas del ciclo entero, no de su cumplimiento."
      />

      <ResumenBoardBlock id="medidas" label="Tipo de medida" span={3}>
        <WaffleDistribution
          title="Tipo de medida"
          hint="Con qué se está midiendo el ciclo."
          total={results.objectiveCount}
          filters={filters}
          filterKey="measures"
          onSelectSegment={openDetail("measures")}
          segments={results.measureMix.map((share, index) => ({
            id: share.measure,
            label: share.label,
            color: MEASURE_COLORS[index % MEASURE_COLORS.length],
            count: share.count,
          }))}
        />
      </ResumenBoardBlock>

      <ResumenBoardBlock id="ritmo" label="Ritmo de actividad" span={3}>
        <ActivityRhythmPanel entries={results.scoredEntries} />
      </ResumenBoardBlock>
      </ResumenBoard>

      {/* El detalle de lo que se acabe de pulsar. Se monta con `key` y solo
          mientras está abierto: así abre siempre parado en el tramo del clic
          y con la búsqueda vacía, sin un efecto que los resincronice. */}
      {detail && detailDimension && (
        <ResultsDetailDrawer
          key={`${detail.key}:${detail.bucketId}`}
          dimension={detailDimension}
          initialBucketId={detail.bucketId}
          filters={filters}
          open
          onOpenChange={(next) => {
            if (!next) setDetail(null);
          }}
        />
      )}
    </>
  );
}
