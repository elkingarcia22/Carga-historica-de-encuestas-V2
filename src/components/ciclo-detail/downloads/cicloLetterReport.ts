import {
  CICLO_PERIOD_LABELS,
  CICLO_STATUS_LABELS,
  DIRECTION_META,
  formatRawValue,
} from "@/components/ciclo-builder";
import {
  countLifecycles,
  LIFECYCLE_META,
  LIFECYCLE_ORDER,
} from "@/components/ciclo-results/objectiveLifecycle";
import { formatShortDate } from "../cicloProgress";
import {
  CICLO_INDIVIDUAL_SECTIONS,
  type CicloIndividualSectionId,
  type CicloReportRequest,
} from "./cicloDownloadTypes";
import {
  count,
  individualLetters,
  percent,
  scopeFor,
  type CicloReportSource,
  type IndividualLetter,
  type IndividualObjectiveLine,
} from "./cicloReportModel";
import { CICLO_LETTER_STYLES } from "./cicloLetterStyles";

/**
 * El reporte individual: una carta por colaborador, la que se firma.
 *
 * Se lee como el reporte general de encuestas —portada de marca, secciones
 * numeradas, indicadores en tarjetas— porque salen del mismo producto y a
 * menudo viajan juntos. Lo que la vuelve carta y no tablero es el final: el
 * bloque de firmas.
 *
 * La firma del líder va con la fecha de emisión ya puesta —el documento lo
 * emite él— y la del colaborador en blanco, porque su fecha es el día en que
 * lo firma, que no es hoy y no lo puede saber el sistema.
 *
 * Sale como HTML impreso desde un iframe: el "Guardar como PDF" del navegador
 * produce el archivo, sin meter una librería de PDF en el bundle.
 */

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

interface Tone {
  bg: string;
  text: string;
  border: string;
}

/**
 * Traduce el `colorHex` pastel de "Estados de los objetivos" a una pareja fondo claro
 * / texto oscuro que sí cumple contraste.
 *
 * Son tonos pensados para relleno de barra, no para texto — usarlos tal cual
 * como color de letra sobre su propio fondo tintado da muy poco contraste (el
 * amarillo o el verde pastel, sobre todo). `getEstadoBadgeConfig` en
 * `objetivosConfigStore.ts` ya resuelve esto para el resto de la app con
 * clases de Tailwind; esta es la misma tabla de equivalencias en hex plano,
 * porque la carta es HTML suelto que se imprime en un iframe, sin Tailwind
 * detrás.
 */
const TONE_BY_HEX: Readonly<Record<string, Tone>> = {
  "#22C55E": { bg: "#DCFCE7", text: "#166534", border: "#BBF7D0" },
  "#86EFAC": { bg: "#D1FAE5", text: "#065F46", border: "#A7F3D0" },
  "#10B981": { bg: "#D1FAE5", text: "#065F46", border: "#A7F3D0" },
  "#FCD34D": { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" },
  "#EAB308": { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" },
  "#FDBA74": { bg: "#FFEDD5", text: "#9A3412", border: "#FED7AA" },
  "#F97316": { bg: "#FFEDD5", text: "#9A3412", border: "#FED7AA" },
  "#93C5FD": { bg: "#DBEAFE", text: "#1E40AF", border: "#BFDBFE" },
  "#3B82F6": { bg: "#DBEAFE", text: "#1E40AF", border: "#BFDBFE" },
  "#EF4444": { bg: "#FECACA", text: "#7F1D1D", border: "#FCA5A5" },
  "#FCA5A5": { bg: "#FEE2E2", text: "#991B1B", border: "#FECACA" },
  // El violeta del ciclo de vida ("Por aprobar") no viene de "Estados del
  // colaborador" —esa tabla no lo usa— así que no tenía pareja legible.
  "#A78BFA": { bg: "#EDE9FE", text: "#5B21B6", border: "#DDD6FE" },
  "#CBD5E1": { bg: "#F1F5F9", text: "#334155", border: "#E2E8F0" },
};

const NEUTRAL_TONE: Tone = { bg: "#F1F5F9", text: "#334155", border: "#E2E8F0" };

/** Respaldo cuando el hex no es uno de los conocidos: el `variant` del estado. */
const TONE_BY_VARIANT: Readonly<Record<string, Tone>> = {
  positive: TONE_BY_HEX["#86EFAC"],
  warning: TONE_BY_HEX["#FCD34D"],
  info: TONE_BY_HEX["#93C5FD"],
  negative: TONE_BY_HEX["#FCA5A5"],
  neutral: NEUTRAL_TONE,
};

const toneFor = (hex: string | null, variant?: string): Tone => {
  if (hex) {
    const known = TONE_BY_HEX[hex.toUpperCase()];
    if (known) return known;
  }
  if (variant) return TONE_BY_VARIANT[variant] ?? NEUTRAL_TONE;
  return NEUTRAL_TONE;
};

/**
 * Un chip pintado con la pareja legible del color que le dio la configuración
 * del módulo. Mismo tratamiento en la tabla de objetivos y en las tarjetas de
 * indicadores, así el nivel de desempeño se reconoce como el mismo dato tenga
 * el tamaño que tenga.
 */
const colorChip = (label: string, hex: string | null, big = false, variant?: string): string => {
  const tone = toneFor(hex, variant);
  const size = big ? " chip-lg" : "";
  return `<span class="chip${size}" style="background:${tone.bg};color:${tone.text};border-color:${tone.border}">${escapeHtml(label)}</span>`;
};

/**
 * Un valor como se lee en la carta.
 *
 * Los objetivos de "se cumple / no se cumple" guardan `"true"`/`"false"`, que
 * es lenguaje de máquina: en un papel que alguien firma tiene que decir lo que
 * significa. Los demás se formatean con su medida —"$180.000.000", "90 %"— y
 * lo que todavía no tiene valor lo dice con palabras, no con un guion que se
 * confunde con un cero.
 */
const readValue = (raw: string, measure: Parameters<typeof formatRawValue>[1]): string => {
  if (measure === "boolean") {
    if (raw === "true") return "Se cumple";
    if (raw === "false") return "No se cumple";
    return "Sin reportar";
  }
  const formatted = formatRawValue(raw, measure);
  if (formatted !== null) return formatted;
  return raw.trim() === "" ? "Sin reportar" : raw;
};

interface LetterContext {
  source: CicloReportSource;
  request: CicloReportRequest;
  /** La fecha de emisión: la misma para todas las cartas de una descarga. */
  issuedAt: Date;
}

const on = (request: CicloReportRequest, id: CicloIndividualSectionId): boolean =>
  request.individualSections.includes(id);

interface Block {
  title: string;
  body: string;
  keepTogether?: boolean;
}

/**
 * La empresa que emite la carta.
 *
 * El prototipo no tiene un tenant real detrás, así que se toma prestado el
 * mismo nombre de empleador ficticio que usa la carta de canalización NOM-035
 * del producto — la referencia de este mismo documento —, en vez de inventar
 * uno nuevo o dejarlo en el genérico "tu organización".
 */
const DEMO_COMPANY_NAME = "Monster Inc.";

// ── Portada ─────────────────────────────────────────────────────────────────

/**
 * La portada: de quién es esta carta y de qué ciclo habla.
 *
 * El nombre va como título porque el documento es sobre una persona —en el
 * reporte general ese lugar lo ocupa la encuesta, que es su sujeto— y el resto
 * de la identidad baja a la fila de metadatos, donde se lee de un barrido sin
 * competirle al nombre.
 */
const coverBlock = (letter: IndividualLetter, { source, issuedAt }: LetterContext): string => {
  const { data } = source;
  const issued = issuedAt.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const meta = (label: string, value: string): string =>
    `<span><strong>${escapeHtml(label)}</strong>${escapeHtml(value)}</span>`;

  return `<header class="cover">
    <div class="cover-top">
      <span class="cover-kind">${escapeHtml(letter.nivel?.nombre ?? "Sin nivel")}</span>
      <span class="cover-brand">Reporte individual</span>
    </div>
    <h1>${escapeHtml(letter.person.collaborator.name)}</h1>
    <div class="cover-meta">
      ${meta("Ciclo", data.name)}
      ${meta(
        "Período",
        `${CICLO_PERIOD_LABELS[data.period]} · ${formatShortDate(`${data.startDate}T12:00:00`)} — ${formatShortDate(`${data.endDate}T12:00:00`)}`
      )}
      ${meta("Área", letter.person.collaborator.area)}
      ${meta("Líder directo", letter.person.collaborator.leader ?? "Sin líder asignado")}
      ${meta("Emitido", issued)}
    </div>
  </header>`;
};

const introBlock = (letter: IndividualLetter, { source }: LetterContext): string => {
  const { data } = source;
  const first = letter.person.collaborator.name.split(" ")[0];
  return `<div class="lead">
    <p class="body">Estimado/a <strong>${escapeHtml(first)}</strong>:</p>
    <p class="body">
      Por medio de la presente se deja constancia del resultado de tu seguimiento de objetivos en el
      ciclo <strong>${escapeHtml(data.name)}</strong> (${escapeHtml(CICLO_STATUS_LABELS[data.status].toLowerCase())}).
      El porcentaje de avance es el promedio ponderado por el peso de cada objetivo, y el nivel de
      desempeño corresponde a la escala configurada por ${escapeHtml(DEMO_COMPANY_NAME)}.
    </p>
  </div>`;
};

// ── Bloques numerados ───────────────────────────────────────────────────────

function scoreBlock(letter: IndividualLetter): Block {
  // El estado por objetivo ya no es un rango de porcentaje: es en qué punto
  // del flujo está —por aprobar, por ajustar, por iniciar, en progreso,
  // completado—, así que el desglose se cuenta por ahí y no por cumplimiento.
  // Va como texto simple en el detalle de la tarjeta "Objetivos", no como
  // píldoras de color propias: esta fila ya tiene su color en el chip de
  // "Estado", y una segunda fila de píldoras al lado compite por la misma
  // atención en vez de leerse como un dato de apoyo.
  const lifecycleCounts = countLifecycles(letter.objectives.map((line) => line.lifecycle));
  const lifecycleSummary = LIFECYCLE_ORDER.map(
    (id) => `${count(lifecycleCounts.get(id) ?? 0)} ${LIFECYCLE_META[id].label.toLowerCase()}`
  ).join(" · ");

  return {
    title: "Avance y nivel de desempeño",
    keepTogether: true,
    body: `
      <div class="kpi-row">
        <div class="kpi">
          <span class="kpi-label">Logro</span>
          <span class="kpi-value">${escapeHtml(percent(letter.percent))}</span>
          <span class="kpi-detail">Promedio por peso de sus objetivos</span>
        </div>
        <div class="kpi">
          <span class="kpi-label">Estado</span>
          <span class="kpi-chip-wrap">${colorChip(letter.estado?.nombre ?? "Sin estado", letter.estado?.colorHex ?? null, true, letter.estado?.variant)}</span>
          <span class="kpi-detail">${
            letter.estado
              ? `Rango ${letter.estado.minPorcentaje}–${letter.estado.maxPorcentaje} %`
              : "Sin rango configurado"
          }</span>
        </div>
        <div class="kpi">
          <span class="kpi-label">Nivel de desempeño</span>
          <span class="kpi-chip-wrap">${colorChip(letter.nivel?.nombre ?? "Sin nivel", letter.nivel?.colorHex ?? null, true)}</span>
          <span class="kpi-detail">${
            letter.nivel
              ? `Rango ${letter.nivel.minPorcentaje}–${letter.nivel.maxPorcentaje} %`
              : "Sin escala configurada"
          }</span>
        </div>
        <div class="kpi">
          <span class="kpi-label">Objetivos</span>
          <span class="kpi-value">${escapeHtml(count(letter.objectives.length))}</span>
          <span class="kpi-detail">${escapeHtml(lifecycleSummary)}</span>
        </div>
      </div>`,
  };
}

/** "Aumentar" / "Reducir", o "No aplica" en los de hito, que no tienen a dónde moverse. */
const directionLabel = (line: IndividualObjectiveLine): string => {
  if (line.objective.measure === "boolean" || line.objective.direction === null) return "No aplica";
  return DIRECTION_META[line.objective.direction].label;
};

/**
 * Un objetivo por bloque: su nombre arriba, como título, y debajo la tabla
 * con su detalle — no una fila más de una tabla compartida, porque el nombre
 * es lo primero que se lee de un objetivo y aquí compite con seis columnas
 * más si se queda metido en la misma celda que todas ellas.
 */
function objectivesBlock(letter: IndividualLetter): Block {
  if (letter.objectives.length === 0) {
    return {
      title: "Detalle por objetivo",
      keepTogether: true,
      body: `<p class="body">Este colaborador no tiene objetivos asignados en el ciclo.</p>`,
    };
  }

  const totalWeight = letter.objectives.reduce((sum, line) => sum + line.objective.weight, 0);

  return {
    title: "Detalle por objetivo",
    body: `
      ${letter.objectives
        .map(
          (line, index) => `
      <div class="objective-block break-avoid">
        <div class="objective-name"><span class="objective-index">${index + 1}.</span> ${escapeHtml(line.objective.title)}
          ${line.objective.description ? `<span class="sub">${escapeHtml(line.objective.description)}</span>` : ""}
        </div>
        <table class="grid">
          <thead><tr>
            <th>Valor inicial</th>
            <th>Meta</th>
            <th>Dirección</th>
            <th>Avance reportado</th>
            <th class="num">Peso</th>
            <th class="num">Cumplimiento</th>
            <th>Estado</th>
          </tr></thead>
          <tbody><tr>
            <td>${
              line.objective.measure === "boolean"
                ? '<span class="dim">No aplica</span>'
                : escapeHtml(readValue(line.objective.initialValue, line.objective.measure))
            }</td>
            <td>${escapeHtml(
              line.objective.measure === "boolean"
                ? "Se cumple / No se cumple"
                : readValue(line.objective.targetValue, line.objective.measure)
            )}</td>
            <td>${escapeHtml(directionLabel(line))}</td>
            <td>${escapeHtml(readValue(line.currentValue, line.objective.measure))}</td>
            <td class="num">${line.objective.weight} %</td>
            <td class="num">${escapeHtml(percent(line.percent))}</td>
            <td>${colorChip(LIFECYCLE_META[line.lifecycle].label, LIFECYCLE_META[line.lifecycle].colorHex)}</td>
          </tr></tbody>
        </table>
      </div>`
        )
        .join("")}
      <p class="objectives-total">Peso total: <strong>${totalWeight} %</strong> · Cumplimiento ponderado: <strong>${escapeHtml(percent(letter.percent))}</strong></p>`,
  };
}

/** El espacio en blanco justo antes de firmar, para lo que la carta no
 *  tiene una casilla propia: una aclaración del líder, una excepción que
 *  quedó por fuera del detalle por objetivo. */
const commentsBlock = (): string => `<div class="comments break-avoid">
  <div class="comments-label">Comentarios</div>
  <div class="comments-lines"><span></span><span></span><span></span></div>
</div>`;

const signaturesBlock = (letter: IndividualLetter, { issuedAt }: LetterContext): string => {
  const issued = issuedAt.toLocaleDateString("es-CO");
  return `${commentsBlock()}
  <div class="signatures">
    <div class="sign">
      <div class="sign-line"></div>
      <div class="sign-name">${escapeHtml(letter.person.collaborator.leader ?? "Líder directo")}</div>
      <div class="sign-role">Líder directo</div>
      <div class="sign-date">Fecha: ${escapeHtml(issued)}</div>
    </div>
    <div class="sign">
      <div class="sign-line pending"></div>
      <div class="sign-name">${escapeHtml(letter.person.collaborator.name)}</div>
      <div class="sign-role">${escapeHtml(letter.person.collaborator.area)}</div>
      <div class="sign-date">Fecha: <u>&nbsp;</u></div>
    </div>
  </div>
  <p class="sign-note">
    La firma del colaborador confirma que conoció este resultado; la fecha es la del día en que lo firma.
  </p>`;
};

// ── La carta ────────────────────────────────────────────────────────────────

function letterHtml(letter: IndividualLetter, context: LetterContext): string {
  const { request } = context;

  // Los bloques apagados no imprimen, y los que quedan se renumeran: un
  // documento que salta del 1 al 3 hace pensar en una página perdida.
  const blocks = [
    on(request, "avance") ? scoreBlock(letter) : null,
    on(request, "objetivos") ? objectivesBlock(letter) : null,
  ].filter((block): block is Block => block !== null);

  return `<article class="letter">
    ${coverBlock(letter, context)}
    ${introBlock(letter, context)}
    ${blocks
      .map(
        (block, position) => `
    <section${block.keepTogether ? ' class="break-avoid"' : ""}>
      <h2><span class="h2-index">${position + 1}</span>${escapeHtml(block.title)}</h2>
      ${block.body}
    </section>`
      )
      .join("")}
    ${on(request, "firmas") ? signaturesBlock(letter, context) : ""}
  </article>`;
}

export function buildCicloLetterDocument(
  source: CicloReportSource,
  request: CicloReportRequest
): string {
  const scope = scopeFor(source, request);
  const letters = individualLetters(source, scope);
  const context: LetterContext = {
    source,
    request,
    issuedAt: new Date(),
  };

  const body =
    letters.length === 0
      ? `<article class="letter"><p class="body">Ningún colaborador quedó en la población elegida.</p></article>`
      : letters.map((letter) => letterHtml(letter, context)).join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(source.data.name)} — Reportes individuales</title>
<style>${CICLO_LETTER_STYLES}</style>
</head>
<body>
${body}
</body>
</html>`;
}

/** Cuántos bloques quedaron encendidos — el contador de la tarjeta del panel. */
export const letterSectionCount = (request: CicloReportRequest): number =>
  CICLO_INDIVIDUAL_SECTIONS.filter((section) => request.individualSections.includes(section.id))
    .length;

/**
 * Renderiza las cartas en un iframe oculto de la misma página y dispara el
 * diálogo de impresión: "Guardar como PDF" ahí es la descarga. Iframe en vez de
 * `window.open` a propósito — un bloqueador de popups puede comerse una pestaña
 * nueva en silencio, y un documento que a veces no aparece se lee como un botón
 * roto.
 */
export function openCicloLetterReport(
  source: CicloReportSource,
  request: CicloReportRequest
): boolean {
  const html = buildCicloLetterDocument(source, request);
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    return false;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => frame.remove();
  win.addEventListener("afterprint", () => setTimeout(cleanup, 500));
  // Respaldo para navegadores que nunca disparan afterprint en iframes.
  setTimeout(cleanup, 120_000);

  // Un respiro para que el layout se asiente antes de que el diálogo lo congele.
  setTimeout(() => {
    win.focus();
    win.print();
  }, 350);
  return true;
}
