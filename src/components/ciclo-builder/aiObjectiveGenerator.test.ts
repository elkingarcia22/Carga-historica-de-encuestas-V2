import { describe, expect, it } from "vitest";
import {
  generateObjectiveFromContext,
  refineObjectiveWording,
} from "./aiObjectiveGenerator";
import { createBlankObjective, type Objective } from "./cicloBuilderTypes";

/**
 * La redacción de un objetivo se arregla leyendo las palabras del autor con
 * una pila de expresiones regulares, y ahí es fácil que un caso arrastre al
 * de al lado: al añadir el infinitivo que faltaba aparecía "Aumentar subamos
 * las ventas", y al quitar el "quiero que" aparecía "Aumentar que". Los dos
 * los encontró esta tabla, así que se queda.
 */

const withTitle = (title: string, extra: Partial<Objective> = {}): Objective => ({
  ...createBlankObjective(),
  title,
  ...extra,
});

describe("refineObjectiveWording", () => {
  it.each([
    // Dictado en voz alta: fuera el arranque, el verbo a infinitivo.
    ["quiero que subamos las ventas del canal digital", "Subir las ventas del canal digital"],
    ["quiero que mejoremos la satisfaccion de los clientes", "Mejorar la satisfaccion de los clientes"],
    ["necesitamos reduzcamos los costos", "Reducir los costos"],
    ["hay que reducir la rotacion", "Reducir la rotacion"],
    // Sin verbo: se le pone el que corresponde.
    ["satisfaccion del cliente", "Aumentar satisfaccion del cliente"],
    // Ya bien escrito: no se toca más que la puntuación sobrante.
    ["aumentar las ventas.", "Aumentar las ventas"],
    // El sustantivo del mismo palo no es un verbo que haya que conjugar.
    ["Mejora continua del proceso", "Mejora continua del proceso"],
  ])("%s → %s", (input, expected) => {
    expect(refineObjectiveWording(withTitle(input)).title).toBe(expected);
  });

  it("respeta la dirección ya elegida al poner el verbo que falta", () => {
    const objective = withTitle("costos de operación", { direction: "decrease" });
    expect(refineObjectiveWording(objective).title).toBe("Reducir costos de operación");
  });

  it("deja la frase como estaba cuando limpiarla no deja objetivo", () => {
    expect(refineObjectiveWording(withTitle("quiero que")).title).toBe("quiero que");
  });

  it("no inventa una descripción que no existía", () => {
    expect(refineObjectiveWording(withTitle("subir ventas")).description).toBe("");
  });

  it("remata la descripción con la cifra cuando el objetivo ya la tiene", () => {
    const objective = withTitle("subir ventas", {
      description: "el dato sale del CRM",
      measure: "numeric",
      direction: "increase",
      initialValue: "10",
      targetValue: "40",
    });
    const { description } = refineObjectiveWording(objective);
    expect(description).toBe("El dato sale del CRM. Subir de 10 a 40 durante el ciclo.");
  });
});

describe("generateObjectiveFromContext", () => {
  it("limpia el arranque dictado al titular", () => {
    expect(
      generateObjectiveFromContext("quiero que mejoremos la satisfaccion de soporte").title
    ).toBe("Mejorar la satisfaccion de soporte");
  });

  it("deja el objetivo listo para medirse", () => {
    const objective = generateObjectiveFromContext("reducir la rotación de los colaboradores");
    expect(objective.measure).not.toBeNull();
    expect(objective.direction).toBe("decrease");
    expect(objective.targetValue).not.toBe("");
  });

  /**
   * El título salía "Reducir la rotación" y la meta subía, porque el verbo
   * conjugado no lo reconocían las pistas de dirección. Título y números
   * tienen que contar la misma historia.
   */
  it("lee la dirección del verbo aunque venga conjugado", () => {
    const objective = generateObjectiveFromContext(
      "quiero que reduzcamos la rotacion de los colaboradores"
    );
    expect(objective.title).toBe("Reducir la rotacion de los colaboradores");
    expect(objective.direction).toBe("decrease");
    expect(Number(objective.targetValue)).toBeLessThan(Number(objective.initialValue));
    expect(objective.description).toContain("Bajar");
  });
});
