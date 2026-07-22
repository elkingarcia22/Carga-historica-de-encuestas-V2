# Carga histórica de encuestas — Documentación técnica y funcional

> **Audiencia:** equipo de tecnología y PM.
> **Objetivo:** describir la funcionalidad completa del prototipo de carga de encuestas, todos los casos de uso (happy path, por formato, por tipo de pregunta y de error), y las instrucciones para reproducir cada uno. Sirve como base para redactar las Historias de Usuario (HU) y los criterios de aceptación.
> **Estado:** prototipo (frontend). La detección/parseo real está implementada para el formato de exportación actual; varios casos "atípicos" y de error se **simulan de forma determinista** para la demo (ver §7). En producción deben implementarse contra el backend real.

---

## 1. Resumen de la funcionalidad

Permite **cargar encuestas históricas** (de tipo Clima, Cultura o NPS) subiendo uno o varios archivos exportados. El sistema:

1. Recibe los archivos y los **valida** (tipo y tamaño).
2. **Analiza y detecta** automáticamente la estructura: participación, favorabilidad, eNPS, demográficos, secciones (dimensiones) y preguntas (con su **tipo/escala/valoración** según la taxonomía UBITS).
3. Agrupa por **ola/año** (una encuesta por año; nunca mezcla años distintos).
4. Presenta un **asistente (wizard)** para confirmar datos generales y revisar la estructura detectada antes de cargar.
5. Ejecuta la **carga** mostrando progreso, con manejo de éxito y de error.

### Flujo de pantallas (wizard)
```
dropzone → [analizando…] → select (si hay varias encuestas)
                          → general (datos generales) → summary (estructura) → [cargando…] → done
Estados transversales: error (bloqueante de análisis) · empty (nada detectado)
```

---

## 2. Arquitectura y puntos de código

| Capa | Archivo | Responsabilidad |
|------|---------|-----------------|
| Orquestación de análisis | `src/lib/surveyImport/index.ts` → `analyzeUploaded()` | Decide escenario demo o pipeline real; devuelve `AnalyzeOutcome`. |
| Escenarios demo | `src/lib/surveyImport/demoScenarios.ts` | Dispara casos por nombre/tipo de archivo; helpers `resolveDemoScenario`, `buildMockExtractionResult`, `buildEmptyStructureResult`, `findExistingDuplicate`, `isEmptyAnalysis`. |
| Parseo real | `src/lib/surveyImport/parseFile.ts` (`detectFormat`), `parseGerenciaReport.ts`, `parseRawFormat.ts` | Lee el Excel y extrae la estructura. |
| Agregación | `src/lib/surveyImport/aggregate.ts` → `aggregateParsedFiles()` | Agrupa por año, combina archivos, calcula métricas ponderadas. |
| Validación de archivos | `src/components/upload/uploadUtils.ts` → `validateFiles()`, `getFileKind()` | Tipo y tamaño; mensajes en español. |
| UI del flujo | `src/screens/EncuestasDashboard.tsx` | Wizard, estados, clasificación de preguntas (`classifyQuestion`), lista/tray de cargas. |

**Pipeline real:** `parseSurveyFiles` → `parseSurveyFile` → `detectFormat` → `parseGerenciaReport` | `parseRawFormat` → `aggregateParsedFiles`.

---

## 3. Formatos soportados y validación

- **Aceptados (validación de subida):** `.csv, .xls, .xlsx, .pdf, .png, .jpg, .jpeg`. **Tamaño máx.: 10 MB.**
- **Parseables realmente (hoy):**
  - **`gerencia-report`** — Excel con hojas `Clima` / `Engagement` / `eNPS` (pivotes por área o por demográfico). Es el formato de la exportación real.
  - **`raw`** — Excel con hojas `answers` / `Dimensions` / `colaboradores` (una fila por respondiente). Único que da **participación exacta** y **eNPS real** (calculado de puntajes 0–10).
- **Limitaciones conocidas (deuda para producción):**
  - **CSV** se acepta pero **no se reconoce** (el parser identifica el formato por nombres de hoja). → HU: soportar CSV real.
  - **PDF / imágenes** se aceptan pero la extracción es **simulada** (mock). → HU: extracción real (OCR/IA).

---

## 4. Happy path (camino feliz) — REAL

**Descripción:** el usuario sube un archivo (o set) válido y bien formado; el sistema detecta toda la estructura y permite cargar la encuesta.

**Pasos:**
1. Clic en el ícono **Subir** (flecha ↑) en la barra de "Lista de encuestas" → abre el panel "Cargar encuestas".
2. Arrastra o selecciona el/los archivo(s) → clic en **Analizar archivos**.
3. Pantalla **"Analizando archivos"** (progreso).
4. **Datos generales**: nombre, visibilidad (Pública/Anónima), umbral de anonimato, fechas de inicio/cierre (pre-rellenados, editables) → **Siguiente**.
5. **Estructura**: indicadores detectados (Participación, Favorabilidad neta, eNPS) y estructura detectada (Demográficos, Secciones y preguntas) → **Cargar encuesta**.
6. **Cargando** con barra de progreso → **completada** (aparece "Ver encuesta" en la lista de cargas).

**Datos que se detectan y muestran:**
- **Participación** (%, respondieron / invitados), **Favorabilidad neta** (%positivos − %negativos), **eNPS** (real o aproximado, marcado con `*`).
- **Demográficos** (cortes detectados), **Secciones** (dimensiones) y **Preguntas** (agrupadas por sección, con badges de tipo/escala/valoración).

**Reproducir (demo):**
- **1 archivo real:** `demo-samples/encuesta-real/Resultdos Clima total QS 2025.xlsx` → favorabilidad, eNPS, demográficos, 7 secciones · 44 preguntas (participación N/D con este archivo solo).
- **Set completo real:** subir los 10 archivos `*2025*.xlsx` de `demo-samples/encuesta-real/` juntos → participación 86.9%, eNPS real, todo completo (una sola encuesta 2025).
- **Sintético:** `demo-samples/Clima 2025.xlsx`.

**Criterios de aceptación (HU):**
- Dado un archivo válido, cuando se analiza, entonces se muestran datos generales pre-rellenados y la estructura detectada.
- Los indicadores sin dato muestran **N/D** (no 0).
- El eNPS aproximado (derivado de favorabilidad) se marca con `*`; el eNPS real (de puntajes 0–10) no.

---

## 5. Casos de uso POR FORMATO

| # | Formato | Comportamiento | Archivo demo | Estado |
|---|---------|----------------|--------------|--------|
| F1 | Excel `gerencia-report` (Clima/Engagement/eNPS) | Parseo real completo. | `encuesta-real/*` , `Clima 2025.xlsx` | REAL |
| F2 | Excel `raw` (answers/colaboradores) | Parseo real con participación y eNPS exactos. | `encuesta-real/Resultados Encuesta de Clima 2025.xlsx` | REAL |
| F3 | Varios Excel del mismo año | Se combinan en **una sola encuesta** (consolidado + por área + raw). | set `*2025*` | REAL |
| F4 | Varios Excel de **años distintos** | Se detectan **varias encuestas** → paso **"Selecciona la encuesta"** (una a la vez). | `Clima 2024.xlsx` + `Clima 2025.xlsx` | REAL |
| F5 | **PDF / imagen** | Extracción **simulada**: muestra estructura estimada con **banner "Estructura estimada (simulada)"**. | `reporte-clima.pdf`, `encuesta.png` | MOCK |
| F6 | **CSV** | Aceptado en subida pero **no reconocido** (cae en "sin estructura"). | — | Limitación |
| F7 | Tipo no permitido (`.zip`, `.docx`, …) | **Bloqueado en validación** al seleccionarlo (toast). | `no-soportado.zip` | REAL |

---

## 6. Casos de uso POR TIPO DE PREGUNTA (taxonomía UBITS)

La clasificación es **presentacional** (badges, agrupación, filtro); **no** altera el cálculo de métricas. Se infiere por heurística de texto (prototipo). El importador productivo debería leer el tipo real del origen.

### Taxonomía detectada
- **Tipo de pregunta:** Escala de valoración · Pregunta abierta · Opción única · Múltiples respuestas · Desplegable · **Sin reconocer**.
- **Tipo de escala** (si Escala de valoración): Likert · NPS · Visual por estrellas · Visual por emociones · Escala lineal.
- **Tipo de valoración** (si Likert): Acuerdo · Frecuencia · Satisfacción · Probabilidad.

### Cómo se agrupan en "Estructura → Secciones y preguntas"
- Preguntas **reconocidas** → bajo su **sección** (dimensión), cada una con sus badges.
- **eNPS**: preguntas NPS sin sección → grupo propio **"eNPS"**.
- **Sin sección**: preguntas reconocidas sin dimensión → grupo **"Sin sección"** con nota (no afectan métricas; son independientes).
- **Sin reconocer**: preguntas que no calzan con ningún tipo UBITS → **acordeón separado "Preguntas sin reconocer"** + **Alert ámbar prominente** por fuera (ver T-SR abajo).
- Filtros: por **sección** y por **tipo** (opciones dinámicas según lo detectado).

| # | Tipo/Escala | Cómo se demuestra (texto de la pregunta) |
|---|-------------|------------------------------------------|
| T1 | Likert · **Acuerdo** | Enunciado de acuerdo (default). "Estoy de acuerdo con…" |
| T2 | Likert · **Frecuencia** | "¿Con qué frecuencia…?", "nunca/siempre" |
| T3 | Likert · **Satisfacción** | "¿Qué tan satisfecho…?" |
| T4 | Likert · **Probabilidad** | "¿Qué tan probable…?" (sin recomendación) |
| T5 | **NPS** | "…recomiendes…", "escala de 0 a 10" |
| T6 | **Estrellas** | "Califica con estrellas…" |
| T7 | **Emociones** | "¿Cómo te sientes…?" |
| T8 | **Lineal** | "En una escala de 1 a 7…" |
| T9 | **Pregunta abierta** | "Cuéntanos…", "comentario", "describe" |
| T10 | **Opción única** | "Selecciona tu…", "elige tu…" |
| T11 | **Múltiples respuestas** | "Selecciona todas las que apliquen" |
| T12 | **Desplegable** | "Elige de la lista…" |
| T-SR | **Sin reconocer** | Ranking/matriz: "Ordena de mayor a menor…", "Distribuye 100 puntos…" |

**Reproducir:** `demo-samples/Encuesta tipos variados 2025.xlsx` (incluye una de cada tipo + 2 sin reconocer).

**Caso especial — "Sin reconocer" (T-SR):**
- Se muestra en un **acordeón aparte** ("Preguntas sin reconocer") con conteo, fuera de "Secciones y preguntas".
- **Alert ámbar prominente** (siempre visible): *"No coinciden con los tipos de UBITS. Si cargas la encuesta así, estas preguntas no aportarán a las métricas (favorabilidad/eNPS) ni podrán filtrarse ni segmentarse."*
- **Criterio de aceptación:** la encuesta **sí se puede cargar** con esas preguntas (no bloquea), pero el usuario queda advertido.

---

## 7. Casos de ERROR (separados)

| # | Caso | Disparador (demo, por nombre/tipo) | Comportamiento esperado | Bloquea | Estado |
|---|------|-----------------------------------|-------------------------|---------|--------|
| E1 | **Tipo no permitido** | Extensión fuera de la lista (ej. `no-soportado.zip`) | Toast en español: *"El tipo de archivo ".zip" no está permitido…"*. No abre el panel/no analiza. | Sí | REAL |
| E2 | **Archivo muy grande** | Nombre con `pesado`/`grande` **o** >10 MB real | Pantalla de error: *"Archivo demasiado grande — El archivo supera el límite de 10 MB…"* | Sí | tamaño REAL / token demo |
| E3 | **Archivo dañado/no legible** | Nombre con `corrupto`/`danado`/`dañado` | Pantalla de error: *"No pudimos leer el archivo — parece estar dañado o protegido con contraseña…"* | Sí | token demo (real: parser lanza → error) |
| E4 | **Reconocido pero sin estructura** | Nombre con `sin-estructura`/`vacio` | **Empty state** (no ceros): *"No encontramos datos de encuesta…"* + botón **"Subir otra encuesta"**. | Sí | token demo (real: parseo vacío) |
| E5 | **Nada detectado en todo el lote** | (todos los archivos no reconocidos) | Empty state equivalente. | Sí | REAL |
| E6 | **Encuesta duplicada** | Nombre = encuesta ya cargada (ej. `Clima Organizacional - Q1 2025.xlsx`) | En "Datos generales", al pulsar **Siguiente**: el campo **"Nombre de la encuesta" se pone rojo** con hint *"Ya existe una encuesta llamada … Usa otro nombre para continuar."* No avanza. Al editar el nombre a uno libre, se limpia y avanza. El botón **Siguiente permanece habilitado** (valida al enviar). | Sí (hasta renombrar) | REAL-contra-mock |
| E7 | **Falla el paso final de carga** | Nombre con `falla-carga`/`error-carga` | La carga **avanza con progreso** y se **atasca a mitad (~62–80%)**; luego el ítem pasa a estado **fallido inline** en la **lista de cargas** y en el **tray minimizado**: ícono rojo, *"No pudimos cargarla — problemas técnicos"*, barra roja y botón **"Reintentar"**. No es pantalla completa. | El ítem (reintentable) | token demo |
| E8 | **Archivos excluidos** (lote mixto) | Algunos reconocidos + otros no | Alert *"Algunos archivos fueron excluidos"* con el detalle, visible aun cuando se detecta una sola encuesta. | No (informativo) | REAL |

**Validaciones de sanidad adicionales (en "Datos generales"):**
- Participación > 100% → nota de advertencia.
- Fecha de cierre anterior a la de inicio → mensaje inline + bloquea Siguiente.
- Umbral de anonimato no numérico o < 1 → mensaje inline + bloquea Siguiente.
- Año no detectado (grupo `unknown-year`) → nota "No detectamos el año…".

---

## 8. Instrucciones para ejecutar (paso a paso)

### Preparación
```bash
# 1. Generar los archivos de muestra (crea/actualiza demo-samples/)
node scripts/generate-demo-samples.cjs

# 2. Levantar el proyecto
npm install   # si es la primera vez
npm run dev   # abre http://localhost:5173
```

### Ejecutar un caso
1. Abrir `http://localhost:5173`.
2. En "Lista de encuestas", clic en el ícono **Subir** (flecha ↑).
3. Arrastrar/seleccionar el/los archivo(s) desde `demo-samples/` (ver tabla de disparadores).
4. Seguir el wizard según el caso.

### Tabla rápida archivo → caso
| Archivo | Caso |
|---------|------|
| `encuesta-real/*` (set 2025) | Happy path con datos reales (F1–F3) |
| `Clima 2025.xlsx` | Happy path sintético |
| `Clima 2024.xlsx` + `Clima 2025.xlsx` | Varias encuestas / select (F4) |
| `preguntas-sin-seccion.xlsx` | Grupos eNPS / Sin sección |
| `Encuesta tipos variados 2025.xlsx` | Taxonomía completa + Sin reconocer (§6) |
| `reporte-clima.pdf` / `encuesta.png` | Extracción simulada (F5) |
| `no-soportado.zip` | Tipo no permitido (E1) |
| `pesado.xlsx` | Archivo muy grande (E2) |
| `corrupto.xlsx` | Dañado/no legible (E3) |
| `sin-estructura.xlsx` | Sin estructura / empty state (E4) |
| `Clima Organizacional - Q1 2025.xlsx` | Duplicado (E6) |
| `falla-carga 2025.xlsx` | Falla del paso final (E7) |

> **Convención de disparo (demo):** el escenario se decide por el **nombre/extensión** del archivo (case-insensitive). Si ningún token coincide, corre el **pipeline real**. Tokens: `pesado`/`grande`, `corrupto`/`danado`, `sin-estructura`/`vacio`, `falla-carga`/`error-carga`; extensiones `pdf`/`png`/`jpg`.

---

## 9. Notas para el PM (redacción de HU)

- **Separar por épica:** (a) Subida y validación, (b) Análisis y detección, (c) Confirmación de datos generales, (d) Revisión de estructura, (e) Carga y resultado, (f) Manejo de errores.
- **Cada caso de §5–§7 = candidato a HU** con sus criterios de aceptación (Given/When/Then).
- **Marcar deuda técnica explícita** para lo que hoy es MOCK/heurística y debe ser real en backend:
  1. Extracción real de **PDF/imágenes** (F5).
  2. Soporte real de **CSV** (F6).
  3. **Detección real del tipo de pregunta** desde el origen, no por heurística de texto (§6).
  4. Errores reales de **archivo grande/corrupto/sin estructura** (E2–E4) contra validación/parseo real.
  5. **Duplicados**: definir la regla real de unicidad (nombre + año + tipo) en backend (E6).
  6. **Falla de carga** (E7): manejo real de error de servidor + reintento idempotente.
- **Regla de negocio a confirmar:** ¿las preguntas "Sin reconocer" se cargan igual (con advertencia) o se excluyen? Hoy: se cargan con advertencia.
- **Tipos de encuesta permitidos:** Clima, Cultura, NPS (validar el tipo real del contenido, hoy no se valida).

---

## 10. Glosario
- **Ola / año:** cada aplicación de la encuesta (ej. Clima 2024 vs 2025). Nunca se mezclan.
- **Favorabilidad neta:** %positivos − %negativos (estilo NPS).
- **eNPS:** %promotores − %detractores; **real** si viene de puntajes 0–10, **aproximado** (`*`) si se deriva de porcentajes por bucket.
- **Consolidado (total):** archivo que representa a toda la empresa; no se suma con los de área para evitar doble conteo.
