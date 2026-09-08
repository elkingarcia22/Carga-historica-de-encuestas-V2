/**
 * Quién es quién para la carga masiva, a partir de lo que la vista de
 * seguimiento ya sabe.
 *
 * La revisión resuelve cada identificador del archivo contra dos listas: la
 * gente del ciclo (con los objetivos que ya llevan, porque la regla del 100%
 * es sobre todo lo que carga una persona) y el directorio completo de UBITS
 * (porque un archivo puede nombrar a alguien que todavía hay que agregar). Las
 * dos salen de aquí, traducidas al vocabulario del importador.
 */

import { parseAmount, type MeasureType as BuilderMeasure } from "@/components/ciclo-builder";
import type { CicloDetailData, TrackedObjective } from "@/components/ciclo-detail/cicloDetailTypes";
import type { CycleObjective, MeasureType, RosterUser } from "@/lib/objectivesImport";
import { COLLABORATORS } from "@/mocks/collaborators";
import { DEMO_CYCLE_ROSTER, DEMO_UBITS_DIRECTORY } from "@/mocks/cargaObjetivosDemo";

/** El vocabulario del constructor, dicho como lo escribe la plantilla oficial. */
const MEASURE_LABEL: Readonly<Record<BuilderMeasure, MeasureType>> = {
  money: "Dinero",
  percentage: "Porcentaje",
  numeric: "Numérico",
  boolean: "Se cumple / No se cumple",
};

/**
 * Un objetivo tal como lo lleva una persona en el ciclo, en la forma que la
 * revisión compara y edita.
 *
 * Los valores del constructor son texto ("80.000", "62,5") porque allá una
 * cifra a medio escribir todavía no es un número; aquí ya lo son, y una que no
 * se pueda leer queda como `NaN` para que las reglas la marquen en vez de
 * inventarle un cero.
 */
function toCycleObjective(tracked: TrackedObjective): CycleObjective {
  const { objective, currentValue } = tracked;
  const isBoolean = objective.measure === "boolean";
  const current = parseAmount(currentValue);

  return {
    id: objective.id,
    title: objective.title,
    description: objective.description,
    weightPercent: objective.weight,
    measureType: objective.measure ? MEASURE_LABEL[objective.measure] : "Numérico",
    trend: objective.direction === "decrease" ? "Reducir" : "Aumentar",
    initialValue: isBoolean ? 0 : parseAmount(objective.initialValue),
    target: isBoolean ? 1 : (parseAmount(objective.targetValue) ?? NaN),
    minProgress: objective.rangeEnabled ? parseAmount(objective.minValue) : null,
    maxProgress: objective.rangeEnabled ? parseAmount(objective.maxValue) : null,
    // Ausente —no null— cuando nadie ha reportado: son dos cosas distintas.
    ...(current !== null ? { currentProgress: current } : {}),
  };
}

/**
 * La gente del ciclo, con lo que ya carga cada quien.
 *
 * A la tabla de seguimiento se le suma el roster de demostración: los archivos
 * de muestra nombran a esas personas, y sin ellas la experiencia de la carga
 * no se puede recorrer completa. Si alguna ya estuviera en el ciclo, gana la
 * del ciclo.
 */
export function buildCycleRoster(data: CicloDetailData): RosterUser[] {
  const people: RosterUser[] = data.people.map((person) => ({
    username: person.collaborator.username,
    name: person.collaborator.name,
    email: person.collaborator.email,
    area: person.collaborator.area,
    leader: person.collaborator.leader ?? undefined,
    cycleObjectives: person.objectives.map(toCycleObjective),
  }));

  const known = new Set(people.map((user) => user.username));
  return [...people, ...DEMO_CYCLE_ROSTER.filter((user) => !known.has(user.username))];
}

/**
 * Todo UBITS menos el ciclo: el directorio de la empresa más los usuarios de
 * demostración que existen pero no están asignados.
 */
export function buildUbitsDirectory(roster: readonly RosterUser[]): RosterUser[] {
  const onCycle = new Set(roster.map((user) => user.username));

  const company: RosterUser[] = COLLABORATORS.filter(
    (collaborator) => !onCycle.has(collaborator.username)
  ).map((collaborator) => ({
    username: collaborator.username,
    name: collaborator.name,
    email: collaborator.email,
    area: collaborator.area,
    leader: collaborator.leader ?? undefined,
  }));

  /**
   * La gente del roster de demostración que no está en *este* ciclo —el caso
   * de un ciclo recién creado, que todavía no tiene a nadie— sigue existiendo
   * en UBITS: un archivo puede nombrarla y la carga la agrega al ciclo. Sin
   * esto, los archivos de muestra caían enteros en "sin alinear" contra un
   * ciclo nuevo, como si esas personas no existieran en la plataforma.
   *
   * Viajan sin sus `cycleObjectives`, que son los del ciclo donde sí están:
   * contarlos aquí le sumaría a la regla del 100 % un peso de otro ciclo.
   */
  const demoOffCycle: RosterUser[] = DEMO_CYCLE_ROSTER.filter(
    (user) => !onCycle.has(user.username)
  ).map((user) => ({ ...user, cycleObjectives: undefined }));

  return [
    ...DEMO_UBITS_DIRECTORY.filter((user) => !onCycle.has(user.username)),
    ...demoOffCycle,
    ...company,
  ];
}
