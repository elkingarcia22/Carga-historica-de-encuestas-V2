import { GruposTab } from "@/components/ciclo-results/GruposTab";
import * as React from "react";
import { toast } from "sonner";
import { BarChart3, ListTree, Sparkles, Trophy, Users } from "lucide-react";
import { ShellRailSlot } from "@/components/app-shell";
import { CURRENT_USER } from "@/components/app-shell/appShellData";
import { UbitsTabs, type TabItem } from "@/components/navigation";
import { useObjetivosConfig } from "@/components/objetivos/objetivosConfigStore";
import {
  CicloDownloadDrawer,
  CicloDownloadsWidget,
  buildCicloDetail,
  buildGroupRows,
  buildPersonRows,
  objectiveCompliance,
  summarize,
  useCicloDownloadCenter,
  type CicloListRow,
  type CicloReportSource,
  type EvidenceFile,
  type ObjectiveReview,
  type ObjectiveUpdate,
} from "@/components/ciclo-detail";
import {
  TOTAL_WEIGHT,
  WeightBalanceDialog,
  createObjectiveId,
  rescaleObjectives,
  totalWeight,
  type Objective,
} from "@/components/ciclo-builder";
import { alignObjectives as alignInSets } from "@/components/ciclo-builder/objectiveSets";
import type {
  AlignmentLevel,
  NodePositions,
  ObjectiveRef,
} from "@/components/ciclo-alignment";
import {
  AiMetricChatPanel,
  AlineacionTab,
  AnalisisIaTab,
  CicloResultsActionRail,
  ColaboradoresTab,
  ColaboradoresViewSwitch,
  CreatePersonObjectivesDrawer,
  CumplimientoTab,
  EditPersonObjectivesDrawer,
  PendingDrawer,
  PersonImpactSheet,
  RankingTab,
  ResultsFilterChips,
  ResultsGlobalFilters,
  ResumenTab,
  buildCicloResults,
  filterResults,
  narrowResults,
  upsertCustomMetric,
  useResultsFilters,
  type CustomMetric,
  type MetricWorkingState,
  type ColaboradoresView,
  type CreateObjectivesIntent,
  type CumplimientoView,
  type PendingKind,
  type BreakdownKey,
  type ThreadPost,
  type ObjectivePatch,
  type ProgressInput,
  DEFAULT_BREAKDOWN,
} from "@/components/ciclo-results";

/**
 * Los resultados de un ciclo.
 *
 * Pantalla aparte del seguimiento a propósito. Seguimiento responde "¿quién
 * falta por reportar?" y por eso es editable, con su drawer de actualización;
 * resultados responde "¿cómo nos fue?" y por eso es de lectura, agregados y
 * exportable. Meterlas en una sola pantalla obliga a que cada control diga en
 * cuál de los dos modos está, que es exactamente el problema que tiene hoy el
 * reporte de la plataforma.
 *
 * Cinco pestañas sobre un mismo agregado, con filtros que viven arriba de
 * todas: pasar de "Comercial en el resumen" a "Comercial en el árbol" es un
 * solo pensamiento, y volver a elegir el área en cada pestaña lo rompería.
 */

type ResultsTab = "resumen" | "cumplimiento" | "colaboradores" | "ranking" | "ia";

const TABS: readonly TabItem[] = [
  { id: "resumen", label: "Resumen", icon: <BarChart3 className="h-4 w-4" /> },
  { id: "cumplimiento", label: "Cumplimiento", icon: <ListTree className="h-4 w-4" /> },
  { id: "colaboradores", label: "Colaboradores", icon: <Users className="h-4 w-4" /> },
  { id: "ranking", label: "Ranking", icon: <Trophy className="h-4 w-4" /> },
  { id: "ia", label: "Análisis con IA", icon: <Sparkles className="h-4 w-4 text-ai-gradient" /> },
];

export function CicloResults({
  ciclo,
  onEditObjectives,
  onEditParticipants,
}: {
  ciclo: CicloListRow;
  /** Abre el constructor del ciclo en el paso de objetivos, para corregir o
   *  agregar objetivos de un colaborador. Sin ella el botón global "Editar"
   *  de la ficha de resultados no aparece. `target` elige sobre qué se va a
   *  trabajar: los grupos o una persona. No recibe el ciclo —quien la pasa ya
   *  sabe cuál está abierto. */
  onEditObjectives?: (target?: "groups" | "individual") => void;
  /** Abre el constructor en el paso de participantes, la misma acción que la
   *  lista de ciclos ofrece sobre una fila. */
  onEditParticipants?: () => void;
}) {
  // Estado, no memo: inactivar un objetivo edita esta copia in-memoria. La
  // pantalla monta de cero con `key={ciclo.id}` en el dashboard, así que el
  // inicializador perezoso no necesita resincronizarse si `ciclo` cambia.
  const [data, setData] = React.useState(() => buildCicloDetail(ciclo));
  const config = useObjetivosConfig();

  /**
   * Inactiva o reactiva objetivos puntuales de una persona, uno o varios en
   * la misma pasada: la ficha los manda en lote desde su barra flotante y de
   * a uno desde la fila, y las dos rutas escriben aquí.
   */
  const setObjectivesInactivation = React.useCallback(
    (personId: string, objectiveIds: readonly string[], inactive: boolean) => {
      const ids = new Set(objectiveIds);
      setData((current) => ({
        ...current,
        people: current.people.map((person) => {
          if (person.id !== personId) return person;
          return {
            ...person,
            objectives: person.objectives.map((tracked) => {
              if (!ids.has(tracked.objective.id)) return tracked;
              if (!inactive) return tracked.inactivation ? { ...tracked, inactivation: null } : tracked;
              if (tracked.inactivation) return tracked;
              return {
                ...tracked,
                inactivation: {
                  date: new Date().toISOString(),
                  authorName: CURRENT_USER.name,
                  percentAtInactivation: objectiveCompliance(tracked, config.allowNegativeResults),
                },
              };
            }),
          };
        }),
      }));
    },
    [config.allowNegativeResults]
  );

  /**
   * Conecta (o suelta) objetivos con un objetivo de empresa, desde el mapa.
   *
   * Llega en lote porque una tarjeta del mapa puede hablar por varios a la vez
   * —un área entera, una persona con metas de dos frentes—, igual que en el
   * constructor. Y se escribe en dos sitios: en la asignación, que es donde
   * vive la decisión, y en la copia que cada persona lleva de ese objetivo,
   * que es de donde el reporte lee. Escribir solo una dejaría el mapa diciendo
   * una cosa y el árbol de cumplimiento otra.
   */
  const alignObjectives = React.useCallback(
    (refs: readonly ObjectiveRef[], companyObjectiveId: string | null) => {
      if (refs.length === 0) return;

      const wanted = new Map<string, Set<string>>();
      refs.forEach(({ setId, objectiveId }) => {
        const current = wanted.get(setId) ?? new Set<string>();
        current.add(objectiveId);
        wanted.set(setId, current);
      });

      setData((current) => ({
        ...current,
        sets: alignInSets(current.sets, refs, companyObjectiveId),
        people: current.people.map((person) => {
          const ids = wanted.get(person.setId);
          if (!ids) return person;
          return {
            ...person,
            objectives: person.objectives.map((tracked) =>
              ids.has(tracked.objective.id)
                ? {
                    ...tracked,
                    objective: { ...tracked.objective, alignedTo: companyObjectiveId },
                  }
                : tracked
            ),
          };
        }),
      }));

      const count = refs.length;
      const subject = `${count} ${count === 1 ? "objetivo" : "objetivos"}`;
      if (companyObjectiveId === null) {
        toast.success(`${subject} sin alineación`);
        return;
      }
      const target = data.companyObjectives.find(
        (objective) => objective.id === companyObjectiveId
      );
      toast.success(`${subject} ${count === 1 ? "alineado" : "alineados"}`, {
        description: `Ahora contribuye${count === 1 ? "" : "n"} a "${
          target?.title.trim() || "Objetivo sin título"
        }".`,
      });
    },
    [data.companyObjectives]
  );

  /**
   * Publica un mensaje en el hilo de un objetivo de alguien.
   *
   * El hilo es la conversación del objetivo, así que un mensaje escrito desde
   * aquí entra por la misma puerta que los del colaborador y su líder: como
   * una actualización más, con su autor y sus adjuntos. Los archivos se
   * guardan como metadatos —nombre, peso, tipo—: el binario no tiene por qué
   * vivir en el estado de una pantalla.
   */
  const postToThread = React.useCallback(
    (personId: string, objectiveId: string, post: ThreadPost) => {
      const stamp = Date.now();
      const evidences: EvidenceFile[] = post.files.map((file, index) => ({
        id: `evidence-${stamp}-${index}`,
        name: file.name,
        size: file.size,
        type: file.type,
      }));
      const update: ObjectiveUpdate = {
        id: `update-${stamp}`,
        authorId: "current-user",
        authorName: CURRENT_USER.name,
        authorRole: "admin",
        date: new Date(stamp).toISOString(),
        // Un mensaje escrito desde resultados nunca mueve el avance: el valor
        // lo reporta quien lleva el objetivo, desde su propia vista.
        value: null,
        comment: post.comment,
        evidences,
        replyTo: post.replyTo,
      };

      setData((current) => ({
        ...current,
        people: current.people.map((person) => {
          if (person.id !== personId) return person;
          return {
            ...person,
            objectives: person.objectives.map((tracked) =>
              tracked.objective.id === objectiveId
                ? { ...tracked, updates: [...tracked.updates, update] }
                : tracked
            ),
          };
        }),
      }));

      toast.success(
        post.replyTo === null ? "Mensaje publicado en el hilo" : "Respuesta enviada"
      );
    },
    []
  );

  /**
   * Reporta un avance de un objetivo puntual.
   *
   * Mueve el valor y deja constancia en el hilo en el mismo gesto: un número
   * que cambia sin decir quién lo cambió ni por qué es justo lo que esta
   * vista existe para evitar.
   */
  const updateObjectiveProgress = React.useCallback(
    (personId: string, objectiveId: string, input: ProgressInput) => {
      const stamp = Date.now();
      const update: ObjectiveUpdate = {
        id: `update-${stamp}`,
        authorId: "current-user",
        authorName: CURRENT_USER.name,
        authorRole: "admin",
        date: new Date(stamp).toISOString(),
        value: input.value,
        comment: input.comment,
        evidences: input.files.map((file, index) => ({
          id: `evidence-${stamp}-${index}`,
          name: file.name,
          size: file.size,
          type: file.type,
        })),
        replyTo: null,
      };

      setData((current) => ({
        ...current,
        people: current.people.map((person) => {
          if (person.id !== personId) return person;
          return {
            ...person,
            objectives: person.objectives.map((tracked) =>
              tracked.objective.id === objectiveId
                ? { ...tracked, currentValue: input.value, updates: [...tracked.updates, update] }
                : tracked
            ),
          };
        }),
      }));
    },
    []
  );

  /** Corrige cómo está escrito un objetivo. El avance no se toca desde aquí. */
  const editObjective = React.useCallback(
    (personId: string, objectiveId: string, patch: ObjectivePatch) => {
      setData((current) => ({
        ...current,
        people: current.people.map((person) => {
          if (person.id !== personId) return person;
          return {
            ...person,
            objectives: person.objectives.map((tracked) =>
              tracked.objective.id === objectiveId
                ? { ...tracked, objective: { ...tracked.objective, ...patch } }
                : tracked
            ),
          };
        }),
      }));
    },
    []
  );

  /**
   * Reescribe varios objetivos de una persona en una sola pasada.
   *
   * El drawer de edición devuelve los objetivos ya completos —la tarjeta del
   * constructor toca medida, recorrido, acciones clave y peso, no solo el
   * título—, así que aquí se reemplazan enteros en vez de fusionar un parche
   * campo por campo. El avance reportado no está en `Objective` y por eso no
   * se pierde: vive en `tracked`, que se conserva.
   */
  const replaceObjectives = React.useCallback(
    (personId: string, objectives: readonly Objective[]) => {
      const byId = new Map(objectives.map((objective) => [objective.id, objective]));
      setData((current) => ({
        ...current,
        people: current.people.map((person) => {
          if (person.id !== personId) return person;
          return {
            ...person,
            objectives: person.objectives.map((tracked) => {
              const next = byId.get(tracked.objective.id);
              return next ? { ...tracked, objective: next } : tracked;
            }),
          };
        }),
      }));
    },
    []
  );

  /**
   * Le pone objetivos nuevos a varios colaboradores en una sola pasada.
   *
   * La tanda se escribe una vez y cada persona recibe su copia: los ids se
   * rehacen por colaborador porque a partir de aquí cada objetivo lleva su
   * propio avance, su propio hilo y su propia revisión, y compartir id haría
   * que inactivar el de uno tocara el del otro.
   *
   * El 100 % es del colaborador, no de la tanda: a quien ya no le quepa lo
   * nuevo, se le reescala en proporción lo que ya traía para hacerle sitio.
   * El avance reportado no vive en `Objective` —está en `tracked`— así que
   * reescalar el peso no borra nada de lo que ya se midió.
   */
  const addObjectives = React.useCallback(
    (personIds: readonly string[], objectives: readonly Objective[]) => {
      if (objectives.length === 0 || personIds.length === 0) return;
      const ids = new Set(personIds);
      const share = totalWeight(objectives);

      setData((current) => ({
        ...current,
        people: current.people.map((person) => {
          if (!ids.has(person.id)) return person;

          const carried = person.objectives.map((tracked) => tracked.objective);
          const needsRoom = totalWeight(carried) + share > TOTAL_WEIGHT;
          const rescaled = needsRoom
            ? rescaleObjectives(carried, Math.max(0, TOTAL_WEIGHT - share))
            : carried;

          return {
            ...person,
            objectives: [
              ...person.objectives.map((tracked, index) =>
                needsRoom ? { ...tracked, objective: rescaled[index] } : tracked
              ),
              ...objectives.map((objective) => ({
                objective: {
                  ...objective,
                  id: `objective-${createObjectiveId()}`,
                  keyActions: objective.keyActions.map((action) => ({
                    ...action,
                    id: `action-${createObjectiveId()}`,
                  })),
                },
                currentValue: "",
                updates: [],
              })),
            ],
          };
        }),
      }));
    },
    []
  );

  /** Saca colaboradores enteros del ciclo, con todo lo que cargaban. */
  const removePeople = React.useCallback((personIds: readonly string[]) => {
    const ids = new Set(personIds);
    setData((current) => ({
      ...current,
      people: current.people.filter((person) => !ids.has(person.id)),
    }));
  }, []);

  /** Saca objetivos del ciclo de una persona, con todo lo que colgaba de ellos. */
  const deleteObjectives = React.useCallback(
    (personId: string, objectiveIds: readonly string[]) => {
      const ids = new Set(objectiveIds);
      setData((current) => ({
        ...current,
        people: current.people.map((person) =>
          person.id === personId
            ? {
                ...person,
                objectives: person.objectives.filter(
                  (tracked) => !ids.has(tracked.objective.id)
                ),
              }
            : person
        ),
      }));
    },
    []
  );

  /** Escribe la revisión del líder sobre uno o varios objetivos puntuales. */
  const writeReview = React.useCallback(
    (personId: string, objectiveIds: readonly string[], review: ObjectiveReview) => {
      const ids = new Set(objectiveIds);
      setData((current) => ({
        ...current,
        people: current.people.map((person) => {
          if (person.id !== personId) return person;
          return {
            ...person,
            objectives: person.objectives.map((tracked) =>
              ids.has(tracked.objective.id) ? { ...tracked, review } : tracked
            ),
          };
        }),
      }));
    },
    []
  );

  /** Aprueba o deniega objetivos "Por aprobar", uno o varios a la vez. Denegar
   *  pide un motivo; aprobar no lo necesita, así que llega vacío. */
  const reviewObjectives = React.useCallback(
    (personId: string, objectiveIds: readonly string[], status: "aprobado" | "ajustes", comment: string) => {
      writeReview(personId, objectiveIds, {
        status,
        reviewerName: CURRENT_USER.name,
        date: new Date().toISOString(),
        comment,
      });
    },
    [writeReview]
  );

  /** Reenvía objetivos "Por ajustar" a "Por aprobar", sin tocar su texto. */
  const resubmitObjectives = React.useCallback(
    (personId: string, objectiveIds: readonly string[]) => {
      writeReview(personId, objectiveIds, {
        status: "pendiente",
        reviewerName: CURRENT_USER.name,
        date: new Date().toISOString(),
        comment: "",
      });
    },
    [writeReview]
  );

  /** El botón "Ajustar": corrige el objetivo y lo reenvía en el mismo gesto. */
  const adjustObjective = React.useCallback(
    (personId: string, objectiveId: string, patch: ObjectivePatch) => {
      setData((current) => ({
        ...current,
        people: current.people.map((person) => {
          if (person.id !== personId) return person;
          return {
            ...person,
            objectives: person.objectives.map((tracked) =>
              tracked.objective.id === objectiveId
                ? {
                    ...tracked,
                    objective: { ...tracked.objective, ...patch },
                    review: {
                      status: "pendiente",
                      reviewerName: CURRENT_USER.name,
                      date: new Date().toISOString(),
                      comment: "",
                    },
                  }
                : tracked
            ),
          };
        }),
      }));
    },
    []
  );

  const resultsConfig = React.useMemo(
    () => ({
      estados: config.estados,
      niveles: config.niveles,
      estadosParticipante: config.estadosParticipante,
      allowNegative: config.allowNegativeResults,
    }),
    [config]
  );

  const results = React.useMemo(
    () => buildCicloResults(data, resultsConfig),
    [data, resultsConfig]
  );

  const [tab, setTab] = React.useState<ResultsTab>("resumen");
  const [view, setView] = React.useState<CumplimientoView>("arbol");
  /*
   * Las dos lecturas de "Colaboradores": el padrón y la alineación. El nivel
   * del mapa y lo que el lector haya movido a mano viven aquí arriba porque
   * el mapa se desmonta al volver a la tabla, y reencuadrarlo cada vez
   * borraría el plano que acababa de armar.
   */
  const [colaboradoresView, setColaboradoresView] =
    React.useState<ColaboradoresView>("persona");
  const [alignmentLevel, setAlignmentLevel] = React.useState<AlignmentLevel>("objetivos");
  const [alignmentPositions, setAlignmentPositions] = React.useState<NodePositions>({});
  // El "Ver por" de la barra: con qué se agrupan el ranking y el cuadro. Es
  // uno solo para toda la pantalla — cambiar de pestaña no debería obligar a
  // volver a elegir el mismo corte.
  const [breakdown, setBreakdown] = React.useState<BreakdownKey>(DEFAULT_BREAKDOWN);
  const [selectedIds, setSelectedIds] = React.useState<ReadonlySet<string>>(() => new Set());
  const [openPersonId, setOpenPersonId] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<PendingKind | null>(null);
  /*
   * Los dos gestos que la barra abre sobre un colaborador marcado y que no
   * caben en un popover: corregir sus objetivos con la tarjeta del
   * constructor, y repartir su 100 %. Guardan el id de la persona —no la
   * fila— para que sigan apuntando a la misma aunque el reporte se recalcule
   * debajo mientras el overlay está abierto.
   */
  const [editObjectivesOf, setEditObjectivesOf] = React.useState<string | null>(null);
  const [editWeightsOf, setEditWeightsOf] = React.useState<string | null>(null);
  /**
   * La vía con la que se abrió "Crear objetivos" sobre la selección, o null
   * cuando el drawer está cerrado. Es el estado de apertura y la decisión a la
   * vez: el drawer arranca haciendo lo que dice, en vez de preguntarlo otra
   * vez nada más abrir.
   */
  const [createObjectivesIntent, setCreateObjectivesIntent] =
    React.useState<CreateObjectivesIntent | null>(null);

  const filters = useResultsFilters();
  const filtered = React.useMemo(() => filterResults(results, filters.filters), [results, filters.filters]);

  /*
   * El resumen se lee sobre lo que dejaron los filtros; la barra de filtros y
   * la barra flotante, sobre el ciclo completo. Es a propósito: si las
   * opciones del popover salieran de lo ya filtrado, marcar "Colombia" borraría
   * los otros cinco países de la lista y no habría forma de cambiar de idea.
   */
  const viewResults = React.useMemo(
    () => narrowResults(results, filtered, filters.filters, resultsConfig),
    [results, filtered, filters.filters, resultsConfig]
  );

  const openPerson = React.useMemo(
    () => results.rows.find((row) => row.person.id === openPersonId) ?? null,
    [results.rows, openPersonId]
  );

  const rowById = React.useCallback(
    (personId: string | null) =>
      personId === null
        ? null
        : results.rows.find((row) => row.person.id === personId) ?? null,
    [results.rows]
  );

  const editObjectivesRow = rowById(editObjectivesOf);
  const editWeightsRow = rowById(editWeightsOf);

  /*
   * La barra actúa sobre filas, no sobre ids: necesita el nombre para
   * nombrarlos en la confirmación y sus objetivos para saber si queda algo
   * que inactivar. Sale de `results.rows` —el ciclo completo— y no de lo ya
   * filtrado, para que una marca puesta antes de mover un filtro no se caiga
   * a la mitad de la frase.
   */
  const selectedRows = React.useMemo(
    () => results.rows.filter((row) => selectedIds.has(row.person.id)),
    [results.rows, selectedIds]
  );

  const blockedCount =
    (results.lifecycleCounts.get("por-aprobar") ?? 0) +
    (results.lifecycleCounts.get("por-ajustar") ?? 0);

  /**
   * El centro de descargas de la vista de seguimiento, tal cual. Un reporte de
   * un ciclo es el mismo papel se pida desde donde se pida, y tener dos
   * generadores sería la vía más corta a que discrepen en un número.
   */
  const reportSource = React.useMemo<CicloReportSource>(() => {
    const progressConfig = {
      estados: config.estados,
      niveles: config.niveles,
      allowNegative: config.allowNegativeResults,
    };
    const rows = buildPersonRows(data, progressConfig);
    return {
      data,
      rows,
      groups: buildGroupRows(data, rows, progressConfig),
      stats: summarize(data, rows, progressConfig),
      estados: config.estados,
      niveles: config.niveles,
      allowNegative: config.allowNegativeResults,
      selectedIds,
    };
  }, [data, config, selectedIds]);

  const downloads = useCicloDownloadCenter(reportSource);
  const [isDownloadOpen, setIsDownloadOpen] = React.useState(false);
  const [isWidgetDismissed, setIsWidgetDismissed] = React.useState(false);
  // El drawer llega con el filtro de la selección ya puesto cuando lo abrió
  // "Exportar seleccionados": el clic que lo abrió ya lo dijo.
  const [downloadsFromSelection, setDownloadsFromSelection] = React.useState(false);

  const openDownloads = (onlySelected: boolean) => {
    if (onlySelected && selectedIds.size === 0) {
      toast.info("Marca colaboradores en la tabla para exportar solo a ellos.");
      return;
    }
    setDownloadsFromSelection(onlySelected);
    setIsDownloadOpen(true);
    setIsWidgetDismissed(false);
  };

  // La selección solo tiene sentido sobre la tabla de colaboradores: en el
  // árbol y en el ranking no hay casillas que marcar, así que salir de esa
  // pestaña la suelta en vez de dejar acciones apuntando a un fantasma.
  const changeTab = (next: ResultsTab) => {
    setTab(next);
    if (next !== "colaboradores") setSelectedIds(new Set());
  };

  /*
   * Las métricas que alguien arma conversando con el Agente IA.
   *
   * El chat vive a la izquierda —empuja la columna, no la tapa— y publica
   * aquí: por eso la pantalla es la que guarda la lista y la que salta al
   * resumen cuando llega una. Si publicara el propio panel, la métrica
   * aparecería en una pestaña que quien la pidió no está mirando.
   */
  const [isMetricChatOpen, setIsMetricChatOpen] = React.useState(false);
  const [customMetrics, setCustomMetrics] = React.useState<readonly CustomMetric[]>([]);
  /** Sobre cuál está hablando el chat: la recién creada, o la que se abrió
   *  desde su propia tarjeta con "Ajustar con IA". */
  const [activeMetricId, setActiveMetricId] = React.useState<string | null>(null);
  /**
   * La métrica con la que el chat abrió, cuando se entró por "Ajustar con
   * IA". Es aparte de la activa a propósito: publicar cambia la activa en
   * cada turno, y si el panel leyera esa, la conversación se remontaría sola
   * al dibujar la primera métrica.
   */
  const [metricSeedId, setMetricSeedId] = React.useState<string | null>(null);
  /** Lo que la IA está armando ahora mismo, para que el resumen abra el hueco
   *  en el sitio exacto donde va a caer. */
  const [metricWorking, setMetricWorking] = React.useState<MetricWorkingState | null>(null);
  /**
   * El orden de las filas del resumen.
   *
   * Vive aquí y no en la pestaña porque la pestaña se desmonta al cambiar de
   * vista: guardarlo allá haría que el tablero volviera a su orden de fábrica
   * cada vez que alguien pasa por Ranking. Las métricas nuevas no se agregan
   * a mano —el tablero las coloca junto al vecino con el que se declararon
   * hasta que alguien las mueva, y ahí sí entran a esta lista—.
   */
  const [boardOrder, setBoardOrder] = React.useState<readonly string[]>([
    "avance",
    "pendientes",
    "filtros",
    "sec-vivo",
    "adopcion-avance",
    "adopcion-meta",
    "adopcion-conversacion",
    "sec-llegar",
    "tiempo",
    "riesgo",
    "aprobacion",
    "aprobacion-lider",
    "devueltos-lider",
    "sec-como-van",
    "estados",
    "ranking-corte",
    "sec-peso",
    "peso-corte",
    "peso-empresa",
    "sec-alineacion",
    "alineacion-personas",
    "alineacion-corte",
    "sec-composicion",
    "medidas",
    "ritmo",
  ]);

  const publishMetric = React.useCallback((metric: CustomMetric) => {
    setCustomMetrics((current) => upsertCustomMetric(current, metric));
    setActiveMetricId(metric.id);
    // La métrica se monta en el resumen, así que el reporte se planta ahí:
    // dibujarla en una pestaña que no se está viendo es no dibujarla.
    changeTab("resumen");
  }, []);

  /**
   * El trabajo de la IA planta el reporte en el resumen desde que arranca, no
   * al terminar: el hueco que se abre es la respuesta a "¿dónde me lo va a
   * poner?", y esa pregunta se hace mientras la barra sube, no después.
   */
  const handleMetricWorking = React.useCallback((state: MetricWorkingState | null) => {
    setMetricWorking(state);
    if (state !== null) changeTab("resumen");
  }, []);

  const removeMetric = React.useCallback((id: string) => {
    setCustomMetrics((current) => current.filter((item) => item.id !== id));
    setActiveMetricId((current) => (current === id ? null : current));
  }, []);

  const adjustMetric = (id: string) => {
    setActiveMetricId(id);
    setMetricSeedId(id);
    setIsMetricChatOpen(true);
  };

  const seedMetric = customMetrics.find((item) => item.id === metricSeedId) ?? null;

  /*
   * El renglón de las pestañas queda limpio: cada vista monta los filtros donde
   * el lector ya está mirando cuando quiere recortar —en la cabecera de su
   * tabla las tres que la tienen, bajo la franja de pendientes en Resumen—.
   * Análisis con IA es el único que no tiene dónde: son tarjetas de hallazgos
   * sueltas, sin tabla ni franja, así que ahí se quedan arriba.
   */
  const filtersOnTabsRow = tab === "ia";
  const globalFilters = (
    <ResultsGlobalFilters
      results={results}
      state={filters}
      breakdown={breakdown}
      onBreakdownChange={setBreakdown}
    />
  );
  const globalChips = <ResultsFilterChips results={results} state={filters} />;

  /*
   * La misma barra para Alineación estratégica, con "Filtros" recortado a lo
   * que recorta gente entera (riesgo, nivel).
   *
   * Esa vista reparte el 100 % que cada persona tiene entre sus metas: sacar
   * personas deja repartos que siguen siendo repartos —"el esfuerzo de los que
   * van en riesgo"—, pero sacar objetivos parte ese 100 % por dentro y cada
   * porcentaje pasa a medirse contra un ciclo que ya no existe. "Ver por" y
   * "Segmentación" se quedan enteros: uno arma el cruce de quién empuja qué y
   * el otro es, justamente, recortar gente.
   */
  const alignmentFilters = (
    <ResultsGlobalFilters
      results={results}
      state={filters}
      breakdown={breakdown}
      onBreakdownChange={setBreakdown}
      filterScope="persona"
    />
  );

  /* El switch de "Colaboradores": va en la cabecera de la tarjeta de cada
     lectura, en el mismo sitio en las dos, para que cambiar de una a otra no
     obligue a ir a buscar el control a otro renglón. */
  const colaboradoresSwitch = (
    <ColaboradoresViewSwitch value={colaboradoresView} onChange={setColaboradoresView} />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Las pestañas y los filtros comparten renglón SOLO donde los filtros
          no tienen dónde más vivir: Resumen y Análisis con IA son paneles
          sueltos, sin la tarjeta de detalle que las otras tres traen.
          En esas tres los filtros bajan a la cabecera de la tarjeta, al lado
          de sus propios controles —el buscador, el switch de vista—: ahí es
          donde el lector ya está mirando cuando quiere recortar la tabla, y
          deja de haber dos franjas de controles compitiendo sobre la página. */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-2">
        <UbitsTabs
          tabs={[...TABS]}
          activeTabId={tab}
          onTabChange={(id) => changeTab(id as ResultsTab)}
          variant="page"
          fitContent
          className="mb-0 w-auto"
        />
        {filtersOnTabsRow && globalFilters}
      </div>

      {/* Las fichas de lo que está puesto, en su propio renglón: al lado de
          los botones empujaban los controles y se leían como una tira más de
          lo mismo. Solo aparece cuando hay algo que quitar. */}
      {filtersOnTabsRow && <ResultsFilterChips results={results} state={filters} />}

      {/* El mismo contenedor de scroll que la vista de seguimiento —y un
          `div`, no un `main`: la concha de la app ya tiene el suyo y dos
          `main` anidados no son HTML válido. El espaciador pegado arriba es el
          del reporte de encuestas: las cabeceras fijas de cada tarjeta
          (`top-3`) se detienen justo debajo de él, no contra las pestañas. */}
      {/* Sin reserva abajo, igual que la lista de ciclos del home: la barra
          flotante pasa por encima de las últimas filas y la tabla sigue por
          debajo. Reservarle sitio dejaba una franja muerta entre el final de
          la tabla y la barra, y esa franja es justo lo que hacía que la tabla
          se leyera cortada a media pantalla. La barra es una pastilla estrecha
          y centrada: lo que tapa de la fila de abajo es el medio, donde ni el
          promedio de la izquierda ni el contador de la derecha viven. */}
      <div
        data-slot="results-scroll"
        className="-mr-1 flex min-h-0 flex-1 flex-col overflow-y-auto pr-1 [scrollbar-gutter:stable]"
      >
        <div aria-hidden className="sticky top-0 z-40 h-4 shrink-0 bg-background" />
        <div key={tab} className="cascade-enter flex min-h-0 flex-col gap-4">
          {tab === "resumen" && (
            <ResumenTab
              results={viewResults}
              filters={filters}
              breakdown={breakdown}
              onOpenPending={setPending}
              globalControls={globalFilters}
              globalChips={globalChips}
              customMetrics={customMetrics}
              highlightedMetricId={isMetricChatOpen ? activeMetricId : null}
              onRemoveMetric={removeMetric}
              onAdjustMetric={adjustMetric}
              workingMetric={metricWorking}
              boardOrder={boardOrder}
              onBoardOrderChange={setBoardOrder}
            />
          )}

          {tab === "cumplimiento" && (
            <CumplimientoTab
              results={viewResults}
              entries={filtered.entries}
              config={resultsConfig}
              filters={filters}
              view={view}
              onViewChange={setView}
              breakdown={breakdown}
              onSelectPerson={setOpenPersonId}
              globalControls={globalFilters}
              globalChips={globalChips}
            />
          )}

          {tab === "colaboradores" && colaboradoresView === "persona" && (
            <ColaboradoresTab
              results={viewResults}
              baseResults={results}
              rows={filtered.rows}
              filters={filters}
              showsRisk={results.showsRisk}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              onOpenPerson={setOpenPersonId}
              globalChips={globalChips}
              viewSwitch={colaboradoresSwitch}
            />
          )}

          {tab === "colaboradores" && colaboradoresView === "grupos" && (
            <GruposTab
              results={viewResults}
              baseResults={results}
              filters={filters}
              breakdown={breakdown}
              onBreakdownChange={setBreakdown}
              globalChips={globalChips}
              viewSwitch={colaboradoresSwitch}
            />
          )}

          {tab === "colaboradores" && colaboradoresView === "alineacion" && (
            <AlineacionTab
              results={viewResults}
              rows={filtered.rows}
              entries={filtered.entries}
              config={resultsConfig}
              filters={filters}
              breakdown={breakdown}
              level={alignmentLevel}
              onLevelChange={setAlignmentLevel}
              positions={alignmentPositions}
              onPositionsChange={setAlignmentPositions}
              onAlign={alignObjectives}
              onOpenPerson={setOpenPersonId}
              globalControls={alignmentFilters}
              globalChips={globalChips}
              viewSwitch={colaboradoresSwitch}
            />
          )}

          {tab === "ranking" && (
            <RankingTab
              results={viewResults}
              rows={filtered.rows}
              config={resultsConfig}
              filters={filters}
              breakdown={breakdown}
              onBreakdownChange={setBreakdown}
              onOpenPerson={setOpenPersonId}
              globalChips={globalChips}
            />
          )}

          {tab === "ia" && (
            <AnalisisIaTab
              results={viewResults}
              rows={filtered.rows}
              entries={filtered.entries}
              filters={filters}
              onGoTo={(next) => changeTab(next as ResultsTab)}
            />
          )}
        </div>
      </div>

      <ShellRailSlot>
        <CicloResultsActionRail
          results={results}
          selectedRows={selectedRows}
          blockedCount={blockedCount}
          activeTab={tab}
          onClearSelection={() => setSelectedIds(new Set())}
          onDownload={openDownloads}
          onRemindProgress={() =>
            toast.success(
              `Recordatorio enviado a ${selectedIds.size} ${
                selectedIds.size === 1 ? "colaborador" : "colaboradores"
              }`
            )
          }
          onRemindApproval={() => setPending("por-aprobar")}
          onRemindNoProgress={() => setPending("sin-avance")}
          onCreateObjectives={() => setPending("sin-objetivos")}
          onCreateMetric={() => {
            // "Crear una métrica" siempre empieza una conversación nueva: si
            // se quiere tocar una que ya está, se entra por su tarjeta.
            setActiveMetricId(null);
            setMetricSeedId(null);
            setIsMetricChatOpen(true);
          }}
          isMetricChatOpen={isMetricChatOpen}
          onOpenPerson={setOpenPersonId}
          onEditObjectives={setEditObjectivesOf}
          onCreatePersonObjectives={setCreateObjectivesIntent}
          onEditWeights={setEditWeightsOf}
          onSetObjectivesInactive={(personId, inactive) => {
            const row = rowById(personId);
            if (!row) return;
            // Inactivar apaga lo que sigue en juego; activar enciende lo que
            // está apagado. Mandar la lista entera en los dos sentidos haría
            // que el contador de la barra y lo que de verdad cambia no
            // coincidieran.
            const targets = row.entries.filter((entry) =>
              inactive ? entry.inactivation === null : entry.inactivation !== null
            );
            if (targets.length === 0) return;
            setObjectivesInactivation(
              personId,
              targets.map((entry) => entry.objective.id),
              inactive
            );
            toast.success(
              inactive
                ? `${targets.length} ${targets.length === 1 ? "objetivo inactivado" : "objetivos inactivados"}`
                : `${targets.length} ${targets.length === 1 ? "objetivo activado" : "objetivos activados"}`
            );
          }}
          onEditParticipants={onEditParticipants}
          onAddObjectives={onEditObjectives}
          onShare={() => toast.success(`Enlace de “${ciclo.nombre}” copiado al portapapeles`)}
          onRemoveFromCiclo={(personIds) => {
            removePeople(personIds);
            setSelectedIds(new Set());
            // Si la ficha abierta era de alguien que acaba de salir, se cierra:
            // quedaría mirando a una persona que el ciclo ya no tiene.
            if (openPersonId !== null && personIds.includes(openPersonId)) setOpenPersonId(null);
            toast.success(
              personIds.length === 1
                ? "Colaborador retirado del ciclo"
                : `${personIds.length} colaboradores retirados del ciclo`
            );
          }}
        />
      </ShellRailSlot>

      {/* El chat del Agente IA. Se monta en el anclaje lateral de la concha,
          que es hermano de la columna de contenido: abrirlo la angosta y el
          resumen queda a la vista mientras se conversa. */}
      <AiMetricChatPanel
        open={isMetricChatOpen}
        onOpenChange={setIsMetricChatOpen}
        cicloName={results.data.name}
        seed={seedMetric}
        onPublish={publishMetric}
        onRemove={removeMetric}
        onWorkingStateChange={handleMetricWorking}
      />

      <PersonImpactSheet
        row={openPerson}
        data={results.data}
        showsRisk={results.showsRisk}
        estados={results.estados}
        open={openPersonId !== null}
        onOpenChange={(open) => {
          if (!open) setOpenPersonId(null);
        }}
        onSetInactivation={
          openPersonId
            ? (objectiveIds, inactive) => setObjectivesInactivation(openPersonId, objectiveIds, inactive)
            : undefined
        }
        onPost={
          openPersonId
            ? (objectiveId, post) => postToThread(openPersonId, objectiveId, post)
            : undefined
        }
        onUpdateProgress={
          openPersonId
            ? (objectiveId, input) => updateObjectiveProgress(openPersonId, objectiveId, input)
            : undefined
        }
        onEditObjective={
          openPersonId
            ? (objectiveId, patch) => editObjective(openPersonId, objectiveId, patch)
            : undefined
        }
        onDeleteObjectives={
          openPersonId ? (objectiveIds) => deleteObjectives(openPersonId, objectiveIds) : undefined
        }
        onApprove={
          openPersonId
            ? (objectiveIds) => reviewObjectives(openPersonId, objectiveIds, "aprobado", "")
            : undefined
        }
        onDeny={
          openPersonId
            ? (objectiveIds, reason) => reviewObjectives(openPersonId, objectiveIds, "ajustes", reason)
            : undefined
        }
        onResubmit={
          openPersonId ? (objectiveIds) => resubmitObjectives(openPersonId, objectiveIds) : undefined
        }
        onAdjustObjective={
          openPersonId
            ? (objectiveId, patch) => adjustObjective(openPersonId, objectiveId, patch)
            : undefined
        }
        onEditCicloObjectives={onEditObjectives ? () => onEditObjectives() : undefined}
      />

      {/* Escribirle objetivos nuevos a los colaboradores marcados, con la
          misma experiencia del constructor: la tarjeta guiada, el banco y el
          Agente IA conversando en el panel de al lado. La tanda se escribe una
          vez y cae en todos los marcados. */}
      <CreatePersonObjectivesDrawer
        rows={selectedRows}
        companyObjectives={results.data.companyObjectives}
        intent={createObjectivesIntent}
        open={createObjectivesIntent !== null}
        onOpenChange={(open) => {
          if (!open) setCreateObjectivesIntent(null);
        }}
        /* Sin hueco no hay objetivo que escribir: el drawer manda al reparto
           de pesos de esa persona, que es el mismo de la tabla. */
        onAdjustWeights={(personId) => {
          setCreateObjectivesIntent(null);
          setEditWeightsOf(personId);
        }}
        onSave={(objectives) => {
          const personIds = selectedRows.map((row) => row.person.id);
          addObjectives(personIds, objectives);
          const objectiveLabel =
            objectives.length === 1 ? "1 objetivo" : `${objectives.length} objetivos`;
          toast.success(
            personIds.length === 1
              ? `${objectiveLabel} para ${selectedRows[0].collaborator.name}`
              : `${objectiveLabel} para ${personIds.length} colaboradores`
          );
          setSelectedIds(new Set());
        }}
      />

      {/* Corregir los objetivos de alguien con la tarjeta del constructor:
          uno o varios en la misma pasada. */}
      <EditPersonObjectivesDrawer
        row={editObjectivesRow}
        companyObjectives={results.data.companyObjectives}
        open={editObjectivesOf !== null}
        onOpenChange={(open) => {
          if (!open) setEditObjectivesOf(null);
        }}
        onSave={(objectives) => {
          if (!editObjectivesOf) return;
          replaceObjectives(editObjectivesOf, objectives);
          toast.success(
            objectives.length === 1
              ? "Objetivo actualizado"
              : `${objectives.length} objetivos actualizados`
          );
        }}
      />

      {/* El reparto es una decisión sobre el conjunto —subirle a uno es
          bajarle a otro—, así que se toca en la misma pieza del constructor y
          no tarjeta por tarjeta. Aquí sale por el costado y no como modal
          centrado: es una edición sobre la tabla de colaboradores, que se
          queda detrás como el resto de las ediciones del módulo. */}
      {editWeightsRow && (
        <WeightBalanceDialog
          presentation="drawer"
          open={editWeightsOf !== null}
          onOpenChange={(open) => {
            if (!open) setEditWeightsOf(null);
          }}
          groups={[
            {
              setId: editWeightsRow.person.id,
              label: editWeightsRow.collaborator.name,
              budget: TOTAL_WEIGHT,
              objectives: editWeightsRow.entries.map((entry) => entry.objective),
            },
          ]}
          title="Peso de los objetivos"
          // El nombre no va aquí: la tarjeta de abajo ya lo lleva de título, y
          // repetirlo en la cabecera no agrega nada.
          description="Reparte el ciclo del colaborador sin entrar objetivo por objetivo."
          onApply={(result) => {
            const weights = result[editWeightsRow.person.id];
            if (!weights) return;
            replaceObjectives(
              editWeightsRow.person.id,
              editWeightsRow.entries
                .map((entry) => entry.objective)
                .filter((objective) => objective.id in weights)
                .map((objective) => ({ ...objective, weight: weights[objective.id] }))
            );
            toast.success("Pesos actualizados");
          }}
        />
      )}

      {pending && (
        <PendingDrawer
          key={pending}
          kind={pending}
          results={results}
          open
          onOpenChange={(open) => {
            if (!open) setPending(null);
          }}
          onAct={(kind, count) => {
            if (kind === "sin-objetivos") {
              toast.success(`Se abrirá el constructor para ${count} colaboradores`);
            } else if (kind === "sin-avance" || kind === "riesgo-alto") {
              toast.success(
                `Recordatorio enviado a ${count} ${count === 1 ? "colaborador" : "colaboradores"}`
              );
            } else {
              toast.success(
                `Recordatorio enviado por ${count} ${count === 1 ? "objetivo" : "objetivos"}`
              );
            }
            setPending(null);
          }}
        />
      )}

      <CicloDownloadDrawer
        open={isDownloadOpen}
        onOpenChange={setIsDownloadOpen}
        source={reportSource}
        entries={downloads.entries}
        onStart={downloads.start}
        onDeliver={downloads.deliver}
        onShare={downloads.share}
        startWithSelection={downloadsFromSelection}
      />
      {!isWidgetDismissed && (
        <CicloDownloadsWidget
          entries={downloads.entries}
          onDeliver={downloads.deliver}
          onShare={downloads.share}
          onOpenDrawer={() => openDownloads(false)}
          onDismiss={() => setIsWidgetDismissed(true)}
        />
      )}
    </div>
  );
}
