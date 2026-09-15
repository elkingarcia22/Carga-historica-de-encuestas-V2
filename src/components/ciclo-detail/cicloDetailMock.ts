/**
 * Datos de demostración de la vista de seguimiento.
 *
 * Arma un ciclo completo a partir de una fila de la lista de ciclos: quién
 * participa (grupos reales del directorio), qué objetivos le tocan y cuánto
 * lleva cada persona. Todo es determinista —el mismo ciclo da siempre los
 * mismos números— y el avance se calibra al estado del ciclo: uno "Por
 * iniciar" no tiene nada reportado, uno "Finalizado" tiene cifras de cierre.
 */

import { COLLABORATORS, type Collaborator } from "@/mocks/collaborators";
import {
  createBlankObjective,
  createObjectiveSet,
  parseAmount,
  type CicloPeriod,
  type CicloStatus,
  type Objective,
  type ObjectiveSet,
} from "@/components/ciclo-builder";
import type {
  CicloDetailData,
  EvidenceFile,
  ObjectiveApproval,
  ObjectiveReview,
  ObjectiveUpdate,
  TrackedObjective,
  TrackedPerson,
  UpdateAuthorRole,
} from "./cicloDetailTypes";

/** La fila de la lista de ciclos, tal como la conoce el dashboard. */
export interface CicloListRow {
  id: string;
  nombre: string;
  periodo: string;
  fechaInicio: string;
  fechaCierre: string;
  estado: string;
}

// ── Determinismo ───────────────────────────────────────────────────────────

/** Hash FNV-1a → [0, 1). Suficiente para repartir avances de mentira. */
function unit(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash / 0x100000000;
}

const pick = <T,>(items: readonly T[], seed: string): T =>
  items[Math.floor(unit(seed) * items.length)];

// ── Fechas ─────────────────────────────────────────────────────────────────

const MONTHS: Readonly<Record<string, number>> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

/** "01 julio 2026" → "2026-07-01". Devuelve hoy si no se entiende. */
export function parseSpanishDate(text: string): string {
  const match = text.trim().toLowerCase().match(/^(\d{1,2})\s+(\p{L}+)\s+(\d{4})$/u);
  const now = new Date();
  if (!match || !(match[2] in MONTHS)) return toISODate(now);
  return toISODate(new Date(Number(match[3]), MONTHS[match[2]], Number(match[1])));
}

function toISODate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const PERIODS: Readonly<Record<string, CicloPeriod>> = {
  mes: "mes",
  bimestre: "bimestre",
  trimestre: "trimestre",
  semestre: "semestre",
  año: "anio",
  personalizado: "personalizado",
};

const STATUSES: Readonly<Record<string, CicloStatus>> = {
  borrador: "draft",
  "por iniciar": "scheduled",
  "en curso": "live",
  finalizado: "closed",
};

// ── Objetivos ──────────────────────────────────────────────────────────────

type Seed = Partial<Objective> & Pick<Objective, "title" | "measure">;

const objective = (id: string, seed: Seed): Objective => ({
  ...createBlankObjective(),
  id,
  direction: seed.measure === "boolean" ? null : "increase",
  ...seed,
});

const COMPANY: readonly Objective[] = [
  objective("company-ingresos", {
    title: "Crecer los ingresos recurrentes un 20 %",
    description: "Pasar de $4.200 millones a $5.040 millones de ingreso recurrente anual.",
    measure: "money",
    initialValue: "4.200.000.000",
    targetValue: "5.040.000.000",
  }),
  objective("company-nps", {
    title: "Elevar el NPS de clientes a 65 puntos",
    measure: "numeric",
    initialValue: "52",
    targetValue: "65",
  }),
  objective("company-cultura", {
    title: "Consolidar la cultura de alto desempeño",
    measure: "boolean",
  }),
];

const SET_TALENTO: ObjectiveSet = {
  ...createObjectiveSet("grupal", ["Alto potencial", "Comité de innovación"]),
  id: "set-talento",
  objectives: [
    objective("obj-ventas-nuevas", {
      title: "Cerrar ventas nuevas por $180.000.000",
      description: "Negocios nuevos firmados dentro del trimestre, sin renovaciones.",
      measure: "money",
      initialValue: "0",
      targetValue: "180.000.000",
      weight: 40,
      alignedTo: "company-ingresos",
    }),
    objective("obj-satisfaccion", {
      title: "Subir la satisfacción del cliente al 90 %",
      measure: "percentage",
      initialValue: "78",
      targetValue: "90",
      weight: 35,
      alignedTo: "company-nps",
    }),
    objective("obj-certificacion", {
      title: "Completar la certificación en metodologías ágiles",
      measure: "boolean",
      weight: 25,
      alignedTo: "company-cultura",
    }),
  ],
};

const SET_MENTORES: ObjectiveSet = {
  ...createObjectiveSet("grupal", ["Mentores internos"]),
  id: "set-mentores",
  objectives: [
    objective("obj-sesiones", {
      title: "Acompañar 12 sesiones de mentoría",
      measure: "numeric",
      initialValue: "0",
      targetValue: "12",
      weight: 30,
      alignedTo: "company-cultura",
    }),
    objective("obj-onboarding", {
      title: "Reducir el tiempo de onboarding de 45 a 30 días",
      measure: "numeric",
      direction: "decrease",
      initialValue: "45",
      targetValue: "30",
      weight: 30,
      alignedTo: "company-cultura",
    }),
    objective("obj-mentorados", {
      title: "Lograr una satisfacción de mentorados del 85 %",
      measure: "percentage",
      initialValue: "70",
      targetValue: "85",
      rangeEnabled: true,
      minValue: "75",
      maxValue: "95",
      weight: 25,
      alignedTo: "company-nps",
    }),
    objective("obj-guia", {
      title: "Publicar la guía interna de mentoría",
      measure: "boolean",
      weight: 15,
    }),
  ],
};

const SET_INDIVIDUAL_OPS: ObjectiveSet = {
  ...createObjectiveSet("individual", []),
  id: "set-ind-ops",
  objectives: [
    objective("obj-costos", {
      title: "Reducir los costos operativos de $15.000.000 a $10.000.000",
      measure: "money",
      direction: "decrease",
      initialValue: "15.000.000",
      targetValue: "10.000.000",
      weight: 50,
      alignedTo: "company-ingresos",
    }),
    objective("obj-clientes", {
      title: "Pasar de 12 a 20 clientes nuevos al mes",
      measure: "numeric",
      initialValue: "12",
      targetValue: "20",
      weight: 50,
      alignedTo: "company-ingresos",
    }),
  ],
};

const SET_INDIVIDUAL_CRM: ObjectiveSet = {
  ...createObjectiveSet("individual", []),
  id: "set-ind-crm",
  objectives: [
    objective("obj-crm", {
      title: "Lanzar el nuevo CRM comercial",
      measure: "boolean",
      weight: 40,
      alignedTo: "company-ingresos",
    }),
    objective("obj-retencion", {
      title: "Subir la retención de clientes al 92 %",
      measure: "percentage",
      initialValue: "88",
      targetValue: "92",
      weight: 60,
      alignedTo: "company-nps",
    }),
  ],
};

// ── Avance ─────────────────────────────────────────────────────────────────

const AMOUNT = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

function formatRaw(value: number, measure: Objective["measure"]): string {
  if (measure === "money") return AMOUNT.format(Math.round(value / 1000) * 1000);
  if (measure === "numeric") return AMOUNT.format(Math.round(value));
  return AMOUNT.format(Math.round(value * 10) / 10);
}

/** Qué tanto del tramo inicial→meta lleva recorrido una persona. */
function progressRatio(seed: string, status: CicloStatus): number | null {
  if (status === "draft" || status === "scheduled") return null;
  const roll = unit(`${seed}:roll`);
  const spread = unit(`${seed}:spread`);
  if (status === "closed") return 0.3 + spread * 1.05;
  if (roll < 0.14) return null;
  return -0.1 + spread * 1.35;
}

function valueAt(objective: Objective, ratio: number): string {
  const initial = parseAmount(objective.initialValue) ?? 0;
  const target = parseAmount(objective.targetValue) ?? 0;
  return formatRaw(initial + (target - initial) * ratio, objective.measure);
}

const COLLABORATOR_COMMENTS = [
  "Actualizo con el cierre de la semana. Vamos según lo planeado.",
  "Reporto el avance a la fecha; adjunto el soporte.",
  "Hubo un retraso con un proveedor, pero ya está encaminado.",
  "Cerramos dos negocios esta semana, el resto va en pipeline.",
  "Dejo el informe de seguimiento para revisión.",
  "Avance parcial: falta la validación de finanzas.",
] as const;

/** Lo que el colaborador contesta cuando el líder le pregunta algo. */
const COLLABORATOR_REPLIES = [
  "Sí, con el equipo de datos nos alcanza. Te comparto el corte del viernes.",
  "Listo, adjunto el consolidado que me pediste.",
  "Tienes razón con el margen: ya ajustamos la lista de precios.",
  "Lo vemos en el uno a uno y te confirmo la fecha.",
  "Voy a acelerarlo: reservé dos mañanas de la otra semana para cerrarlo.",
] as const;

const LEADER_COMMENTS = [
  "Buen ritmo. ¿Necesitas apoyo para llegar a la meta del mes?",
  "Revisado. Recuerda adjuntar el consolidado antes del cierre.",
  "Vamos bien, pero ojo con el margen: no sacrifiquemos precio.",
  "Gracias por la actualización. Lo comentamos en el uno a uno.",
  "¿Podemos acelerar la certificación? Quedan pocas semanas.",
] as const;

const EVIDENCE_POOL: readonly Omit<EvidenceFile, "id">[] = [
  { name: "reporte-ventas-agosto.xlsx", size: 184_320, type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  { name: "certificado-scrum-master.pdf", size: 912_400, type: "application/pdf" },
  { name: "captura-dashboard-nps.png", size: 421_880, type: "image/png" },
  { name: "acta-comite-innovacion.pdf", size: 268_100, type: "application/pdf" },
  { name: "encuesta-satisfaccion-q3.xlsx", size: 96_200, type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  { name: "propuesta-cliente-firmada.pdf", size: 1_240_000, type: "application/pdf" },
];

interface Window {
  start: Date;
  end: Date;
}

/**
 * La forma que tiene un día de oficina: dos picos —media mañana y media
 * tarde—, un valle al almuerzo y una cola corta al cierre del día.
 *
 * Va pesada y no repartida por igual entre las ocho y las seis porque el
 * ritmo de actividad del resumen lee justo esto: con una hora tan probable
 * como cualquier otra, ese gráfico sale plano y no tiene nada que decir.
 */
const HOUR_WEIGHTS: readonly (readonly [hour: number, weight: number])[] = [
  [8, 4],
  [9, 9],
  [10, 14],
  [11, 13],
  [12, 7],
  [13, 3],
  [14, 7],
  [15, 11],
  [16, 13],
  [17, 10],
  [18, 5],
  [19, 2],
];

const HOUR_WEIGHT_TOTAL = HOUR_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);

function weightedHour(seed: string): number {
  let ticket = unit(seed) * HOUR_WEIGHT_TOTAL;
  for (const [hour, weight] of HOUR_WEIGHTS) {
    ticket -= weight;
    if (ticket <= 0) return hour;
  }
  return HOUR_WEIGHTS[HOUR_WEIGHTS.length - 1][0];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Cuándo se reportó algo: un punto del calendario del ciclo, corrido al cierre
 * del mes y fuera del fin de semana, con una hora de oficina.
 *
 * Las tres correcciones son las que hacen legible el ritmo de actividad: sin
 * ellas los reportes caen igual de repartidos un domingo a las 3 de la tarde
 * que un miércoles a media mañana, y el gráfico del resumen —que existe justo
 * para decir "cuándo actualiza la gente"— saldría parejo.
 */
function dateBetween(seed: string, window: Window, share: number): string {
  const span = window.end.getTime() - window.start.getTime();
  const jitter = (unit(`${seed}:jitter`) - 0.5) * 0.08;
  const at = window.start.getTime() + span * Math.max(0.02, Math.min(0.98, share + jitter));
  const date = new Date(at);

  // El cierre de mes es cuando alguien se acuerda de actualizar lo que lleva:
  // un tercio de los reportes cae en los últimos días. Solo si el mes que le
  // toca cierra dentro del calendario del ciclo; si no, se queda donde estaba.
  if (unit(`${seed}:month-end`) < 0.34) {
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const nudged = new Date(monthEnd.getTime() - Math.floor(unit(`${seed}:tail`) * 3) * DAY_MS);
    if (nudged >= window.start && nudged <= window.end) {
      date.setTime(nudged.getTime());
    }
  }

  // Nadie reporta un objetivo el fin de semana: el sábado retrocede al viernes
  // y el domingo avanza al lunes, salvo que el lunes se saliera del ciclo.
  const weekday = date.getDay();
  if (weekday === 6) date.setTime(date.getTime() - DAY_MS);
  if (weekday === 0) {
    const monday = date.getTime() + DAY_MS;
    date.setTime(monday <= window.end.getTime() ? monday : date.getTime() - 2 * DAY_MS);
  }

  date.setHours(weightedHour(`${seed}:hour`), Math.floor(unit(`${seed}:min`) * 60), 0, 0);
  return date.toISOString();
}

function buildUpdates(
  person: Collaborator,
  objective: Objective,
  currentValue: string,
  status: CicloStatus,
  window: Window,
  cicloId: string
): readonly ObjectiveUpdate[] {
  const seed = `${cicloId}:${person.id}:${objective.id}`;
  const leaderName = person.leader ?? "Líder de área";
  const hasValue = currentValue !== "";
  // Dos mensajes como piso cuando hay algo reportado: con uno solo el hilo no
  // es un hilo, y lo que esta vista tiene que enseñar es justamente la
  // conversación entre el colaborador y su líder alrededor del avance.
  const count = hasValue
    ? 2 + Math.floor(unit(`${seed}:count`) * 3)
    : unit(`${seed}:comment-only`) < 0.3
      ? 1
      : 0;
  if (count === 0) return [];

  const finalRatio =
    objective.measure === "boolean"
      ? 1
      : progressRatio(seed, status) ?? 0;

  const updates: ObjectiveUpdate[] = [];
  /** El último mensaje de primer nivel: de él cuelgan las respuestas. */
  let lastRootId: string | null = null;

  for (let index = 0; index < count; index += 1) {
    const isLast = index === count - 1;
    const stepSeed = `${seed}:${index}`;
    const share = (index + 1) / (count + 0.6);
    // El último mensaje es siempre del colaborador y abre hilo: es el que
    // deja el objetivo en el valor que muestra la tabla, y un valor escondido
    // dentro de una respuesta se leería como un comentario más.
    const isLeader = !isLast && lastRootId !== null && unit(`${stepSeed}:author`) < 0.55;
    const role: UpdateAuthorRole = isLeader ? "lider" : "colaborador";
    const previous = updates[updates.length - 1];
    const answersLeader =
      !isLeader &&
      !isLast &&
      previous !== undefined &&
      previous.authorRole === "lider" &&
      unit(`${stepSeed}:answer`) < 0.65;
    const replyTo = isLeader || answersLeader ? lastRootId : null;

    let value: string | null = null;
    if (hasValue && !isLeader) {
      if (objective.measure === "boolean") {
        value = isLast ? currentValue : "false";
      } else {
        value = isLast ? currentValue : valueAt(objective, finalRatio * share);
      }
    }

    // El soporte viaja con quien lo tiene: casi siempre con el reporte, a
    // veces con una respuesta —el líder que devuelve el acta del comité.
    const evidences: EvidenceFile[] = [];
    if (unit(`${stepSeed}:evidence`) < (value !== null ? 0.55 : 0.3)) {
      evidences.push({ id: `evidence-${stepSeed}`, ...pick(EVIDENCE_POOL, `${stepSeed}:file`) });
      if (unit(`${stepSeed}:evidence-2`) < 0.3) {
        evidences.push({ id: `evidence-${stepSeed}-b`, ...pick(EVIDENCE_POOL, `${stepSeed}:file-2`) });
      }
    }

    const id = `update-${stepSeed}`;
    if (replyTo === null) lastRootId = id;

    updates.push({
      id,
      authorId: isLeader ? `leader-${leaderName}` : person.id,
      authorName: isLeader ? leaderName : person.name,
      authorRole: role,
      date: dateBetween(stepSeed, window, share),
      value,
      comment: isLeader
        ? pick(LEADER_COMMENTS, `${stepSeed}:text`)
        : answersLeader
          ? pick(COLLABORATOR_REPLIES, `${stepSeed}:text`)
          : pick(COLLABORATOR_COMMENTS, `${stepSeed}:text`),
      evidences,
      replyTo,
    });
  }

  return updates;
}


/** Lo que un líder pide cambiar cuando devuelve un objetivo. */
const REVIEW_COMMENTS = [
  "La meta me parece baja para el trimestre. Súbela y volvemos a hablar.",
  "Falta el valor inicial: sin él no se puede calcular el avance.",
  "Este objetivo se cruza con el de tu compañero. Delimítalo mejor.",
  "El peso no corresponde al esfuerzo real. Ajústalo antes de aprobarlo.",
  "Redacta la meta en términos medibles, no como una intención.",
] as const;

/**
 * La revisión del líder sobre un objetivo.
 *
 * Un ciclo cerrado no tiene objetivos sin aprobar —no habría cerrado con
 * ellos—, así que solo los ciclos vivos reparten pendientes: una minoría
 * esperando visto bueno y una minoría más pequeña devuelta con cambios. Es la
 * proporción que hace la vista útil: suficiente para que el bloqueo se vea,
 * no tanta como para que parezca el estado normal.
 */
function reviewObjective(
  person: Collaborator,
  objective: Objective,
  status: CicloStatus,
  window: Window,
  cicloId: string
): ObjectiveReview {
  const seed = `${cicloId}:${person.id}:${objective.id}:review`;
  const leaderName = person.leader ?? "Líder de área";
  const roll = unit(seed);

  if (status === "closed" || status === "draft" || roll > 0.16) {
    return {
      status: "aprobado",
      reviewerName: leaderName,
      date: dateBetween(`${seed}:ok`, window, 0.02),
      comment: "",
    };
  }

  if (roll > 0.06) {
    return { status: "pendiente", reviewerName: null, date: null, comment: "" };
  }

  return {
    status: "ajustes",
    reviewerName: leaderName,
    date: dateBetween(`${seed}:back`, window, 0.08),
    comment: pick(REVIEW_COMMENTS, `${seed}:text`),
  };
}

/**
 * `cicloId` is part of every seed on purpose: the same person carrying the
 * same objective in two different ciclos has to land on two different values,
 * or thirty ciclos all report the identical avance and every average built
 * over them — the home's own cards included — flattens into one number.
 */
function trackObjective(
  person: Collaborator,
  objective: Objective,
  status: CicloStatus,
  window: Window,
  cicloId: string
): TrackedObjective {
  const seed = `${cicloId}:${person.id}:${objective.id}`;
  const review = reviewObjective(person, objective, status, window, cicloId);
  // Un objetivo que no está aprobado no puede tener avance: quien lo escribió
  // todavía no tiene permiso de reportar nada contra él.
  const ratio = review.status === "aprobado" ? progressRatio(seed, status) : null;
  let currentValue = "";
  if (ratio !== null) {
    if (objective.measure === "boolean") {
      const roll = unit(`${seed}:bool`);
      currentValue =
        status === "closed" ? (roll > 0.35 ? "true" : "false") : roll > 0.55 ? "true" : roll < 0.2 ? "false" : "";
    } else {
      currentValue = valueAt(objective, ratio);
    }
  }
  return {
    objective,
    currentValue,
    updates:
      review.status === "aprobado"
        ? buildUpdates(person, objective, currentValue, status, window, cicloId)
        : [],
    review,
  };
}

// ── Demo fijo: Alejandro Castro Moreno con los cinco estados ───────────────

/**
 * Un colaborador real del directorio —nace del mismo hash que arma
 * `COLLABORATORS`, no un registro aparte— al que se le fijan cinco objetivos,
 * uno por cada estado del flujo: por aprobar, por ajustar, por iniciar, en
 * progreso y completado. El resto del ciclo reparte esos estados al azar
 * según la semilla, así que verlos los cinco a la vez en una sola persona
 * depende de la suerte; aquí no: siempre están, para probar el reporte
 * individual y la vista de seguimiento sin tener que buscarlos.
 */
const ALEJANDRO_DEMO_ID = "collab-2007";
const SET_ALEJANDRO_DEMO_ID = "set-ind-alejandro-demo";

const OBJETIVOS_ALEJANDRO_DEMO: readonly Objective[] = [
  objective("obj-ale-portal", {
    title: "Publicar el nuevo portal de proveedores",
    measure: "boolean",
    weight: 20,
  }),
  objective("obj-ale-soporte", {
    title: "Reducir el tiempo de respuesta de soporte de 48 a 24 horas",
    measure: "numeric",
    direction: "decrease",
    initialValue: "48",
    targetValue: "24",
    weight: 20,
  }),
  objective("obj-ale-alianzas", {
    title: "Cerrar alianzas comerciales por $50.000.000",
    measure: "money",
    initialValue: "0",
    targetValue: "50.000.000",
    weight: 20,
  }),
  objective("obj-ale-nps", {
    title: "Subir el NPS de cuenta a 80 puntos",
    measure: "numeric",
    initialValue: "60",
    targetValue: "80",
    weight: 20,
  }),
  objective("obj-ale-certificacion", {
    title: "Certificar al equipo en la nueva metodología",
    measure: "boolean",
    weight: 20,
  }),
];

const SET_ALEJANDRO_DEMO: ObjectiveSet = {
  ...createObjectiveSet("individual", [ALEJANDRO_DEMO_ID]),
  id: SET_ALEJANDRO_DEMO_ID,
  objectives: OBJETIVOS_ALEJANDRO_DEMO,
};

/** A qué estado se fija cada uno: su revisión y, si ya arrancó, su avance. */
const ALEJANDRO_DEMO_OUTCOMES: Readonly<Record<string, { review: ObjectiveApproval; currentValue: string }>> = {
  "obj-ale-portal": { review: "pendiente", currentValue: "" },
  "obj-ale-soporte": { review: "ajustes", currentValue: "" },
  "obj-ale-alianzas": { review: "aprobado", currentValue: "" },
  "obj-ale-nps": { review: "aprobado", currentValue: "72" },
  "obj-ale-certificacion": { review: "aprobado", currentValue: "true" },
};

function trackAlejandroObjective(
  person: Collaborator,
  objective: Objective,
  window: Window,
  cicloId: string
): TrackedObjective {
  const outcome = ALEJANDRO_DEMO_OUTCOMES[objective.id];
  const leaderName = person.leader ?? "Líder de área";
  const seed = `${cicloId}:${person.id}:${objective.id}:demo`;

  const review: ObjectiveReview =
    outcome.review === "aprobado"
      ? {
          status: "aprobado",
          reviewerName: leaderName,
          date: dateBetween(`${seed}:ok`, window, 0.05),
          comment: "",
        }
      : outcome.review === "pendiente"
        ? { status: "pendiente", reviewerName: null, date: null, comment: "" }
        : {
            status: "ajustes",
            reviewerName: leaderName,
            date: dateBetween(`${seed}:back`, window, 0.08),
            comment: pick(REVIEW_COMMENTS, `${seed}:text`),
          };

  const updates: readonly ObjectiveUpdate[] =
    review.status === "aprobado" && outcome.currentValue !== ""
      ? [
          {
            id: `update-${seed}`,
            authorId: person.id,
            authorName: person.name,
            authorRole: "colaborador",
            date: dateBetween(seed, window, 0.85),
            value: outcome.currentValue,
            comment: pick(COLLABORATOR_COMMENTS, `${seed}:text`),
            evidences: [],
          },
        ]
      : [];

  return { objective, currentValue: outcome.currentValue, updates, review };
}

/** El colaborador con sus cinco objetivos fijos, o null si el directorio
 *  cambiara y el id ya no existiera. */
function alejandroDemoPerson(window: Window, cicloId: string): TrackedPerson | null {
  const person = COLLABORATORS.find((candidate) => candidate.id === ALEJANDRO_DEMO_ID);
  if (!person) return null;
  return {
    id: person.id,
    collaborator: person,
    setId: SET_ALEJANDRO_DEMO_ID,
    groupId: null,
    objectives: OBJETIVOS_ALEJANDRO_DEMO.map((item) =>
      trackAlejandroObjective(person, item, window, cicloId)
    ),
  };
}

// ── Demo fijo: Ana Cifuentes Cifuentes con los seis estados ────────────────

/**
 * Otro colaborador real del directorio, con seis objetivos fijados: los
 * cinco tramos del flujo de aprobación —por aprobar, por ajustar, por
 * iniciar, en progreso, completado— más uno inactivado, para poder probar
 * también Inactivar/Activar desde su ficha sin tener que salir a buscarlo.
 * Mismo patrón que Alejandro Castro Moreno, arriba: nace del mismo hash del
 * directorio, con sus objetivos fijados aparte del reparto por grupo.
 */
const ANA_DEMO_ID = "collab-6228";
const SET_ANA_DEMO_ID = "set-ind-ana-demo";

const OBJETIVOS_ANA_DEMO: readonly Objective[] = [
  objective("obj-ana-nps", {
    title: "Subir el NPS interno de tecnología a 75 puntos",
    measure: "numeric",
    initialValue: "58",
    targetValue: "75",
    weight: 20,
  }),
  objective("obj-ana-incidentes", {
    title: "Reducir los incidentes críticos de 12 a 4 por trimestre",
    measure: "numeric",
    direction: "decrease",
    initialValue: "12",
    targetValue: "4",
    weight: 20,
  }),
  objective("obj-ana-migracion", {
    title: "Migrar el 100 % de los servicios al nuevo clúster",
    measure: "percentage",
    initialValue: "0",
    targetValue: "100",
    weight: 20,
  }),
  objective("obj-ana-automatizacion", {
    title: "Automatizar el 80 % de los despliegues manuales",
    measure: "percentage",
    initialValue: "15",
    targetValue: "80",
    weight: 20,
  }),
  objective("obj-ana-certificacion", {
    title: "Certificar al equipo en buenas prácticas de seguridad",
    measure: "boolean",
    weight: 10,
  }),
  objective("obj-ana-catalogo", {
    title: "Consolidar el catálogo de APIs internas",
    measure: "percentage",
    initialValue: "0",
    targetValue: "100",
    weight: 10,
  }),
];

const SET_ANA_DEMO: ObjectiveSet = {
  ...createObjectiveSet("individual", [ANA_DEMO_ID]),
  id: SET_ANA_DEMO_ID,
  objectives: OBJETIVOS_ANA_DEMO,
};

/** A qué estado se fija cada uno. `inactivo` solo aplica al que además debe
 *  probar Inactivar/Activar — el resto se queda tal cual quede su revisión. */
const ANA_DEMO_OUTCOMES: Readonly<
  Record<string, { review: ObjectiveApproval; currentValue: string; inactivo?: boolean }>
> = {
  "obj-ana-nps": { review: "pendiente", currentValue: "" },
  "obj-ana-incidentes": { review: "ajustes", currentValue: "" },
  "obj-ana-migracion": { review: "aprobado", currentValue: "" },
  "obj-ana-automatizacion": { review: "aprobado", currentValue: "52" },
  "obj-ana-certificacion": { review: "aprobado", currentValue: "true" },
  "obj-ana-catalogo": { review: "aprobado", currentValue: "40", inactivo: true },
};

function trackAnaObjective(
  person: Collaborator,
  objective: Objective,
  window: Window,
  cicloId: string
): TrackedObjective {
  const outcome = ANA_DEMO_OUTCOMES[objective.id];
  const leaderName = person.leader ?? "Líder de área";
  const seed = `${cicloId}:${person.id}:${objective.id}:demo`;

  const review: ObjectiveReview =
    outcome.review === "aprobado"
      ? {
          status: "aprobado",
          reviewerName: leaderName,
          date: dateBetween(`${seed}:ok`, window, 0.05),
          comment: "",
        }
      : outcome.review === "pendiente"
        ? { status: "pendiente", reviewerName: null, date: null, comment: "" }
        : {
            status: "ajustes",
            reviewerName: leaderName,
            date: dateBetween(`${seed}:back`, window, 0.08),
            comment: pick(REVIEW_COMMENTS, `${seed}:text`),
          };

  const updates: readonly ObjectiveUpdate[] =
    review.status === "aprobado" && outcome.currentValue !== ""
      ? [
          {
            id: `update-${seed}`,
            authorId: person.id,
            authorName: person.name,
            authorRole: "colaborador",
            date: dateBetween(seed, window, 0.85),
            value: outcome.currentValue,
            comment: pick(COLLABORATOR_COMMENTS, `${seed}:text`),
            evidences: [],
          },
        ]
      : [];

  return {
    objective,
    currentValue: outcome.currentValue,
    updates,
    review,
    inactivation: outcome.inactivo
      ? {
          date: dateBetween(`${seed}:inactive`, window, 0.92),
          authorName: leaderName,
          percentAtInactivation: 40,
        }
      : null,
  };
}

/** El colaborador con sus seis objetivos fijos, o null si el directorio
 *  cambiara y el id ya no existiera. */
function anaDemoPerson(window: Window, cicloId: string): TrackedPerson | null {
  const person = COLLABORATORS.find((candidate) => candidate.id === ANA_DEMO_ID);
  if (!person) return null;
  return {
    id: person.id,
    collaborator: person,
    setId: SET_ANA_DEMO_ID,
    groupId: null,
    objectives: OBJETIVOS_ANA_DEMO.map((item) => trackAnaObjective(person, item, window, cicloId)),
  };
}

// ── Ensamble ───────────────────────────────────────────────────────────────

const GROUP_SETS = [SET_TALENTO, SET_MENTORES] as const;

function peopleForGroups(status: CicloStatus, window: Window, cicloId: string): TrackedPerson[] {
  return GROUP_SETS.flatMap((set) =>
    set.targetIds.flatMap((groupId) =>
      // Alejandro Castro Moreno y Ana Cifuentes Cifuentes salen del reparto
      // por grupo: sus objetivos están fijados aparte, más arriba, y
      // aparecer también aquí los duplicaría con una segunda asignación.
      COLLABORATORS.filter(
        (person) =>
          person.customGroup === groupId &&
          person.id !== ALEJANDRO_DEMO_ID &&
          person.id !== ANA_DEMO_ID
      ).map((person) => ({
        id: person.id,
        collaborator: person,
        setId: set.id,
        groupId,
        objectives: set.objectives.map((item) => trackObjective(person, item, status, window, cicloId)),
      }))
    )
  );
}

/**
 * A quiénes les tocan los sets individuales.
 *
 * Vive aparte del seguimiento porque el reparto es configuración del ciclo
 * —lo que el constructor reabre para editar— y las cifras reportadas no. Los
 * dos tienen que nombrar exactamente a las mismas personas, así que salen de
 * esta única lista en vez de repetirse en cada sitio.
 */
function individualAssignments(): {
  ops: ObjectiveSet;
  crm: ObjectiveSet;
  opsPeople: readonly Collaborator[];
  crmPeople: readonly Collaborator[];
} {
  // Personas sin grupo ad hoc, para que nadie reciba dos asignaciones.
  const pool = COLLABORATORS.filter((person) => person.customGroup === null);
  const opsPeople = [pool[7], pool[42], pool[113]];
  const crmPeople = [pool[260]];
  return {
    opsPeople,
    crmPeople,
    ops: { ...SET_INDIVIDUAL_OPS, targetIds: opsPeople.map((person) => person.id) },
    crm: { ...SET_INDIVIDUAL_CRM, targetIds: crmPeople.map((person) => person.id) },
  };
}

function individualPeople(status: CicloStatus, window: Window, cicloId: string): {
  people: TrackedPerson[];
  sets: ObjectiveSet[];
} {
  const { ops, crm, opsPeople, crmPeople } = individualAssignments();

  const track = (set: ObjectiveSet, people: readonly Collaborator[]): TrackedPerson[] =>
    people.map((person) => ({
      id: person.id,
      collaborator: person,
      setId: set.id,
      groupId: null,
      objectives: set.objectives.map((item) => trackObjective(person, item, status, window, cicloId)),
    }));

  return { people: [...track(ops, opsPeople), ...track(crm, crmPeople)], sets: [ops, crm] };
}

const CICLO_DESCRIPTION =
  "Ciclo de objetivos del equipo de talento e innovación: crecimiento comercial, experiencia de cliente y consolidación cultural.";

/**
 * Cómo quedó configurado el ciclo: fechas, grupos y objetivos repartidos, sin
 * una sola línea de seguimiento.
 *
 * Es la mitad del ciclo que se puede editar —la que el constructor reabre al
 * pulsar "Editar ciclo"—, y sale de las mismas listas que la vista de
 * seguimiento para que las dos no cuenten ciclos distintos. Se separa porque
 * armar el avance de cada persona cuesta mucho más que leer el reparto, y
 * quien va a editar todavía no está mirando el avance.
 */
export interface CicloSetup {
  status: CicloStatus;
  period: CicloPeriod;
  startDate: string;
  endDate: string;
  description: string;
  segmentBy: CicloDetailData["segmentBy"];
  companyObjectives: readonly Objective[];
  sets: readonly ObjectiveSet[];
}

export function buildCicloSetup(row: CicloListRow): CicloSetup {
  const individual = individualAssignments();
  const hasAlejandro = COLLABORATORS.some((person) => person.id === ALEJANDRO_DEMO_ID);
  const hasAna = COLLABORATORS.some((person) => person.id === ANA_DEMO_ID);

  return {
    status: STATUSES[row.estado.toLowerCase()] ?? "live",
    period: PERIODS[row.periodo.toLowerCase()] ?? "personalizado",
    startDate: parseSpanishDate(row.fechaInicio),
    endDate: parseSpanishDate(row.fechaCierre),
    description: CICLO_DESCRIPTION,
    segmentBy: "customGroup",
    companyObjectives: COMPANY,
    sets: [
      ...GROUP_SETS,
      individual.ops,
      individual.crm,
      ...(hasAlejandro ? [SET_ALEJANDRO_DEMO] : []),
      ...(hasAna ? [SET_ANA_DEMO] : []),
    ],
  };
}

/** El ciclo completo detrás de una fila de la lista. */
export function buildCicloDetail(row: CicloListRow, now: Date = new Date()): CicloDetailData {
  const setup = buildCicloSetup(row);
  const status = setup.status;
  const startDate = setup.startDate;
  const endDate = setup.endDate;

  // Las actualizaciones caen dentro del calendario del ciclo, y nunca en el
  // futuro: en un ciclo abierto la última puede ser de hoy, no de mañana.
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59`);
  const window: Window = {
    start: start < now ? start : new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
    end: status === "closed" ? end : new Date(Math.min(end.getTime(), now.getTime())),
  };
  if (window.end <= window.start) window.end = new Date(window.start.getTime() + 24 * 60 * 60 * 1000);

  const individual = individualPeople(status, window, row.id);
  const alejandro = alejandroDemoPerson(window, row.id);
  const ana = anaDemoPerson(window, row.id);

  return {
    id: row.id,
    name: row.nombre,
    status,
    period: setup.period,
    startDate,
    endDate,
    description: setup.description,
    segmentBy: setup.segmentBy,
    companyObjectives: setup.companyObjectives,
    sets: setup.sets,
    people: [
      ...peopleForGroups(status, window, row.id),
      ...individual.people,
      ...(alejandro ? [alejandro] : []),
      ...(ana ? [ana] : []),
    ],
  };
}
