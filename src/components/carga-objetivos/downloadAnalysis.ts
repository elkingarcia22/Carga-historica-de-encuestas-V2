import * as XLSX from "xlsx";
import {
  bucketForGroup,
  groupDisplayName,
  isObjectiveLinkPending,
  validateObjective,
  validateProgressUpdate,
  type BulkUploadMode,
  type GroupBucket,
  type ObjectiveUserGroup,
  type ParsedObjective,
} from "@/lib/objectivesImport";
import { TAB_META, TAB_ORDER } from "./reviewTabs";

/**
 * Por qué esta fila está en la pestaña donde está, en una frase — lo que en
 * pantalla se ve como chip, aviso o "Guardar ajustes" bloqueado, aquí es una
 * sola columna de texto porque el excel no tiene esos elementos visuales.
 */
function describeRowDetail(
  group: ObjectiveUserGroup,
  objective: ParsedObjective,
  bucket: GroupBucket,
  isProgressLoad: boolean
): string {
  if (bucket === "sinAlinear") return "Sin usuario asociado en UBITS.";

  if (bucket === "asociaciones") {
    return group.suggestion
      ? `Propuesta sin confirmar: ${group.suggestion.name}${group.suggestionBasis ? ` (${group.suggestionBasis})` : ""}.`
      : "Alineación sugerida sin confirmar.";
  }

  if (bucket === "errores") {
    if (isObjectiveLinkPending(objective)) {
      return "Falta confirmar a qué objetivo de UBITS corresponde esta fila.";
    }
    const violations = isProgressLoad ? validateProgressUpdate(objective) : validateObjective(objective);
    if (violations.length > 0) return violations.map((violation) => violation.message).join(" ");
    return "Los pesos de esta persona superan el 100%.";
  }

  return "Listo para cargar.";
}

const CREATE_EDIT_HEADER = [
  "Fila del archivo",
  "Identificador del archivo",
  "Usuario UBITS",
  "Objetivo",
  "Tipo de medida",
  "Dirección",
  "Valor inicial",
  "Meta",
  "Mínimo",
  "Máximo",
  "Peso %",
  "Estado",
  "Detalle",
] as const;

const PROGRESS_HEADER = [
  "Fila del archivo",
  "Identificador del archivo",
  "Usuario UBITS",
  "Objetivo",
  "Valor inicial",
  "Meta",
  "Avance actual",
  "Nuevo avance",
  "Estado",
  "Detalle",
] as const;

function buildRow(
  group: ObjectiveUserGroup,
  objective: ParsedObjective,
  bucket: GroupBucket,
  isProgressLoad: boolean
): (string | number)[] {
  const displayName = groupDisplayName(group);
  const detail = describeRowDetail(group, objective, bucket, isProgressLoad);
  const statusLabel = TAB_META[bucket].label;

  if (isProgressLoad) {
    return [
      objective.sourceRow || "",
      group.identifier,
      displayName,
      objective.title,
      objective.initialValue ?? "",
      objective.target,
      objective.currentProgress ?? "",
      objective.newProgress ?? "",
      statusLabel,
      detail,
    ];
  }

  return [
    objective.sourceRow || "",
    group.identifier,
    displayName,
    objective.title,
    objective.measureType,
    objective.trend,
    objective.initialValue ?? "",
    objective.target,
    objective.minProgress ?? "",
    objective.maxProgress ?? "",
    objective.weightPercent,
    statusLabel,
    detail,
  ];
}

/** Nombre de archivo seguro: sin los caracteres que Windows/Excel rechazan. */
function slugifyForFile(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]+/g, "-");
}

/**
 * Descarga un excel con una hoja por pestaña de la revisión —mismo orden y
 * mismos rótulos que `TAB_ORDER`/`TAB_META`— para que quien lo abra vea
 * exactamente lo que hay hoy en cada una de las cuatro pestañas del drawer,
 * incluida la razón por la que cada fila está donde está.
 */
export function downloadObjectivesAnalysis(
  groups: ObjectiveUserGroup[],
  mode: BulkUploadMode,
  cycleName: string
): void {
  const isProgressLoad = mode === "actualizar";
  const workbook = XLSX.utils.book_new();

  TAB_ORDER.forEach((bucket) => {
    const bucketGroups = groups.filter((group) => bucketForGroup(group) === bucket);
    const rows: (string | number)[][] = [[...(isProgressLoad ? PROGRESS_HEADER : CREATE_EDIT_HEADER)]];

    bucketGroups.forEach((group) => {
      group.objectives.forEach((objective) => {
        rows.push(buildRow(group, objective, bucket, isProgressLoad));
      });
    });

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, TAB_META[bucket].label.slice(0, 31));
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const cycleSlug = cycleName.trim() ? slugifyForFile(cycleName) : "ciclo";
  XLSX.writeFile(workbook, `analisis-objetivos-${cycleSlug}-${stamp}.xlsx`);
}
