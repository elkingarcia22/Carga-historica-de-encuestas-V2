/**
 * Vista de seguimiento de un ciclo — tipos de dominio.
 *
 * El builder produce un `CicloDraft`: quién está en el ciclo y qué objetivos
 * le tocan a cada quien. Una vez el ciclo arranca aparece lo que el builder
 * nunca tuvo: el valor que cada persona lleva reportado en cada objetivo, y la
 * conversación alrededor de ese valor (comentarios, evidencias, quién lo
 * actualizó). Estos tipos son esa capa: un objetivo *por persona*, con su
 * historial, montado encima del `Objective` que el builder ya definió.
 */

import type { Collaborator } from "@/mocks/collaborators";
import type { SegmentKey } from "@/components/survey-builder";
import type {
  CicloPeriod,
  CicloStatus,
  Objective,
  ObjectiveSet,
} from "@/components/ciclo-builder";

/** Quién escribe una actualización. Decide el rótulo junto al nombre. */
export type UpdateAuthorRole = "colaborador" | "lider" | "admin";

export const UPDATE_AUTHOR_ROLE_LABELS: Readonly<Record<UpdateAuthorRole, string>> = {
  colaborador: "Colaborador",
  lider: "Líder",
  admin: "Administrador",
};

/** Un archivo adjunto a una actualización. Solo metadatos: el binario no
 * viaja por el estado de la pantalla. */
export interface EvidenceFile {
  id: string;
  name: string;
  size: number;
  type: string;
}

/**
 * Una entrada del historial de un objetivo.
 *
 * `value` es el nuevo valor reportado, o null cuando la entrada es solo un
 * comentario —una pregunta del líder, una aclaración— que no mueve el
 * avance. Ambas conviven en el mismo hilo porque así las lee la gente: la
 * conversación sobre un objetivo es una sola, tenga o no cifras.
 */
export interface ObjectiveUpdate {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: UpdateAuthorRole;
  /** ISO con hora. */
  date: string;
  value: string | null;
  comment: string;
  evidences: readonly EvidenceFile[];
  /**
   * El mensaje de este mismo objetivo al que responde, o `null` (y ausente en
   * los ciclos que ya existen) cuando abre hilo.
   *
   * El historial de un objetivo no es una lista de reportes: el líder pregunta,
   * el colaborador contesta y adjunta el soporte, y esa ida y vuelta solo se
   * lee bien si cada respuesta cuelga de lo que responde. Una sola altura de
   * anidamiento a propósito —una respuesta a una respuesta sigue colgando del
   * mismo mensaje raíz—, porque un hilo de objetivo se sigue en vertical y no
   * en profundidad.
   */
  replyTo?: string | null;
}

/**
 * Dónde va la aprobación del líder sobre un objetivo.
 *
 * Un objetivo no arranca solo porque el ciclo arrancó: su líder tiene que
 * aprobarlo. Si en vez de aprobarlo pide cambios, el objetivo vuelve a manos
 * de quien lo escribió —"Por ajustar"— y no cuenta como avance de nadie
 * mientras siga ahí.
 */
export type ObjectiveApproval = "pendiente" | "ajustes" | "aprobado";

export interface ObjectiveReview {
  status: ObjectiveApproval;
  /** Quién revisó, o null mientras nadie lo haya mirado. */
  reviewerName: string | null;
  /** ISO con hora de la última decisión, null si aún no hay ninguna. */
  date: string | null;
  /** Qué pidió cambiar el líder. Solo tiene texto con "ajustes". */
  comment: string;
}

/**
 * Que un objetivo puntual quedó fuera de juego: alguien lo inactivó a mitad
 * de camino porque ya no aplica, sin que eso borre lo que llevaba.
 *
 * `percentAtInactivation` congela el cumplimiento del momento en que se
 * inactivó — el número que se sigue mostrando en la ficha aunque el objetivo
 * ya no sume en el peso ni en el promedio de la persona.
 */
export interface ObjectiveInactivation {
  /** ISO con hora. */
  date: string;
  authorName: string;
  percentAtInactivation: number;
}

/** Un objetivo tal como lo lleva *una* persona: la definición más su avance. */
export interface TrackedObjective {
  objective: Objective;
  /** Último valor reportado, en el mismo formato crudo que usa el builder
   * ("80.000", "62,5"). Vacío mientras nadie haya reportado nada. */
  currentValue: string;
  updates: readonly ObjectiveUpdate[];
  /**
   * La revisión del líder. Opcional: la vista de seguimiento no la lee y los
   * ciclos que ya existen no la traen, así que su ausencia se interpreta como
   * "aprobado" —que es lo que un objetivo en curso ya era antes de que el
   * flujo de aprobación existiera.
   */
  review?: ObjectiveReview;
  /**
   * Presente cuando este objetivo puntual está inactivo. A diferencia del
   * estado de un participante —que saca a toda la persona de los
   * resultados— esto excluye un solo objetivo: los demás de la persona
   * siguen contando normal.
   */
  inactivation?: ObjectiveInactivation | null;
}

export interface TrackedPerson {
  /** Igual al id del colaborador. */
  id: string;
  collaborator: Collaborator;
  /** La asignación de la que salieron sus objetivos. */
  setId: string;
  /** El grupo por el que recibió la asignación, o null si fue individual. */
  groupId: string | null;
  objectives: readonly TrackedObjective[];
}

export interface CicloDetailData {
  id: string;
  name: string;
  status: CicloStatus;
  period: CicloPeriod;
  /** ISO `yyyy-mm-dd`. */
  startDate: string;
  endDate: string;
  description: string;
  segmentBy: SegmentKey;
  companyObjectives: readonly Objective[];
  sets: readonly ObjectiveSet[];
  people: readonly TrackedPerson[];
}

/** Lo que el drawer entrega al guardar. Los archivos van como `File` porque
 * es lo que el selector produce; la pantalla los convierte a metadatos. */
export interface ObjectiveUpdateInput {
  value: string | null;
  comment: string;
  files: readonly File[];
}
