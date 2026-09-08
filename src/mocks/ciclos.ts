/**
 * The ciclos and the people the Objetivos home lists.
 *
 * Lives here rather than inside the dashboard because more than one surface
 * reads it: the table, the home pulse cards and the alert row all count the
 * same rows, and two copies of this list would let them disagree.
 */

export interface CicloRow {
  id: string;
  nombre: string;
  periodo: string;
  fechaInicio: string;
  fechaCierre: string;
  estado: string;
  numObjetivos: number;
  /** Avance of the ciclo, 0–100 — what the progress bar fills to. */
  progreso: number;
  /** The same figure as written in the table ("125%" can overshoot 100). */
  avance: string;
  tipoProgreso: string;
}

export interface UsuarioSinObjetivosRow {
  id: string;
  username: string;
  nombre: string;
  correo: string;
  area: string;
  lider: string;
}

/**
 * The twelve ciclos every row is a copy of.
 *
 * The two "En curso" ciclos here close within the next few days on purpose:
 * a list where every open ciclo closed months ago would leave the home's "Por
 * cerrar" alert permanently at zero, and an open ciclo whose closing date has
 * already passed is not a state the product should be showing off.
 */
const BASE_CICLOS: readonly CicloRow[] = [
  { id: "1", nombre: "Kpis 2026", periodo: "Trimestre", fechaInicio: "01 julio 2026", fechaCierre: "01 octubre 2026", estado: "En curso", numObjetivos: 3, progreso: 7.5, avance: "7.5%", tipoProgreso: "warning" },
  { id: "2", nombre: "Q3 GB", periodo: "Personalizado", fechaInicio: "25 agosto 2026", fechaCierre: "07 septiembre 2026", estado: "En curso", numObjetivos: 3, progreso: 100, avance: "125%", tipoProgreso: "success" },
  { id: "3", nombre: "GBEAUTY", periodo: "Personalizado", fechaInicio: "25 agosto 2026", fechaCierre: "26 agosto 2026", estado: "Finalizado", numObjetivos: 2, progreso: 100, avance: "125%", tipoProgreso: "success" },
  { id: "4", nombre: "bnh", periodo: "Semestre", fechaInicio: "26 agosto 2026", fechaCierre: "27 febrero 2027", estado: "Por iniciar", numObjetivos: 0, progreso: 0, avance: "0%", tipoProgreso: "neutral" },
  { id: "5", nombre: "Objetivos UBITS 2026", periodo: "Personalizado", fechaInicio: "26 agosto 2026", fechaCierre: "09 septiembre 2026", estado: "En curso", numObjetivos: 18, progreso: 41.75, avance: "41.75%", tipoProgreso: "warning" },
  { id: "6", nombre: "asdasd", periodo: "Trimestre", fechaInicio: "24 agosto 2026", fechaCierre: "25 noviembre 2026", estado: "En curso", numObjetivos: 5, progreso: 20, avance: "20%", tipoProgreso: "warning" },
  { id: "7", nombre: "Objetivos sales II semestre", periodo: "Personalizado", fechaInicio: "01 septiembre 2026", fechaCierre: "31 diciembre 2026", estado: "Por iniciar", numObjetivos: 2, progreso: 6.93, avance: "6.93%", tipoProgreso: "warning" },
  { id: "8", nombre: "hgfhfghj", periodo: "Bimestre", fechaInicio: "20 agosto 2026", fechaCierre: "20 octubre 2026", estado: "En curso", numObjetivos: 2, progreso: 50, avance: "50%", tipoProgreso: "warning" },
  { id: "9", nombre: "Ejemplo C.", periodo: "Semestre", fechaInicio: "20 agosto 2026", fechaCierre: "20 febrero 2027", estado: "En curso", numObjetivos: 10, progreso: 85, avance: "85%", tipoProgreso: "success" },
  { id: "10", nombre: "Prueba con chicooos", periodo: "Mes", fechaInicio: "19 agosto 2026", fechaCierre: "19 septiembre 2026", estado: "En curso", numObjetivos: 4, progreso: 33.3, avance: "33.3%", tipoProgreso: "warning" },
  { id: "11", nombre: "INNES Prueba Mapi", periodo: "Personalizado", fechaInicio: "01 julio 2026", fechaCierre: "18 agosto 2026", estado: "Finalizado", numObjetivos: 7, progreso: 93.81, avance: "93.81%", tipoProgreso: "success" },
  { id: "12", nombre: "Prueba Vale Daily Talent", periodo: "Mes", fechaInicio: "18 agosto 2026", fechaCierre: "18 septiembre 2026", estado: "En curso", numObjetivos: 8, progreso: 65.5, avance: "65.5%", tipoProgreso: "success" },
];

/** How many rows the list holds — enough to page through. */
const CICLO_COUNT = 30;

export const CICLOS: readonly CicloRow[] = Array.from({ length: CICLO_COUNT }, (_, index) => {
  const base = BASE_CICLOS[index % BASE_CICLOS.length];
  return {
    ...base,
    id: String(index + 1),
    nombre: `${base.nombre}${index > BASE_CICLOS.length - 1 ? ` (${index + 1})` : ""}`,
  };
});

const BASE_USUARIOS: readonly UsuarioSinObjetivosRow[] = [
  { id: "1", username: "laumanrique@ubits.com", nombre: "Prueba Manrique Cienfuegos", correo: "laumanrique@ubits.com", area: "Pruebas", lider: "-" },
  { id: "2", username: "ximena.ramirez@sedicosa.com.mx", nombre: "XIMENA RAMIREZ GARRIDO", correo: "ximena.ramirez@sedicosa.com.mx", area: "Ventas", lider: "-" },
  { id: "3", username: "sara.lopez@sedicosa.com.mx", nombre: "SARA SABEL LOPEZ ENTAR", correo: "sara.lopez@sedicosa.com.mx", area: "Servicio", lider: "-" },
  { id: "4", username: "miguel.hernandez@sedicosa.com.mx", nombre: "MIGUEL EDUARDO HERNANDEZ MEZA", correo: "miguel.hernandez@sedicosa.com.mx", area: "Servicio", lider: "-" },
  { id: "5", username: "jesus.bautista@sedicosa.com.mx", nombre: "JESUS BAUTISTA POPOCA", correo: "jesus.bautista@sedicosa.com.mx", area: "Almacen", lider: "-" },
];

export const USUARIOS_SIN_OBJETIVOS: readonly UsuarioSinObjetivosRow[] = Array.from(
  { length: 30 },
  (_, index) => {
    const base = BASE_USUARIOS[index % BASE_USUARIOS.length];
    return {
      ...base,
      id: String(index + 1),
      nombre: `${base.nombre}${index > BASE_USUARIOS.length - 1 ? ` (${index + 1})` : ""}`,
    };
  }
);

/** The estados a ciclo can be in, in the order the column menu lists them. */
export const CICLO_ESTADOS: readonly string[] = ["Por iniciar", "En curso", "Finalizado"];

/** The periodos in use, derived so the menu can never offer one no row has. */
export const CICLO_PERIODOS: readonly string[] = [...new Set(BASE_CICLOS.map((c) => c.periodo))].sort(
  (a, b) => a.localeCompare(b)
);
