/**
 * De la revisión a la carga, y de vuelta.
 *
 * `buildUploadRows` convierte los grupos revisados en la lista de filas que la
 * carga va a escribir (y las que no, para que consten). `groupsFromPendingRows`
 * hace el camino inverso: toma lo que una carga dejó sin entrar y lo vuelve a
 * poner en la mesa de revisión.
 */

import {
  TOTAL_WEIGHT_PERCENT,
  bucketForGroup,
  buildUserIndex,
  groupWeightTotal,
  hasSavedEdits,
  linkGroupObjectives,
  matchIdentifier,
  toExistingObjectives,
  validateObjective,
  type BulkUploadMode,
  type MeasureType,
  type ObjectiveUserGroup,
  type ParsedObjective,
  type RosterUser,
  type Trend,
} from "@/lib/objectivesImport";
import { failureFor, isPendingRow, type UploadRowResult, type UploadTaskState } from "./uploadTaskTypes";

interface RowOwner {
  userName: string;
  userEmail?: string;
  userArea?: string;
  userLeader?: string;
}

function ownerOf(group: ObjectiveUserGroup): RowOwner {
  return {
    userName: group.matchedUser?.name ?? group.identifier,
    userEmail: group.matchedUser?.email,
    userArea: group.matchedUser?.area,
    userLeader: group.matchedUser?.leader,
  };
}

function toRow(objective: ParsedObjective, owner: RowOwner): Omit<UploadRowResult, "status" | "willFail"> {
  return {
    id: objective.id,
    title: objective.title,
    ...owner,
    description: objective.description,
    weightPercent: objective.weightPercent,
    measureType: objective.measureType,
    trend: objective.trend,
    initialValue: objective.initialValue,
    target: objective.target,
    minProgress: objective.minProgress,
    maxProgress: objective.maxProgress,
    newProgress: objective.newProgress,
  };
}

/** Por qué una fila con dueño no pudo cargar, en una frase. */
function analysisErrorFor(objective: ParsedObjective, group: ObjectiveUserGroup): string {
  const violations = validateObjective(objective);
  if (violations.length > 0) return violations[0].message;
  if (groupWeightTotal(group) > TOTAL_WEIGHT_PERCENT) {
    return `El peso total supera el ${TOTAL_WEIGHT_PERCENT}%.`;
  }
  // Ahora es por fila, no por tarjeta: esta misma fila es la que lo sabe.
  if (!objective.rowConfirmed) return "Pendiente de confirmación por el usuario.";
  return "Error en el objetivo.";
}

/**
 * Las filas de una carga, en el orden en que hay que escribirlas.
 *
 * Solo los usuarios alineados cargan. Sus objetivos ya existentes y ajustados a
 * mano van primero: un peso que el revisor bajó para hacer espacio tiene que
 * escribirse antes que las filas que necesitan ese espacio, o la plataforma
 * las rechazaría por pasar del 100% a mitad de camino. Las filas de los demás
 * usuarios quedan registradas como no cargadas, para que "retomar" las tenga.
 */
export function buildUploadRows(
  groups: ObjectiveUserGroup[],
  /**
   * El archivo llegó con todos sus usuarios alineados, sin que nadie tuviera
   * que arreglar nada.
   *
   * Decide si la escritura puede rechazar filas: un archivo que llegó limpio
   * carga limpio de punta a punta —o el happy path mostraría fallos aleatorios
   * sin razón visible—, y uno que llegó con problemas también ejercita los del
   * momento de escribir, incluidos los de las filas que el revisor acaba de
   * corregir: a un timeout del servicio le da igual que el dato ya esté bien.
   */
  cameInClean: boolean
): UploadRowResult[] {
  const aligned = groups.filter((group) => bucketForGroup(group) === "alineados");
  const blocked = groups.filter((group) => bucketForGroup(group) !== "alineados");

  const loading: UploadRowResult[] = aligned
    .flatMap((group) => {
      const owner = ownerOf(group);
      const adjusted = group.existing
        .filter((objective) => hasSavedEdits(objective))
        // Una fila que reescribe este objetivo ya trae su propio cambio; contarlo
        // aparte lo mandaría dos veces.
        .filter((objective) => !group.objectives.some((row) => row.link?.targetId === objective.id));
      return [...adjusted, ...group.objectives].map((objective) => ({ objective, owner }));
    })
    // Por posición y no al azar: el mismo archivo rechaza siempre las mismas filas.
    .map(({ objective, owner }, index) => ({
      ...toRow(objective, owner),
      status: "pending" as const,
      willFail: !cameInClean && failureFor(index),
    }));

  const leftBehind: UploadRowResult[] = blocked.flatMap((group) => {
    const owner = ownerOf(group);
    const bucket = bucketForGroup(group);
    return group.objectives.map((objective) => ({
      ...toRow(objective, owner),
      status: bucket === "errores" ? ("analysis_error" as const) : ("unassigned" as const),
      analysisError: bucket === "errores" ? analysisErrorFor(objective, group) : undefined,
      willFail: false,
    }));
  });

  return [...loading, ...leftBehind];
}

/**
 * En qué fila se cae el servicio, si el archivo pide ese caso por su nombre.
 *
 * Va por fuera de `willFail` a propósito: eso decide qué filas rechaza la
 * plataforma, y esto es lo contrario — la plataforma no rechazó nada, dejó de
 * responder. Cae pasada la mitad para que se vea lo que importa: unas filas ya
 * entraron y no se van a deshacer solas.
 */
export function serviceFailureRow(fileName: string, rowCount: number): number | undefined {
  return /falla-carga|error-carga/i.test(fileName) ? Math.max(1, Math.ceil(rowCount * 0.6)) : undefined;
}

/**
 * Lo que una carga dejó pendiente, de vuelta como grupos de revisión.
 *
 * Cada fila se agrupa por la persona a la que apuntaba. Las que ya tenían dueño
 * lo recuperan tal cual; las que nunca lo tuvieron vuelven como identificador
 * sin resolver, que es exactamente lo que eran. En una carga de edición o
 * avances los enlaces se recalculan contra los objetivos de la persona, para
 * que la fila vuelva a saber a cuál apuntaba.
 */
export function groupsFromPendingRows(
  task: UploadTaskState,
  mode: BulkUploadMode,
  roster: readonly RosterUser[],
  directory: readonly RosterUser[]
): ObjectiveUserGroup[] {
  const candidates: RosterUser[] = [
    ...roster.map((user) => ({ ...user, onCycle: true })),
    ...directory.map((user) => ({ ...user, onCycle: user.onCycle ?? false })),
  ];
  const index = buildUserIndex(candidates);
  const linksByName = mode !== "crear";

  const groups = new Map<string, ObjectiveUserGroup>();

  task.rows.filter(isPendingRow).forEach((row) => {
    const identifier = row.userEmail || row.userName;
    let group = groups.get(identifier);

    if (!group) {
      const match = matchIdentifier(identifier, index);
      const wasResolved = row.status !== "unassigned";
      const matchedUser =
        match.user ??
        (wasResolved
          ? candidates.find((user) => user.email === row.userEmail || user.name === row.userName)
          : undefined);

      group = {
        identifier,
        identifierType: match.identifierType,
        mode,
        matchStatus: matchedUser ? "matched" : match.status,
        matchedUser,
        suggestion: matchedUser ? undefined : match.suggestion,
        suggestionBasis: matchedUser ? undefined : match.basis,
        suggestionReason: matchedUser ? undefined : match.reason,
        isManual: false,
        objectives: [],
        existing: matchedUser ? toExistingObjectives(matchedUser) : [],
      };
      groups.set(identifier, group);
    }

    const objective: ParsedObjective = {
      id: row.id,
      sourceRow: 0,
      username: identifier,
      title: row.title,
      description: row.description ?? "",
      weightPercent: row.weightPercent ?? 0,
      measureType: (row.measureType ?? "Numérico") as MeasureType,
      trend: (row.trend ?? "Aumentar") as Trend,
      initialValue: row.initialValue ?? null,
      target: row.target ?? NaN,
      minProgress: row.minProgress ?? null,
      maxProgress: row.maxProgress ?? null,
      ...(mode === "actualizar" ? { newProgress: row.newProgress ?? null } : {}),
      ...(linksByName
        ? { link: { status: "unmatched" as const, isManual: false, lookupTitle: row.title } }
        : {}),
    };

    groups.set(identifier, { ...group, objectives: [...group.objectives, objective] });
  });

  return linkGroupObjectives([...groups.values()]);
}
