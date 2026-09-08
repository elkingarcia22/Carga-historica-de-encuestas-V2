import * as React from "react";
import {
  AlertTriangle,
  CalendarRange,
  FileSearch,
  FileSpreadsheet,
  FileText,
  Info,
  ListChecks,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DrawerSection, DrawerShell } from "@/components/overlays";
import { UbitsTabs } from "@/components/navigation";
import { EmptyState } from "@/components/feedback/EmptyState";
import { UploadZone } from "@/components/upload/UploadZone";
import { AiAnalyzingState } from "@/components/ai-interaction";
import { CicloSelectorField } from "./CicloSelectorField";
import { ModeSelector } from "./ModeSelector";
import { ObjectivesReviewTable } from "./ObjectivesReviewTable";
import { UploadsPanel } from "./UploadsPanel";
import { UploadDetailPanel } from "./UploadDetailPanel";
import { CargaObjetivosWidget } from "./CargaObjetivosWidget";
import { CargaObjetivosFooter } from "./CargaObjetivosFooter";
import { downloadObjectivesAnalysis } from "./downloadAnalysis";
import type { ReviewSelectionInfo } from "./reviewTabs";
import { buildCycleRoster, buildUbitsDirectory } from "./cargaObjetivosRoster";
import { buildUploadRows, groupsFromPendingRows, serviceFailureRow } from "./uploadRows";
import { buildCicloDetail, type CicloListRow } from "@/components/ciclo-detail";
import {
  ANALYSIS_HOLD_MS,
  ANALYSIS_STEP,
  ANALYSIS_TICK_MS,
  UPLOAD_TICK_MS,
  countPending,
  getAnalyzingCopy,
  summarizeFindings,
  type AnalysisFindings,
  type UploadTaskState,
} from "./uploadTaskTypes";
import {
  OBJECTIVES_IMPORT_ACCEPT,
  OBJECTIVES_IMPORT_MAX_MB,
  analyzeObjectivesFiles,
  assignGroupUser,
  bucketForGroup,
  countObjectives,
  flattenGroups,
  getImmediateValidationError,
  getModeConfig,
  relinkObjective,
  type AnalyzeObjectivesOutcome,
  type BulkUploadMode,
  type DetectedObjectivesAnalysis,
  type ObjectiveUserGroup,
  type ParsedObjective,
  type RosterUser,
} from "@/lib/objectivesImport";

/**
 * Carga masiva de objetivos para un ciclo: elegir la operación y el archivo →
 * analizar → revisar lo detectado → confirmar. No es una acción sobre las
 * filas seleccionadas de la tabla: la entrada es un archivo.
 *
 * La revisión es donde ocurre el trabajo: los objetivos leídos caen en una
 * tabla editable partida por lo que bloquea a cada usuario, las reglas corren
 * a cada tecla y solo se cargan los de los usuarios alineados. La carga en sí
 * es una tarea de fondo: vive en la pestaña "Cargas" y en el widget flotante,
 * abierto o cerrado el panel.
 */

type UploadStep = "dropzone" | "summary" | "error" | "empty" | "detail";
type WizardTab = "nueva" | "cargas";
type TemplateMismatch = Extract<AnalyzeObjectivesOutcome, { kind: "mismatch" }>;

export interface CargaObjetivosDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Nombre del ciclo en el que aterrizan los objetivos, y su gente ya
   * asignada — presentes cuando el drawer se abre desde dentro de ese ciclo,
   * que ya sabe contra quién resolver el archivo.
   */
  cycleName?: string;
  roster?: RosterUser[];
  /** El resto de UBITS: alguien nombrado en el archivo puede faltar por agregar. */
  directory?: RosterUser[];
  /**
   * Los ciclos entre los que elegir, cuando no hay uno fijo — abierto desde el
   * home. El asistente pide elegir uno (o crear uno nuevo) antes de seguir.
   */
  ciclos?: readonly CicloListRow[];
  /** Se dispara cuando una carga termina, con cuántos objetivos entraron. */
  onUploaded?: (objectivesCount: number) => void;
  /** El widget de descargas ocupa la esquina: el de la carga se corre a su lado. */
  dodgeWidget?: boolean;
}

/** Referencia estable: un literal nuevo en cada render invalidaría los `useMemo` que dependen de ella. */
const EMPTY_ROSTER: RosterUser[] = [];

export function CargaObjetivosDrawer({
  open,
  onOpenChange,
  cycleName: fixedCycleName,
  roster: fixedRoster,
  directory: fixedDirectory,
  ciclos,
  onUploaded,
  dodgeWidget = false,
}: CargaObjetivosDrawerProps) {
  /**
   * Sin ciclo fijo, el asistente lo pide como su propio primer paso —arriba
   * de "Qué quieres hacer"—, porque nada de lo que sigue tiene sentido sin
   * saber contra quién resolver el archivo.
   */
  const hasCicloPicker = ciclos !== undefined;
  const [pickedCiclo, setPickedCiclo] = React.useState<CicloListRow | null>(null);
  const [isCreatingNewCiclo, setIsCreatingNewCiclo] = React.useState(false);
  const [newCicloName, setNewCicloName] = React.useState("");

  const pickedCicloData = React.useMemo(
    () => (pickedCiclo ? buildCicloDetail(pickedCiclo) : null),
    [pickedCiclo]
  );
  const pickedRoster = React.useMemo(
    () => (pickedCicloData ? buildCycleRoster(pickedCicloData) : EMPTY_ROSTER),
    [pickedCicloData]
  );

  const cycleName = hasCicloPicker
    ? isCreatingNewCiclo
      ? newCicloName.trim()
      : (pickedCiclo?.nombre ?? "")
    : (fixedCycleName ?? "");
  const roster = hasCicloPicker ? (isCreatingNewCiclo ? EMPTY_ROSTER : pickedRoster) : (fixedRoster ?? EMPTY_ROSTER);
  const directory = React.useMemo(
    () => (hasCicloPicker ? buildUbitsDirectory(roster) : (fixedDirectory ?? EMPTY_ROSTER)),
    [hasCicloPicker, roster, fixedDirectory]
  );
  /** Falta resolver el ciclo: ni uno elegido ni un nombre para el nuevo. */
  const cicloMissing = hasCicloPicker && cycleName === "";
  const [tab, setTab] = React.useState<WizardTab>("nueva");
  const [step, setStep] = React.useState<UploadStep>("dropzone");
  const [detailTask, setDetailTask] = React.useState<UploadTaskState | null>(null);
  /** `null` hasta que se elige una operación: no hay una por defecto. */
  const [mode, setMode] = React.useState<BulkUploadMode | null>(null);
  const [files, setFiles] = React.useState<File[]>([]);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [findings, setFindings] = React.useState<AnalysisFindings | null>(null);
  const [analysis, setAnalysis] = React.useState<DetectedObjectivesAnalysis | null>(null);
  const [error, setError] = React.useState<{ title: string; detail: string } | null>(null);
  /** "Este archivo es de otra operación", contestado sin salir de la zona de carga. */
  const [mismatch, setMismatch] = React.useState<TemplateMismatch | null>(null);
  /** La copia de trabajo de la revisión: arranca como lo dijo el archivo y deriva con las ediciones. */
  const [groups, setGroups] = React.useState<ObjectiveUserGroup[]>([]);
  const [isConfirmingDelete, setConfirmingDelete] = React.useState(false);
  /** Lo que hay marcado con checkbox en la revisión, para prestárselo al rail. */
  const [reviewSelection, setReviewSelection] = React.useState<ReviewSelectionInfo | null>(null);
  /** La revisión, aparcada pero no perdida: el drawer se esconde y el widget es el camino de vuelta. */
  const [isMinimized, setIsMinimized] = React.useState(false);
  const [isConfirmingCancel, setConfirmingCancel] = React.useState(false);
  const [isConfirmingPartialLoad, setConfirmingPartialLoad] = React.useState(false);
  const [isConfirmingTrayCancel, setConfirmingTrayCancel] = React.useState(false);
  /** Cargas de esta sesión. Sobreviven al drawer, como la bandeja de descargas del navegador. */
  const [uploadTasks, setUploadTasks] = React.useState<UploadTaskState[]>([]);
  const [showTray, setShowTray] = React.useState(false);

  /**
   * Las cargas, escritas en el estado y en una referencia a la vez.
   *
   * El intervalo que las hace avanzar corre fuera de React, así que necesita
   * leer las filas *ahora*, no en el próximo render: con `setUploadTasks` a
   * secas el updater se ejecuta después y el intervalo terminaba decidiendo
   * sobre una lista vieja — por eso no se detenía al caerse el servicio y
   * peleaba con el intervalo del reintento.
   */
  const uploadTasksRef = React.useRef(uploadTasks);
  const applyTasks = (update: (tasks: UploadTaskState[]) => UploadTaskState[]): UploadTaskState[] => {
    const next = update(uploadTasksRef.current);
    uploadTasksRef.current = next;
    setUploadTasks(next);
    return next;
  };
  const timersRef = React.useRef(new Set<ReturnType<typeof setInterval>>());
  React.useEffect(() => () => timersRef.current.forEach((timer) => clearInterval(timer)), []);

  // Solo se usa donde ya hay archivo analizado (el mode queda fijo por
  // entonces); el resto de la pantalla no lee `modeConfig` mientras la
  // operación sigue sin elegir, así que el respaldo a "crear" no se nota.
  const modeConfig = getModeConfig(mode ?? "crear");
  const modeMissing = mode === null;

  const reset = () => {
    setStep("dropzone");
    setMode(null);
    setFiles([]);
    setIsAnalyzing(false);
    setProgress(0);
    setFindings(null);
    setAnalysis(null);
    setError(null);
    setMismatch(null);
    setGroups([]);
    setConfirmingDelete(false);
    setIsMinimized(false);
    setConfirmingCancel(false);
    setConfirmingPartialLoad(false);
    setConfirmingTrayCancel(false);
    setPickedCiclo(null);
    setIsCreatingNewCiclo(false);
    setNewCicloName("");
  };

  /** Cambiar de operación invalida el archivo: cada una espera columnas distintas. */
  const handleModeChange = (next: BulkUploadMode) => {
    if (next === mode) return;
    setMode(next);
    setFiles([]);
    setMismatch(null);
  };

  /** Solo la revisión guarda trabajo que no se rehace eligiendo el archivo otra vez. */
  const hasReviewInFlight = step === "summary" && groups.length > 0;
  const activeUploads = uploadTasks.filter((task) => task.status === "loading").length;

  const minimize = () => {
    setConfirmingCancel(false);
    setIsMinimized(true);
    onOpenChange(false);
  };

  const discard = () => {
    setConfirmingCancel(false);
    setConfirmingTrayCancel(false);
    onOpenChange(false);
    reset();
  };

  /**
   * La X, Escape y el velo caen aquí. Con una revisión abierta minimizan:
   * "cerrar" un panel es "quítamelo de encima", y un gesto tan ambiguo no
   * puede ser el que destruya una hora de trabajo. Descartar tiene su botón, y
   * ese botón pregunta.
   */
  const handleOpenChange = (next: boolean) => {
    if (next) {
      setIsMinimized(false);
      onOpenChange(true);
      return;
    }
    if (hasReviewInFlight) {
      minimize();
      return;
    }
    discard();
  };

  /*
    Reabrir desde fuera —el botón de la barra flotante— restaura la revisión
    minimizada en vez de arrancar una vacía. Ajustado durante el render y no en
    un efecto, para que el valor viejo nunca llegue a pintarse.
  */
  const [wasOpen, setWasOpen] = React.useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setIsMinimized(false);
  }

  /**
   * El análisis, narrado. La barra es dueña del reloj: sube a 100 a su ritmo,
   * se queda ahí lo justo para leerse y solo entonces pasa la mano. El parseo
   * corre en paralelo y deja sus conteos reales en `findings` en cuanto
   * termina, para que la segunda mitad de la narración diga lo que encontró.
   */
  const handleAnalyze = () => {
    if (cicloMissing || mode === null) return;
    setIsAnalyzing(true);
    setProgress(0);
    setFindings(null);
    setMismatch(null);

    // Cuando la estructura sí permite saber la operación correcta —hoy, solo
    // hacia "actualizar"— el sistema cambia por su cuenta y vuelve a analizar.
    const parsing = analyzeObjectivesFiles(files, mode, roster, directory).then(
      (outcome): Promise<AnalyzeObjectivesOutcome> | AnalyzeObjectivesOutcome => {
        if (outcome.kind !== "mismatch" || !outcome.suggested) return outcome;
        const corrected = outcome.suggested;
        setMode(corrected);
        return analyzeObjectivesFiles(files, corrected, roster, directory).then((resolved) =>
          resolved.kind === "result"
            ? {
                kind: "result",
                result: {
                  ...resolved.result,
                  notes: [
                    `Este archivo tiene la estructura de "${getModeConfig(corrected).label}", así que lo analizamos con esa operación.`,
                    ...resolved.result.notes,
                  ],
                },
              }
            : resolved
        );
      }
    );
    void parsing.then((outcome) => {
      if (outcome.kind === "result") setFindings(summarizeFindings(outcome.result));
    });

    let value = 0;
    const interval = setInterval(() => {
      value = Math.min(100, value + ANALYSIS_STEP);
      setProgress(value);
      if (value < 100) return;

      clearInterval(interval);
      timersRef.current.delete(interval);
      void parsing.then(async (outcome) => {
        await new Promise((resolve) => setTimeout(resolve, ANALYSIS_HOLD_MS));
        setIsAnalyzing(false);

        if (outcome.kind === "error") {
          setError({ title: outcome.title, detail: outcome.detail });
          setAnalysis(null);
          setGroups([]);
          setStep("error");
          return;
        }
        // Sin corrección posible: se eligió actualizar y falta nuevo_avance. Se
        // queda en la zona de carga porque la respuesta está a un clic, arriba.
        if (outcome.kind === "mismatch") {
          setMismatch(outcome);
          setAnalysis(null);
          setGroups([]);
          setTab("nueva");
          return;
        }
        setAnalysis(outcome.result);
        setGroups(outcome.result.groups);
        setStep(countObjectives(outcome.result.groups) === 0 ? "empty" : "summary");
      });
    }, ANALYSIS_TICK_MS);
    timersRef.current.add(interval);
  };

  // --- Ediciones de la revisión (inmutables, un grupo a la vez) ------------

  const updateObjective = (id: string, patch: Partial<ParsedObjective>) => {
    // El archivo es lo único con un "ya lo revisé" que retirar por fila —lo
    // que un "Guardar ajustes" anterior aceptó no era esta edición—; un
    // objetivo ya existente no lleva esa marca, así que ahí basta con el
    // parche. Editar solo suelta la fila que se tocó, no a sus vecinas.
    const applyToFile = (objectives: ParsedObjective[]) =>
      objectives.map((objective) =>
        objective.id === id ? { ...objective, ...patch, rowConfirmed: false } : objective
      );
    const applyToExisting = (objectives: ParsedObjective[]) =>
      objectives.map((objective) => (objective.id === id ? { ...objective, ...patch } : objective));
    setGroups((current) =>
      current.map((group) => {
        const ownsRow =
          group.objectives.some((objective) => objective.id === id) ||
          group.existing.some((objective) => objective.id === id);
        if (!ownsRow) return group;
        return { ...group, objectives: applyToFile(group.objectives), existing: applyToExisting(group.existing) };
      })
    );
  };

  const removeObjectives = (ids: string[]) => {
    const removing = new Set(ids);
    setGroups((current) =>
      current
        .map((group) => {
          const objectives = group.objectives.filter((objective) => !removing.has(objective.id));
          return objectives.length === group.objectives.length ? group : { ...group, objectives };
        })
        .filter((group) => group.objectives.length > 0)
    );
  };

  const countOf = (identifier: string) =>
    groups.find((group) => group.identifier === identifier)?.objectives.length ?? 0;

  /** Confirmar mueve la tarjeta de pestaña, así que el toast es lo que dice que el clic llegó. */
  const assignUser = (identifier: string, user: RosterUser | null) => {
    setGroups((current) => assignGroupUser(current, identifier, user));
    if (!user) return;
    const count = countOf(identifier);
    toast.success(`${count} ${count === 1 ? "objetivo alineado" : "objetivos alineados"} con ${user.name}`);
  };

  /**
   * El "Guardar ajustes" de una fila: se confirma sola, sin arrastrar a sus
   * vecinas. La tarjeta entera solo pasa a "alineados" cuando todas sus filas
   * lo han hecho — ver `groupAllRowsConfirmed`.
   */
  const confirmObjectiveReady = (objectiveId: string) => {
    setGroups((current) =>
      current.map((group) =>
        group.objectives.some((objective) => objective.id === objectiveId)
          ? {
              ...group,
              objectives: group.objectives.map((objective) =>
                objective.id === objectiveId ? { ...objective, rowConfirmed: true } : objective
              ),
            }
          : group
      )
    );
    const row = flattenGroups(groups).find((objective) => objective.id === objectiveId);
    toast.success(row ? `"${row.title}" guardado` : "Objetivo guardado");
  };

  const relinkRow = (objectiveId: string, targetId: string | null) => {
    setGroups((current) => relinkObjective(current, objectiveId, targetId));
    const row = flattenGroups(groups).find((objective) => objective.id === objectiveId);
    if (!row) return;
    if (targetId === null) {
      toast.success(`"${row.title}" se cargará como un objetivo nuevo`);
      return;
    }
    const target = groups.flatMap((group) => group.existing).find((objective) => objective.id === targetId);
    const targetTitle = target?.title ?? "el objetivo elegido";
    toast.success(
      mode === "actualizar"
        ? `El avance de "${row.title}" se registrará en "${targetTitle}"`
        : `"${row.title}" reescribirá "${targetTitle}"`
    );
  };

  /** Dos identificadores del archivo que nombran a la misma persona, unidos en uno. */
  const mergeGroups = (sourceIdentifier: string, targetIdentifier: string) => {
    const source = groups.find((group) => group.identifier === sourceIdentifier);
    const target = groups.find((group) => group.identifier === targetIdentifier);
    setGroups((current) => {
      const from = current.find((group) => group.identifier === sourceIdentifier);
      if (!from) return current;
      return current
        .map((group) =>
          group.identifier === targetIdentifier
            ? {
                ...group,
                // Dos tarjetas juntas son una combinación que nadie ha visto
                // todavía: ninguna fila trae su "ya lo revisé" a la fusión.
                objectives: [...group.objectives, ...from.objectives].map((objective) => ({
                  ...objective,
                  rowConfirmed: false,
                })),
              }
            : group
        )
        .filter((group) => group.identifier !== sourceIdentifier);
    });
    if (!source || !target) return;
    const total = source.objectives.length + target.objectives.length;
    toast.success(
      `Objetivos unificados: ${target.matchedUser?.name ?? target.identifier} queda con ${total} ${total === 1 ? "objetivo" : "objetivos"}`
    );
  };

  const candidates = React.useMemo(
    () => [...roster.map((user) => ({ ...user, onCycle: true })), ...directory],
    [roster, directory]
  );

  // --- Conteos derivados ----------------------------------------------------

  const allObjectives = React.useMemo(() => flattenGroups(groups), [groups]);
  const readyObjectives = React.useMemo(
    () =>
      groups
        .filter((group) => bucketForGroup(group) === "alineados")
        .reduce((total, group) => total + group.objectives.length, 0),
    [groups]
  );
  const remainingUsers = React.useMemo(
    () => groups.filter((group) => bucketForGroup(group) !== "alineados").length,
    [groups]
  );

  const isTrayVisible = !open && (isMinimized || (showTray && uploadTasks.length > 0));

  // --- La carga como tarea de fondo -----------------------------------------

  /** Escribe un objetivo por tick y registra lo que volvió. */
  const runUploadProgress = (taskId: string, failsAtRow?: number) => {
    const interval = setInterval(() => {
      const stop = () => {
        clearInterval(interval);
        timersRef.current.delete(interval);
      };

      const task = uploadTasksRef.current.find((entry) => entry.id === taskId);
      const index = task?.rows.findIndex((row) => row.status === "pending") ?? -1;
      // La tarea ya no está, o no le queda nada pendiente: este intervalo
      // sobra. Dejarlo vivo es lo que hacía que el reintento peleara con la
      // corrida anterior, que volvía a marcar como fallido lo que el reintento
      // acababa de escribir.
      if (!task || index === -1) {
        stop();
        return;
      }

      // El servicio se cae a mitad de camino: lo que entró se queda, lo
      // que faltaba queda fallido, y el reintento manda solo eso.
      const next: UploadTaskState =
        failsAtRow !== undefined && index >= failsAtRow
          ? {
              ...task,
              rows: task.rows.map((row) =>
                row.status === "pending" ? { ...row, status: "failed" as const } : row
              ),
              status: "completed",
              serviceFailed: true,
            }
          : (() => {
              const rows = task.rows.map((row, position) =>
                position === index
                  ? { ...row, status: row.willFail ? ("failed" as const) : ("uploaded" as const) }
                  : row
              );
              return {
                ...task,
                rows,
                status: rows.every((row) => row.status !== "pending") ? "completed" : "loading",
              };
            })();

      applyTasks((current) => current.map((entry) => (entry.id === taskId ? next : entry)));

      if (next.status !== "completed") return;
      stop();
      onUploaded?.(next.rows.filter((row) => row.status === "uploaded").length);
    }, UPLOAD_TICK_MS);
    timersRef.current.add(interval);
  };

  /** Manda otra vez solo lo que nunca entró. Siempre pasa: la caída era del servicio, no de los datos. */
  const retryUpload = (taskId: string) => {
    applyTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: "loading" as const,
              serviceFailed: false,
              rows: task.rows.map((row) =>
                row.status === "failed" ? { ...row, status: "pending" as const, willFail: false } : row
              ),
            }
          : task
      )
    );
    runUploadProgress(taskId);
  };

  /**
   * Confirmar no termina el flujo, arranca un trabajo de fondo: el drawer baja
   * a "Cargas", donde la barra vive junto a las cargas anteriores, y la misma
   * tarea sigue visible en el widget abierto o cerrado el panel.
   */
  const handleConfirm = () => {
    const taskId = String(Date.now());
    const name = analysis?.fileNames[0] ?? `${modeConfig.label} — ${cycleName}`;
    /*
      `analysis.groups` es el parseo tal como llegó, intacto de todo lo que el
      revisor arregló después — así que es lo que dice si este archivo llegó
      limpio. Ver `buildUploadRows`.
    */
    const cameInClean = analysis?.groups.every((group) => bucketForGroup(group) === "alineados") ?? true;
    const rows = buildUploadRows(groups, cameInClean);
    const failsAtRow = serviceFailureRow(name, rows.length);

    applyTasks((current) => [...current, { id: taskId, name, status: "loading", rows }]);
    setShowTray(true);

    setGroups([]);
    setAnalysis(null);
    setFiles([]);
    setConfirmingCancel(false);
    setConfirmingPartialLoad(false);
    setStep("dropzone");
    setTab("cargas");
    runUploadProgress(taskId, failsAtRow);
  };

  const handleResumeTask = (task: UploadTaskState) => {
    // Retomar no pasa por la elección de operación del paso "Nueva carga";
    // cae aquí con lo último que quedó en `mode` (o "crear" si nunca se llegó
    // a elegir uno), igual que antes de que la selección pudiera venir vacía.
    setGroups(groupsFromPendingRows(task, mode ?? "crear", roster, directory));
    setDetailTask(null);
    setTab("nueva");
    setStep("summary");
  };

  const openDetail = (task: UploadTaskState) => {
    setDetailTask(task);
    setStep("detail");
  };

  // --- Textos y medidas del panel -------------------------------------------

  const title =
    step === "summary"
      ? "Revisa los objetivos detectados"
      : step === "error"
        ? "No pudimos continuar"
        : step === "empty"
          ? "No encontramos objetivos"
          : step === "detail"
            ? "Detalle de la carga"
            : "Carga masiva de objetivos";

  const description =
    step === "summary"
      ? "Resuelve lo que falta en cada pestaña: al confirmarlo, pasa a la siguiente. Solo se cargan los de “Listos para cargar”."
      : step === "error"
        ? "Revisa el archivo e inténtalo de nuevo."
        : step === "empty"
          ? "No pudimos detectar objetivos en este archivo."
          : step === "detail"
            ? "Qué entró en UBITS y qué quedó pendiente, por persona."
            : "Elige qué quieres hacer y sube el archivo, o revisa tus cargas recientes.";

  // La revisión necesita el ancho; el resto del asistente se lee mejor angosto.
  const widthClass =
    step === "summary" ? "!w-[86vw] !max-w-[86vw]" : "!w-[38vw] !max-w-[38vw] !min-w-[32rem]";

  const isBusyQuestion = isConfirmingCancel || isConfirmingPartialLoad;
  const pendingInDetail = detailTask ? countPending(detailTask) : 0;

  const footer = (
    <CargaObjetivosFooter
      step={step}
      tab={tab}
      modeConfig={modeConfig}
      filesCount={files.length}
      cicloMissing={cicloMissing}
      modeMissing={modeMissing}
      activeUploads={activeUploads}
      pendingInDetail={pendingInDetail}
      isAnalyzing={isAnalyzing}
      isConfirmingDelete={isConfirmingDelete}
      isConfirmingCancel={isConfirmingCancel}
      isConfirmingPartialLoad={isConfirmingPartialLoad}
      hasReviewInFlight={hasReviewInFlight}
      reviewedRows={allObjectives.length}
      readyObjectives={readyObjectives}
      remainingUsers={remainingUsers}
      selection={reviewSelection}
      onClose={() => onOpenChange(false)}
      onResumeDetail={() => detailTask && handleResumeTask(detailTask)}
      onRequestCancel={() => setConfirmingCancel(true)}
      onKeepReviewing={() => setConfirmingCancel(false)}
      onDiscard={discard}
      onAnalyze={handleAnalyze}
      onMinimize={minimize}
      onRequestLoad={() => (remainingUsers > 0 ? setConfirmingPartialLoad(true) : handleConfirm())}
      onCancelPartialLoad={() => setConfirmingPartialLoad(false)}
      onConfirmLoad={handleConfirm}
      onAcknowledgeError={() => {
        setError(null);
        setStep("dropzone");
        setFiles([]);
      }}
      onDownloadAnalysis={() => downloadObjectivesAnalysis(groups, mode ?? "crear", cycleName)}
    />
  );

  return (
    <>
      <DrawerShell
        open={open}
        onOpenChange={handleOpenChange}
        title={title}
        description={description}
        side="right"
        size="md"
        className={cn(
          "!bg-background transition-[width,max-width] duration-500",
          // Una descripción de dos líneas a lo ancho de 1.240px no se lee. El
          // texto del encabezado se corta a una medida de lectura, como el
          // resto de los copys largos del proyecto.
          "[&_[data-slot=sheet-description]]:max-w-[104ch]",
          widthClass
        )}
        disablePadding
        disableScrollbarGutter
        footer={footer}
      >
        {/* Posicionado para que el velo del análisis cubra solo el cuerpo.
            `bg-background` ya es el fondo azulado de la aplicación (#f8faff);
            lo que faltaba para que las tarjetas se leyeran como tarjetas era la
            sombra, no un fondo distinto. */}
        <div
          className={cn(
            "relative flex min-h-0 flex-1 flex-col bg-background px-4 pb-4",
            step === "summary" && "pt-3"
          )}
        >
          {step === "dropzone" && (
            <div className="flex min-h-0 flex-1 flex-col gap-4">
              <UbitsTabs
                tabs={[
                  { id: "nueva", label: "Nueva carga", icon: <Upload className="size-4" /> },
                  { id: "cargas", label: "Cargas", icon: <FileText className="size-4" />, badge: activeUploads },
                ]}
                activeTabId={tab}
                onTabChange={(id) => setTab(id as WizardTab)}
                className="mb-0 shrink-0"
              />

              {tab === "nueva" ? (
                /* El scroll vive aquí y no en el cuerpo del drawer, para que la
                   tira "Nueva carga / Cargas" siga a la vista mientras se baja
                   por las tres secciones del paso. */
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-0.5">
                  {hasCicloPicker && (
                    <DrawerSection
                      icon={CalendarRange}
                      tone="brand"
                      title="Ciclo"
                      hint="A qué ciclo entran estos objetivos. Puedes elegir uno existente o crear uno nuevo."
                    >
                      <CicloSelectorField
                        ciclos={ciclos ?? []}
                        value={pickedCiclo}
                        isCreatingNew={isCreatingNewCiclo}
                        newCicloName={newCicloName}
                        onSelectExisting={(ciclo) => {
                          setPickedCiclo(ciclo);
                          setIsCreatingNewCiclo(false);
                        }}
                        onStartNew={() => {
                          setPickedCiclo(null);
                          setIsCreatingNewCiclo(true);
                        }}
                        onBackToExisting={() => setIsCreatingNewCiclo(false)}
                        onNewNameChange={setNewCicloName}
                      />
                    </DrawerSection>
                  )}

                  <DrawerSection
                    icon={ListChecks}
                    tone="brand"
                    title="Qué quieres hacer"
                    hint="Cada operación espera columnas distintas, así que se elige antes de subir el archivo."
                  >
                    <ModeSelector value={mode} onChange={handleModeChange} />
                  </DrawerSection>

                  {/* El rótulo lo pone la sección, no la prop `label` de la
                      zona de carga: los tres grupos del paso —ciclo, operación,
                      archivo— comparten la misma anatomía de `DrawerSection`. */}
                  <DrawerSection
                    icon={FileSpreadsheet}
                    tone="brand"
                    title="Carga de archivo de objetivos"
                    hint={`Formatos aceptados: CSV, XLS y XLSX. Máximo ${OBJECTIVES_IMPORT_MAX_MB} MB.`}
                  >
                    <UploadZone
                      value={files}
                      onChange={(next) => {
                        setFiles(next);
                        setMismatch(null);
                      }}
                      accept={OBJECTIVES_IMPORT_ACCEPT}
                      multiple
                      maxSizeMB={OBJECTIVES_IMPORT_MAX_MB}
                      validate={getImmediateValidationError}
                      idleText="Arrastra el archivo aquí o haz clic para buscarlo"
                      activeText="Suelta el archivo aquí…"
                    />
                  </DrawerSection>

                  {/* Sin nuevo_avance y con "actualizar" elegido, dicho donde se
                      puede arreglar. Sin botón: no hay corrección segura que
                      ofrecer, y las tarjetas de operación están un poco más arriba. */}
                  {mismatch && (
                    <Alert variant="warning" role="status">
                      <AlertTriangle className="size-4" />
                      <AlertDescription>
                        <p className="text-xs font-bold text-text-primary">{mismatch.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-text-secondary">{mismatch.detail}</p>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <UploadsPanel
                  tasks={uploadTasks}
                  cycleName={cycleName}
                  onRetry={retryUpload}
                  onViewDetails={openDetail}
                  onResumePending={handleResumeTask}
                />
              )}
            </div>
          )}

          {step === "summary" && (
            <div
              inert={isBusyQuestion || undefined}
              className={cn("flex min-h-0 flex-1 flex-col gap-4 transition-opacity", isBusyQuestion && "opacity-50")}
            >
              {analysis?.notes && analysis.notes.length > 0 && (
                <Alert variant="info" className="shrink-0">
                  <Info className="size-4" />
                  <AlertDescription className="text-xs">
                    <ul className="space-y-0.5">
                      {analysis.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <ObjectivesReviewTable
                groups={groups}
                // Este paso solo se alcanza tras elegir una operación
                // (`handleAnalyze` corta si `mode` sigue sin elegirse) o al
                // retomar una carga previa, así que en la práctica nunca es
                // null aquí; el respaldo es solo para el tipo.
                mode={mode ?? "crear"}
                candidates={candidates}
                onDelete={(id) => removeObjectives([id])}
                onDeleteMany={removeObjectives}
                onChange={updateObjective}
                onAssignUser={assignUser}
                onConfirmObjective={confirmObjectiveReady}
                onMergeGroups={mergeGroups}
                onRelinkObjective={relinkRow}
                onConfirmingChange={setConfirmingDelete}
                onSelectionChange={setReviewSelection}
              />
            </div>
          )}

          {step === "detail" && detailTask && (
            <UploadDetailPanel
              task={detailTask}
              onBack={() => {
                setDetailTask(null);
                setStep("dropzone");
              }}
              onResume={() => handleResumeTask(detailTask)}
            />
          )}

          {step === "error" && error && (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                title={error.title}
                description={error.detail}
                icon={AlertTriangle}
                className="border-none bg-transparent p-0 shadow-none"
              />
            </div>
          )}

          {step === "empty" && (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                title="No encontramos objetivos"
                description={`Revisa que el archivo tenga las columnas de la plantilla (${modeConfig.columns.slice(0, 4).join(", ")}…) y al menos una fila con datos.`}
                icon={FileSearch}
                className="border-none bg-transparent p-0 shadow-none"
              />
            </div>
          )}

          {/* El estado "la IA está trabajando" del sistema, confinado al panel. */}
          {isAnalyzing && (
            <AiAnalyzingState
              title="Analizando archivos"
              progress={progress}
              detail={getAnalyzingCopy(progress, files.length, findings)}
              caption="Estamos extrayendo y validando la información de tus objetivos."
              className="absolute inset-x-4 inset-y-0 z-[60] min-h-0"
            />
          )}
        </div>
      </DrawerShell>

      {isTrayVisible && (
        <CargaObjetivosWidget
          cycleName={cycleName}
          tasks={uploadTasks}
          parkedReview={
            isMinimized
              ? { readyObjectives, totalObjectives: allObjectives.length, remainingUsers }
              : undefined
          }
          isConfirmingDiscard={isConfirmingTrayCancel}
          onRequestDiscard={() => setConfirmingTrayCancel(true)}
          onCancelDiscard={() => setConfirmingTrayCancel(false)}
          onDiscard={discard}
          onOpenDrawer={() => {
            setConfirmingTrayCancel(false);
            setIsMinimized(false);
            if (uploadTasks.length > 0 && !isMinimized) setTab("cargas");
            onOpenChange(true);
          }}
          onClose={() => {
            setShowTray(false);
            applyTasks(() => []);
          }}
          dodgeRight={dodgeWidget}
        />
      )}
    </>
  );
}
