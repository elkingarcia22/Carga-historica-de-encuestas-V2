/**
 * The ciclo list's date format, in both directions.
 *
 * Rows carry dates as full Spanish strings ("24 agosto 2026"), so anything
 * that edits one has to go through the same parse and the same format —
 * otherwise a date edited in the table comes back in a shape the rest of the
 * row no longer understands. Mirrors `survey-list/surveyListDates`, split out
 * because ciclos spell their months out in full where surveys abbreviate them.
 */

/** Month names as the rows spell them, in calendar order. */
export const MONTH_FULL = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

const MONTH_INDEX: Readonly<Record<string, number>> = Object.fromEntries(
  MONTH_FULL.map((name, index) => [name, index])
);

/** Lowercase and accent-free, so "Agosto" and "ágosto" both reach "agosto". */
function fold(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** A row's date as a Date, or null for "-" and anything unparsed. */
export function parseCicloDate(raw: string): Date | null {
  const match = /^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/.exec(raw.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  const monthIndex = MONTH_INDEX[fold(month)];
  if (monthIndex === undefined) return null;
  return new Date(Number(year), monthIndex, Number(day));
}

/** A Date back in the rows' own format: "03 agosto 2026". */
export function formatCicloDate(date: Date): string {
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${day} ${MONTH_FULL[date.getMonth()]} ${date.getFullYear()}`;
}

/** Midnight today, so day comparisons ignore the current time. */
export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
