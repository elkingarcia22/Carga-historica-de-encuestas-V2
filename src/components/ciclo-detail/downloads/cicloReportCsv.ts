import type { CicloReportRequest } from "./cicloDownloadTypes";
import {
  csvNumber,
  csvPercent,
  objectiveDetailRows,
  personProgressRows,
  scopeFor,
  type CicloReportSource,
} from "./cicloReportModel";

/**
 * Los CSV del ciclo.
 *
 * Las dos primeras columnas de encabezado son las que el módulo ya entrega hoy
 * —"Nombre de Usuario", "Porcentaje de Avance %"— escritas igual, acentos
 * incluidos: quien tenga una macro montada sobre el archivo real la puede
 * correr sobre este sin tocar una fórmula. El tercero es nuevo y sigue las
 * mismas convenciones para no inventar un segundo dialecto.
 */

export const CSV_MIME = "text/csv;charset=utf-8";

export const fileStamp = (): string => new Date().toISOString().slice(0, 10);

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

export function saveBlob(fileName: string, mime: string, content: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Una celda de CSV.
 *
 * Se entrecomilla solo cuando hace falta —coma, comilla o salto de línea
 * dentro— porque los archivos del módulo tampoco entrecomillan de más y la
 * diferencia se ve al abrir los dos lado a lado. Un salto de línea dentro de un
 * comentario no se escapa: se aplana, que es lo que Excel hace de vuelta.
 */
const cell = (value: string | number): string => {
  const text = typeof value === "number" ? String(value) : value.replace(/[\r\n]+/g, " ");
  return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * Una fecha con hora para una celda: `2026-09-01 17:05`.
 *
 * No la forma larga en español que usa la pantalla: una columna de fechas en
 * un CSV es para ordenar y filtrar, y "01 de sept de 2026" ordena
 * alfabéticamente — abril antes de enero — mientras el ISO ordena solo.
 */
const csvDateTime = (iso: string): string => {
  if (iso === "") return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toCsv = (rows: readonly (readonly (string | number)[])[]): string =>
  // BOM al frente: sin él, Excel en Windows abre los acentos como mojibake y
  // el primer reporte que alguien reenvía llega con "Descripciรณn".
  `﻿${rows.map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;

// ── Detalle del ciclo ───────────────────────────────────────────────────────

const DETAIL_HEAD = [
  "Nombre de Usuario",
  "Nombre Completo",
  "Nombre del Objetivo",
  "Descripción",
  "Peso %",
  "Meta",
  "Valor Inicial",
  "Avance",
  "Valor Mínimo Límite",
  "Valor Máximo Límite",
  "Porcentaje de Avance %",
  "Fecha de Creación",
  "Fecha de Finalización",
] as const;

/** Una fila por objetivo de cada colaborador. */
export function buildDetailCsv(source: CicloReportSource, request: CicloReportRequest): string {
  const scope = scopeFor(source, request);
  const rows = objectiveDetailRows(source, scope);
  return toCsv([
    DETAIL_HEAD,
    ...rows.map((row) => [
      row.username,
      row.fullName,
      row.objectiveTitle,
      row.description,
      row.weight,
      csvNumber(row.target, 2),
      csvNumber(row.initial, 2),
      csvNumber(row.current, 2),
      csvNumber(row.min, 2),
      csvNumber(row.max, 2),
      csvPercent(row.percent),
      row.createdAt,
      row.finishedAt,
    ]),
  ]);
}

// ── Progreso del ciclo ──────────────────────────────────────────────────────

const PROGRESS_HEAD = ["UserId", "Participante", "Porcentaje de Avance %"] as const;

/** Una fila por participante con su avance ponderado. */
export function buildProgressCsv(source: CicloReportSource, request: CicloReportRequest): string {
  const scope = scopeFor(source, request);
  const rows = personProgressRows(source, scope);
  return toCsv([
    PROGRESS_HEAD,
    ...rows.map((row) => [row.userId, row.fullName, csvPercent(row.percent)]),
  ]);
}

// ── Estado por usuario ──────────────────────────────────────────────────────

const USERS_HEAD = [
  "UserId",
  "Nombre de Usuario",
  "Participante",
  "Área",
  "Líder Directo",
  "Grupo",
  "Objetivos",
  "Objetivos con Avance",
  "Objetivos Cumplidos",
  "Porcentaje de Avance %",
  "Estado",
  "Nivel de Desempeño",
  "Última Actualización",
  "Actualizado Por",
] as const;

/**
 * La lectura general de cada persona: cómo va, en qué estado quedó y qué nivel
 * de desempeño le corresponde — sin abrir sus objetivos uno por uno.
 *
 * Es el archivo que faltaba entre los dos que ya existen: el de progreso solo
 * trae el porcentaje, y el de detalle obliga a colapsar seis filas por persona
 * para responder "¿quién está en riesgo?".
 */
export function buildUsersCsv(source: CicloReportSource, request: CicloReportRequest): string {
  const scope = scopeFor(source, request);
  const rows = personProgressRows(source, scope);
  return toCsv([
    USERS_HEAD,
    ...rows.map((row) => [
      row.userId,
      row.username,
      row.fullName,
      row.area,
      row.leader,
      row.groupLabel,
      row.objectiveCount,
      row.reportedCount,
      row.achievedCount,
      csvPercent(row.percent),
      row.estado,
      row.nivel,
      csvDateTime(row.lastUpdate),
      row.lastUpdateAuthor,
    ]),
  ]);
}
