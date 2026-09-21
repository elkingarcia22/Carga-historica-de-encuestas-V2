/**
 * Lo que cuelga de un objetivo escrito por la IA.
 *
 * Hasta ahora el generador entregaba objetivos pelados: título, medida y meta.
 * Eso vale en SMART, donde el plan es opcional, pero en OKR un objetivo sin
 * resultados clave no es un objetivo a medias sino uno inválido —la tarjeta lo
 * marca en rojo apenas cae—, y en NCT pasa lo mismo con las tareas. Así que
 * cuando el modelo pide hijos, la IA los escribe.
 *
 * No hay modelo de lenguaje detrás: los hijos salen de lo que el objetivo ya
 * dice —de qué habla, hacia dónde va— con plantillas distintas según sean
 * resultados (pruebas de que se llegó) o acciones (el plan para llegar). El
 * reparto se hace con `distributeWeights`, el mismo que reparte el peso de los
 * objetivos, para que sumen exactamente 100 y la tarjeta no pida cuadrarlos.
 */

import {
  createKeyAction,
  distributeWeights,
  type KeyAction,
  type Objective,
} from "./cicloBuilderTypes";
import type { ObjectiveChildrenKind } from "./objectiveModel";

/**
 * El sujeto del objetivo: su título sin el verbo que lo encabeza.
 *
 * "Subir la retención mensual" → "la retención mensual", que es lo que se
 * puede volver a nombrar en una frase sin que quede "Subir subir".
 */
function subjectOf(title: string): string {
  const trimmed = title.trim();
  if (trimmed === "") return "el objetivo";
  const withoutVerb = trimmed.replace(
    /^(subir|bajar|aumentar|reducir|mejorar|mantener|sostener|lograr|alcanzar|entregar|lanzar|crecer en|llevar)\s+/i,
    ""
  );
  return (withoutVerb === "" ? trimmed : withoutVerb).toLowerCase();
}

/** Las pruebas de que se llegó: miden el objetivo, no lo planean. */
function resultTitles(objective: Objective, count: number): string[] {
  const subject = subjectOf(objective.title);
  const isDown = objective.direction === "decrease";

  const pool = objective.measure === "boolean"
    ? [
        `Dejar ${subject} en funcionamiento`,
        `Validar ${subject} con quienes lo van a usar`,
        `Documentar cómo queda ${subject}`,
        `Dejar a alguien a cargo de sostener ${subject}`,
      ]
    : isDown
      ? [
          `Bajar ${subject} en la primera mitad del ciclo`,
          `Sostener la baja de ${subject} hasta el cierre`,
          `Atacar las dos causas que más pesan en ${subject}`,
          `Dejar ${subject} medida cada semana`,
        ]
      : [
          `Cubrir la mitad de ${subject} antes del ecuador del ciclo`,
          `Sostener el ritmo de ${subject} hasta el cierre`,
          `Recuperar ${subject} donde viene rezagada`,
          `Dejar ${subject} medida cada semana`,
        ];

  return pool.slice(0, count);
}

/** El plan: lo que hay que hacer para llegar. No mueve la cifra por sí solo. */
function actionTitles(objective: Objective, count: number): string[] {
  const subject = subjectOf(objective.title);
  return [
    `Armar el plan de ${subject}`,
    `Ejecutar la primera ola y medir qué movió`,
    `Ajustar con lo aprendido y repetir`,
    `Dejar el seguimiento andando`,
  ].slice(0, count);
}

/**
 * Los hijos de un objetivo recién escrito.
 *
 * `driveProgress` decide si reparten el 100 % de la meta o son solo un plan de
 * apoyo: los resultados clave siempre lo hacen, las acciones solo cuando el
 * modelo lo dice. Todos salen como hito —sin cantidad que teclear— porque un
 * hito se cumple o no, y pedirle a la IA que invente "cuántas veces" cada uno
 * sería inventar una cifra que nadie pidió.
 */
export function buildObjectiveChildren(
  objective: Objective,
  count: number,
  kind: ObjectiveChildrenKind,
  driveProgress: boolean
): KeyAction[] {
  if (kind === "none" || count <= 0) return [];

  const titles = kind === "results" ? resultTitles(objective, count) : actionTitles(objective, count);
  // Sin avance por hijos el aporte no se usa, y dejarlo en cero evita que la
  // tarjeta muestre un reparto que no significa nada.
  const shares = driveProgress ? distributeWeights(titles.length) : titles.map(() => 0);

  return titles.map((title, index) => ({
    ...createKeyAction(shares[index]),
    title,
  }));
}
