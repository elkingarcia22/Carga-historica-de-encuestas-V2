import { MEASURE_META } from "@/components/ciclo-builder";
import { formatPercent } from "@/components/ciclo-detail";
import type { CicloResults, PersonResultRow, ResultEntry } from "./resultsModel";
import {
  buildFocus,
  buildGaps,
  buildGovernance,
  buildStrengths,
} from "./cicloInsightBlocks";
import {
  GAP_WORTH_TELLING,
  pct,
  plural,
  weightOf,
  type CicloAnalysis,
  type CicloInsight,
  type FocusRow,
  type GapCut,
  type GovernanceReading,
} from "./cicloInsightTypes";

export * from "./cicloInsightTypes";

/**
 * Lo que la IA puede leer de un ciclo de objetivos.
 *
 * Una encuesta se analiza preguntando "¿qué respondió la gente?". Un ciclo no:
 * aquí nadie respondió nada, aquí alguien *se comprometió* a mover una cifra y
 * el ciclo lleva un tiempo corriendo. Eso cambia lo que hay que mirar. Las
 * cuatro preguntas propias de este reporte son:
 *
 *   1. ¿Va a llegar?          — avance contra el calendario ya corrido.
 *   2. ¿De qué depende?       — dónde está el *peso*, no dónde está el ruido.
 *   3. ¿Dónde se abre?        — la diferencia entre áreas, líderes y grupos.
 *   4. ¿Se está llevando bien? — aprobaciones, conversación y ritmo de reporte.
 *
 * Todo sale de `resultsModel`: no hay una segunda fuente de verdad que pueda
 * contradecir a la tabla de al lado. Y todo es puro —entra el agregado, salen
 * lecturas—, así que la pestaña no calcula nada por su cuenta.
 */

// ── El análisis ────────────────────────────────────────────────────────────

export function buildCicloAnalysis(
  results: CicloResults,
  rows: readonly PersonResultRow[],
  entries: readonly ResultEntry[]
): CicloAnalysis {
  /*
   * Un ciclo cerrado cambia el tiempo verbal de todo lo que sigue. "Va
   * atrasada" y "no puede pasar de" son pronósticos: sobre algo que ya terminó
   * son falsos aunque los números que los produjeron sean los mismos. Ahí no
   * hay atraso, hay resultado.
   */
  const isClosed = !results.showsRisk;
  const scored = rows.filter((row) => row.counts);
  const scoredEntries = entries.filter((entry) =>
    scored.some((row) => row.person.id === entry.personId)
  );
  const reference = isClosed ? results.overallPercent : results.elapsed;

  const focus = buildFocus(scored, reference, isClosed);
  const strengths = buildStrengths(results, scored);
  const gaps = buildGaps(scored, scoredEntries, results);
  const governance = buildGovernance(results, scoredEntries, rows);
  const insights = buildInsights(results, scored, scoredEntries, focus, gaps, governance, isClosed);

  return {
    summary: buildSummary(results, focus, governance, isClosed),
    insights,
    focus,
    strengths,
    gaps,
    governance,
  };
}

// ── Las lecturas ───────────────────────────────────────────────────────────

function buildInsights(
  results: CicloResults,
  scored: readonly PersonResultRow[],
  scoredEntries: readonly ResultEntry[],
  focus: readonly FocusRow[],
  gaps: readonly GapCut[],
  governance: GovernanceReading,
  isClosed: boolean
): CicloInsight[] {
  const list: CicloInsight[] = [];
  const totalWeight = weightOf(scoredEntries);
  const stalledShare = pct(totalWeight.stalled, totalWeight.total);
  const ceiling = 100 - stalledShare;
  const enMeta = scoredEntries.filter((entry) => entry.percent >= 100).length;
  const desbordados = scoredEntries.filter((entry) => entry.percent > 125).length;
  const blocked = governance.approval.porAprobar + governance.approval.porAjustar;

  /* ── Hallazgos: qué pasó en este ciclo ── */

  list.push({
    id: "ritmo",
    kind: "finding",
    title: isClosed
      ? `El ciclo cerró en ${formatPercent(results.overallPercent)}`
      : `El ciclo va ${Math.abs(Math.round(results.elapsed - results.overallPercent))} puntos ${results.overallPercent >= results.elapsed ? "por delante del" : "por detrás del"} calendario`,
    body: isClosed
      ? `Es el promedio ponderado de ${scored.length} ${plural(scored.length, "persona", "personas")} sobre ${scoredEntries.length} objetivos. Es la cifra contra la que hay que leer todo lo demás de esta pestaña.`
      : `Con ${Math.round(results.elapsed)} % del calendario corrido, el avance promedio es ${formatPercent(results.overallPercent)}. Al ritmo actual el ciclo llegaría a ${formatPercent(Math.min(100, results.elapsed > 0 ? (results.overallPercent / results.elapsed) * 100 : 0))} el día del cierre.`,
    evidence: `${formatPercent(results.overallPercent)} de avance · ${Math.round(results.elapsed)} % del calendario · ${Math.abs(results.daysLeft)} ${plural(Math.abs(results.daysLeft), "día", "días")} ${results.daysLeft >= 0 ? "restantes" : "desde el cierre"}`,
    confidence: "high",
    action: { label: "Ver el cumplimiento", tab: "cumplimiento" },
  });

  const reportShare = pct(results.peopleWithProgress, results.peopleCount);
  list.push({
    id: "adopcion",
    kind: "finding",
    title:
      reportShare >= 90
        ? `${reportShare} % de las personas ${isClosed ? "reportó" : "está reportando"} su avance`
        : `Solo ${reportShare} % de las personas ${isClosed ? "reportó algo" : "ha reportado algo"}`,
    body:
      reportShare >= 90
        ? `${results.peopleWithProgress} de ${results.peopleCount} personas registraron al menos un avance. La adopción no es el problema de este ciclo, así que las diferencias de cumplimiento son diferencias reales y no huecos de registro.`
        : `${results.peopleWithProgress} de ${results.peopleCount} personas registraron al menos un avance. ${
            isClosed
              ? "El promedio del ciclo mide entonces dos cosas a la vez —el trabajo y el hábito de reportarlo— y ya no hay forma de separarlas."
              : "Mientras eso no suba, el promedio del ciclo está midiendo tanto el trabajo como el hábito de reportarlo, y no se pueden separar."
          }`,
    evidence: `${results.peopleWithProgress} de ${results.peopleCount} personas con al menos un avance`,
    confidence: "high",
    action: { label: "Ver colaboradores", tab: "colaboradores" },
  });

  if (scoredEntries.length > 0) {
    list.push({
      id: "en-meta",
      kind: "finding",
      title: `${pct(enMeta, scoredEntries.length)} % de los objetivos ya llegó a su meta`,
      body: `${enMeta} de ${scoredEntries.length} objetivos están en 100 % o más. ${
        isClosed
          ? "Es el reparto con el que cerró el ciclo."
          : `Los ${scoredEntries.length - enMeta} restantes son los que todavía se pueden mover.`
      }`,
      evidence: `${enMeta} de ${scoredEntries.length} objetivos en meta`,
      confidence: "high",
      action: { label: "Ver los objetivos", tab: "cumplimiento" },
    });
  }

  const topMeasure = [...results.measureMix].sort((a, b) => b.count - a.count)[0];
  if (topMeasure && results.objectiveCount > 0) {
    const share = pct(topMeasure.count, results.objectiveCount);
    if (share >= 50) {
      list.push({
        id: "medida",
        kind: "finding",
        title: `El ciclo se mide casi todo con ${MEASURE_META[topMeasure.measure]?.label ?? topMeasure.label}`,
        body: `${share} % de los objetivos usa el mismo tipo de medida. No es un problema en sí, pero sí dice qué clase de trabajo está quedando fuera: lo que no se deja poner en esa unidad tiende a no escribirse como objetivo.`,
        evidence: `${topMeasure.count} de ${results.objectiveCount} objetivos son «${topMeasure.label}»`,
        confidence: "medium",
      });
    }
  }

  /* ── Riesgos: qué está en juego ── */

  if (stalledShare >= 20) {
    list.push({
      id: "peso-detenido",
      kind: "risk",
      title: isClosed
        ? `El ${stalledShare} % del peso del ciclo cerró sin un solo avance`
        : `El ${stalledShare} % del peso del ciclo está quieto`,
      body: isClosed
        ? `No es lo mismo cerrar con muchos objetivos quietos que cerrar quietos los que más pesan. Ese peso por sí solo le puso techo al resultado en ${ceiling} %, sin importar cómo le fue al resto.`
        : `No es lo mismo tener muchos objetivos quietos que tener quietos los que más pesan. Aunque todo lo demás llegara al 100 %, el ciclo no puede pasar de ${ceiling} % mientras ese peso no se mueva.`,
      evidence: `Techo del ciclo: ${ceiling} % · peso detenido ${stalledShare} %`,
      confidence: "high",
      action: {
        label: "Ver los detenidos",
        tab: "cumplimiento",
        filter: { key: "lifecycles", value: "por-iniciar" },
      },
    });
  }

  if (blocked > 0) {
    const share = pct(blocked, results.objectiveCount);
    list.push({
      id: "aprobacion",
      kind: "risk",
      title:
        share >= 15
          ? `El ${share} % de los objetivos todavía no puede arrancar`
          : `${blocked} ${plural(blocked, "objetivo sigue", "objetivos siguen")} esperando el flujo de aprobación`,
      body: isClosed
        ? `${governance.approval.porAprobar} ${plural(governance.approval.porAprobar, "objetivo nunca recibió", "objetivos nunca recibieron")} el visto bueno de su líder y ${governance.approval.porAjustar} ${plural(governance.approval.porAjustar, "se quedó", "se quedaron")} con cambios pedidos. El ciclo cerró contándolos en cero sin que nadie hubiera podido moverlos.`
        : `${governance.approval.porAprobar} ${plural(governance.approval.porAprobar, "objetivo espera", "objetivos esperan")} el visto bueno de su líder y ${governance.approval.porAjustar} ${plural(governance.approval.porAjustar, "volvió", "volvieron")} con cambios pedidos. Ninguno suma avance, así que el ${formatPercent(results.overallPercent)} general se calcula con objetivos que nadie puede mover todavía.`,
      evidence: `${governance.approval.porAprobar} por aprobar · ${governance.approval.porAjustar} ${plural(governance.approval.porAjustar, "devuelto", "devueltos")} · ${results.objectiveCount} objetivos en el ciclo`,
      confidence: "high",
      action: {
        label: "Ver los bloqueados",
        tab: "cumplimiento",
        filter: { key: "lifecycles", value: "por-aprobar" },
      },
    });
  }

  const alto = results.riskCounts.get("alto") ?? 0;
  if (!isClosed && alto > 0) {
    list.push({
      id: "riesgo-alto",
      kind: "risk",
      title: `${alto} ${plural(alto, "persona está", "personas están")} en riesgo alto de no cumplir`,
      body: `Su avance va 25 puntos o más por debajo del calendario ya corrido. Con ${results.daysLeft} ${plural(Math.abs(results.daysLeft), "día", "días")} por delante, es el grupo donde una conversación todavía cambia el resultado.`,
      evidence: `${alto} de ${scored.length} personas con brecha ≥ 25 puntos`,
      confidence: "high",
      action: { label: "Ver en riesgo alto", tab: "colaboradores", filter: { key: "risks", value: "alto" } },
    });
  }

  const worstFocus = focus[0];
  if (worstFocus) {
    list.push({
      id: "foco-area",
      kind: "risk",
      title: isClosed
        ? `${worstFocus.label} cerró ${worstFocus.gap} puntos por debajo del ciclo`
        : `${worstFocus.label} es donde más resultado hay en juego`,
      body:
        worstFocus.gap > 0
          ? `Carga el ${worstFocus.weightShare} % del peso del ciclo y va ${worstFocus.gap} puntos por debajo de ${isClosed ? "el promedio" : "lo esperado para esta altura del calendario"}. No es el área con el porcentaje más bajo, es la que combina atraso con peso: ahí es donde una misma conversación rinde más.`
          : `Carga el ${worstFocus.weightShare} % del peso del ciclo y el ${worstFocus.stalledShare} % de ese peso todavía no se ha movido. No va atrasada contra el calendario, pero es donde más resultado está esperando a que alguien lo arranque.`,
      evidence: `${formatPercent(worstFocus.percent)} sobre ${worstFocus.people} personas · ${worstFocus.weightShare} % del peso del ciclo`,
      confidence: worstFocus.confidence,
      action: {
        label: `Ver ${worstFocus.label}`,
        tab: "cumplimiento",
        filter: { key: "areas", value: worstFocus.filterValue },
      },
    });
  }

  if (governance.coverage.sinObjetivos > 0) {
    list.push({
      id: "sin-objetivos",
      kind: "risk",
      title: `${governance.coverage.sinObjetivos} ${plural(governance.coverage.sinObjetivos, "persona se quedó", "personas se quedaron")} sin ningún objetivo`,
      body: `Son personas de las áreas del ciclo que no aparecen en ninguna asignación. No salen mal en los resultados: no salen. Al cierre no hay nada que evaluarles y tampoco quedará constancia de por qué.`,
      evidence: `${governance.coverage.sinObjetivos} de ${results.peopleCount + governance.coverage.sinObjetivos} personas del alcance`,
      confidence: "high",
      action: { label: "Ver colaboradores", tab: "colaboradores" },
    });
  }

  if (desbordados > 0 && scoredEntries.length > 0) {
    const share = pct(desbordados, scoredEntries.length);
    if (share >= 8) {
      list.push({
        id: "metas-desbordadas",
        kind: "risk",
        title: `${share} % de los objetivos pasó del 125 % de su meta`,
        body: `${desbordados} objetivos superaron su meta por más de un cuarto. Una vez es suerte; a esta escala es calibración: las metas se pusieron por debajo de lo que el equipo ya venía haciendo, y el ciclo deja de distinguir quién se estiró de quién no.`,
        evidence: `${desbordados} de ${scoredEntries.length} objetivos por encima del 125 %`,
        confidence: "medium",
        action: { label: "Ver el ranking", tab: "ranking" },
      });
    }
  }

  /* ── Qué hacer: por dónde abrir el plan ── */

  if (blocked > 0) {
    list.push({
      id: "accion-desbloquear",
      kind: "recommendation",
      title: `Desbloquear ${blocked} ${plural(blocked, "objetivo", "objetivos")} antes de mirar cualquier otra cifra`,
      body: `Es la única acción de esta lista que no depende de nadie más que de los líderes que tienen la revisión pendiente, y mientras no pase, cada número del reporte está diluido por objetivos en cero que nadie podía mover.`,
      evidence: `${blocked} ${plural(blocked, "objetivo", "objetivos")} en revisión${
        pct(blocked, results.objectiveCount) >= 1
          ? ` · ${pct(blocked, results.objectiveCount)} % del ciclo`
          : ""
      }`,
      confidence: "high",
      action: {
        label: "Ver los bloqueados",
        tab: "cumplimiento",
        filter: { key: "lifecycles", value: "por-aprobar" },
      },
    });
  }

  if (governance.conversation.mudos > 0 && governance.conversation.conAvance > 0) {
    const share = pct(governance.conversation.mudos, governance.conversation.conAvance);
    if (share >= 25) {
      list.push({
        id: "accion-conversacion",
        kind: "recommendation",
        title: `Pedir una línea de contexto en los ${governance.conversation.mudos} objetivos que avanzan mudos`,
        body: `${share} % de los objetivos con avance no tiene un solo comentario: registran cifras sin explicación. ${
          isClosed
            ? "El ciclo cerró sin que quede por escrito por qué subieron o bajaron"
            : "Al cierre nadie va a poder decir por qué subieron o bajaron"
        }, y esa es justo la conversación que un ciclo de objetivos debería dejar.`,
        evidence: `${governance.conversation.mudos} de ${governance.conversation.conAvance} objetivos con avance y sin comentario`,
        confidence: "high",
        action: { label: "Ver colaboradores", tab: "colaboradores" },
      });
    }
  }

  const widest = gaps[0];
  if (widest && widest.spread >= GAP_WORTH_TELLING && widest.worst && widest.best) {
    list.push({
      id: "accion-brecha",
      kind: "recommendation",
      title: `Abrir la conversación por ${widest.label.toLowerCase()}, no por el promedio del ciclo`,
      body: `Entre ${widest.worst.label} y ${widest.best.label} hay ${widest.spread} puntos de diferencia. Un plan armado sobre el promedio del ciclo resuelve en el centro un problema que solo existe en un extremo: ${widest.worst.label} necesita algo distinto de lo que necesita ${widest.best.label}.`,
      evidence: `${widest.covered} ${widest.pluralLabel} con muestra suficiente · brecha de ${widest.spread} puntos`,
      confidence: widest.confidence,
      action: {
        label: `Ver ${widest.worst.label}`,
        tab: "cumplimiento",
        filter: { key: widest.key, value: widest.worst.label },
      },
    });
  }

  if (!isClosed && focus.length > 0 && focus[0].gap > 0) {
    const carga = focus.slice(0, 3).reduce((sum, row) => sum + row.weightShare, 0);
    list.push({
      id: "accion-foco",
      kind: "recommendation",
      title: `Empezar por los tres focos que concentran el ${carga} % del peso`,
      body: `${focus
        .slice(0, 3)
        .map((row) => row.label)
        .join(", ")} cargan juntos ${carga} % del peso del ciclo y van por debajo del calendario. Atender primero lo que más pesa es lo que separa un plan de una lista de áreas rezagadas.`,
      evidence: `${carga} % del peso del ciclo en ${Math.min(3, focus.length)} ${plural(Math.min(3, focus.length), "foco", "focos")}`,
      confidence: focus[0].confidence,
      action: { label: "Ver el cumplimiento", tab: "cumplimiento" },
    });
  }

  if (governance.rhythm.monthEndShare >= 40) {
    list.push({
      id: "accion-ritmo",
      kind: "recommendation",
      title: "Mover el reporte fuera del cierre de mes",
      body: `${governance.rhythm.monthEndShare} % de los avances se registra en los últimos cinco días del mes. Un seguimiento que solo existe el día del corte no sirve para corregir: para cuando la cifra aparece, el mes ya pasó.`,
      evidence: `${governance.rhythm.monthEndShare} % de ${governance.rhythm.updates} registros en los últimos 5 días del mes`,
      confidence: "medium",
    });
  }

  return list;
}

// ── El resumen ─────────────────────────────────────────────────────────────

function buildSummary(
  results: CicloResults,
  focus: readonly FocusRow[],
  governance: GovernanceReading,
  isClosed: boolean
): string {
  const blocked = governance.approval.porAprobar + governance.approval.porAjustar;
  const head = isClosed
    ? `El ciclo cerró en ${formatPercent(results.overallPercent)} con ${results.peopleCount} personas y ${results.objectiveCount} objetivos.`
    : `El ciclo va en ${formatPercent(results.overallPercent)} con ${Math.round(results.elapsed)} % del calendario corrido y ${results.daysLeft} ${plural(Math.abs(results.daysLeft), "día", "días")} por delante.`;

  const middle =
    blocked > 0
      ? ` ${blocked} objetivos siguen sin poder arrancar por el flujo de aprobación, así que esa cifra está diluida.`
      : ` Todos los objetivos pasaron la revisión de su líder, así que la cifra está limpia de bloqueos.`;

  const tail = !focus[0]
    ? ` Ningún foco concentra peso quieto ni atraso suficiente como para leerse aparte del promedio.`
    : focus[0].gap > 0
      ? ` El contraste está entre ${focus[0].label}, que carga ${focus[0].weightShare} % del peso y va ${focus[0].gap} puntos por debajo, y el resto del ciclo.`
      : ` Donde más resultado está esperando es ${focus[0].label}: carga ${focus[0].weightShare} % del peso del ciclo y el ${focus[0].stalledShare} % de ese peso no se ha movido.`;

  return head + middle + tail;
}
