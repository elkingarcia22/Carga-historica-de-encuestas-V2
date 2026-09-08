import * as React from "react";
import { motion } from "framer-motion";
import { ArrowUp, Layers, Sparkles, X } from "lucide-react";
import { AI_GRADIENT } from "@/components/app-shell/appShellData";
import { AiAnalyzingState } from "@/components/ai-interaction";
import { GuidedStep } from "./GuidedStep";
import {
  AmbitionPicker,
  AiPromptField,
  CountPicker,
  FocusChips,
  StarterChips,
} from "./AiObjectiveControls";
import {
  AI_BRIEF_STARTERS,
  createBlankBrief,
  describeBrief,
  generateObjectiveSet,
  isBriefReady,
  type AiObjectiveBrief,
} from "./aiObjectiveBrief";
import { AI_OBJECTIVE_SUGGESTIONS } from "./aiObjectiveGenerator";
import type { Objective } from "./cicloBuilderTypes";

/** Un objetivo suelto o la tanda entera del ciclo. Cambia qué se pregunta y
 * cómo se lee todo lo demás, no cómo funciona. */
export type AiComposerMode = "single" | "set";

/** Las cuatro salidas de la revisión, tal cual las necesita quien las
 * muestre: la barra de acciones flotante de la pantalla que contiene el
 * generador, no la propia tarjeta. */
export interface AiReviewActions {
  onDiscard: () => void;
  onModify: () => void;
  onRegenerate: () => void;
  onKeep: () => void;
}

interface AiObjectiveComposerProps {
  mode: AiComposerMode;
  /** Se llama con los objetivos generados, en cuanto están listos: los deja
   * puestos en la lista, ya editables. No cierra la tarjeta — pasa a la
   * revisión, que se encarga de eso. */
  onConfirm: (objectives: Objective[]) => void;
  onCancel: () => void;
  /** Cuántos caben todavía en el paso que lo abrió. */
  maxCount?: number;
  /** "de la empresa" / "del equipo": lo que se está creando, para los textos. */
  scopeLabel?: string;
  /** Se llama con `true` en cuanto la tarjeta aparece y con `false` justo
   * antes de desmontarse, para que quien la contenga pueda bloquear otras
   * acciones (como la barra de acciones del ciclo) mientras el generador
   * de IA está en pantalla, sea cual sea su fase interna. */
  onWorkingChange?: (isWorking: boolean) => void;
  /** Quita del ciclo los objetivos con estos ids, sin cerrar la tarjeta: lo
   * que usan "Otra propuesta" y "Modificar criterios" para retirar la tanda
   * anterior antes de proponer una nueva, y "Descartar" para deshacer la
   * tanda entera antes de salir. */
  onRemoveObjectives: (objectiveIds: string[]) => void;
  /** Se llama con las cuatro acciones de revisión en cuanto la tanda queda
   * lista para decidir, y con `null` en cuanto se deja de necesitar —se pasa
   * a otra fase, o la tarjeta se cierra—, para que quien la contenga las
   * muestre en su propia barra de acciones flotante en vez de en la tarjeta. */
  onReviewActionsChange?: (actions: AiReviewActions | null) => void;
}

type ComposerPhase = "brief" | "working" | "review";

/** Lo que la IA dice estar haciendo mientras trabaja. No es decoración: son
 * exactamente las cuatro decisiones que el autor se está ahorrando, y verlas
 * pasar es lo que explica por qué el resultado viene completo. */
const WORKING_TASKS: readonly string[] = [
  "Leyendo el contexto de tu empresa",
  "Eligiendo cómo se mide cada objetivo",
  "Definiendo si el número sube o baja",
  "Proponiendo metas realistas para el ciclo",
];

/** Lo que tarda el trabajo simulado, sin contar el respiro del 100 %. */
const GENERATION_MS = 2500;

/** Qué frase toca según lo avanzada que esté la barra. Es la línea que
 * cambia bajo el progreso, no el titular: el titular dice "Analizando" todo
 * el tiempo, así como en la importación de participantes con IA. */
function workingCaption(progress: number): string {
  const step = Math.floor((progress / 100) * WORKING_TASKS.length);
  return WORKING_TASKS[Math.min(WORKING_TASKS.length - 1, Math.max(0, step))];
}

/**
 * Crear objetivos con IA, en el sitio donde van a quedar.
 *
 * No es un modal ni un panel lateral a propósito: es exactamente la misma
 * pieza que aparece al pulsar "crear manualmente" —una tarjeta más en la
 * columna, con sus preguntas y sus campos— solo que las respuestas las
 * rellena la IA. Sacar esto a una ventana flotante habría convertido "añadir
 * un objetivo" en "ir a otro sitio a traer un objetivo", y el autor habría
 * perdido de vista la lista a la que está añadiendo.
 *
 * La tarjeta atraviesa tres momentos sin moverse del sitio —lo que sabes, lo
 * que hacemos, lo que armamos— y no hay una lista de propuesta aparte: en
 * cuanto la IA termina, los objetivos entran de una a la lista real, donde
 * ya se pueden editar campo por campo. Lo que queda pendiente es la decisión
 * sobre la tanda entera, y por eso la tarjeta se queda puesta —fija arriba
 * de lo que acaba de crear— hasta que el autor la conserva, pide otra,
 * cambia los criterios o la descarta.
 */
export function AiObjectiveComposer({
  mode: initialMode,
  onConfirm,
  onCancel,
  maxCount = 10,
  scopeLabel = "del ciclo",
  onWorkingChange,
  onRemoveObjectives,
  onReviewActionsChange,
}: AiObjectiveComposerProps) {
  const [phase, setPhase] = React.useState<ComposerPhase>("brief");
  const [mode, setMode] = React.useState<AiComposerMode>(initialMode);
  const [brief, setBrief] = React.useState<AiObjectiveBrief>(() =>
    createBlankBrief(initialMode === "single" ? 1 : 0)
  );
  const [progress, setProgress] = React.useState(0);
  // Los ids que la última tanda generada dejó puestos en el ciclo de verdad:
  // "Descartar", "Otra propuesta" y "Modificar criterios" los necesitan para
  // quitar esa tanda antes de cerrar, regenerar o volver al brief.
  const [insertedIds, setInsertedIds] = React.useState<string[]>([]);
  const cardRef = React.useRef<HTMLElement>(null);
  const runRef = React.useRef<{ cancelled: boolean } | null>(null);

  // El bloqueo dura lo que dura la tarjeta en pantalla, no solo el tramo
  // animado de "Analizando": desde que se abre el generador ya no tiene
  // sentido guardar el ciclo o continuar de paso con un brief a medio
  // responder, así que se avisa al montar y se retira al desmontar —se
  // cierre por Cancelar, por la X, o porque el autor confirmó la propuesta.
  React.useEffect(() => {
    onWorkingChange?.(true);
    return () => onWorkingChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si la tarjeta se cierra a mitad de una generación, lo que quedaba en
  // vuelo no debe escribir al volver.
  React.useEffect(
    () => () => {
      if (runRef.current) runRef.current.cancelled = true;
    },
    []
  );

  const patch = (next: Partial<AiObjectiveBrief>) =>
    setBrief((current) => ({ ...current, ...next }));

  /**
   * Genera los objetivos y los entrega.
   *
   * Lleva el mismo compás que la importación de participantes con IA: la
   * barra sube sola hasta el 95 %, el proceso real termina, y solo entonces
   * salta al 100 %. Que las dos esperas del producto se sientan iguales es
   * el punto.
   *
   * Al cerrar el 100 % los objetivos salen por `onConfirm` y quedan puestos
   * en la lista de verdad — no hay una lista aparte esperando aprobación—,
   * pero la tarjeta no se cierra: pasa a "review", donde se leen ya armados
   * y se decide si se conservan, se retocan o se descartan.
   *
   * Vive en el gesto y no en un efecto porque eso es lo que es: una acción
   * que el autor dispara. El `run` sirve de banderín — si la tarjeta se
   * cierra a mitad, lo que quedaba en vuelo no escribe sobre un componente
   * que ya no está.
   */
  const startGeneration = async () => {
    const run = { cancelled: false };
    runRef.current = run;

    setProgress(0);
    setPhase("working");

    const interval = setInterval(() => {
      setProgress((current) => (current >= 95 ? current : current + 5));
    }, 150);

    await new Promise((resolve) => setTimeout(resolve, GENERATION_MS));
    clearInterval(interval);
    if (run.cancelled) return;

    setProgress(100);
    // Un respiro en el 100 % antes de cambiar de pantalla: sin él la barra
    // llena no llega a verse y el salto parece un corte.
    await new Promise((resolve) => setTimeout(resolve, 450));
    if (run.cancelled) return;

    const generated = generateObjectiveSet(brief, { useContextAsObjective: mode === "single" });
    setInsertedIds(generated.map((objective) => objective.id));
    onConfirm(generated);
    setPhase("review");
  };

  /** Se queda con la tanda tal cual salió: solo cierra la tarjeta, los
   * objetivos ya estaban puestos desde que se generaron. */
  const keepBatch = () => onCancel();

  /** Deshace la tanda entera y sale de la experiencia de IA: es la única de
   * las cuatro acciones de revisión que cierra la tarjeta sin dejar nada. */
  const discardBatch = () => {
    onRemoveObjectives(insertedIds);
    setInsertedIds([]);
    onCancel();
  };

  /** Quita la tanda actual y vuelve al brief con las mismas respuestas
   * puestas, para tocar lo que haga falta antes de volver a generar. */
  const modifyCriteria = () => {
    onRemoveObjectives(insertedIds);
    setInsertedIds([]);
    setPhase("brief");
  };

  /** Quita la tanda actual y pide otra con el mismo brief — mismo camino que
   * la primera generación, así que pasa por "working" y muestra el mismo
   * "Analizando" en vez de un aviso aparte. */
  const regenerateBatch = () => {
    onRemoveObjectives(insertedIds);
    setInsertedIds([]);
    void startGeneration();
  };

  // La revisión se decide en la barra de acciones flotante de la pantalla
  // que contiene el generador, no aquí: en cuanto la tanda queda lista se le
  // pasan las cuatro salidas, y se le avisa con `null` en cuanto deja de
  // aplicar —cambia de fase, o la tarjeta se desmonta— para que esa barra
  // vuelva a mostrar lo suyo.
  React.useEffect(() => {
    if (phase !== "review") return;
    onReviewActionsChange?.({
      onDiscard: discardBatch,
      onModify: modifyCriteria,
      onRegenerate: regenerateBatch,
      onKeep: keepBatch,
    });
    return () => onReviewActionsChange?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, insertedIds]);

  // Cada fase tiene un alto distinto, así que al cambiar la tarjeta crece o
  // encoge bajo un scroll que sigue donde estaba: sin esto, generar desde el
  // final del brief deja al autor mirando el hueco que la tarjeta acaba de
  // dejar. Se espera a que la animación de alto termine antes de recolocar.
  React.useEffect(() => {
    const timer = setTimeout(() => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 320);
    return () => clearTimeout(timer);
  }, [phase]);

  /** Pasar de "uno" a "varios" sin perder lo ya escrito: el contexto y el
   * foco valen igual para una propuesta que para cinco. */
  const switchToSet = () => {
    setMode("set");
    patch({ count: null });
  };

  const isSingle = mode === "single";
  const isWorking = phase === "working";
  const isReview = phase === "review";
  const canOfferSet = maxCount > 1;
  // En modo "uno" desaparece la pregunta de cantidad, así que las que quedan
  // se renumeran: una lista que empieza en 2 delata un hueco.
  const stepOffset = isSingle ? 0 : 1;

  // Las preguntas se abren de a una, en el orden en que dejan de ser
  // adivinanzas: el frente no significa nada antes de saber cuántos
  // objetivos, y la exigencia de la meta no se puede juzgar sin saber de qué
  // meta hablamos. Es la misma regla que sigue la tarjeta de objetivo manual.
  const showFocus = isSingle || (brief.count !== null && brief.count > 0);
  const showContext = showFocus && brief.focuses.length > 0;
  const showAmbition = showContext && brief.context.trim() !== "";
  const showNotes = showAmbition && brief.ambition !== null;
  // Cuántas preguntas hay en pantalla: es lo que dispara el deslizamiento de
  // abajo cuando se abre una nueva.
  const visibleSteps =
    (isSingle ? 0 : 1) +
    (showFocus ? 1 : 0) +
    (showContext ? 1 : 0) +
    (showAmbition ? 1 : 0) +
    (showNotes ? 1 : 0);
  const isReady = isBriefReady(brief);

  /**
   * Lleva la vista al paso recién abierto.
   *
   * Va al propio paso y no al final de la tarjeta porque lo que hay que ver
   * es la pregunta, no el hueco debajo: con `block: "nearest"` y el margen de
   * scroll que trae `GuidedStep`, un paso alto queda alineado por arriba y
   * uno bajo simplemente asoma con aire.
   */
  const scrollToNewestStep = React.useCallback(() => {
    const steps = cardRef.current?.querySelectorAll("[data-objective-step]");
    steps?.[steps.length - 1]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  /**
   * El deslizamiento sale en cuanto el paso está en el DOM.
   *
   * La tarjeta ya no anima su alto a propósito: hacerlo obligaba a esperar a
   * que terminara para poder medir, y ese "crece, para, y ahora sí baja" es
   * lo que se sentía como un brinco. Ahora el alto cambia de una vez por
   * debajo del paso que entra desenfocado, y el único movimiento visible es
   * este deslizamiento, que arranca a la vez que la entrada del paso.
   */
  React.useEffect(() => {
    if (phase !== "brief" || visibleSteps === 0) return;
    const timer = setTimeout(scrollToNewestStep, 90);
    return () => clearTimeout(timer);
  }, [phase, visibleSteps, scrollToNewestStep]);

  return (
    <motion.section
      ref={cardRef}
      initial={{ opacity: 0, y: 16, filter: "blur(12px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      aria-label={isSingle ? "Crear un objetivo con IA" : "Crear objetivos con IA"}
      className="sticky top-0 z-20 overflow-hidden rounded-2xl bg-ai-mesh-card shadow-card border border-border"
    >
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border/50 px-5 py-4">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white shadow-drawer"
          style={{ background: AI_GRADIENT }}
        >
          <Sparkles className="size-[17px]" strokeWidth={2.2} />
        </span>

        <div className="min-w-[220px] flex-1">
          <h3 className="text-[14px] font-bold leading-tight text-text-primary">
            {phase === "brief"
              ? isSingle
                ? "Crear un objetivo con IA"
                : `Crear los objetivos ${scopeLabel} con IA`
              : phase === "working"
                ? isSingle
                  ? "Armando el objetivo"
                  : "Armando los objetivos"
                : isSingle
                  ? "Objetivo creado con IA"
                  : "Objetivos creados con IA"}
          </h3>
          <p className="text-[12px] leading-snug text-text-secondary">
            {phase === "brief"
              ? `${isSingle ? "Cuatro" : "Cinco"} preguntas, de a una. Ninguna necesita que sepas la terminología de objetivos.`
              : phase === "working"
                ? "Un momento: estamos resolviendo los campos por ti."
                : `${describeBrief(brief)} · ${
                    insertedIds.length === 1
                      ? "¿lo conservas, generas otro, cambias los criterios o lo descartas?"
                      : "¿los conservas, generas otros, cambias los criterios o los descartas?"
                  }`}
          </p>
        </div>

        {!isReview && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isWorking}
            aria-label="Cerrar el generador"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-black/5 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-40"
          >
            <X className="size-4" strokeWidth={2.2} />
          </button>
        )}
      </header>

      {!isReview && (
      <div className="px-5 py-6">
        {/* El cuerpo se remonta en cada fase por su `key` y entra con su
            propia animación. Sin `AnimatePresence`: en "wait" se quedaba
            esperando una salida que nunca completa —React 19 en
            StrictMode— y el cuerpo se congelaba en el paso anterior
            mientras la cabecera ya iba por el siguiente. Nadie echa de
            menos el fundido de salida; el de entrada es el que cuenta. */}
        <motion.div
          key={phase}
          initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          {phase === "brief" && (
            <div className="flex flex-col gap-7">
            {!isSingle && (
              <GuidedStep
                number={1}
                question={`¿Cuántos objetivos ${scopeLabel} quieres crear?`}
                help="Dos o tres suelen bastar para que el ciclo tenga foco. Puedes añadir más luego."
              >
                <CountPicker
                  value={brief.count}
                  max={maxCount}
                  onChange={(count) => patch({ count })}
                />
              </GuidedStep>
            )}

            {showFocus && (
              <GuidedStep
                number={stepOffset + 1}
                question="¿En qué se juega este ciclo?"
                help="Elige los frentes que de verdad importan ahora. Si el tuyo no está, escríbelo y lo añadimos."
              >
                <FocusChips value={brief.focuses} onChange={(focuses) => patch({ focuses })} />
              </GuidedStep>
            )}

            {showContext && (
              <GuidedStep
                number={stepOffset + 2}
                question={
                  isSingle
                    ? "¿Qué quieres lograr, con tus palabras?"
                    : "¿Qué momento vive la empresa?"
                }
                help={
                  isSingle
                    ? "Describe el resultado, no la tarea. De ahí sacamos qué medir, hacia dónde moverlo y hasta dónde."
                    : "Describe la situación actual de la empresa para definir qué medir."
                }
              >
                <div className="flex flex-col gap-3">
                  <AiPromptField
                    value={brief.context}
                    onChange={(context) => patch({ context })}
                    onSubmit={() => void startGeneration()}
                    placeholder={
                      isSingle
                        ? "Ej. Subir la satisfacción del cliente sin aumentar el equipo de soporte"
                        : "Ej. Somos una empresa de servicios, venimos creciendo pero perdiendo margen, y este trimestre el foco es rentabilidad sin descuidar al cliente"
                    }
                    rows={isSingle ? 3 : 4}
                  />
                  <StarterChips
                    starters={isSingle ? AI_OBJECTIVE_SUGGESTIONS : AI_BRIEF_STARTERS}
                    onPick={(starter) => patch({ context: starter })}
                    show={brief.context.trim() === ""}
                  />
                </div>
              </GuidedStep>
            )}

            {showAmbition && (
              <GuidedStep
                number={stepOffset + 3}
                question={
                  isSingle
                    ? "¿Qué tan exigente debe ser la meta?"
                    : "¿Qué tan exigentes deben ser las metas?"
                }
                help="Esto no cambia qué se mide, cambia cuánto hay que moverlo para darlo por cumplido."
              >
                <AmbitionPicker
                  value={brief.ambition}
                  onChange={(ambition) => patch({ ambition })}
                />
              </GuidedStep>
            )}

            {showNotes && (
              <GuidedStep
                number={stepOffset + 4}
                question="¿Algo más que debamos tener en cuenta?"
                help="Opcional. Restricciones o condiciones (ej. presupuesto congelado, temporada baja)."
              >
                <AiPromptField
                  value={brief.notes}
                  onChange={(notes) => patch({ notes })}
                  onSubmit={() => void startGeneration()}
                  placeholder="Ej. No podemos contratar más gente y el presupuesto de marketing sigue igual que el año pasado"
                  rows={3}
                />
              </GuidedStep>
            )}

            {isSingle && canOfferSet && (
              <button
                type="button"
                onClick={switchToSet}
                className="flex items-center gap-2 self-start rounded-xl border border-dashed border-border px-3.5 py-2.5 text-[12px] font-semibold text-text-secondary transition-all hover:border-ai-gradient-start/40 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <Layers className="size-3.5" strokeWidth={2.2} />
                Prefiero crear varios objetivos de una vez
              </button>
            )}
            </div>
          )}

          {phase === "working" && (
            <AiAnalyzingState
              title="Analizando"
              progress={progress}
              detail={describeBrief(brief)}
              caption={workingCaption(progress)}
            />
          )}

        </motion.div>
      </div>
      )}

      {phase === "brief" && (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 bg-surface/70 px-5 py-4">
          <p className="text-[11.5px] text-text-muted">
            {isReady
              ? "Al generar entran a la lista, editables campo por campo."
              : "Responde las preguntas de arriba y generamos los objetivos."}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-10 rounded-xl border border-border bg-surface px-4 text-[13px] font-semibold text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={() => void startGeneration()}
              disabled={!isReady}
              className="flex h-10 items-center gap-2 rounded-xl px-5 text-[13px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:hover:brightness-100"
              style={{ background: AI_GRADIENT }}
            >
              {isSingle
                ? "Generar el objetivo"
                : `Generar ${brief.count ?? ""} ${brief.count === 1 ? "objetivo" : "objetivos"}`.replace(
                    /\s+/g,
                    " "
                  )}
              <ArrowUp className="size-4 rotate-45" strokeWidth={2.4} />
            </button>
          </div>
        </footer>
      )}
    </motion.section>
  );
}
