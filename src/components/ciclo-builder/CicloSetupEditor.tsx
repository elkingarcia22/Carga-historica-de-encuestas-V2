import * as React from "react";
import {
  ArrowRight,
  Building2,
  CalendarRange,
  Check,
  CheckIcon,
  CircleSlash,
  Lightbulb,
  Lock,
  Route,
  ShieldCheck,
  Target,
  Users2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toneBorder, toneChip, toneSolid, toneText, toneWash, type Tone } from "@/lib/tone";
import { MagicCard } from "@/components/ui/magic-card";
import { Switch } from "@/components/ui/switch";
import { DualDateRangePicker } from "@/components/date";
import {
  CICLO_PERIOD_LABELS,
  CICLO_PERIOD_MONTHS,
  MAX_CICLO_DESCRIPTION_LENGTH,
  PARTICIPANT_MODES_BY_CREATOR,
  type CicloDraft,
  type CicloObjectiveCreator,
  type CicloPeriod,
} from "./cicloBuilderTypes";
import { addMonths, formatSingleDate, parseISODate, toISODate } from "./cicloDates";
import {
  ASSIGNMENT_LEVEL_META,
  ASSIGNMENT_LEVEL_ORDER,
  GOVERNANCE_META,
  GOVERNANCE_ORDER,
  SETUP_BLOCK_ORDER,
  assignmentLevelOf,
  creatorAssignsObjectives,
  levelsForAssignment,
  levelsForCreator,
  setupBlockIssue,
  setupBlockSummary,
  setupIssue,
  setupModelOptions,
  setupPeriodOptions,
  shouldResetLevels,
  type SetupBlockId,
} from "./cicloSetup";
import { cicloStepLabel, getCicloStepperOrder, type CicloStepId } from "./cicloStepper";
import { PERIOD_VISUAL } from "./measureVisual";
import {
  OBJECTIVE_MODEL_META,
  objectiveModelPreset,
  objectiveModelRuleSentences,
  objectiveModelVocab,
  type ObjectiveModelId,
  type ObjectiveModelRules,
} from "./objectiveModel";
import { ObjectiveOptionCard } from "./ObjectiveOptionCard";
import { SetupBlock } from "./SetupBlock";
import { PermissionGroup } from "@/components/objetivos/objetivosConfigParts";
import {
  PERMISOS_LIDER_PROPIOS,
  PERMISOS_LIDER_EQUIPO,
  PERMISOS_COLABORADOR,
} from "@/components/objetivos/useObjetivosConfigDraft";

interface CicloSetupEditorProps {
  draft: CicloDraft;
  onChange: (patch: Partial<CicloDraft>) => void;
  /** True once the author tried to leave with required decisions missing. */
  showValidation?: boolean;
  /** Lo que va a la derecha del título del paso —el interruptor de flujo. */
  aside?: React.ReactNode;
  /** El bloque que estaba abierto cuando se guardó el borrador. Al retomarlo
   *  se abre ese mismo, en vez del primero. */
  initialOpenBlock?: SetupBlockId | null;
  /** Qué bloque está abierto ahora, para que el constructor lo guarde con el
   *  borrador. Debe ser estable entre renders. */
  onOpenBlockChange?: (block: SetupBlockId | null) => void;
}

const REQUIRED_FIELD_HINT = "Completa este campo";

/** Lo que espera el paso antes de abrir el bloque siguiente. */
const REVEAL_DELAY_MS = 280;

/**
 * Cuánta inactividad en el nombre hace falta para cederle el paso a
 * Metodología, cuando duración y fechas ya se resolvieron primero. El nombre
 * no tiene un botón "Aplicar" como el calendario que marque que el autor
 * terminó, así que una pausa al escribir hace de esa señal. Más larga que
 * `REVEAL_DELAY_MS`: tiene que sobrevivir una pausa normal entre palabras
 * mientras se compone un nombre, no solo entre teclas sueltas.
 */
const NAME_IDLE_DELAY_MS = 1400;

const PERIOD_DAYS: Readonly<Record<CicloPeriod, string>> = {
  mes: "30 días",
  bimestre: "60 días",
  trimestre: "90 días",
  semestre: "180 días",
  anio: "365 días",
  personalizado: "A medida",
};

/** Todos los pasos que el constructor puede tener, en su orden canónico. */
const ALL_STEPS: readonly CicloStepId[] = [
  "general",
  "participants",
  "company",
  "objectives",
  "alignment",
];

const BLOCK_TITLES: Readonly<Record<SetupBlockId, string>> = {
  identity: "Identidad y tiempos",
  methodology: "Metodología",
  governance: "Gobierno",
  permissions: "Permisos del ciclo",
};

const BLOCK_HINTS: Readonly<Record<SetupBlockId, string>> = {
  identity: "Cómo se llama el ciclo y entre qué fechas corre.",
  methodology: "Con qué modelo se escriben y se miden los objetivos: el qué.",
  governance: "Quién redacta los objetivos. Define dónde termina tu trabajo: el quién.",
  permissions: "Qué puede hacer cada rol dentro del ciclo.",
};

/** Cuántos bloques están contestados, contando desde el primero sin saltar. */
function countAnswered(draft: CicloDraft): number {
  if (setupBlockIssue("identity", draft) !== null) return 0;
  if (setupBlockIssue("methodology", draft) !== null) return 1;
  if (draft.objectiveCreator === null) return 2;
  if (setupBlockIssue("permissions", draft) !== null) return 3;
  return 4;
}

/** El norte, según lo que el modelo diga de él. */
function companyFlagFor(rules: ObjectiveModelRules, current: boolean): boolean {
  if (rules.companyObjectives === "off") return false;
  if (rules.companyObjectives === "required") return true;
  return current;
}

/**
 * El primer paso del ciclo como parametrización: cuatro bloques que van de
 * lo general a lo operativo y mandan sobre todo lo que sigue.
 *
 *   1. Identidad y tiempos   nombre, duración, fechas
 *   2. Metodología           el modelo y las reglas fijas que trae
 *   3. Gobierno              quién escribe — y dónde termina el administrador
 *   4. Estructura            a qué nivel se asigna, condicionado por el gobierno
 *
 * Los bloques se revelan de a uno, como las preguntas del paso guiado, pero
 * se pliegan solos: en cuanto el autor contesta el bloque siguiente, el
 * anterior se resume en una línea. Cuatro decisiones caben así en una
 * pantalla, y al volver a este paso con todo contestado se ve el resumen
 * entero de un vistazo, no cuatro formularios abiertos.
 *
 * Nada aquí abre un drawer: las reglas del modelo se ajustan en el mismo
 * bloque, con las mismas filas que antes vivían en el panel lateral.
 */
export function CicloSetupEditor({
  draft,
  onChange,
  showValidation = false,
  aside,
  initialOpenBlock = null,
  onOpenBlockChange,
}: CicloSetupEditorProps) {
  const sectionRef = React.useRef<HTMLElement>(null);
  const companyQuestionRef = React.useRef<HTMLDivElement>(null);

  // La foto del borrador al abrir, tomada una sola vez: si ya venía
  // contestado —se está editando, o se vuelve a este paso— no hay nada que
  // revelar y los四个 bloques arrancan plegados con su resumen.
  const [arrivedAnswered] = React.useState(() => setupIssue(draft) === null);

  // El bloque que el borrador traía abierto, leído una sola vez: retomar es
  // volver a la misma decisión, no al principio del acordeón.
  const [resumedBlock] = React.useState(() => initialOpenBlock);

  const answered = countAnswered(draft);

  const [revealedByAnswers, setRevealedByAnswers] = React.useState(() => {
    if (arrivedAnswered) return SETUP_BLOCK_ORDER.length;
    // Un bloque retomado tiene que estar revelado para poder verse abierto.
    const resumedIndex = resumedBlock === null ? -1 : SETUP_BLOCK_ORDER.indexOf(resumedBlock);
    return Math.max(1, resumedIndex + 1);
  });
  const revealed = showValidation ? SETUP_BLOCK_ORDER.length : revealedByAnswers;

  // Un solo bloque abierto a la vez, como un acordeón: abrir uno pliega
  // cualquier otro. El recién revelado se abre solo; contestar el que está
  // abierto lo pliega apenas el siguiente aparece.
  const [openBlock, setOpenBlock] = React.useState<SetupBlockId | null>(
    () => resumedBlock ?? (arrivedAnswered ? null : "identity")
  );
  const toggleBlock = (block: SetupBlockId) =>
    setOpenBlock((current) => (current === block ? null : block));

  React.useEffect(() => {
    const target = Math.min(SETUP_BLOCK_ORDER.length, answered + 1);
    // "Identidad y tiempos" no cede el paso solo (ver más abajo) — y mientras
    // siga abierta, tampoco revela lo que sigue: el nombre completa el
    // bloque con cada tecla, mucho antes de que el autor termine de
    // escribirlo, así que revelar "Metodología" en ese instante se leería
    // como que el acordeón ya avanzó. Revelarla espera a que el bloque ceda
    // el paso de verdad —clic en "Aplicar", o la pausa al escribir el
    // nombre, más abajo— igual que abrirla.
    const capped = openBlock === "identity" ? Math.min(target, 1) : target;
    if (revealed >= capped) return;
    const timer = setTimeout(
      () => setRevealedByAnswers((current) => Math.min(capped, current + 1)),
      REVEAL_DELAY_MS
    );
    return () => clearTimeout(timer);
  }, [answered, revealed, openBlock]);

  // El constructor guarda esto con el borrador — ver `_lastSetupBlock`.
  React.useEffect(() => {
    onOpenBlockChange?.(openBlock);
    // `onOpenBlockChange` es estable; volver a avisar en cada render del
    // padre solo repetiría el mismo valor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openBlock]);

  // Leído dentro del efecto de abajo sin ser su dependencia — igual que
  // `autoHideRef` en `CicloBuilderRail` — para que abrir o cerrar un bloque a
  // mano no dispare de nuevo la lógica de revelado.
  const openBlockRef = React.useRef(openBlock);
  React.useEffect(() => {
    openBlockRef.current = openBlock;
    if (openBlock) {
      const timer = setTimeout(() => {
        const el = document.getElementById(openBlock);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 90);
      return () => clearTimeout(timer);
    }
  }, [openBlock]);

  // Lo mismo para la pregunta del norte, que el efecto de revelado consulta
  // sin depender de ella: se declara más abajo, junto al resto de metodología.
  const companyQuestionPendingRef = React.useRef(false);

  const previousRevealed = React.useRef(revealed);
  React.useEffect(() => {
    if (revealed <= previousRevealed.current) {
      previousRevealed.current = revealed;
      return;
    }
    let opened = SETUP_BLOCK_ORDER.slice(previousRevealed.current, revealed);
    previousRevealed.current = revealed;
    
    if (opened.length === 0) return;

    // "Identidad y tiempos" no cede el paso solo. Sus fechas llegan con un
    // valor por defecto (hoy) en cuanto se elige la duración, así que
    // terminarlo no es señal de que el autor ya vio esa fecha y la quiere
    // así — es la primera vez que puede tocarla. El bloque se queda abierto
    // para que la ajuste si hace falta; el autor abre "Metodología" cuando
    // esté listo, con un clic.
    if (openBlockRef.current === "identity") return;

    // Y "Metodología" tampoco, mientras el modelo elegido deje el norte a
    // criterio del autor y esa pregunta siga sin contestar: elegir modelo no
    // termina el bloque cuando el modelo abre una pregunta más.
    if (openBlockRef.current === "methodology" && companyQuestionPendingRef.current) return;

    setOpenBlock(opened[opened.length - 1]);
  }, [revealed, draft.objectiveCreator]);

  // Contestar el bloque abierto lo pliega de inmediato, sin esperar a que el
  // siguiente termine de revelarse — el autor ya se movió de decisión.
  const previousAnswered = React.useRef(answered);
  React.useEffect(() => {
    const before = previousAnswered.current;
    previousAnswered.current = answered;
    if (answered <= before || answered < 2) return;
    const settled = SETUP_BLOCK_ORDER[answered - 2];

    // Si el bloque contestado es permisos (o gobierno si fuera el último), es el último bloque de la parametrización.
    // Lo dejamos abierto o gestionamos su cierre.
    if (settled === "permissions") {
      return;
    }

    setOpenBlock((current) => (current === settled ? null : current));
  }, [answered, draft.objectiveCreator]);

  /** Si un bloque tiene algo pendiente: su propia incidencia, o —solo
   *  gobierno— que el autor todavía no haya elegido. */
  const blockHasIssue = (block: SetupBlockId): boolean =>
    setupBlockIssue(block, draft) !== null;

  // Intentar continuar con algo sin responder abre el primer bloque
  // pendiente: el aviso nombra el hueco, y el hueco tiene que poder verse.
  React.useEffect(() => {
    if (!showValidation) return;
    const firstIssue = SETUP_BLOCK_ORDER.find(blockHasIssue);
    if (firstIssue) setOpenBlock(firstIssue);
    // Solo al encenderse el aviso: reabrir en cada tecla pelearía con el autor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showValidation]);

  // ── Identidad ────────────────────────────────────────────────────────────

  const [wantsDescription, setWantsDescription] = React.useState(
    () => draft.description !== ""
  );
  const showDescription = wantsDescription || draft.description !== "";
  const setDescriptionShown = (checked: boolean) => {
    if (!checked && draft.description !== "") onChange({ description: "" });
    setWantsDescription(checked);
  };

  const hasInvalidRange =
    draft.startDate !== "" && draft.endDate !== "" && draft.endDate < draft.startDate;
  const nameError =
    showValidation && draft.name.trim() === "" ? REQUIRED_FIELD_HINT : undefined;
  const periodError =
    showValidation && draft.period === null ? "Elige una duración" : undefined;
  const startDateError =
    showValidation && draft.startDate === "" ? REQUIRED_FIELD_HINT : undefined;
  const endDateError = hasInvalidRange
    ? "El cierre no puede ser antes del inicio"
    : showValidation && draft.endDate === ""
      ? REQUIRED_FIELD_HINT
      : undefined;

  // El calendario de fechas, controlado desde aquí para poder abrirlo solo
  // en cuanto se elige una duración fija — ver `applyPeriod`.
  const [datesCalendarOpen, setDatesCalendarOpen] = React.useState(false);

  // El calendario cerrándose —siempre con "Aplicar", nunca solo— es la
  /**
   * Elegir una duración abre el calendario de una vez en los dos casos,
   * porque en los dos el siguiente paso obvio es tocar una fecha — nunca
   * hace falta el clic extra de abrir "Fecha de inicio" a mano.
   *
   * Con una duración fija, además contesta el cierre: pedirle al autor que
   * calcule "inicio + 3 meses menos un día" sería pedirle que repita lo que
   * acaba de decir. Ese inicio lo elige el autor, no nosotros — se parte de
   * hoy solo como punto de partida provisional, y el cierre se recalcula
   * solo en cuanto lo cambia (`handleDateChange`). El calendario nunca se
   * cierra solo con un clic: se queda abierto mostrando el cierre ya
   * calculado, para que el autor lo revise antes de irse — cerrarlo siempre
   * pasa por su propio botón "Aplicar".
   *
   * Personalizado no calcula nada: el calendario se abre igual, y elegir el
   * inicio avanza al paso de cierre sin cerrarse, que es lo que el propio
   * calendario ya hace por su cuenta. El autor elige las dos fechas a mano,
   * una tras otra, y confirma con "Aplicar" igual que en una duración fija.
   *
   * El cierre que hubiera quedado de una duración fija anterior se borra al
   * pasar a Personalizado — si no, se vería ya puesto, como si el sistema lo
   * hubiera elegido por su cuenta, cuando aquí nadie calcula nada.
   */
  const applyPeriod = (period: CicloPeriod) => {
    const months = CICLO_PERIOD_MONTHS[period];
    if (months === null) {
      onChange({ period, endDate: "" });
      setTimeout(() => setDatesCalendarOpen(true), 0);
      return;
    }
    const start = parseISODate(draft.startDate) ?? new Date();
    onChange({
      period,
      startDate: toISODate(start),
      endDate: toISODate(addMonths(start, months)),
    });
    setTimeout(() => setDatesCalendarOpen(true), 0);
  };

  const handleDateChange = ({
    startDate,
    endDate,
  }: {
    startDate: Date | undefined;
    endDate: Date | undefined;
  }) => {
    const months = draft.period ? CICLO_PERIOD_MONTHS[draft.period] : null;

    // Un inicio nuevo bajo una duración fija arrastra el cierre con él.
    if (months !== null && startDate && toISODate(startDate) !== draft.startDate) {
      onChange({
        startDate: toISODate(startDate),
        endDate: toISODate(addMonths(startDate, months)),
      });
      return;
    }

    // Mover el cierre a mano bajo una duración fija la vuelve personalizada.
    if (months !== null && startDate && endDate) {
      const expectedEndDate = toISODate(addMonths(startDate, months));
      if (toISODate(endDate) !== expectedEndDate) {
        onChange({
          startDate: toISODate(startDate),
          endDate: toISODate(endDate),
          period: "personalizado",
        });
        return;
      }
    }

    onChange({ startDate: toISODate(startDate), endDate: toISODate(endDate) });
  };

  const isPresetPeriod =
    draft.period !== null && CICLO_PERIOD_MONTHS[draft.period] !== null;

  // Si duración y fechas ya estaban resueltas y lo único que faltaba era el
  // nombre, terminar de escribirlo también completa "Identidad y tiempos" —
  // pero a diferencia del calendario, aquí no hay un "Aplicar" que marque el
  // final. El temporizador se reinicia con cada tecla (por eso depende solo
  // de `draft.name`) y, si pasa entero sin que el bloque vuelva a tener una
  // incidencia, cede el paso a Metodología igual que hace `onApply` arriba.
  React.useEffect(() => {
    if (openBlockRef.current !== "identity") return;
    if (setupBlockIssue("identity", draft) !== null) return;
    const timer = setTimeout(() => {
      setOpenBlock((current) => (current === "identity" ? "methodology" : current));
    }, NAME_IDLE_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.name]);

  // ── Metodología ──────────────────────────────────────────────────────────

  /**
   * Que el autor haya contestado si quiere norte, no que el borrador traiga
   * un valor. `useCompanyObjectives` nunca es nulo —nace en `true`—, así que
   * por sí solo no distingue "todavía no se preguntó" de "ya contestó";
   * misma razón por la que el gobierno lleva su propio `creatorPicked`.
   */
  const [companyPicked, setCompanyPicked] = React.useState(arrivedAnswered);

  const handleModelPick = (model: ObjectiveModelId) => {
    // Personalizado parte de las reglas que ya tenía el ciclo: es "lo mío",
    // no "desde cero". Un preset trae las suyas.
    const inherited = objectiveModelPreset(model) ?? draft.modelRules;
    // Salvo el norte: Personalizado es la puerta a que el autor ajuste cada
    // regla a mano, y esta ya tiene su propia pregunta lista (las demás
    // esperan su editor en la fase 3). Heredarla como "required" u "off" del
    // modelo anterior la escondería en silencio — aquí siempre queda a
    // criterio del autor, nunca impuesta por un modelo que ya no es el suyo.
    const rules: ObjectiveModelRules =
      model === "custom" ? { ...inherited, companyObjectives: "optional" } : inherited;
    // Modelo nuevo, regla nueva sobre el norte: lo que se hubiera contestado
    // antes era sobre otro modelo.
    setCompanyPicked(false);
    setHoveredModel(null); // Clear stuck hover states on touch devices
    onChange({
      objectiveModel: model,
      modelRules: rules,
      useCompanyObjectives: companyFlagFor(rules, draft.useCompanyObjectives),
    });
    if (rules.companyObjectives !== "optional") {
      setOpenBlock((current) => (current === "methodology" ? "governance" : current));
    }
  };

  const model = draft.objectiveModel;
  const modelMeta = model ? OBJECTIVE_MODEL_META[model] : null;
  const modelError = showValidation && model === null ? "Elige un modelo" : undefined;

  /**
   * El modelo del que habla el panel de abajo: el que se está mirando con el
   * cursor, o el elegido cuando no se mira ninguno.
   *
   * El panel es el mismo sitio en los dos casos —nunca un globo flotante
   * sobre la fila— así que recorrer las tarjetas con el ratón compara sin
   * tapar nada ni mover la grilla de sitio.
   */
  const [hoveredModel, setHoveredModel] = React.useState<ObjectiveModelId | null>(null);
  const previewModel = hoveredModel ?? model;
  const isPreviewingOther = hoveredModel !== null && hoveredModel !== model;
  const previewMeta = previewModel ? OBJECTIVE_MODEL_META[previewModel] : null;
  // Mirando otra tarjeta manda su preset; hablando del modelo ya elegido,
  // las reglas que el ciclo lleva puestas.
  const previewRules: ObjectiveModelRules = isPreviewingOther
    ? (objectiveModelPreset(hoveredModel!) ?? draft.modelRules)
    : draft.modelRules;
  const previewSentences = objectiveModelRuleSentences(
    previewRules,
    objectiveModelVocab(previewModel, previewRules)
  );

  /**
   * El bloque todavía tiene una pregunta abierta: el modelo dejó el norte a
   * criterio del autor y nadie lo ha contestado.
   */
  const isCompanyQuestionPending =
    model !== null && draft.modelRules.companyObjectives === "optional" && !companyPicked;

  React.useEffect(() => {
    companyQuestionPendingRef.current = isCompanyQuestionPending;
    if (isCompanyQuestionPending) {
      const timer = setTimeout(() => {
        companyQuestionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 90);
      return () => clearTimeout(timer);
    }
  }, [isCompanyQuestionPending]);

  /** Contestar el norte es lo último del bloque: ahí sí cede el paso. */
  const answerCompanyQuestion = (useCompanyObjectives: boolean) => {
    setCompanyPicked(true);
    onChange({ useCompanyObjectives });
    setOpenBlock((current) => (current === "methodology" ? "governance" : current));
  };

  /** Se pasa por encima de una tarjeta que sí tiene reglas que adelantar. */
  const hoverProps = (option: ObjectiveModelId) => ({
    onPointerEnter: () => setHoveredModel(option),
    onPointerLeave: () => setHoveredModel((current) => (current === option ? null : current)),
    onFocus: () => setHoveredModel(option),
    onBlur: () => setHoveredModel((current) => (current === option ? null : current)),
  });

  // ── Gobierno ─────────────────────────────────────────────────────────────

  /**
   * Cambiar de gobierno adelanta el paso de participantes al método que le
   * corresponde —el primero de su orden en `PARTICIPANT_MODES_BY_CREATOR`— y
   * vuelve a preguntar el nivel cuando hace falta: la primera vez, y cada vez
   * que colaboradores u Otros entra o sale, porque con ellos el nivel no se
   * elige (ver `hasFixedIndividualLevel` en `cicloSetup.ts`).
   */
  const [creatorPicked, setCreatorPicked] = React.useState(arrivedAnswered);

  const handleCreatorPick = (creator: CicloObjectiveCreator) => {
    const patch: Partial<CicloDraft> = { objectiveCreator: creator };
    if (creator !== "hr") {
      patch.participants = {
        ...draft.participants,
        mode: PARTICIPANT_MODES_BY_CREATOR[creator][0],
        groupSegmentBy: creator === "leader" ? "leader" : draft.participants.groupSegmentBy,
      };
    }
    if (draft.objectiveCreator === null || shouldResetLevels(draft.objectiveCreator, creator)) {
      Object.assign(patch, levelsForCreator(creator));
    }
    setCreatorPicked(true);
    onChange(patch);

  };

  /**
   * A qué nivel se reparte, la pregunta que sigue a "quién escribe".
   *
   * Solo la contestan los gobiernos que reparten desde aquí (RRHH y Otros):
   * con líderes o colaboradores el constructor termina al lanzar el ciclo y
   * el reparto no es de este paso. La respuesta manda sobre "Objetivos
   * asignados": un solo nivel abre ese paso directo en su experiencia —solo
   * grupos o solo personas—, y Mixto deja las dos vías con sus pestañas.
   */
  const assignmentLevel = assignmentLevelOf(draft);
  const asksAssignmentLevel = creatorAssignsObjectives(draft.objectiveCreator);

  const governance = draft.objectiveCreator ? GOVERNANCE_META[draft.objectiveCreator] : null;
  const suggestedCreator =
    modelMeta?.creator && modelMeta.creator !== draft.objectiveCreator ? modelMeta.creator : null;
  const journey = getCicloStepperOrder(draft, "parametrizado");

  // ── Render ───────────────────────────────────────────────────────────────

  const isRevealed = (block: SetupBlockId) => SETUP_BLOCK_ORDER.indexOf(block) < revealed;
  const isOpen = (block: SetupBlockId) => openBlock === block;
  const isAnswered = (block: SetupBlockId) =>
    block === "governance" ? draft.objectiveCreator !== null : setupBlockIssue(block, draft) === null;
  const summaryOf = (block: SetupBlockId) =>
    block === "governance" && draft.objectiveCreator === null ? null : setupBlockSummary(block, draft);
  const blockHasError = (block: SetupBlockId) =>
    showValidation && setupBlockIssue(block, draft) !== null;

  // Los cuatro iconos de cabecera van en el mismo azul de marca: son pasos
  // de un mismo recorrido, no cuatro categorías con su propio acento —el
  // tono por bloque quedaba en la marca del modelo elegido y en el chip del
  // paso, no en este icono.
  const blockTone: Tone = "brand";

  const blockProps = (block: SetupBlockId) => ({
    id: block,
    tone: blockTone,
    title: BLOCK_TITLES[block],
    hint: BLOCK_HINTS[block],
    summary: summaryOf(block),
    isAnswered: isAnswered(block),
    isOpen: isOpen(block),
    onToggle: () => toggleBlock(block),
    hasError: blockHasError(block),
  });

  return (
    <section ref={sectionRef} className="flex min-w-0 flex-1 flex-col gap-3 self-start">
      <header className="flex items-start justify-between gap-4 rounded-2xl border border-border/60 bg-surface px-6 py-4 shadow-card">
        <div className="flex flex-col gap-1">
          <h2 className="text-[16px] font-bold tracking-tight text-text-primary">
            Parametriza el ciclo
          </h2>
          <p className="text-[13px] leading-relaxed text-text-secondary">
            Cuatro decisiones, de lo general a lo operativo. Ordenan todo lo que viene después:
            qué pasos existen, qué se le pide a cada objetivo y dónde termina tu parte.
          </p>
        </div>
        {aside && <div className="shrink-0 pt-0.5">{aside}</div>}
      </header>

      {/* ── 1. Identidad y tiempos ─────────────────────────────────────── */}
      {isRevealed("identity") && (
        <SetupBlock icon={CalendarRange} {...blockProps("identity")}>
          <div className="flex flex-col gap-5">
            <Field label="Nombre del ciclo" required error={nameError}>
              <input
                value={draft.name}
                onChange={(event) => onChange({ name: event.target.value })}
                placeholder="Por ejemplo: Objetivos comerciales Q1"
                aria-label="Nombre del ciclo"
                aria-invalid={!!nameError}
                autoFocus={!arrivedAnswered}
                className={cn(
                  "h-10 w-full rounded-md border bg-surface px-3 text-[13px] text-text-primary outline-none transition-all focus:ring-2 placeholder:text-muted-foreground/70",
                  nameError
                    ? "border-destructive focus:border-destructive focus:ring-destructive/25"
                    : "border-border focus:border-primary focus:ring-primary/25"
                )}
              />
              <label className="mt-2.5 flex w-fit cursor-pointer items-center gap-2 text-[12px] font-medium text-text-primary">
                <Switch
                  checked={showDescription}
                  onCheckedChange={setDescriptionShown}
                  className="data-[state=checked]:bg-status-positive"
                />
                <span>Añadir descripción</span>
              </label>
              {showDescription && (
                <textarea
                  value={draft.description}
                  onChange={(event) =>
                    onChange({
                      description: event.target.value.slice(0, MAX_CICLO_DESCRIPTION_LENGTH),
                    })
                  }
                  maxLength={MAX_CICLO_DESCRIPTION_LENGTH}
                  rows={3}
                  placeholder="Explica en una o dos frases para qué existe este ciclo."
                  aria-label="Descripción del ciclo"
                  className="mt-2 w-full resize-y rounded-md border border-border bg-surface px-3 py-2.5 text-[13px] leading-relaxed text-text-primary outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/25 placeholder:text-muted-foreground/70"
                />
              )}
            </Field>

            <Field
              label="Duración"
              required
              hint="Al elegir una, calculamos la fecha de cierre por ti."
              error={periodError}
            >
              <div
                role="radiogroup"
                aria-label="Duración del ciclo"
                data-period-picker
                className="grid grid-cols-3 gap-2 sm:grid-cols-5"
              >
                {setupPeriodOptions(draft.period).map((option) => (
                  <ObjectiveOptionCard
                    key={option}
                    {...PERIOD_VISUAL[option]}
                    align="center"
                    label={CICLO_PERIOD_LABELS[option]}
                    tagline={PERIOD_DAYS[option]}
                    isSelected={draft.period === option}
                    onClick={() => applyPeriod(option)}
                    onPointerUp={() => applyPeriod(option)}
                    hasError={Boolean(periodError)}
                    className="min-h-[84px] p-2.5"
                  />
                ))}
              </div>
            </Field>

            <Field label="Fechas del ciclo" required>
              <DualDateRangePicker
                startDate={parseISODate(draft.startDate)}
                endDate={parseISODate(draft.endDate)}
                onApply={() => {
                  if (setupBlockIssue("identity", draft) === null) {
                    setOpenBlock((current) => (current === "identity" ? "methodology" : current));
                  }
                }}
                startLabel="Fecha de inicio"
                endLabel="Fecha de cierre"
                startError={startDateError}
                endError={endDateError}
                locale="es"
                onChange={handleDateChange}
                open={datesCalendarOpen}
                onOpenChange={setDatesCalendarOpen}
              />
              {isPresetPeriod && draft.startDate !== "" && (
                <p className="mt-2 flex items-start gap-2 text-[12px] leading-relaxed text-text-secondary">
                  <CalendarRange
                    className="mt-px size-3.5 shrink-0 text-primary"
                    strokeWidth={2}
                  />
                  <span>
                    La fecha de inicio es{" "}
                    <span className="font-semibold text-text-primary">
                      {formatSingleDate(draft.startDate)}
                    </span>
                    ; el cierre sale solo de la duración{" "}
                    <span className="font-semibold text-text-primary">
                      {CICLO_PERIOD_LABELS[draft.period!].toLowerCase()}
                    </span>
                    . Si mueves cualquiera de las dos a mano, la duración pasa a ser
                    personalizada.
                  </span>
                </p>
              )}
            </Field>
          </div>
        </SetupBlock>
      )}

      {/* ── 2. Metodología ─────────────────────────────────────────────── */}
      {isRevealed("methodology") && (
        <SetupBlock icon={Target} {...blockProps("methodology")}>
          <Field label="Modelo de medición" required error={modelError}>
            <div
              role="radiogroup"
              aria-label="Modelo de medición"
              className="grid grid-cols-3 gap-2 sm:grid-cols-5"
            >
              {/* Pasar por encima de una tarjeta cambia el panel de abajo, no
                  abre nada encima: Personalizado no adelanta nada porque sus
                  reglas no se heredan de ningún preset. */}
              {setupModelOptions(model).map((option) => (
                <div key={option} className="h-full w-full" {...hoverProps(option)}>
                  <ObjectiveOptionCard
                    icon={OBJECTIVE_MODEL_META[option].icon}
                    tone={OBJECTIVE_MODEL_META[option].tone}
                    label={OBJECTIVE_MODEL_META[option].label}
                    tagline={OBJECTIVE_MODEL_META[option].tagline}
                    align="center"
                    isSelected={model === option}
                    onClick={() => handleModelPick(option)}
                    hasError={Boolean(modelError)}
                    className="h-full min-h-[92px] w-full p-2.5"
                  />
                </div>
              ))}
            </div>
          </Field>

          {/* Lo que trae el modelo, siempre en el mismo sitio: aquí abajo.
              Habla del que se está mirando con el cursor o del ya elegido, y
              nunca se abre encima de la fila — comparar no puede costar tapar
              las tarjetas vecinas. Es de solo lectura: las reglas son fijas. */}
          {previewModel !== null && previewMeta && (
            <div
              className="mt-4 overflow-hidden rounded-xl border bg-surface shadow-card transition-colors"
              style={previewMeta.tone ? toneBorder(previewMeta.tone, 40) : undefined}
            >
              <header
                className="flex items-start gap-3 px-4 py-3"
                style={previewMeta.tone ? toneWash(previewMeta.tone, 7) : undefined}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-border/40",
                    !previewMeta.tone && "bg-primary/10 text-primary"
                  )}
                  style={previewMeta.tone ? toneChip(previewMeta.tone) : undefined}
                >
                  <previewMeta.icon className="size-[18px]" strokeWidth={2.2} />
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <h4
                      className={cn(
                        "text-[14px] font-bold leading-tight tracking-tight",
                        !previewMeta.tone && "text-text-primary"
                      )}
                      style={previewMeta.tone ? toneText(previewMeta.tone) : undefined}
                    >
                      {previewModel === "custom" ? "Modelo personalizado" : previewMeta.label}
                    </h4>
                    {previewModel !== "custom" && (
                      <span className="text-[11.5px] text-text-muted">{previewMeta.fullName}</span>
                    )}
                  </div>
                  <p className="text-[12px] leading-relaxed text-text-secondary">
                    {previewModel === "custom" ? previewMeta.help : previewMeta.structure}
                  </p>
                </div>

                {/* Mirar no es elegir: la marca dice cuál de las dos cosas
                    está pasando, para que nadie crea que el ciclo cambió de
                    modelo solo por pasar el cursor. */}
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    isPreviewingOther
                      ? "bg-surface text-text-secondary ring-1 ring-inset ring-border"
                      : "bg-status-positive/10 text-status-positive"
                  )}
                >
                  {isPreviewingOther ? "Vista previa" : "Elegido"}
                </span>
              </header>

              <div className="border-t border-border/50 px-4 py-3.5">
                <p className="mb-2.5 text-[12px] font-semibold text-text-primary">
                  {isPreviewingOther
                    ? "Reglas fijas que aplicaría"
                    : "Reglas fijas que aplicará el sistema"}
                </p>
                <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  {previewSentences.map((sentence) => (
                    <li
                      key={sentence}
                      className="flex items-start gap-2 text-[12.5px] leading-relaxed text-text-primary"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "mt-[3px] flex size-4 shrink-0 items-center justify-center rounded-full",
                          !previewMeta.tone && "bg-primary/10 text-primary"
                        )}
                        style={previewMeta.tone ? toneChip(previewMeta.tone) : undefined}
                      >
                        <Check className="size-2.5" strokeWidth={3.2} />
                      </span>
                      <span>{sentence}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* El ejemplo es lo que de verdad resuelve "¿y esto en qué se
                  traduce?". Personalizado no lo lleva: su ejemplo habla del
                  modelo, no de un objetivo escrito con él. */}
              {previewModel !== "custom" ? (
                <figure className="flex flex-col gap-1 border-t border-border/50 bg-surface-muted/30 px-4 py-3">
                  <figcaption className="flex items-center gap-1.5 text-[11.5px] font-semibold text-text-secondary">
                    <Lightbulb className="size-3.5" strokeWidth={2.2} />
                    Un objetivo escrito así
                  </figcaption>
                  <p
                    className="border-l-2 pl-3 text-[12.5px] italic leading-relaxed text-text-primary"
                    style={previewMeta.tone ? toneBorder(previewMeta.tone, 100) : undefined}
                  >
                    {previewMeta.example}
                  </p>
                </figure>
              ) : (
                <p className="border-t border-border/50 bg-surface-muted/30 px-4 py-2.5 text-[12px] leading-relaxed text-text-secondary">
                  Por ahora hereda las reglas del último modelo que tuvo el ciclo. Ajustarlas una
                  a una llega más adelante.
                </p>
              )}
            </div>
          )}

          {/* Cuando el modelo deja el norte a criterio del autor, la pregunta
              se contesta aquí y no dos pasos más adelante: de la respuesta
              depende que el paso "Objetivos de la empresa" —y con él la
              alineación— exista siquiera. Mira las reglas del ciclo, nunca
              las de la tarjeta que se esté rozando con el cursor: una
              pregunta que aparece y desaparece al pasar el ratón no es una
              pregunta. Y no antes de elegir modelo: sin modelo, la regla que
              la hace opcional todavía no la puso nadie. */}
          {model !== null && draft.modelRules.companyObjectives === "optional" && (
            <div className="mt-5" ref={companyQuestionRef}>
              <Field
                label="¿El ciclo va a tener objetivos de la empresa?"
                required
                hint={
                  modelMeta && model !== "custom"
                    ? `${modelMeta.label} los deja a tu criterio. Son el norte del que pueden colgar los demás objetivos.`
                    : "Son el norte del que pueden colgar los demás objetivos. Tu modelo los deja a tu criterio."
                }
              >
                <div
                  role="radiogroup"
                  aria-label="Objetivos de la empresa"
                  className="mt-3 grid gap-2.5 sm:grid-cols-2"
                >
                  <ObjectiveOptionCard
                    icon={Building2}
                    label="Sí, con un norte"
                    tagline="Se añade el paso para escribirlos y alinear lo demás a ellos"
                    isSelected={companyPicked && draft.useCompanyObjectives}
                    onClick={() => answerCompanyQuestion(true)}
                    className="min-h-[84px] p-3"
                  />
                  <ObjectiveOptionCard
                    icon={CircleSlash}
                    label="No, sin norte"
                    tagline="El ciclo se sostiene solo con los objetivos que se asignen"
                    isSelected={companyPicked && !draft.useCompanyObjectives}
                    onClick={() => answerCompanyQuestion(false)}
                    className="min-h-[84px] p-3"
                  />
                </div>
              </Field>
            </div>
          )}
        </SetupBlock>
      )}

      {/* ── 3. Gobierno ────────────────────────────────────────────────── */}
      {isRevealed("governance") && (
        <SetupBlock icon={ShieldCheck} {...blockProps("governance")}>
          <Field
            label="¿Quién redactará los objetivos?"
            required
            hint={
              suggestedCreator
                ? `${modelMeta!.label} nace del acuerdo entre líder y colaborador, por eso te proponemos ${GOVERNANCE_META[suggestedCreator].label.toLowerCase()}. Puedes elegir otro.`
                : "Cada opción define cuándo termina el flujo para ti como creador del ciclo."
            }
          >
            <div role="radiogroup" aria-label="Quién redacta los objetivos" className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {GOVERNANCE_ORDER.map((option) => (
                <GovernanceCard
                  key={option}
                  creator={option}
                  isSelected={draft.objectiveCreator === option}
                  isSuggested={suggestedCreator === option}
                  onClick={() => handleCreatorPick(option)}
                />
              ))}
            </div>
          </Field>

          {/* Quién escribe ya está dicho; falta a quién le llega. Vive aquí y
              no en el paso de asignación porque decide cómo es ese paso. */}
          {asksAssignmentLevel && (
            <div className="mt-5">
              <Field
                label="¿Cómo se van a crear los objetivos?"
                required
                hint="El paso de objetivos asignados se abre en la experiencia que elijas aquí. Puedes volver a cambiarlo desde este bloque."
              >
                <div
                  role="radiogroup"
                  aria-label="Cómo se crean los objetivos"
                  className="mt-3 grid gap-2.5 sm:grid-cols-3"
                >
                  {ASSIGNMENT_LEVEL_ORDER.map((level) => {
                    const meta = ASSIGNMENT_LEVEL_META[level];
                    return (
                      <ObjectiveOptionCard
                        key={level}
                        icon={meta.icon}
                        label={meta.label}
                        tagline={meta.tagline}
                        isSelected={assignmentLevel === level}
                        onClick={() => onChange(levelsForAssignment(level))}
                        className="min-h-[84px] p-3"
                      />
                    );
                  })}
                </div>
              </Field>
            </div>
          )}

          {/* El recorrido que sale de esta decisión, para que la consecuencia
              se vea antes de seguir y no al llegar al último paso. */}
          {draft.objectiveCreator !== null && (
            <div className="mt-4 flex flex-col gap-2.5 rounded-xl border border-border/60 bg-surface-muted/40 px-4 py-3">
              <div className="flex items-center gap-2">
                <Route className="size-4 shrink-0 text-text-secondary" strokeWidth={2.2} />
                <p className="text-[12.5px] font-semibold text-text-primary">Tu recorrido</p>
                <span className="text-[12px] text-text-secondary">· {governance?.yourPart}</span>
              </div>
              <ol className="flex flex-wrap items-center gap-1.5">
                {ALL_STEPS.map((step) => {
                  const included = journey.includes(step);
                  return (
                    <React.Fragment key={step}>
                      <li
                        className={cn(
                          "flex h-7 items-center rounded-full px-2.5 text-[11.5px] font-semibold",
                          included
                            ? "bg-surface text-text-primary ring-1 ring-inset ring-border"
                            : "text-text-muted line-through decoration-text-muted/60"
                        )}
                      >
                        {cicloStepLabel(step, "parametrizado")}
                      </li>
                      <ArrowRight
                        aria-hidden
                        className="size-3 shrink-0 text-text-muted/60"
                        strokeWidth={2}
                      />
                    </React.Fragment>
                  );
                })}
                <li className="flex h-7 items-center rounded-full bg-primary/10 px-2.5 text-[11.5px] font-semibold text-primary">
                  {governance?.finishLabel}
                </li>
              </ol>
            </div>
          )}
        </SetupBlock>
      )}

      {/* ── 4. Permisos ────────────────────────────────────────────────── */}
      {isRevealed("permissions") && (
        <SetupBlock icon={ShieldCheck} {...blockProps("permissions")}>
          <div className="flex flex-col gap-5">
            <Field
              label="Permisos de líderes"
              hint="Qué puede hacer un líder con sus propios objetivos y con los de su equipo durante este ciclo."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <PermissionGroup title="Objetivos propios" permissions={PERMISOS_LIDER_PROPIOS} />
                <PermissionGroup title="Objetivos del equipo" permissions={PERMISOS_LIDER_EQUIPO} />
              </div>
            </Field>

            <Field
              label="Permisos de colaboradores"
              hint="Qué puede hacer un colaborador con los objetivos que le pertenecen durante este ciclo."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <PermissionGroup title="Objetivos propios" permissions={PERMISOS_COLABORADOR} />
              </div>
            </Field>
          </div>
        </SetupBlock>
      )}

    </section>
  );
}

// ── Piezas ──────────────────────────────────────────────────────────────────

/** Etiqueta, control y una sola línea debajo: la ayuda o el error. */
function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-1 text-[13px] font-semibold text-text-primary">
          {label}
          {required && <span className="text-destructive">•</span>}
        </span>
        {hint && !error && (
          <span className="max-w-[80ch] text-[12px] leading-relaxed text-text-secondary">
            {hint}
          </span>
        )}
      </div>
      {children}
      {error && <span className="text-[12px] text-destructive">{error}</span>}
    </div>
  );
}

/**
 * Una forma de gobierno: quién escribe, cómo se llama ese reparto y qué le
 * toca al creador. Sin tono a propósito —las tres no son tipos de cosa
 * distintos, son un mismo o/o/o— así que la elegida se pinta en el azul de
 * marca como el resto de las decisiones planas del producto.
 */
function GovernanceCard({
  creator,
  isSelected,
  isSuggested,
  onClick,
}: {
  creator: CicloObjectiveCreator;
  isSelected: boolean;
  isSuggested: boolean;
  onClick: () => void;
}) {
  const meta = GOVERNANCE_META[creator];
  return (
    <MagicCard
      role="radio"
      aria-checked={isSelected}
      isSelected={isSelected}
      onClick={onClick}
      className="w-full p-3.5"
      contentClassName="h-full w-full flex-col items-start gap-2.5 text-left"
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span
          aria-hidden
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors",
            isSelected
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
          )}
        >
          <meta.icon className="size-[18px]" strokeWidth={2.2} />
        </span>
        <span className="flex items-center gap-1.5">
          {isSuggested && (
            <span className="rounded-full bg-status-warning/15 px-2 py-0.5 text-[10.5px] font-semibold text-status-warning">
              Sugerido
            </span>
          )}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
              isSelected ? "bg-primary/10 text-primary" : "bg-surface-muted text-text-secondary"
            )}
          >
            {meta.mode}
          </span>
          <span
            aria-hidden
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
              isSelected
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-input bg-surface"
            )}
          >
            {isSelected && <span className="size-2 rounded-full bg-current" />}
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <span
          className={cn(
            "text-[13.5px] font-bold leading-tight tracking-tight",
            isSelected ? "text-primary" : "text-text-primary"
          )}
        >
          {meta.label}
        </span>
        <span className="text-[12px] leading-snug text-text-secondary">{meta.description}</span>
      </div>

      <span className="mt-auto flex items-start gap-1.5 text-[11.5px] leading-snug text-text-muted">
        <ArrowRight className="mt-[2px] size-3 shrink-0" strokeWidth={2.2} />
        {meta.yourPart}
      </span>
    </MagicCard>
  );
}
