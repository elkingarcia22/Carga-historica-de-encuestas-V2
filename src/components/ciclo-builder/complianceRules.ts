/**
 * Cómo se calcula el cumplimiento de un objetivo — las reglas R0…R6, en un
 * solo lugar.
 *
 * La analogía que usa el equipo para explicarlas es una carrera atlética, y
 * vale la pena conservarla aquí porque hace evidente por qué las reglas son
 * como son:
 *
 *   Valor inicial → la SALIDA, dónde arrancó el corredor
 *   Meta          → la LLEGADA, el 100 % de cumplimiento
 *   Mínimo        → la marca de CLASIFICACIÓN: si no llega ahí, no suma nada
 *   Máximo        → el TECHO: más allá, el marcador deja de sumar
 *
 * En una carrera de INCREMENTO el corredor va de menor a mayor, así que la
 * pista queda `inicial < mínimo < meta < máximo`. En una de DECREMENTO va de
 * mayor a menor y la pista se recorre al revés: `inicial > mínimo > meta >
 * máximo`. Esto vale igual con números negativos — lo único que importa es el
 * orden relativo, no de qué lado del cero caiga la pista.
 *
 * El hallazgo que simplifica todo el módulo: las cuatro reglas de "sin valor
 * inicial" (R6b-1, R6b-2, R6c-1, R6c-2) no son cuatro fórmulas distintas. Son
 * la misma fórmula de R6a aplicada sobre una línea de salida *deducida*. Por
 * eso `resolveStartLine` existe: resuelve la salida una sola vez y de ahí en
 * adelante hay un único camino de cálculo, en vez de cinco ramas que puedan
 * desalinearse entre sí.
 */

import type { ObjectiveDirection } from "./cicloBuilderTypes";

/** De dónde salió la línea de salida que se usó para calcular. */
export type StartLineSource =
  /** R6a — la escribió el autor. */
  | "declared"
  /** R6b-1 / R6c-2 — se asume el cero de la pista. */
  | "zero"
  /** R6b-2 / R6c-1 — el cero no sirve de referencia, se usa el doble de la meta. */
  | "doubled-target";

export interface StartLine {
  value: number;
  source: StartLineSource;
  /** Identificador de la regla aplicada, para poder mostrarlo y auditarlo. */
  rule: "R6a" | "R6b-1" | "R6b-2" | "R6c-1" | "R6c-2";
}

/**
 * La línea de salida efectiva de la carrera (R6a / R6b-* / R6c-*).
 *
 * Cuando el autor no la escribió, el sistema deduce una que deje la meta
 * *adelante* del corredor. Asumir cero funciona en la mitad de los casos; en
 * la otra mitad (subir hacia una meta negativa, o bajar hacia una positiva) el
 * cero quedaría del lado equivocado de la meta y el avance se mediría al
 * revés, así que la referencia pasa a ser el doble de la meta.
 */
export function resolveStartLine(
  direction: ObjectiveDirection,
  target: number,
  declaredInitial: number | null
): StartLine {
  // R6a — con valor inicial, no hay nada que deducir.
  if (declaredInitial !== null) {
    return { value: declaredInitial, source: "declared", rule: "R6a" };
  }

  if (direction === "increase") {
    // R6b-1 — subir hacia una meta positiva: arrancar en cero es lo natural.
    if (target >= 0) return { value: 0, source: "zero", rule: "R6b-1" };
    // R6b-2 — subir hacia una meta negativa: cero queda *por encima* de la
    // meta, así que serviría de techo, no de salida. El doble de la meta cae
    // por debajo y deja la carrera en el sentido correcto.
    return { value: 2 * target, source: "doubled-target", rule: "R6b-2" };
  }

  // R6c-1 — bajar hacia una meta positiva: cero quedaría *por debajo* de la
  // meta, o sea ya pasada la llegada. El doble de la meta queda por encima.
  if (target >= 0) return { value: 2 * target, source: "doubled-target", rule: "R6c-1" };
  // R6c-2 — bajar hacia una meta negativa: aquí cero sí queda por encima.
  return { value: 0, source: "zero", rule: "R6c-2" };
}

export interface ComplianceInput {
  direction: ObjectiveDirection;
  /** Meta de la carrera. */
  target: number;
  /** Valor inicial escrito por el autor, o null para deducirlo. */
  initial: number | null;
  /** Marca de clasificación (R4), o null si no se definió. */
  min?: number | null;
  /** Techo de puntaje (R5), o null si no se definió. */
  max?: number | null;
  /** Lo que reportó el corredor. */
  actual: number;
  /** Cuando la configuración del módulo permite resultados negativos, R0a se
   * desactiva: un resultado que retrocedió más allá de la salida se muestra
   * como el porcentaje negativo que es, en vez de truncarse a 0 %. */
  allowNegative?: boolean;
}

export interface ComplianceResult {
  /** Porcentaje final que ve el cliente, ya truncado por R0a. */
  percent: number;
  /** La salida que se usó, y por cuál regla. */
  startLine: StartLine;
  /** True si R4 lo dejó en cero por no alcanzar el mínimo. */
  blockedByMinimum: boolean;
  /** True si R5 topó el avance en el máximo. */
  cappedByMaximum: boolean;
  /** True si R0a tuvo que truncar un resultado negativo a 0 %. */
  truncatedAtZero: boolean;
}

/**
 * El cumplimiento de un objetivo, aplicando R0a, R4, R5 y R6 en ese orden.
 *
 * Devuelve además *por qué* dio lo que dio: la barra de la tarjeta y el
 * simulador necesitan poder decir "esto quedó en 0 % porque no alcanzó el
 * mínimo", que es distinto de "quedó en 0 % porque no avanzaste". Sin ese
 * detalle, el 0 % es justamente el número que genera el ticket de soporte que
 * describe la guía.
 */
export function computeCompliance(input: ComplianceInput): ComplianceResult {
  const { direction, target, initial, min = null, max = null, actual, allowNegative = false } =
    input;
  const startLine = resolveStartLine(direction, target, initial);
  const isIncrease = direction === "increase";

  // R4a / R4b — por debajo de la clasificación (o por encima, si la carrera va
  // hacia atrás) el objetivo no suma nada, ni siquiera lo poco que se avanzó.
  if (min !== null) {
    const missedTheCut = isIncrease ? actual < min : actual > min;
    if (missedTheCut) {
      return {
        percent: 0,
        startLine,
        blockedByMinimum: true,
        cappedByMaximum: false,
        truncatedAtZero: false,
      };
    }
  }

  // R5a / R5b — pasado el techo el marcador deja de sumar: se calcula como si
  // el corredor se hubiera quedado exactamente en el máximo.
  let effectiveActual = actual;
  let cappedByMaximum = false;
  if (max !== null) {
    const wentPastTheCeiling = isIncrease ? actual > max : actual < max;
    if (wentPastTheCeiling) {
      effectiveActual = max;
      cappedByMaximum = true;
    }
  }

  // R6 — qué tanto del tramo salida→meta se recorrió. El denominador nunca es
  // cero: R1/R2/R3 impiden meta = inicial, y R0b impide la meta cero cuando la
  // salida es deducida (que es el único caso donde podrían coincidir).
  const span = target - startLine.value;
  const raw = span === 0 ? 0 : ((effectiveActual - startLine.value) / span) * 100;

  // R0a — el marcador nunca muestra negativo, salvo que la configuración del
  // módulo permita resultados negativos: ahí el retroceso se deja tal cual,
  // para que pueda caer en el estado configurado para negativos.
  const truncatedAtZero = !allowNegative && raw < 0;
  return {
    percent: truncatedAtZero ? 0 : raw,
    startLine,
    blockedByMinimum: false,
    cappedByMaximum,
    truncatedAtZero,
  };
}

// ── Validación de la pista ────────────────────────────────────────────────

/**
 * Un problema que impide guardar el objetivo (R0b, R1, R2, R3), o null.
 *
 * Sólo entran aquí las reglas que la tabla declara como bloqueantes. El orden
 * de mínimo y máximo se revisa aparte, como advertencia: la tabla lo describe
 * como comportamiento de cálculo (R4/R5), no como algo que impida guardar.
 */
export function trackBlockingIssue(
  direction: ObjectiveDirection,
  target: number | null,
  initial: number | null
): string | null {
  if (target === null) return null;

  // R0b — sin salida escrita, la meta cero no deja tramo que medir: la salida
  // deducida caería justo encima de la meta y el cálculo dividiría por cero.
  if (initial === null && target === 0) {
    return "Sin valor inicial, la meta no puede ser 0. Escribe un valor inicial o cambia la meta.";
  }

  if (initial === null) return null;

  // R3 — no se puede arrancar parado en la llegada.
  if (target === initial) return "La meta no puede ser igual al valor inicial.";

  // R1 — en una carrera hacia adelante, la meta va después de la salida.
  if (direction === "increase" && target < initial) {
    return "En objetivos de aumento, la meta debe ser mayor que el valor inicial.";
  }

  // R2 — hacia atrás, la meta va antes.
  if (direction === "decrease" && target > initial) {
    return "En objetivos de reducción, la meta debe ser menor que el valor inicial.";
  }

  return null;
}

export interface TrackWarning {
  field: "min" | "max";
  message: string;
}

/**
 * Avisos sobre mínimos y máximos mal ubicados en la pista.
 *
 * No bloquean —la tabla no los declara inválidos— pero sí producen objetivos
 * que se comportan de forma sorprendente: un mínimo puesto más allá de la meta
 * deja el objetivo en 0 % incluso cumpliéndolo, y ése es exactamente el caso
 * que la guía manda a revisar con un "juez". Decirlo al crear el objetivo sale
 * mucho más barato que descubrirlo al cerrar el ciclo.
 */
export function trackWarnings(
  direction: ObjectiveDirection,
  start: number,
  target: number,
  min: number | null,
  max: number | null
): TrackWarning[] {
  const warnings: TrackWarning[] = [];
  const isIncrease = direction === "increase";
  /** ¿`value` cae dentro del tramo salida→meta, en el sentido de la carrera? */
  const isOnTrack = (value: number) =>
    isIncrease ? value >= start && value <= target : value <= start && value >= target;
  /** ¿`value` cae en la meta o más allá, en el sentido de la carrera? */
  const isAtOrBeyondTarget = (value: number) =>
    isIncrease ? value >= target : value <= target;

  if (min !== null && !isOnTrack(min)) {
    warnings.push({
      field: "min",
      message: isAtOrBeyondTarget(min)
        ? "El mínimo quedó en la meta o más allá: cualquier resultado que no llegue a la meta contará como 0 %."
        : "El mínimo quedó antes del valor inicial, así que nunca se aplicará.",
    });
  }

  if (max !== null && !isAtOrBeyondTarget(max)) {
    warnings.push({
      field: "max",
      message: isOnTrack(max)
        ? "El máximo quedó antes de la meta: el cumplimiento se topará por debajo del 100 %."
        : "El máximo quedó antes del valor inicial, así que topará todo en 0 %.",
    });
  }

  return warnings;
}
