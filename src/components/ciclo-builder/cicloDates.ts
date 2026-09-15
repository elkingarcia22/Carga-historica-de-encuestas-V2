/**
 * Fechas del ciclo: `yyyy-mm-dd` ⇄ Date y las cuentas de periodo.
 *
 * El borrador guarda las fechas como texto ISO para seguir siendo
 * serializable tal cual; estas funciones son el único puente hacia `Date`.
 */

export function parseISODate(value: string): Date | null {
  if (value === "") return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function toISODate(date: Date | undefined | null): string {
  if (!date) return "";
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Suma meses enteros y retrocede un día, para que un trimestre que arranca el
 * 1 de enero cierre el 31 de marzo y no el 1 de abril — un ciclo es una
 * ventana cerrada, y el autor la cuenta en meses completos.
 */
export function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
  next.setDate(next.getDate() - 1);
  return next;
}

const SHORT_DATE = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });
const SHORT_DATE_YEAR = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "1 ene – 31 mar 2026", o con los dos años si el rango cruza de uno a otro. */
export function formatDateRange(startISO: string, endISO: string): string | null {
  const start = parseISODate(startISO);
  const end = parseISODate(endISO);
  if (start === null || end === null) return null;
  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = sameYear ? SHORT_DATE.format(start) : SHORT_DATE_YEAR.format(start);
  return `${startLabel} – ${SHORT_DATE_YEAR.format(end)}`.replace(/\./g, "");
}

/** "12 sept. 2026", para nombrar una sola fecha en una frase. */
export function formatSingleDate(iso: string): string | null {
  const date = parseISODate(iso);
  return date === null ? null : SHORT_DATE_YEAR.format(date).replace(/\./g, "");
}
