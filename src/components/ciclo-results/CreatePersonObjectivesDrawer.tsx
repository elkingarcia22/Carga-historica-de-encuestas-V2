import * as React from "react";
import { ArrowLeft, Check, Library, Plus, Scale, Sparkles, Target, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DrawerShell } from "@/components/overlays";
import { agentPanelShift } from "@/components/ai/agentPanelMotion";
import { DrawerActionRail, DrawerRailButton } from "@/components/action-rail";
import { AiAgentDrawer } from "@/components/ai/AiAgentDrawer";
import { AiAnalyzingState } from "@/components/ai-interaction/AiAnalyzingState";
import { InitialsAvatar } from "@/components/ciclo-detail";
import {
  MAX_AI_OBJECTIVES,
  MIN_OBJECTIVE_WEIGHT,
  ObjectiveBankPanel,
  ObjectiveBankStepHeader,
  ObjectiveCardCompact,
  TOTAL_WEIGHT,
  WeightBalanceDialog,
  createBlankObjective,
  distributeWeights,
  objectiveIssue,
  totalWeight,
  useObjectiveBank,
  type Objective,
} from "@/components/ciclo-builder";
import type { PersonResultRow } from "./resultsModel";

/**
 * Crear objetivos para los colaboradores marcados en la tabla, sin salir de
 * los resultados.
 *
 * Es la misma experiencia con la que se escriben los objetivos de la empresa
 * en el constructor —la tarjeta paso a paso, el banco de objetivos ya escritos
 * y el Agente IA conversando en el panel lateral— apuntada a personas en vez
 * de a la compañía. Se reusa entera a propósito: escribir un objetivo antes de
 * que el ciclo arranque y escribirlo con el ciclo en marcha son la misma
 * pregunta, y dos formas distintas de contestarla acabarían discrepando en qué
 * se puede pedir.
 *
 * Las tres puertas —a mano, del banco, con IA— se eligen antes de abrir, en la
 * barra flotante de resultados, para que el drawer no vuelva a preguntar algo
 * que ya se contestó al pulsar. Desde dentro se sigue pudiendo cambiar de vía:
 * el mismo menú vive en su barra de abajo.
 *
 * Con el Agente IA abierto el drawer se angosta en vez de taparse: la tanda
 * que la IA propone cae en esta lista mientras se conversa, que es justo lo
 * que hay que estar viendo para decidir si sirve.
 *
 * Nada se escribe hasta "Guardar": el borrador vive aquí, y cerrar sin guardar
 * deja el ciclo exactamente como estaba.
 */

/** Con qué se abre el drawer. Lo decide el gesto que lo abrió. */
export type CreateObjectivesIntent = "manual" | "banco" | "ia";

/** Lo que cada persona marcada ya tiene repartido de su 100 %. */
const usedWeightOf = (row: PersonResultRow): number =>
  totalWeight(row.entries.map((entry) => entry.objective));

interface CreatePersonObjectivesDrawerProps {
  /** Los colaboradores marcados: todos reciben los mismos objetivos. */
  rows: readonly PersonResultRow[];
  companyObjectives: readonly Objective[];
  /** Con qué arranca. `null` mientras el drawer está cerrado. */
  intent: CreateObjectivesIntent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Los objetivos escritos, una sola vez. Quien los recibe los copia a cada
   * colaborador marcado —con ids propios— y le hace sitio a su peso.
   */
  onSave: (objectives: readonly Objective[]) => void;
  /**
   * Abrir el reparto de pesos de un colaborador — el mismo drawer "Peso de
   * los objetivos" que ya vive en resultados.
   *
   * Es la salida cuando alguien ya reparte su 100 %: ahí no se puede crear
   * nada sin quitarle sitio a lo que ya tiene, y esa decisión se toma sobre
   * el conjunto, no escribiendo un objetivo más.
   */
  onAdjustWeights?: (personId: string) => void;
}

export function CreatePersonObjectivesDrawer({
  rows,
  companyObjectives,
  intent,
  open,
  onOpenChange,
  onSave,
  onAdjustWeights,
}: CreatePersonObjectivesDrawerProps) {
  const [draft, setDraft] = React.useState<readonly Objective[]>([]);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [showValidation, setShowValidation] = React.useState(false);
  const [isComposerOpen, setIsComposerOpen] = React.useState(false);
  /** El banco se saca dentro de este mismo cajón, en el sitio de la lista:
   *  a quién se le pone ya está decidido arriba, y apilar un segundo cajón
   *  encima tapaba justo esa respuesta. */
  const [isBankOpen, setIsBankOpen] = React.useState(false);
  const bank = useObjectiveBank("individual", isBankOpen);
  const [isAddMenuOpen, setIsAddMenuOpen] = React.useState(false);
  const [isBalanceOpen, setIsBalanceOpen] = React.useState(false);
  const [workingState, setWorkingState] = React.useState<{
    progress: number;
    caption: string;
    detail: string;
  } | null>(null);

  const single = rows.length === 1 ? rows[0] : null;

  /** Lo que el cajón se corre para dejarle sitio al panel, y cómo. */
  const agentShift = agentPanelShift(isComposerOpen);

  /*
   * El hueco que de verdad hay.
   *
   * El 100 % es de cada colaborador, no de esta tanda, así que lo que queda
   * libre es lo que le queda a la persona más cargada de las marcadas: darle
   * a los objetivos nuevos el hueco de la más vacía dejaría a las demás por
   * encima del 100 % sin que nadie lo hubiera pedido.
   */
  const freeBudget = React.useMemo(() => {
    if (rows.length === 0) return TOTAL_WEIGHT;
    const mostLoaded = Math.max(...rows.map(usedWeightOf));
    return Math.max(0, TOTAL_WEIGHT - mostLoaded);
  }, [rows]);

  /** Cuántos objetivos carga ya la persona más ocupada de las marcadas. */
  const mostObjectives = React.useMemo(
    () => (rows.length === 0 ? 0 : Math.max(...rows.map((row) => row.entries.length))),
    [rows]
  );

  /**
   * Cuánto puede repartir esta tanda entre `count` objetivos.
   *
   * Con hueco libre, el hueco. Sin hueco —el caso normal en un ciclo en
   * marcha, donde todo el mundo ya reparte su 100 %— la tanda entra en
   * igualdad de condiciones con lo que ya había: tres objetivos viejos y uno
   * nuevo se van a 25 % cada uno. Arrancarlos en 0 % sería pedirle al autor
   * que resuelva a mano una cuenta que el ciclo ya contesta solo.
   */
  const budgetFor = React.useCallback(
    (count: number) => {
      if (freeBudget > 0) return freeBudget;
      if (count <= 0) return 0;
      return Math.max(
        count * MIN_OBJECTIVE_WEIGHT,
        Math.round((count / (mostObjectives + count)) * TOTAL_WEIGHT)
      );
    },
    [freeBudget, mostObjectives]
  );

  /**
   * Los marcados que ya reparten su ciclo entero.
   *
   * Con uno solo de estos no hay nada que crear: el peso de un objetivo nuevo
   * tendría que salir de los que esa persona ya lleva, y eso es una decisión
   * sobre el conjunto —cuánto vale cada uno—, no sobre el objetivo que se
   * está escribiendo. Así que el drawer no deja escribir y manda al reparto.
   */
  const fullyLoaded = React.useMemo(
    () => rows.filter((row) => usedWeightOf(row) >= TOTAL_WEIGHT),
    [rows]
  );
  const isBlocked = fullyLoaded.length > 0;

  const share = totalWeight(draft);
  const budget = budgetFor(draft.length);
  /** A quién hay que reescalarle lo que ya tenía para que esto quepa. */
  const crowded = React.useMemo(
    () => rows.filter((row) => usedWeightOf(row) + share > TOTAL_WEIGHT),
    [rows, share]
  );

  /*
   * Cada apertura arranca en blanco y aplica la vía con la que se entró. El
   * borrador de la vez anterior propondría objetivos que nadie está mirando,
   * y la vía se aplica una sola vez —borrar el último objetivo no puede
   * conjurar otro solo.
   */
  const [seen, setSeen] = React.useState(open);
  if (seen !== open) {
    setSeen(open);
    if (open) {
      setShowValidation(false);
      setIsBalanceOpen(false);
      setIsAddMenuOpen(false);
      if (isBlocked) {
        // Nada que sembrar: lo único que ofrece esta apertura es ir a
        // repartir los pesos que ya existen.
        setDraft([]);
        setExpandedId(null);
        setIsComposerOpen(false);
        setIsBankOpen(false);
      } else if (intent === "ia") {
        setDraft([]);
        setExpandedId(null);
        setIsComposerOpen(true);
        setIsBankOpen(false);
      } else if (intent === "banco") {
        setDraft([]);
        setExpandedId(null);
        setIsComposerOpen(false);
        setIsBankOpen(true);
      } else {
        const first = createBlankObjective(budgetFor(1));
        setDraft([first]);
        setExpandedId(first.id);
        setIsComposerOpen(false);
        setIsBankOpen(false);
      }
    } else {
      setIsComposerOpen(false);
      setIsBankOpen(false);
    }
  }

  /** Lo que queda sin repartir dentro de la tanda. */
  const freeInDraft = Math.max(0, budget - share);

  const addBlank = () => {
    // El presupuesto crece con la tanda cuando nadie tiene hueco, así que lo
    // que le toca al nuevo es lo que ese presupuesto acaba de abrir.
    const room = Math.max(0, budgetFor(draft.length + 1) - share);
    const objective = createBlankObjective(room);
    setDraft((current) => [...current, objective]);
    setExpandedId(objective.id);
  };

  /**
   * Los que llegan ya escritos —del banco o de la IA— reparten entre ellos lo
   * que quede libre: los que ya estaban en pantalla conservan el peso que su
   * autor les dio, porque añadir algo no es motivo para reescribir una
   * decisión que nadie pidió cambiar.
   *
   * `expand` decide si el primero cae abierto. Del banco sí, porque se elige
   * de a uno y abrirlo es seguir mirándolo; de la IA no, porque llega una
   * tanda y abrir uno de cinco es tapar el resto con una tarjeta larga.
   */
  /** Lo que trae `addWritten` y `addFromBank` por igual: la tanda con el
   *  peso que le toca dentro de lo que queda libre. Aparte porque el banco
   *  necesita el resultado ya calculado —no la actualización de estado— para
   *  decidir si con esto la tanda quedó lista para guardarse sola. */
  const mergeWritten = (
    current: readonly Objective[],
    incoming: readonly Objective[]
  ): readonly Objective[] => {
    const weights = distributeWeights(
      incoming.length,
      Math.max(0, budgetFor(current.length + incoming.length) - totalWeight(current))
    );
    return [...current, ...incoming.map((objective, index) => ({ ...objective, weight: weights[index] }))];
  };

  const addWritten = (
    incoming: readonly Objective[],
    { expand = true, fromAi = false }: { expand?: boolean; fromAi?: boolean } = {}
  ) => {
    if (incoming.length === 0) return;
    setDraft((current) => mergeWritten(current, incoming));
    setExpandedId(expand ? incoming[0].id : null);
    if (fromAi) setAiDraftIds(new Set(incoming.map((objective) => objective.id)));
  };

  /**
   * Cierra el banco llevándose lo marcado. El hueco libre se mira en este
   * momento y no al abrirlo: entre medias pudo entrar algo más.
   *
   * A diferencia de la IA, aquí no hay una revisión posterior —elegir del
   * banco ya es la decisión completa—, así que si con esto la tanda queda
   * lista se guarda sola en vez de dejar un "Guardar" de más.
   */
  const addFromBank = () => {
    const incoming = bank.buildObjectives(freeInDraft);
    if (incoming.length === 0) return;
    const next = mergeWritten(draft, incoming);
    setIsBankOpen(false);
    if (finishIfComplete(next)) return;
    setDraft(next);
    setExpandedId(incoming[0].id);
  };

  /** Quita una tanda entera de la IA en un solo cambio de estado: llamar al
   *  removedor de a uno leería el mismo borrador viejo cada vez. */
  const removeMany = (ids: readonly string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setDraft((current) => current.filter((objective) => !idSet.has(objective.id)));
    setAiDraftIds((current) => new Set([...current].filter((id) => !idSet.has(id))));
  };

  const changeObjective = (id: string, patch: Partial<Objective>) =>
    setDraft((current) =>
      current.map((objective) => (objective.id === id ? { ...objective, ...patch } : objective))
    );

  const removeObjective = (id: string) =>
    setDraft((current) => current.filter((objective) => objective.id !== id));

  const distribute = () =>
    setDraft((current) => {
      const weights = distributeWeights(current.length, budgetFor(current.length));
      return current.map((objective, index) => ({ ...objective, weight: weights[index] }));
    });

  /*
   * La tanda que el Agente IA acaba de proponer y que todavía no se conserva.
   *
   * Lo que ya estaba escrito no se esconde mientras se conversa: esconderlo
   * dejaba la lista vacía y un estado vacío mintiendo sobre una tanda que sí
   * tenía objetivos. Lo nuevo se distingue por el borde degradado del
   * Agente, y deja de llevarlo en cuanto el chat decide.
   */
  const [aiDraftIds, setAiDraftIds] = React.useState<ReadonlySet<string>>(() => new Set());

  React.useEffect(() => {
    if (!isComposerOpen) setAiDraftIds(new Set());
  }, [isComposerOpen]);

  const firstIssue = draft.find((objective) =>
    objectiveIssue(objective, { requireWeight: true, requireAlignment: false })
  );

  const save = () => {
    if (draft.length === 0) return;
    if (firstIssue) {
      setShowValidation(true);
      setExpandedId(firstIssue.id);
      return;
    }
    onSave(draft);
    onOpenChange(false);
  };

  /** Guarda sola la tanda si con lo que acaba de llegar —banco, o "Conservar"
   *  de la IA— ya no falta nada. Si sigue faltando algo, no hace nada y la
   *  tanda se queda en pantalla igual que antes. */
  const finishIfComplete = (list: readonly Objective[]): boolean => {
    if (list.length === 0) return false;
    const isIncomplete = list.some((objective) =>
      objectiveIssue(objective, { requireWeight: true, requireAlignment: false })
    );
    if (isIncomplete) return false;
    onSave(list);
    onOpenChange(false);
    return true;
  };

  /** "Conservar todos" del panel de IA. Los objetivos ya están en `draft`
   *  desde que se generaron; aquí solo se decide si con ellos la tanda ya
   *  queda lista para guardarse sola o si el panel simplemente se cierra. */
  const keepAiDraft = () => {
    setIsComposerOpen(false);
    finishIfComplete(draft);
  };

  const headline = single
    ? single.collaborator.name
    : `${rows.length} colaboradores`;

  const footerHint = isBlocked
    ? fullyLoaded.length === 1
      ? `${fullyLoaded[0].collaborator.name} ya reparte su ${TOTAL_WEIGHT} % · ajusta sus pesos antes de crear`
      : `${fullyLoaded.length} de los marcados ya reparten su ${TOTAL_WEIGHT} % · ajusta sus pesos antes de crear`
    : isBankOpen
    ? bank.selectedCount === 0
      ? "Marca en el banco los objetivos que quieras traer"
      : `${bank.selectedCount} ${
          bank.selectedCount === 1 ? "objetivo" : "objetivos"
        } del banco · se añadirán a esta tanda`
    : draft.length === 0
      ? "Añade al menos un objetivo para guardar"
      : share !== budget
        ? `Los pesos suman ${share} % de ${budget} %`
        : crowded.length > 0
          ? `${draft.length} ${
              draft.length === 1 ? "objetivo" : "objetivos"
            } · toman ${share} % y se reajusta lo que ya había`
          : `${draft.length} ${
              draft.length === 1 ? "objetivo" : "objetivos"
            } · toman ${share} % del ${TOTAL_WEIGHT} % de cada uno`;

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title={single ? "Crear objetivos para un colaborador" : "Crear objetivos para varios colaboradores"}
      size="5xl"
      // El mismo ancho que el drawer de asignaciones del constructor, porque
      // lleva la misma tarjeta: "Tipo de medida" y "Dirección" comparten fila
      // y por debajo de ~1000 px las opciones se aprietan hasta recortar sus
      // nombres.
      //
      // Con el Agente IA abierto sigue siendo el mismo cajón —misma altura,
      // mismo borde, mismo sitio— corrido a la izquierda para hacerle hueco
      // al panel. Convertirlo en tarjeta flotante lo hacía leer como otro
      // drawer distinto, abierto solo para escribir objetivos.
      className={cn(
        "!w-[min(1280px,96vw)] !top-0 !bottom-0 !h-dvh !rounded-none sm:!rounded-l-2xl !border-y-0",
        isComposerOpen ? "!border-r !border-border/60" : "!border-r-0"
      )}
      // Cuánto se corre y con qué curva, en línea y compartido con el panel:
      // ver `agentPanelMotion`.
      contentStyle={agentShift.content}
      overlayStyle={agentShift.overlay}
      /*
       * Nunca modal: el panel del Agente IA vive en la concha de la app, fuera
       * del portal, y un diálogo modal apaga los eventos de puntero de todo lo
       * que no sea él —el chat quedaría dibujado pero muerto—. Tampoco se
       * enciende y apaga sobre la marcha: Radix monta un componente distinto
       * por modalidad, así que cambiarla reconstruye el cajón y lo hace entrar
       * de nuevo desde la derecha. El velo no se va con la modalidad: se
       * recorta justo donde empieza el panel, así que lo de atrás sigue tapado
       * y solo se puede tocar aquello con lo que el drawer está conversando.
       */
      modal={false}
      onInteractOutside={(event) => {
        // El panel del Agente IA es hermano del drawer, no hijo: un clic ahí
        // cuenta como "fuera" y cerraría lo que se está armando.
        if (isComposerOpen) event.preventDefault();
      }}
      disablePadding
      footer={
        <DrawerActionRail
          hint={footerHint}
          // Mientras la propuesta se arma no hay nada seguro que hacer desde
          // aquí: los botones del propio chat son los que mandan.
          isBlocked={isComposerOpen && workingState !== null}
          keepOpen={
            isBlocked || draft.length === 0 || isAddMenuOpen || isBankOpen || crowded.length > 0
          }
          tools={
            // Sin hueco no hay nada que añadir, y con el banco a la vista la
            // barra solo tiene que rematarlo: volver a ofrecer "añadir
            // objetivo" sería ofrecer salir de donde ya se está eligiendo.
            isBlocked || isBankOpen ? null : (
            <>
              <AddObjectiveMenu
                open={isAddMenuOpen}
                onOpenChange={setIsAddMenuOpen}
                isEmpty={draft.length === 0}
                onAddBlank={addBlank}
                onOpenBank={() => setIsBankOpen(true)}
                onOpenComposer={() => setIsComposerOpen(true)}
              />
              {draft.length > 1 && (
                <DrawerRailButton
                  icon={Scale}
                  label="Ajustar pesos"
                  onClick={() => setIsBalanceOpen(true)}
                />
              )}
            </>
            )
          }
          actions={
            isBlocked ? (
              <>
                <DrawerRailButton icon={X} label="Cerrar" onClick={() => onOpenChange(false)} />
                {onAdjustWeights && fullyLoaded.length === 1 && (
                  <DrawerRailButton
                    icon={Scale}
                    variant="primary"
                    label="Ajustar pesos"
                    onClick={() => onAdjustWeights(fullyLoaded[0].person.id)}
                  />
                )}
              </>
            ) : isBankOpen ? (
              <>
                <DrawerRailButton
                  icon={ArrowLeft}
                  label="Volver"
                  onClick={() => setIsBankOpen(false)}
                />
                <DrawerRailButton
                  icon={Check}
                  variant="primary"
                  label={`Agregar (${bank.selectedCount})`}
                  disabled={bank.selectedCount === 0}
                  onClick={addFromBank}
                />
              </>
            ) : (
            <>
              <DrawerRailButton icon={X} label="Cancelar" onClick={() => onOpenChange(false)} />
              <DrawerRailButton
                icon={Check}
                variant="primary"
                label={
                  draft.length > 1
                    ? `Guardar ${draft.length} objetivos`
                    : "Guardar objetivo"
                }
                disabled={draft.length === 0}
                onClick={save}
              />
            </>
            )
          }
        />
      }
    >
      <div className="flex flex-col gap-3 bg-background p-4">
        <TargetsStrip rows={rows} headline={headline} />

        {isBlocked ? (
          <FullyLoadedNotice
            rows={fullyLoaded}
            onAdjustWeights={onAdjustWeights}
          />
        ) : isBankOpen ? (
          <>
            <ObjectiveBankStepHeader
              onBack={() => setIsBankOpen(false)}
              kindLabel="individuales"
              targetName={headline}
              selectedCount={bank.selectedCount}
            />
            <ObjectiveBankPanel bank={bank} />
          </>
        ) : (
          <>

        {/* El peso solo significa algo como parte de un todo, y aquí el todo
            no es la tanda: es el ciclo de cada colaborador. Por eso la barra
            mide contra lo que esta tanda puede repartir —el hueco libre, o la
            parte que le toca en igualdad de condiciones— y no contra 100. */}
        {!isComposerOpen && draft.length > 0 && (
          <TandaWeightSummary
            total={share}
            budget={budget}
            count={draft.length}
            onDistribute={distribute}
          />
        )}

        {/* Un objetivo nuevo no cabe sin quitarle sitio a los que ya había, y
            eso no puede pasar en silencio: se dice antes de guardar y se
            aplica al guardar. */}
        {!isComposerOpen && crowded.length > 0 && (
          <div className="rounded-xl border border-status-warning/30 bg-status-warning/5 px-3.5 py-3">
            <p className="text-[12.5px] leading-relaxed text-text-secondary">
              {crowded.length === 1
                ? `${crowded[0].collaborator.name} ya reparte su ${TOTAL_WEIGHT} %.`
                : `${crowded.length} de los colaboradores marcados ya reparten su ${TOTAL_WEIGHT} %.`}{" "}
              Al guardar, el peso de sus objetivos actuales se ajusta en proporción para
              hacerle sitio al <strong className="text-text-primary">{share} %</strong> de los
              nuevos. El avance que ya reportaron no cambia.
            </p>
          </div>
        )}

        {/* Antes de la lista y no después: la tanda que la IA deja puesta cae
            debajo, y el panel debe quedar fijo mientras se decide qué hacer
            con ella. */}
        <AiAgentDrawer
          open={isComposerOpen}
          onOpenChange={(next) => {
            if (!next) setIsComposerOpen(false);
          }}
          context="objectives"
          objectiveCallbacks={{
            mode: "set",
            onConfirm: (incoming) => addWritten(incoming, { expand: false, fromAi: true }),
            onKeep: keepAiDraft,
            onRemoveObjectives: removeMany,
            maxCount: Math.max(1, MAX_AI_OBJECTIVES - draft.length),
            scopeLabel: single ? `de ${single.collaborator.name}` : "de los colaboradores",
            scope: "colaborador",
            audienceLabel: single ? single.collaborator.name : "los colaboradores",
            companyObjectives,
            onWorkingStateChange: (isWorking, progress, caption, detail) => {
              setWorkingState(isWorking ? { progress, caption, detail } : null);
            },
          }}
        />

        {workingState !== null && (
          <AiAnalyzingState
            title="Analizando"
            progress={workingState.progress}
            caption={workingState.caption}
            detail={workingState.detail}
          />
        )}

        {draft.length === 0 && isComposerOpen ? (
          // Mientras la IA está trabajando, el loader de arriba es el único
          // que habla: este estado vacío y ese loader cuentan la misma
          // historia ("todavía no hay nada") y mostrarlos juntos es ruido.
          workingState === null && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-surface-muted/30 px-6 py-16 text-center">
              <div className="relative flex size-14 items-center justify-center rounded-2xl bg-surface shadow-sm">
                <Sparkles className="size-6 text-primary" strokeWidth={2.2} />
                <div className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-surface shadow-sm">
                  <Target className="size-3 text-text-secondary" strokeWidth={2.5} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-[14px] font-semibold text-text-primary">
                  Creando objetivos con IA
                </p>
                <p className="max-w-[46ch] text-[12.5px] leading-relaxed text-text-secondary">
                  Dile al Agente IA qué necesita medir {single ? single.collaborator.name : "esta gente"}.
                  Los objetivos que proponga aparecerán aquí para que los revises.
                </p>
              </div>
            </div>
          )
        ) : draft.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-surface-muted/30 px-6 py-12 text-center">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-surface text-text-secondary">
              <Target className="size-5" strokeWidth={2} />
            </span>
            <p className="text-[13.5px] font-semibold text-text-primary">
              Todavía no hay objetivos en esta tanda
            </p>
            <p className="max-w-[46ch] text-[12.5px] leading-relaxed text-text-secondary">
              Empieza por el resultado que quieres pedirle a {single ? "esta persona" : "esta gente"}.
              Te vamos guiando campo por campo.
            </p>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2.5">
              <EmptyAction icon={Plus} label="Crear manualmente" onClick={addBlank} />
              <EmptyAction icon={Library} label="Elegir del banco" onClick={() => setIsBankOpen(true)} />
              <EmptyAction
                icon={Sparkles}
                label="Proponer con IA"
                onClick={() => setIsComposerOpen(true)}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {draft.map((objective, index) => (
                <ObjectiveCardCompact
                  key={objective.id}
                  objective={objective}
                  position={index + 1}
                  variant="assigned"
                  scope="individual"
                  isExpanded={expandedId === objective.id}
                  onToggleExpanded={() =>
                    setExpandedId((current) => (current === objective.id ? null : objective.id))
                  }
                  onChange={(patch) => changeObjective(objective.id, patch)}
                  onRemove={() => removeObjective(objective.id)}
                  canRemove
                  showValidation={showValidation}
                  otherObjectivesWeight={share - objective.weight}
                  weightBudget={budget}
                  companyObjectives={companyObjectives}
                  cycleObjectives={draft.filter((other) => other.id !== objective.id)}
                  isAiDraft={aiDraftIds.has(objective.id)}
                />
            ))}
          </div>
        )}

          </>
        )}

        {/* Cuadrar la tanda sin abrir tarjeta por tarjeta. Reparte el hueco
            libre, que es lo único que esta tanda puede tocar sin pisar lo que
            los colaboradores ya llevaban. */}
        <WeightBalanceDialog
          open={isBalanceOpen}
          onOpenChange={setIsBalanceOpen}
          groups={[{ setId: "tanda", label: headline, budget, objectives: draft }]}
          title="Ajustar los pesos de esta tanda"
          description={`Reparte el ${budget} % entre los objetivos nuevos sin entrar uno por uno.`}
          onApply={(result) => {
            const weights = result["tanda"];
            if (!weights) return;
            setDraft((current) =>
              current.map((objective) =>
                objective.id in weights ? { ...objective, weight: weights[objective.id] } : objective
              )
            );
          }}
        />
      </div>
    </DrawerShell>
  );
}

/**
 * Cuando no queda ni un punto libre.
 *
 * Alguien de los marcados ya reparte su ciclo entero, así que un objetivo
 * nuevo no cabe sin quitarle peso a los que ya tiene. Esa es una decisión
 * sobre el conjunto —cuánto vale cada objetivo de esa persona— y se toma en
 * el mismo sitio donde se toma siempre: el reparto de pesos de resultados.
 * Por eso este paso no ofrece escribir, ofrece ir allá.
 */
function FullyLoadedNotice({
  rows,
  onAdjustWeights,
}: {
  rows: readonly PersonResultRow[];
  onAdjustWeights?: (personId: string) => void;
}) {
  const single = rows.length === 1 ? rows[0] : null;

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-status-warning/30 bg-status-warning/5 px-6 py-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-2xl bg-surface text-status-warning">
        <Scale className="size-5" strokeWidth={2} />
      </span>
      <p className="text-[13.5px] font-semibold text-text-primary">
        {single
          ? `${single.collaborator.name} ya reparte su ${TOTAL_WEIGHT} %`
          : `${rows.length} de los colaboradores marcados ya reparten su ${TOTAL_WEIGHT} %`}
      </p>
      <p className="max-w-[52ch] text-[12.5px] leading-relaxed text-text-secondary">
        Un objetivo nuevo tendría que salir del peso de los que ya
        {single ? " tiene" : " tienen"}, y eso se decide sobre el conjunto.
        Ajusta primero el reparto y vuelve a crear con el hueco que dejes.
      </p>
      {onAdjustWeights && (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2.5">
          {rows.slice(0, 4).map((row) => (
            <button
              key={row.person.id}
              type="button"
              onClick={() => onAdjustWeights(row.person.id)}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-[13px] font-semibold text-text-secondary transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <Scale className="size-4" strokeWidth={2.4} />
              {single ? "Ajustar sus pesos" : `Pesos de ${row.collaborator.name}`}
            </button>
          ))}
          {rows.length > 4 && (
            <span className="text-[12px] text-text-muted">
              y {rows.length - 4} más
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Lo que esta tanda reparte, contra lo que puede repartir.
 *
 * No es el resumen de peso del constructor y no puede serlo: allá el todo es
 * el 100 % de la asignación, y aquí la tanda es solo una parte del ciclo de
 * cada colaborador —el hueco que le quedaba libre, o la porción que le toca
 * cuando ya no quedaba ninguno—. Medir contra 100 diría "te falta" sobre una
 * tanda que ya está completa.
 */
function TandaWeightSummary({
  total,
  budget,
  count,
  onDistribute,
}: {
  total: number;
  budget: number;
  count: number;
  onDistribute: () => void;
}) {
  const isExact = total === budget;
  const isOver = total > budget;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-3",
        isExact
          ? "border-status-positive/25 bg-status-positive/5"
          : isOver
            ? "border-destructive/30 bg-destructive/5"
            : "border-border/60 bg-surface-muted/40"
      )}
    >
      <span className="flex items-center gap-2 text-[13px] font-semibold text-text-primary">
        <Scale className="size-4 text-text-secondary" strokeWidth={2} />
        Peso de la tanda
      </span>

      <span className="relative h-2 min-w-[120px] flex-1 overflow-hidden rounded-full bg-border/60">
        <span
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
            isExact ? "bg-status-positive" : isOver ? "bg-destructive" : "bg-primary"
          )}
          style={{ width: `${budget === 0 ? 0 : Math.min(100, (total / budget) * 100)}%` }}
        />
      </span>

      <span
        className={cn(
          "text-[13px] font-bold tabular-nums",
          isExact ? "text-status-positive" : isOver ? "text-destructive" : "text-text-primary"
        )}
      >
        {total} / {budget} %
      </span>

      {!isExact && count > 0 && (
        <button
          type="button"
          onClick={onDistribute}
          className="flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-[12px] font-semibold text-text-secondary transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-95"
        >
          <Sparkles className="size-3.5" strokeWidth={2.2} />
          Repartir en partes iguales
        </button>
      )}
    </div>
  );
}

/**
 * A quiénes les va a caer esta tanda.
 *
 * Con una persona es su ficha; con varias, sus caras y cuántas son. Es lo
 * primero del cuerpo porque cada campo de la tarjeta de abajo se contesta
 * distinto según a quién se le esté pidiendo.
 */
function TargetsStrip({
  rows,
  headline,
}: {
  rows: readonly PersonResultRow[];
  headline: string;
}) {
  const single = rows.length === 1 ? rows[0] : null;

  if (single) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface-muted/40 px-3.5 py-3">
        <InitialsAvatar name={single.collaborator.name} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-text-primary">
            {single.collaborator.name}
          </p>
          <p className="truncate text-[12px] text-text-secondary">
            {single.area} · {single.leader} ·{" "}
            {single.entries.length === 0
              ? "sin objetivos todavía"
              : `${single.entries.length} ${
                  single.entries.length === 1 ? "objetivo" : "objetivos"
                } en el ciclo`}
          </p>
        </div>
      </div>
    );
  }

  // Ocho caras y el resto en número: una fila de avatares deja de decir
  // "quiénes" mucho antes de que se acaben los marcados.
  const shown = rows.slice(0, 8);
  const rest = rows.length - shown.length;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-surface-muted/40 px-3.5 py-3">
      <div className="flex items-center -space-x-2">
        {shown.map((row) => (
          <span key={row.person.id} className="rounded-full ring-2 ring-surface-muted" title={row.collaborator.name}>
            <InitialsAvatar name={row.collaborator.name} size="sm" />
          </span>
        ))}
        {rest > 0 && (
          <span className="flex size-6 items-center justify-center rounded-full bg-surface text-[10px] font-bold tabular-nums text-text-secondary ring-2 ring-surface-muted">
            +{rest}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-text-primary">{headline}</p>
        <p className="truncate text-[12px] text-text-secondary">
          Todos reciben los mismos objetivos, cada uno con su propia copia.
        </p>
      </div>
    </div>
  );
}

function EmptyAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Plus;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-[13px] font-semibold text-text-secondary transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <Icon className="size-4" strokeWidth={2.4} />
      {label}
    </button>
  );
}

/**
 * Las tres formas de traer un objetivo, bajo el "+" de la barra del drawer.
 *
 * Es el mismo menú del drawer de asignaciones del constructor: quien ya lo
 * usó allá lo reconoce aquí, y las tres puertas se llaman igual en los dos
 * sitios.
 */
function AddObjectiveMenu({
  open,
  onOpenChange,
  isEmpty,
  onAddBlank,
  onOpenBank,
  onOpenComposer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEmpty: boolean;
  onAddBlank: () => void;
  onOpenBank: () => void;
  onOpenComposer: () => void;
}) {
  const choose = (action: () => void) => () => {
    onOpenChange(false);
    action();
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {/* El disparador envuelve al botón de la barra para que el rótulo y el
            estado sigan siendo los del propio rail. */}
        <div>
          <DrawerRailButton
            icon={Plus}
            label={isEmpty ? "Crear un objetivo" : "Añadir objetivo"}
            onClick={() => {}}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={16}
        avoidCollisions={false}
        className="w-[280px] rounded-2xl border-white/10 bg-surface-nav p-2 text-white/60 shadow-rail"
      >
        <div className="flex flex-col gap-0.5">
          <svg width="0" height="0" className="absolute">
            <defs>
              <linearGradient id="ai-icon-gradient-person-add" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--ai-gradient-start))" />
                <stop offset="100%" stopColor="hsl(var(--ai-gradient-end))" />
              </linearGradient>
            </defs>
          </svg>

          <button
            type="button"
            onClick={choose(onOpenComposer)}
            className="hover-icon-pop group flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-white/5"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 transition-colors group-hover:bg-white/10">
              <Sparkles
                className="h-5 w-5"
                strokeWidth={2.5}
                stroke="url(#ai-icon-gradient-person-add)"
              />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[14px] font-bold tracking-tight text-ai-gradient">
                Proponer con IA
              </span>
              <span className="text-[11px] font-medium text-white/45">
                Conversa y genera una propuesta base.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={choose(onOpenBank)}
            className="hover-icon-pop group flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-white/5"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/60 transition-colors group-hover:bg-white/10 group-hover:text-white">
              <Library className="h-5 w-5" strokeWidth={2} />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[14px] font-bold tracking-tight text-white">
                Elegir del banco
              </span>
              <span className="text-[11px] font-medium text-white/45">
                Objetivos ya escritos por área y tema.
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={choose(onAddBlank)}
            className="hover-icon-pop group flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-white/5"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/60 transition-colors group-hover:bg-white/10 group-hover:text-white">
              <Plus className="h-5 w-5" strokeWidth={2} />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[14px] font-bold tracking-tight text-white">
                Crear manualmente
              </span>
              <span className="text-[11px] font-medium text-white/45">
                Redacta un objetivo desde cero.
              </span>
            </span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
