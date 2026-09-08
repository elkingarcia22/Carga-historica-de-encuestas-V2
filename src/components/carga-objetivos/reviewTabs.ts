import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import type { Tone } from "@/lib/tone";
import type { GroupBucket, ObjectiveUserGroup, ParsedObjective, RosterUser } from "@/lib/objectivesImport";

/**
 * Las cuatro pestañas de la revisión: qué le falta a cada usuario para poder
 * cargar, en el orden en que se resuelve.
 */

/**
 * Orden de lectura, que es también el orden en que se drena la cola: primero
 * resolver quién es cada usuario, después arreglar sus datos, al final cargar.
 * Los que no tienen a nadie van antes que los que ya traen un candidato: son
 * los que necesitan trabajo real, y confirmar una propuesta es un clic.
 */
export const TAB_ORDER: readonly GroupBucket[] = ["sinAlinear", "asociaciones", "errores", "alineados"];

export interface TabMeta {
  label: string;
  /** Encabeza la lista debajo de la pestaña, como cualquier otra lista del módulo. */
  listTitle: string;
  emptyTitle: string;
  empty: string;
  /**
   * El tono del sistema con el que se pinta esta pestaña: el contador de la
   * tira, el chip de cada tarjeta y el aviso de la lista. Las cuatro pestañas
   * son cuatro estados —falta la persona, hay una propuesta, hay datos que
   * UBITS rechaza, esto ya carga— y el color es lo que las hace legibles de un
   * vistazo, igual que en el home y en el detalle del ciclo.
   */
  tone: Tone;
  /**
   * El glifo que acompaña al tono. No es la silueta de una persona —eso ya lo
   * dice el nombre que hay al lado—, sino qué le pasa a esa persona: hay algo
   * por decidir, hay una propuesta por confirmar, hay datos que UBITS rechaza,
   * o ya no falta nada. Es el mismo vocabulario de iconos que usan los avisos
   * del resto del producto: información, triángulo de aviso, círculo de error
   * y check.
   */
  icon: LucideIcon;
}

export const TAB_META: Readonly<Record<GroupBucket, TabMeta>> = {
  /*
    No es una pestaña de errores, y nada en ella se lee como uno: son personas
    que UBITS todavía no conoce. Sus violaciones de reglas se esconden hasta
    que tengan dueño; la revisión las revela al elegir al usuario.
  */
  sinAlinear: {
    tone: "brand",
    icon: Info,
    label: "Usuarios sin alinear",
    listTitle: "Lista de usuarios sin alinear",
    emptyTitle: "Todos los usuarios están alineados",
    empty:
      "Cada identificador del archivo apunta a un usuario de UBITS, así que no hay nadie por elegir a mano.",
  },
  asociaciones: {
    tone: "warning",
    icon: TriangleAlert,
    label: "Alineación sugerida",
    listTitle: "Lista de usuarios con alineación sugerida",
    emptyTitle: "No hay nada por confirmar",
    empty:
      "Todos los identificadores del archivo coincidieron por username, correo o documento, así que ninguno quedó como propuesta.",
  },
  errores: {
    tone: "negative",
    icon: CircleAlert,
    label: "Objetivos con errores",
    listTitle: "Lista de objetivos con errores",
    emptyTitle: "Ningún dato por corregir",
    empty: "Los pesos suman 100% y ninguna fila con usuario tiene datos que UBITS vaya a rechazar.",
  },
  /*
    La única pestaña vacía que es mala noticia: no hay nada que cargar. Por eso
    su vacío apunta al trabajo en vez de felicitar al revisor.
  */
  alineados: {
    tone: "positive",
    icon: CircleCheck,
    label: "Listos para cargar",
    listTitle: "Lista de objetivos listos para cargar",
    emptyTitle: "Todavía no hay nada listo para cargar",
    empty:
      "Ningún usuario tiene a la vez su persona resuelta, sus datos válidos y sus pesos en 100%. Revisa las otras pestañas.",
  },
};

export const EMPTY_BUCKETS: Readonly<Record<GroupBucket, ObjectiveUserGroup[]>> = {
  alineados: [],
  asociaciones: [],
  sinAlinear: [],
  errores: [],
};

/**
 * La única pregunta en pantalla, sea del tipo que sea. Quitar una fila, quitar
 * un usuario y unificar dos comparten el hueco porque comparten la regla: solo
 * una puede estar abierta, y mientras lo está el resto de la revisión deja de
 * responder.
 */
export type PendingQuestion =
  | { kind: "row"; id: string }
  | { kind: "group"; identifier: string }
  | { kind: "merge"; identifier: string; user: RosterUser; targetIdentifier: string };

/** Un grupo junto con las filas que los filtros dejan ver. */
export interface VisibleGroup {
  group: ObjectiveUserGroup;
  objectives: ParsedObjective[];
}

/**
 * Lo que el rail flotante necesita para prestar sus botones a una selección
 * que no es suya: cuántos hay marcados, cómo se limpia la marca y qué hace
 * "quitar" con lo que representan — un usuario entero en las pestañas de solo
 * consulta, cada objetivo por su cuenta en las otras dos.
 */
export interface ReviewSelectionInfo {
  count: number;
  onClear: () => void;
  onRemove: () => void;
}
