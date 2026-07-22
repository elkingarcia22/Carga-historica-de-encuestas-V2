/**
 * Genera los archivos de muestra para la demo de carga de encuestas.
 *
 * Uso:  node scripts/generate-demo-samples.cjs
 * Salida: carpeta demo-samples/ en la raíz del repo.
 *
 * Cada archivo está pensado para disparar un escenario concreto del flujo
 * (ver demo-samples/README.md). Los archivos "reales" (xlsx bien formados) se
 * procesan de verdad; los que llevan tokens en el nombre (corrupto/pesado/
 * sin-estructura) o extensión pdf/imagen disparan escenarios forzados/mock.
 */
const fs = require("fs");
const path = require("path");
const XLSX = require(path.join(__dirname, "..", "node_modules", "xlsx"));

const OUT = path.join(__dirname, "..", "demo-samples");
fs.mkdirSync(OUT, { recursive: true });

/** Construye una hoja "Clima" en el layout por-área que entiende parseGerenciaReport. */
function climaSheet({ surveyName, sections }) {
  // sections: [{ name, questions: [text, ...] }]
  const groupRow = ["", "", "", "", "Indicador Clave"];
  const headerRow = ["Área:", "", "Respuestas", "Invitados", "Favorabilidad"];
  const neg = ["Quillayes Surlat", "", 480, 520, 10];
  const neu = ["", "", "", "", 20];
  const pos = ["", "", "", "", 70];
  sections.forEach((sec) => {
    groupRow.push("Dimension");
    headerRow.push(sec.name);
    neg.push(12); neu.push(20); pos.push(70);
    sec.questions.forEach((q) => {
      groupRow.push("Pregunta");
      headerRow.push(q);
      neg.push(11); neu.push(19); pos.push(70);
    });
  });
  const aoa = [
    ["Reporte de Gerencia"],
    ["Área: Quillayes Surlat"],
    [`Encuesta: ${surveyName}`],
    [],
    ["Fecha: 26-MAR-2026"],
    groupRow,
    headerRow,
    neg, neu, pos,
  ];
  return XLSX.utils.aoa_to_sheet(aoa);
}

/** Hoja eNPS con preguntas sin dimensión (quedan section-less). */
function enpsSheet() {
  const groupRow = ["", "", "", "", "Indicador Clave", "Pregunta", "Pregunta"];
  const headerRow = [
    "Área:", "", "Respuestas", "Invitados", "eNPS",
    "En una escala de 0 a 10, ¿qué tan probable es que recomiendes a la empresa como un buen lugar para trabajar?",
    "¿Qué es lo que más valoras de trabajar aquí? (respuesta abierta)",
  ];
  return XLSX.utils.aoa_to_sheet([
    ["Reporte"], ["Área: Quillayes Surlat"], ["Encuesta: eNPS 2025"], [], ["Fecha: 26-MAR-2026"],
    groupRow, headerRow,
    ["Quillayes Surlat", "", 480, 520, 30, 10, 20],
    ["", "", "", "", 30, 20, 30],
    ["", "", "", "", 40, 70, 50],
  ]);
}

function writeWorkbook(fileName, sheets) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, ws }) => XLSX.utils.book_append_sheet(wb, ws, name));
  XLSX.writeFile(wb, path.join(OUT, fileName));
  console.log("✓", fileName);
}

const CLIMA_SECTIONS = [
  { name: "Seguridad", questions: [
    "Las condiciones en las que realizo mi trabajo son seguras.",
    "Los aspectos de seguridad son una prioridad dentro de los objetivos de la empresa.",
    "Conozco la forma para reportar las acciones y condiciones inseguras de mi área.",
  ] },
  { name: "Liderazgo", questions: [
    "Mi jefatura me entrega retroalimentación oportuna.",
    "Confío en las decisiones que toma el equipo directivo.",
  ] },
  { name: "Desarrollo", questions: [
    "Tengo oportunidades reales de crecimiento en la empresa.",
  ] },
];

// --- Acto 1: happy path (real) ---
writeWorkbook("Clima 2025.xlsx", [{ name: "Clima", ws: climaSheet({ surveyName: "Encuesta de Clima 2025", sections: CLIMA_SECTIONS }) }]);

// --- Acto 3: varias encuestas (real) — un segundo año ---
writeWorkbook("Clima 2024.xlsx", [{ name: "Clima", ws: climaSheet({ surveyName: "Encuesta de Clima 2024", sections: CLIMA_SECTIONS }) }]);

// --- Acto 3: preguntas sin sección + eNPS (real) ---
writeWorkbook("preguntas-sin-seccion.xlsx", [
  { name: "Clima", ws: climaSheet({ surveyName: "Encuesta de Clima 2025", sections: CLIMA_SECTIONS.slice(0, 2) }) },
  { name: "eNPS", ws: enpsSheet() },
]);

// --- Acto 3: duplicado vs. encuesta existente (real-contra-mock) ---
writeWorkbook("Clima Organizacional - Q1 2025.xlsx", [
  { name: "Clima", ws: climaSheet({ surveyName: "Clima Organizacional", sections: CLIMA_SECTIONS }) },
]);

// --- Acto 3: tipos de pregunta variados (para mostrar el match completo de la
// taxonomía UBITS) + preguntas que no hacen match (van al grupo "Sin reconocer") ---
const TIPOS_VARIADOS_SECTIONS = [
  { name: "Compromiso", questions: [
    "Estoy de acuerdo con la dirección que está tomando la empresa.",            // Likert · Acuerdo
    "¿Con qué frecuencia recibes reconocimiento por tu trabajo?",                // Likert · Frecuencia
    "¿Qué tan satisfecho estás con tu equipo de trabajo?",                       // Likert · Satisfacción
    "¿Qué tan probable es que asumas nuevos retos este año?",                    // Likert · Probabilidad
  ] },
  { name: "Experiencia", questions: [
    "En una escala de 0 a 10, ¿qué tan probable es que recomiendes a la empresa como un buen lugar para trabajar?", // NPS
    "Califica con estrellas tu experiencia general en la empresa.",              // Estrellas
    "¿Cómo te sientes al iniciar tu jornada laboral?",                           // Emociones
    "En una escala de 1 a 7, evalúa el ambiente de tu área.",                    // Lineal
  ] },
  { name: "Preferencias", questions: [
    "Cuéntanos con tus palabras qué mejorarías de la empresa (comentario).",     // Abierta
    "Selecciona tu sede principal.",                                             // Opción única
    "Selecciona todas las prestaciones que utilizas.",                           // Múltiples respuestas
    "Elige de la lista tu área de trabajo.",                                     // Desplegable
    "Ordena de mayor a menor los beneficios según su importancia para ti.",      // Sin reconocer (ranking)
    "Distribuye 100 puntos entre las siguientes iniciativas.",                   // Sin reconocer (matriz)
  ] },
];
writeWorkbook("Encuesta tipos variados 2025.xlsx", [
  { name: "Clima", ws: climaSheet({ surveyName: "Encuesta de tipos variados 2025", sections: TIPOS_VARIADOS_SECTIONS }) },
]);

// --- Acto 2: falla el paso final de carga (error técnico), disparado por el
// nombre. El archivo es válido y recorre todo el wizard; solo falla al "Cargar". ---
writeWorkbook("falla-carga 2025.xlsx", [
  { name: "Clima", ws: climaSheet({ surveyName: "Encuesta de Clima 2025", sections: CLIMA_SECTIONS }) },
]);

// --- Acto 2: reconocido pero sin estructura (token 'sin-estructura', igual generamos un xlsx real vacío) ---
writeWorkbook("sin-estructura.xlsx", [{ name: "Hoja1", ws: XLSX.utils.aoa_to_sheet([["Datos"], ["sin estructura reconocible"]]) }]);

// --- Acto 2: placeholders por token (contenido irrelevante, disparan por nombre) ---
writeWorkbook("pesado.xlsx", [{ name: "Clima", ws: climaSheet({ surveyName: "Encuesta de Clima 2025", sections: CLIMA_SECTIONS }) }]);
writeWorkbook("corrupto.xlsx", [{ name: "Clima", ws: climaSheet({ surveyName: "Encuesta de Clima 2025", sections: CLIMA_SECTIONS }) }]);

// --- Acto 3: PDF e imagen (mock extraction, contenido irrelevante) ---
const MINIMAL_PDF = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n164\n%%EOF";
fs.writeFileSync(path.join(OUT, "reporte-clima.pdf"), MINIMAL_PDF, "latin1");
console.log("✓ reporte-clima.pdf");

// 1x1 PNG transparente
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);
fs.writeFileSync(path.join(OUT, "encuesta.png"), PNG_1PX);
console.log("✓ encuesta.png");

// --- Acto 2: tipo no soportado (bloqueado en validación) ---
fs.writeFileSync(path.join(OUT, "no-soportado.zip"), Buffer.from("PK archivo de prueba no soportado"));
console.log("✓ no-soportado.zip");

console.log("\nListo. Archivos en:", OUT);
