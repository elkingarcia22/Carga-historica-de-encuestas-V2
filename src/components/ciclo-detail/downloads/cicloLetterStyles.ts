/**
 * El CSS de impresión de la carta individual del ciclo.
 *
 * Habla el mismo idioma que el reporte general de encuestas: portada en
 * degradado de marca con su píldora y su fila de metadatos, títulos de sección
 * numerados en un cuadro azul sobre su regla, indicadores en tarjetas de borde
 * fino, subtítulos en versalitas con una barra azul al costado y tablas de
 * encabezado gris. Los dos documentos salen del mismo producto y tienen que
 * poder ponerse uno al lado del otro.
 *
 * Lo que la carta añade sobre ese reporte es lo que la hace carta: el bloque
 * de firmas.
 */

const BRAND = "#0C5BEF";
const INK = "#1A1F2E";
const MUTED = "#6B7280";
const BORDER = "#E4E9F0";

export const CICLO_LETTER_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  /*
   * El margen real de la hoja se reparte en dos: 5mm los pone @page y el resto
   * el padding del body, que suma 12mm arriba y abajo — el margen de verdad
   * que necesita una carta que se archiva y se perfora.
   *
   * No es cosmético: Chrome dibuja su propia banda de fecha/URL/título dentro
   * del margen de página, y la omite solo cuando ese margen no llega a las
   * ~0,25in (6,35mm) que la banda necesita para caber. Con @page en 5mm la
   * banda no cabe y no se dibuja; si el margen entero fuera del @page (como
   * antes, 12mm) sí cabría, y ahí aparecía el "3/9/26, 4:14 p.m. …" que tapaba
   * el encabezado.
   */
  @page { size: A4; margin: 5mm 13mm; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: ${INK}; font-size: 11.5px; line-height: 1.55; background: #fff;
  }

  /*
   * Una carta por persona, y cada una empieza en su propia hoja — por eso el
   * aire extra del margen va aquí, en la carta, y no en el body: el padding
   * del body solo alcanza el borde superior de la primera hoja y el inferior
   * de la última, mientras que cada carta es su propia página impresa y
   * necesita su propio respiro arriba y abajo.
   */
  .letter { break-after: page; padding: 7mm 0; }
  .letter:last-child { break-after: auto; }

  /* --- Portada --- */
  .cover {
    background: linear-gradient(120deg, ${BRAND}, #2f7bff 65%, #6aa4ff);
    color: #fff; border-radius: 16px; padding: 20px 24px 17px; margin-bottom: 15px;
  }
  .cover-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .cover-kind {
    background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.35);
    border-radius: 999px; padding: 3px 12px; font-size: 11px; font-weight: 700;
  }
  .cover-brand { font-size: 11.5px; font-weight: 600; opacity: .9; }
  .cover h1 { font-size: 23px; font-weight: 800; letter-spacing: -.02em; margin-bottom: 12px; }
  .cover-meta { display: flex; flex-wrap: wrap; gap: 6px 24px; font-size: 11px; opacity: .95; }
  .cover-meta strong { display: block; font-size: 10px; font-weight: 600; opacity: .78; }

  /* --- Estructura --- */
  section { margin-bottom: 13px; }
  .break-avoid { break-inside: avoid; }
  h2 {
    font-size: 13.5px; font-weight: 800; letter-spacing: -.01em; margin-bottom: 8px;
    padding-bottom: 5px; border-bottom: 2px solid ${BRAND};
    display: flex; align-items: center; gap: 8px;
  }
  .h2-index {
    width: 19px; height: 19px; border-radius: 6px; background: ${BRAND}; color: #fff;
    font-size: 11px; font-weight: 700; display: inline-flex; align-items: center;
    justify-content: center; flex: none;
  }
  p.body { margin-bottom: 7px; }
  p.body:last-child { margin-bottom: 0; }
  .lead { margin-bottom: 14px; }

  /* --- Indicadores --- */
  .kpi-row { display: flex; flex-wrap: wrap; gap: 9px; margin-bottom: 10px; }
  .kpi {
    flex: 1 1 0; min-width: 0; border: 1px solid ${BORDER}; border-radius: 12px;
    padding: 10px 12px; display: flex; flex-direction: column; gap: 1px; break-inside: avoid;
  }
  .kpi-label { font-size: 10.5px; font-weight: 600; color: ${MUTED}; }
  .kpi-value { font-size: 22px; font-weight: 800; letter-spacing: -.03em; line-height: 1.15; }
  /* El chip de estado/nivel ocupa el mismo lugar que un kpi-value de texto:
     un poco de aire arriba y abajo para no pegarse a la etiqueta ni al dato. */
  .kpi-chip-wrap { margin: 3px 0 2px; }
  .kpi-detail { font-size: 10.5px; color: ${MUTED}; }

  /* --- Píldoras y barras --- */
  .chip {
    display: inline-block; border-radius: 999px; border: 1px solid;
    padding: 1px 9px; font-weight: 700; font-size: 10.5px; white-space: nowrap;
  }
  /* La variante que hace de valor de una tarjeta KPI en vez de una etiqueta de
     tabla: mismo lenguaje de color, letra más grande para sostener el lugar
     donde antes iba un número o una palabra en negrita. */
  .chip-lg { font-size: 13.5px; font-weight: 800; padding: 3px 12px; }
  .chip-mute { background: #F1F3F5; color: ${MUTED}; border-color: #E2E6EA; }

  /* --- Tablas --- */
  table { width: 100%; border-collapse: collapse; }
  .grid th {
    text-align: left; font-size: 9px; color: ${MUTED}; font-weight: 700;
    letter-spacing: .03em; text-transform: uppercase;
    padding: 6px 8px; background: #F8FAFC; border-bottom: 1px solid ${BORDER};
  }
  .grid td { padding: 5px 8px; font-size: 10.5px; border-bottom: 1px solid #F1F3F5; }
  .grid tr:last-child td { border-bottom: 0; }
  /* Se protege la fila, nunca la tabla: un break-inside sobre la tabla la
     empuja entera a la hoja siguiente y deja media página en blanco. */
  .grid tr { break-inside: avoid; }
  .grid thead { display: table-header-group; }
  .grid .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .grid .name { font-weight: 700; }
  .grid .sub { display: block; font-size: 9.5px; font-weight: 400; color: ${MUTED}; }
  .grid .dim { color: ${MUTED}; }
  .grid tr.total td { border-top: 1px solid ${BORDER}; font-weight: 800; background: #FBFCFD; }

  /* --- Un bloque por objetivo: su nombre arriba, su tabla de detalle abajo --- */
  .objective-block {
    border: 1px solid ${BORDER}; border-radius: 10px; padding: 9px 11px 2px;
    margin-bottom: 8px; break-inside: avoid;
  }
  .objective-name { font-size: 11.5px; font-weight: 700; margin-bottom: 6px; }
  .objective-index { color: ${MUTED}; }
  .objective-name .sub {
    display: block; font-size: 9.5px; font-weight: 400; color: ${MUTED}; margin-top: 2px;
  }
  .objectives-total { font-size: 10.5px; font-weight: 700; text-align: right; margin-top: 4px; }

  /* --- Actualizaciones --- */
  .log { border: 1px solid ${BORDER}; border-radius: 10px; padding: 2px 12px; }
  .log-item { padding: 6px 0; border-bottom: 1px solid #F1F3F5; break-inside: avoid; }
  .log-item:last-child { border-bottom: 0; }
  .log-head { display: flex; align-items: baseline; gap: 8px; font-size: 10.5px; }
  .log-obj { font-weight: 700; }
  .log-when { margin-left: auto; color: ${MUTED}; font-size: 9.5px; }
  .log-body { font-size: 10.5px; margin-top: 2px; }
  .note { color: ${MUTED}; font-size: 10px; margin-top: 6px; }

  /* --- Comentarios --- */
  /* El espacio en blanco justo antes de firmar: el líder o el colaborador
     escriben aquí a mano, así que son líneas para llenar, no una caja vacía
     que se lea como un error de impresión. */
  .comments { margin-top: 20px; break-inside: avoid; }
  .comments-label { font-size: 10.5px; font-weight: 700; margin-bottom: 8px; }
  .comments-lines span { display: block; height: 20px; border-bottom: 1px solid ${BORDER}; }

  /* --- Firmas --- */
  .signatures { display: flex; gap: 40px; margin-top: 40px; break-inside: avoid; }
  .sign { flex: 1; text-align: center; }
  .sign-line { border-top: 1px solid ${INK}; margin-bottom: 6px; }
  .sign-line.pending { border-top: 1px dashed #9AA3AF; }
  .sign-name { font-size: 11.5px; font-weight: 700; }
  .sign-role { font-size: 10.5px; color: ${MUTED}; }
  .sign-date { font-size: 10.5px; margin-top: 3px; }
  .sign-date u { text-decoration: none; border-bottom: 1px solid ${INK}; padding: 0 22px; }
  .sign-note { font-size: 9.5px; color: ${MUTED}; margin-top: 9px; text-align: center; }
`;
