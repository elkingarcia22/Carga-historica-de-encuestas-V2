import { describe, expect, it } from "vitest";
import { DEFAULT_PARTICIPANTS } from "@/components/survey-builder";
import { DEFAULT_CICLO_RESULTS_POLICY, type CicloDraft } from "./cicloBuilderTypes";
import {
  levelsForCreator,
  setupBlockIssue,
  setupBlockSummary,
  setupIssue,
  setupModelOptions,
  setupPeriodOptions,
  shouldResetLevels,
} from "./cicloSetup";
import { cicloStepIssue, getCicloStepperOrder } from "./cicloStepper";
import {
  OBJECTIVE_MODEL_PRESETS,
  objectiveModelRuleSentences,
  objectiveModelVocab,
} from "./objectiveModel";

/**
 * La parametrización manda sobre el recorrido entero, así que lo que se
 * prueba aquí no es el formulario sino sus consecuencias: qué pasos existen
 * según gobierno y modelo, qué reclama cada uno, y que las frases de reglas
 * digan lo que el autor espera leer al elegir un modelo.
 */

const draftWith = (extra: Partial<CicloDraft> = {}): CicloDraft => ({
  name: "Objetivos Q1",
  status: "draft",
  period: "trimestre",
  startDate: "2026-01-01",
  endDate: "2026-03-31",
  description: "",
  objectiveModel: "smart",
  modelRules: OBJECTIVE_MODEL_PRESETS.smart,
  objectiveCreator: "hr",
  participants: DEFAULT_PARTICIPANTS,
  useCompanyObjectives: true,
  companyObjectives: [],
  useGroupObjectives: true,
  useIndividualObjectives: false,
  assignment: { groupSegmentBy: "area", groupsAutoInclude: false },
  resultsPolicy: DEFAULT_CICLO_RESULTS_POLICY,
  objectiveSets: [],
  ...extra,
});

describe("getCicloStepperOrder — parametrizado", () => {
  it("RH recorre norte, objetivos y alineación, sin participantes", () => {
    expect(getCicloStepperOrder(draftWith(), "parametrizado")).toEqual([
      "general",
      "company",
      "objectives",
      "alignment",
    ]);
  });

  it("líderes y colaboradores terminan al lanzar: sin objetivos ni alineación", () => {
    expect(getCicloStepperOrder(draftWith({ objectiveCreator: "leader" }), "parametrizado")).toEqual([
      "general",
      "participants",
      "company",
    ]);
    expect(
      getCicloStepperOrder(draftWith({ objectiveCreator: "collaborator" }), "parametrizado")
    ).toEqual(["general", "participants", "company"]);
  });

  it("un modelo sin norte quita el paso de empresa y, con él, la alineación", () => {
    const rules = { ...OBJECTIVE_MODEL_PRESETS.smart, companyObjectives: "off" as const };
    expect(
      getCicloStepperOrder(draftWith({ objectiveModel: "custom", modelRules: rules }), "parametrizado")
    ).toEqual(["general", "objectives"]);
    expect(
      getCicloStepperOrder(
        draftWith({ objectiveModel: "custom", modelRules: rules, objectiveCreator: "leader" }),
        "parametrizado"
      )
    ).toEqual(["general", "participants"]);
  });

  it("decir que no al norte quita el paso de empresa y la alineación", () => {
    // SMART lo deja opcional, así que la respuesta del autor es la que manda.
    const draft = draftWith({ useCompanyObjectives: false });
    expect(getCicloStepperOrder(draft, "parametrizado")).toEqual(["general", "objectives"]);
    expect(
      getCicloStepperOrder({ ...draft, objectiveCreator: "leader" }, "parametrizado")
    ).toEqual(["general", "participants"]);
  });

  it("un modelo que exige el norte no deja apagarlo desde el borrador", () => {
    // El editor fuerza `useCompanyObjectives` con un modelo que lo exige, así
    // que el recorrido de OKR siempre lleva su paso de empresa.
    const draft = draftWith({
      objectiveModel: "okr",
      modelRules: OBJECTIVE_MODEL_PRESETS.okr,
    });
    expect(getCicloStepperOrder(draft, "parametrizado")).toEqual([
      "general",
      "company",
      "objectives",
      "alignment",
    ]);
  });

  it("el flujo guiado no cambia", () => {
    expect(getCicloStepperOrder(draftWith(), "guided")).toEqual([
      "general",
      "company",
      "objectives",
      "alignment",
    ]);
    expect(getCicloStepperOrder(draftWith({ objectiveCreator: "leader" }))).toHaveLength(5);
  });
});

describe("setupBlockIssue", () => {
  it("identidad pide nombre, duración y fechas coherentes, en ese orden", () => {
    expect(setupBlockIssue("identity", draftWith({ name: " " }))).toBe("Ponle nombre al ciclo");
    expect(setupBlockIssue("identity", draftWith({ period: null }))).toBe(
      "Elige la duración del ciclo"
    );
    expect(setupBlockIssue("identity", draftWith({ endDate: "2025-12-01" }))).toBe(
      "El cierre no puede ser antes del inicio"
    );
    expect(setupBlockIssue("identity", draftWith())).toBeNull();
  });

  it("metodología exige modelo; estructura exige al menos un nivel", () => {
    expect(setupBlockIssue("methodology", draftWith({ objectiveModel: null }))).toBe(
      "Elige el modelo de medición"
    );
    expect(
      setupBlockIssue(
        "structure",
        draftWith({ useGroupObjectives: false, useIndividualObjectives: false })
      )
    ).toBe("Elige a qué nivel se asignarán los objetivos");
    expect(setupIssue(draftWith())).toBeNull();
  });

  it("el paso general del flujo parametrizado reclama lo mismo que los bloques", () => {
    const input = {
      draft: draftWith({ objectiveModel: null }),
      visitedSteps: new Set<never>(),
      flow: "parametrizado" as const,
    };
    expect(cicloStepIssue("general", input)).toBe("Elige el modelo de medición");
  });
});

describe("objetivos asignados — parametrizado", () => {
  it("un nivel elegido que no reparte nada bloquea el paso", () => {
    const input = { draft: draftWith(), visitedSteps: new Set<never>(), flow: "parametrizado" as const };
    expect(cicloStepIssue("objectives", input)).toBe("Crea al menos una asignación por grupos");
  });

  it("en el flujo guiado un nivel vacío no bloquea por sí solo", () => {
    const input = { draft: draftWith(), visitedSteps: new Set<never>() };
    expect(cicloStepIssue("objectives", input)).toBe("Crea al menos una asignación de objetivos");
  });
});

describe("niveles según gobierno", () => {
  it("colaboradores fija individual; los demás arrancan sin responder", () => {
    expect(levelsForCreator("collaborator")).toEqual({
      useGroupObjectives: false,
      useIndividualObjectives: true,
    });
    expect(levelsForCreator("hr")).toEqual({
      useGroupObjectives: false,
      useIndividualObjectives: false,
    });
  });

  it("solo entrar o salir de colaboradores vuelve a preguntar el nivel", () => {
    expect(shouldResetLevels("hr", "leader")).toBe(false);
    expect(shouldResetLevels("hr", "collaborator")).toBe(true);
    expect(shouldResetLevels("collaborator", "leader")).toBe(true);
  });
});

describe("opciones del selector", () => {
  it("bimestre y NCT solo aparecen si el borrador ya los traía", () => {
    expect(setupPeriodOptions(null)).not.toContain("bimestre");
    expect(setupPeriodOptions("bimestre")).toContain("bimestre");
    expect(setupModelOptions(null)).not.toContain("nct");
    expect(setupModelOptions("nct")).toContain("nct");
    expect(setupModelOptions("nct").at(-1)).toBe("custom");
  });
});

describe("objectiveModelRuleSentences", () => {
  it("OKR dice que hay objetivo padre; KPI que usa umbrales", () => {
    const okr = objectiveModelRuleSentences(
      OBJECTIVE_MODEL_PRESETS.okr,
      objectiveModelVocab("okr", OBJECTIVE_MODEL_PRESETS.okr)
    );
    expect(okr.some((sentence) => sentence.includes("objetivo padre"))).toBe(true);

    const kpi = objectiveModelRuleSentences(
      OBJECTIVE_MODEL_PRESETS.kpi,
      objectiveModelVocab("kpi", OBJECTIVE_MODEL_PRESETS.kpi)
    );
    expect(kpi).toContain("Usa umbrales que hay que mantener, no metas fijas a las que llegar.");
    expect(kpi[0]).toBe("Cada indicador es una sola métrica, sin nada debajo.");
  });

  it("un modelo sin norte lo dice", () => {
    const rules = { ...OBJECTIVE_MODEL_PRESETS.smart, companyObjectives: "off" as const };
    expect(objectiveModelRuleSentences(rules, objectiveModelVocab("custom", rules))).toContain(
      "No usa objetivos de la empresa: el ciclo se sostiene con lo que se asigna."
    );
  });
});

describe("setupBlockSummary", () => {
  it("resume cada bloque en una línea", () => {
    const draft = draftWith();
    expect(setupBlockSummary("identity", draft)).toBe("Objetivos Q1 · Trimestre · 1 ene – 31 mar 2026");
    // SMART deja el norte opcional, así que el resumen dice qué se contestó.
    expect(setupBlockSummary("methodology", draft)).toBe(
      "SMART · Específico, Medible, Alcanzable, Relevante, Temporal · Con objetivos de la empresa"
    );
    expect(
      setupBlockSummary("methodology", draftWith({ useCompanyObjectives: false }))
    ).toContain("Sin objetivos de la empresa");
    // OKR lo exige: ahí no hubo nada que elegir y el resumen no lo menciona.
    expect(
      setupBlockSummary(
        "methodology",
        draftWith({ objectiveModel: "okr", modelRules: OBJECTIVE_MODEL_PRESETS.okr })
      )
    ).toBe("OKR · Objectives and Key Results");
    expect(setupBlockSummary("governance", draft)).toBe("Administrador / RRHH · Centralizado");
    expect(setupBlockSummary("structure", draft)).toBe("A grupos enteros");
    expect(
      setupBlockSummary("structure", draftWith({ useIndividualObjectives: true }))
    ).toBe("A grupos enteros y A nivel individual");
  });
});
