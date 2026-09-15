import * as React from "react";
import { toast } from "sonner";
import {
  Ban,
  Check,
  Download,
  MessageSquarePlus,
  Paperclip,
  Pencil,
  RotateCcw,
  Trash2,
  TrendingUp,
  Wrench,
  X,
} from "lucide-react";
import {
  AnimatedActionItem,
  ConfirmActionPopover,
  DrawerActionRail,
  DrawerRailButton,
  RailSelectionChip,
  railButtonClass,
  useContextChangeKey,
} from "@/components/action-rail";
import { RailOrientationContext } from "@/components/action-rail/railOrientation";
import { UbitsTabs } from "@/components/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFillHeight } from "@/lib/useFillHeight";
import { DrawerShell } from "@/components/overlays";
import { formatPercent, type CicloDetailData } from "@/components/ciclo-detail";
import type { ObjetivoEstadoConfig } from "@/components/objetivos/objetivosConfigStore";
import { LIFECYCLE_META, editIntentOf } from "./objectiveLifecycle";
import { PersonImpactCanvas, ImpactLegend } from "./PersonImpactCanvas";
import {
  PERSON_OBJECTIVES_COLUMNS,
  PersonObjectivesTable,
} from "./PersonObjectivesTable";
import { TableConfigButton, useTableConfig } from "@/components/data-display/table-config";
import {
  DenyObjectiveDialog,
  UpdateProgressDialog,
  type ObjectivePatch,
  type ProgressInput,
} from "./PersonObjectiveDialogs";
import { PersonSummaryStrip } from "./PersonSummaryStrip";
import { ResultsDetailCard } from "./ResultsDetailCard";
import { buildPersonImpactGraph, type ImpactGraph } from "./personImpactGraph";
import type { ThreadPost } from "./ObjectiveThread";
import type { PersonResultRow } from "./resultsModel";

/**
 * La ficha ancha de una persona en los resultados del ciclo.
 *
 * Arriba, una franja con tres lecturas —cómo va, qué lleva, a qué empuja— que
 * ocupa lo que mide y no la altura de la ventana. Debajo, dos pestañas sobre
 * lo mismo, ya a todo el ancho: "Objetivos" es la tabla de lo que carga, una
 * fila por objetivo con su hilo a un clic; "Mapa de impacto" es el mismo
 * lienzo del paso de alineación del constructor, recortado a ella. Y al pie,
 * la barra flotante del drawer con lo que se le puede hacer a un objetivo
 * —actualizar su avance, editarlo, comentarlo, inactivarlo, eliminarlo—, que
 * actúa sobre lo que la tabla tenga marcado, igual que en el resto de las
 * tablas del módulo.
 *
 * El ancho es a propósito: la ficha angosta apilaba tarjetas de dos pantallas
 * para cinco objetivos y no dejaba sitio a un mapa que se leyera. Aquí la
 * tabla cabe en una línea por objetivo y el mapa tiene el aire del canvas
 * original.
 *
 * Y se lee con la gramática del reporte, no con una propia: las tarjetas de la
 * izquierda son las mismas con las que el resumen lee un indicador, y lo de la
 * derecha vive en la misma tarjeta de detalle que sostiene las tablas de las
 * cinco pestañas. Abrir a una persona es bajar una altura en el mismo reporte,
 * no entrar a otra pantalla.
 */

type PersonSheetTab = "objetivos" | "mapa";

/** Las dos preguntas de sí o no que la barra puede hacer. */
type PendingKind = "inactivar" | "reactivar" | "eliminar";

interface PendingAction {
  kind: PendingKind;
  ids: readonly string[];
}

/** Qué formulario está abierto. Editar y ajustar no están aquí: esos no abren
 *  una caja, convierten la fila de la tabla en el formulario. */
type OpenForm = "avance" | "comentar" | null;

/**
 * El objetivo que se está editando dentro de la tabla, y con qué consecuencia:
 * "editar" solo guarda el texto; "ajustar" además lo reenvía a "Por aprobar",
 * que es lo que destraba un objetivo devuelto por su líder.
 */
interface InlineEdit {
  id: string;
  mode: "editar" | "ajustar";
}

export function PersonImpactSheet({
  row,
  data,
  showsRisk,
  estados,
  open,
  onOpenChange,
  onSetInactivation,
  onPost,
  onUpdateProgress,
  onEditObjective,
  onDeleteObjectives,
  onApprove,
  onDeny,
  onResubmit,
  onAdjustObjective,
  onEditCicloObjectives,
}: {
  row: PersonResultRow | null;
  /** El ciclo completo: el norte de la empresa y las asignaciones, para el mapa. */
  data: CicloDetailData;
  showsRisk: boolean;
  /** Las bandas de cumplimiento del ciclo, para el desglose de la izquierda. */
  estados: readonly ObjetivoEstadoConfig[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Inactiva (`true`) o reactiva (`false`) objetivos de esta persona, uno o
   * varios a la vez. Opcional: sin ella la tabla se ve igual pero sin acciones.
   */
  onSetInactivation?: (objectiveIds: readonly string[], inactive: boolean) => void;
  /** Publica un mensaje en el hilo de uno de sus objetivos. */
  onPost?: (objectiveId: string, post: ThreadPost) => void;
  /** Reporta un avance: mueve el valor del objetivo y lo deja en su hilo. */
  onUpdateProgress?: (objectiveId: string, input: ProgressInput) => void;
  /** Corrige cómo está escrito el objetivo, sin tocar su avance. */
  onEditObjective?: (objectiveId: string, patch: ObjectivePatch) => void;
  /** Saca objetivos del ciclo de esta persona. No tiene vuelta atrás. */
  onDeleteObjectives?: (objectiveIds: readonly string[]) => void;
  /** Aprueba objetivos "Por aprobar", uno o varios a la vez. */
  onApprove?: (objectiveIds: readonly string[]) => void;
  /** Deniega objetivos "Por aprobar": vuelven a "Por ajustar" con el motivo. */
  onDeny?: (objectiveIds: readonly string[], reason: string) => void;
  /** Reenvía objetivos "Por ajustar" a "Por aprobar", sin editarlos. */
  onResubmit?: (objectiveIds: readonly string[]) => void;
  /** El botón "Ajustar": corrige un objetivo "Por ajustar" y lo reenvía. */
  onAdjustObjective?: (objectiveId: string, patch: ObjectivePatch) => void;
  /** El "Editar" global, sin selección: abre el constructor del ciclo en el
   *  paso de objetivos para corregir o agregar los de este colaborador. */
  onEditCicloObjectives?: () => void;
}) {
  const [tab, setTab] = React.useState<PersonSheetTab>("objetivos");

  // La configuración de la tabla de objetivos vive aquí porque su botón se
  // sienta en la cabecera de la tarjeta, junto al resto de los controles, y no
  // dentro de la tabla.
  const objectivesConfig = useTableConfig(
    "ciclo-resultados-objetivos-persona",
    PERSON_OBJECTIVES_COLUMNS
  );
  const [selectedIds, setSelectedIds] = React.useState<ReadonlySet<string>>(() => new Set());
  const [pending, setPending] = React.useState<PendingAction | null>(null);
  const [form, setForm] = React.useState<OpenForm>(null);
  /** Objetivos a denegar: el motivo se pide en su propio diálogo, no en el
   *  `ConfirmDialog` genérico de sí/no. */
  const [denyIds, setDenyIds] = React.useState<readonly string[] | null>(null);
  const [editing, setEditing] = React.useState<InlineEdit | null>(null);

  // Cada apertura arranca limpia: en "Objetivos", sin nada marcado. Abrir la
  // ficha de Sofía con la selección de Andrés puesta sería actuar sobre un
  // fantasma. Se reinicia durante el render —comparando con la apertura
  // anterior— y no en un efecto, que pintaría un frame con el estado viejo.
  const openingKey = open ? row?.person.id ?? null : null;
  const [seenOpeningKey, setSeenOpeningKey] = React.useState(openingKey);
  if (seenOpeningKey !== openingKey) {
    setSeenOpeningKey(openingKey);
    if (openingKey !== null) {
      setTab("objetivos");
      setSelectedIds(new Set());
      setPending(null);
      setForm(null);
      setDenyIds(null);
      setEditing(null);
    }
  }

  const graph = React.useMemo(() => (row ? buildPersonImpactGraph(row, data) : null), [row, data]);

  const selectedEntries = React.useMemo(
    () => (row ? row.entries.filter((entry) => selectedIds.has(entry.objective.id)) : []),
    [row, selectedIds]
  );
  const selectedActive = selectedEntries.filter((entry) => entry.inactivation === null);
  const selectedInactive = selectedEntries.filter((entry) => entry.inactivation !== null);
  /** De lo activo marcado, lo que de verdad se puede inactivar: un objetivo
   *  que ni siquiera tiene el visto bueno del líder no está "en juego"
   *  todavía, así que inactivarlo no significa nada — lo suyo es denegarlo o
   *  eliminarlo, no congelarlo. */
  const selectedActiveCommitted = selectedActive.filter(
    (entry) => LIFECYCLE_META[entry.lifecycle].isCommitted
  );

  /** Lo único marcado, cuando hay exactamente uno. Actualizar y editar lo piden. */
  const single = selectedEntries.length === 1 ? selectedEntries[0] : null;

  /**
   * El botón final de la barra —y algunas de las acciones fijas— cambian con
   * lo que hay marcado, no solo con su cantidad: cada tramo del flujo puede
   * hacer cosas distintas, y mostrar la misma barra para los cinco sería
   * ofrecer botones que no significan nada.
   *
   *   - Inactivo: lo único que tiene sentido es reactivarlo. Actualizar,
   *     editar, aprobar o denegar un objetivo que no cuenta hoy no dice nada
   *     hasta que vuelva a estar activo.
   *   - Por aprobar: la decisión del líder manda — aprobar o denegar.
   *   - Por ajustar (denegado): lo único que lo destraba es corregirlo y
   *     reenviarlo.
   *   - Cualquier otro (por iniciar, en progreso, completado): el objetivo ya
   *     está en juego, así que reportar avance vuelve a ser lo normal.
   *
   * Solo se activa cuando *toda* la selección comparte el mismo tramo — una
   * mezcla cae al botón de siempre, deshabilitado salvo que quede uno solo
   * marcado, igual que Editar. Inactivo se revisa primero: un objetivo
   * congelado que además esté sin aprobar sigue sin poder hacer nada más que
   * reactivarse.
   */
  const allSelectedInactive =
    selectedEntries.length > 0 && selectedEntries.every((entry) => entry.inactivation !== null);
  const allSelectedPorAprobar =
    selectedEntries.length > 0 && selectedEntries.every((entry) => entry.lifecycle === "por-aprobar");
  const allSelectedPorAjustar =
    selectedEntries.length > 0 && selectedEntries.every((entry) => entry.lifecycle === "por-ajustar");
  const railBranch: "inactivo" | "aprobar" | "ajustar" | "normal" = allSelectedInactive
    ? "inactivo"
    : allSelectedPorAprobar
      ? "aprobar"
      : allSelectedPorAjustar
        ? "ajustar"
        : "normal";

  /** Simulado a propósito: no hay backend de reportes detrás de esta ficha. */
  const downloadObjectives = (ids: readonly string[]) =>
    toast.success(
      ids.length === 1 ? "Descargando el objetivo…" : `Descargando ${ids.length} objetivos…`
    );

  // Igual que en el home: el grupo de acciones que depende de la selección
  // entra con animación al marcar el primer objetivo, en vez de quedarse
  // siempre montado y apagado. `animKey` cambia solo al cruzar de "nada
  // marcado" a "algo marcado" (o viceversa), así el stagger no se repite en
  // cada clic dentro del mismo estado.
  const railMode = selectedIds.size === 0 ? "none" : "selected";
  const railAnimKey = useContextChangeKey(railMode);

  const forget = (ids: readonly string[]) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => next.delete(id));
      return next;
    });

  const confirmPending = () => {
    if (!pending) return;
    const count = pending.ids.length;

    if (pending.kind === "eliminar") {
      onDeleteObjectives?.(pending.ids);
      toast.success(
        count === 1 ? "Objetivo eliminado del ciclo" : `${count} objetivos eliminados del ciclo`
      );
    } else {
      onSetInactivation?.(pending.ids, pending.kind === "inactivar");
      toast.success(
        pending.kind === "inactivar"
          ? `${count === 1 ? "Objetivo inactivado" : `${count} objetivos inactivados`}: ya no cuenta${count === 1 ? "" : "n"} en el ponderado`
          : `${count === 1 ? "Objetivo activado" : `${count} objetivos activados`}: vuelve${count === 1 ? "" : "n"} a contar en el ponderado`
      );
    }

    forget(pending.ids);
    setPending(null);
  };

  const pendingCount = pending?.ids.length ?? 0;
  const pendingPercent =
    pending && pendingCount === 1
      ? row?.entries.find((entry) => entry.objective.id === pending.ids[0])?.percent ?? null
      : null;

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title={row?.collaborator.name ?? "Colaborador"}
      description={row ? `${row.area} · ${row.leader} · ${row.groupLabel}` : undefined}
      size="6xl"
      // Con piso en 64rem: es lo que necesita la tabla de objetivos en una
      // línea por fila junto a la columna de resumen. `!bg-background` para
      // que el hueco entre el header y el cuerpo no se lea como una franja.
      className="!w-[82vw] !max-w-[92rem] !min-w-[64rem] gap-0 !bg-background"
      disablePadding
      footer={
        row ? (
          <DrawerActionRail
            keepOpen={selectedIds.size > 0}
            tools={
              selectedIds.size > 0 ? (
                // La barra del drawer siempre está tumbada; el chip, fuera de
                // un shell, leería la preferencia de la barra de la pantalla.
                <RailOrientationContext.Provider value="horizontal">
                  <AnimatedActionItem animKey={railAnimKey} staggerIndex={0} skipColorFlash>
                    <RailSelectionChip
                      count={selectedIds.size}
                      gender="m"
                      onClear={() => setSelectedIds(new Set())}
                    />
                  </AnimatedActionItem>
                </RailOrientationContext.Provider>
              ) : null
            }
            actions={
              selectedIds.size === 0 ? (
                // Sin nada marcado, la barra ofrece dos acciones sobre el
                // colaborador entero en vez de sobre una fila: corregir sus
                // objetivos desde el constructor, o exportar todos de una vez.
                <>
                  <AnimatedActionItem animKey={railAnimKey} staggerIndex={1}>
                    <DrawerRailButton
                      icon={Pencil}
                      iconOnly
                      label="Editar los objetivos de este colaborador"
                      disabled={!onEditCicloObjectives}
                      onClick={() => onEditCicloObjectives?.()}
                    />
                  </AnimatedActionItem>
                  <AnimatedActionItem animKey={railAnimKey} staggerIndex={2}>
                    <DrawerRailButton
                      icon={Download}
                      iconOnly
                      label="Descargar todos sus objetivos"
                      onClick={() => downloadObjectives(row.entries.map((entry) => entry.objective.id))}
                    />
                  </AnimatedActionItem>
                </>
              ) : (
                <>
                  <AnimatedActionItem animKey={railAnimKey} staggerIndex={1}>
                    <ConfirmActionPopover
                      open={pending?.kind === "eliminar"}
                      onOpenChange={(next) => {
                        if (!next) setPending(null);
                      }}
                      trigger={
                        <button
                          type="button"
                          aria-label={
                            selectedIds.size > 1 ? `Eliminar (${selectedIds.size})` : "Eliminar"
                          }
                          disabled={!onDeleteObjectives}
                          onClick={() =>
                            setPending({
                              kind: "eliminar",
                              ids: selectedEntries.map((entry) => entry.objective.id),
                            })
                          }
                          className={railButtonClass("danger", true)}
                        >
                          <Trash2 className="size-4" strokeWidth={2.2} />
                        </button>
                      }
                      title={confirmTitle(pending?.kind, pendingCount)}
                      description={confirmDescription(pending?.kind, pendingCount, pendingPercent)}
                      confirmLabel="Eliminar"
                      tone="destructive"
                      onConfirm={confirmPending}
                    />
                  </AnimatedActionItem>

                  {/* Se cae del todo en tres casos: en la rama "inactivo"
                      reactivar ya es el botón final de abajo, y en "por
                      aprobar"/"por ajustar" no hay nada que inactivar todavía
                      —ninguno de los dos está en juego— así que el botón no
                      aparece en vez de quedarse ahí siempre apagado. */}
                  {railBranch !== "inactivo" &&
                    (selectedInactive.length > 0 || selectedActiveCommitted.length > 0) && (
                    <AnimatedActionItem animKey={railAnimKey} staggerIndex={2}>
                      {selectedInactive.length > 0 ? (
                        <ConfirmActionPopover
                          open={pending?.kind === "reactivar"}
                          onOpenChange={(next) => {
                            if (!next) setPending(null);
                          }}
                          trigger={
                            <button
                              type="button"
                              aria-label={`Activar (${selectedInactive.length})`}
                              disabled={!onSetInactivation}
                              onClick={() =>
                                setPending({
                                  kind: "reactivar",
                                  ids: selectedInactive.map((entry) => entry.objective.id),
                                })
                              }
                              className={railButtonClass("ghost", true)}
                            >
                              <RotateCcw className="size-4" strokeWidth={2.2} />
                            </button>
                          }
                          title={confirmTitle(pending?.kind, pendingCount)}
                          description={confirmDescription(pending?.kind, pendingCount, pendingPercent)}
                          confirmLabel="Activar"
                          tone="primary"
                          onConfirm={confirmPending}
                        />
                      ) : (
                        <ConfirmActionPopover
                          open={pending?.kind === "inactivar"}
                          onOpenChange={(next) => {
                            if (!next) setPending(null);
                          }}
                          trigger={
                            <button
                              type="button"
                              aria-label={
                                selectedActiveCommitted.length > 1
                                  ? `Inactivar (${selectedActiveCommitted.length})`
                                  : "Inactivar"
                              }
                              disabled={!onSetInactivation || selectedActiveCommitted.length === 0}
                              onClick={() =>
                                setPending({
                                  kind: "inactivar",
                                  ids: selectedActiveCommitted.map((entry) => entry.objective.id),
                                })
                              }
                              className={railButtonClass("ghost", true)}
                            >
                              <Ban className="size-4" strokeWidth={2.2} />
                            </button>
                          }
                          title={confirmTitle(pending?.kind, pendingCount)}
                          description={confirmDescription(pending?.kind, pendingCount, pendingPercent)}
                          confirmLabel="Inactivar"
                          tone="warning"
                          onConfirm={confirmPending}
                        />
                      )}
                    </AnimatedActionItem>
                  )}

                  {/* Se cae en "por ajustar" —"Ajustar" ya es el único
                      camino para corregirlo ahí abajo— y en "inactivo" —nada
                      que corregir en un objetivo que no está en juego—, en
                      vez de quedarse siempre montado y apagado. */}
                  {/* También se cae con varios marcados: Editar corrige un
                      objetivo a la vez, así que con más de uno no hay nada
                      seguro que hacer con este botón todavía. */}
                  {railBranch !== "ajustar" && railBranch !== "inactivo" && single !== null && (
                    <AnimatedActionItem animKey={railAnimKey} staggerIndex={3}>
                      <DrawerRailButton
                        icon={Pencil}
                        iconOnly
                        label="Editar"
                        disabled={!onEditObjective}
                        onClick={() => setEditing({ id: single.objective.id, mode: "editar" })}
                      />
                    </AnimatedActionItem>
                  )}

                  <AnimatedActionItem animKey={railAnimKey} staggerIndex={4}>
                    <DrawerRailButton
                      icon={Download}
                      iconOnly
                      label={selectedIds.size > 1 ? `Descargar (${selectedIds.size})` : "Descargar"}
                      onClick={() =>
                        downloadObjectives(selectedEntries.map((entry) => entry.objective.id))
                      }
                    />
                  </AnimatedActionItem>

                  {/* Comentar solo aplica a un objetivo que ya está en juego:
                      "por aprobar" y "por ajustar" todavía no tienen avance
                      que discutir, y uno inactivo dejó de contar. Se cae en
                      vez de ofrecer un hilo sobre algo que no está corriendo. */}
                  {railBranch === "normal" && (
                    <AnimatedActionItem animKey={railAnimKey} staggerIndex={5}>
                      <CommentPopover
                        open={form === "comentar"}
                        onOpenChange={(next) => setForm(next ? "comentar" : null)}
                        count={selectedEntries.length}
                        trigger={
                          <button
                            type="button"
                            disabled={!onPost}
                            onClick={() => setForm("comentar")}
                            className={railButtonClass("ghost", false)}
                          >
                            <MessageSquarePlus className="size-4" strokeWidth={2.2} />
                            {selectedIds.size > 1 ? `Comentar (${selectedIds.size})` : "Crear comentario"}
                          </button>
                        }
                        onSubmit={({ comment, files }) => {
                          if (!onPost) return;
                          selectedEntries.forEach((entry) =>
                            onPost(entry.objective.id, { comment, files, replyTo: null })
                          );
                          toast.success(
                            selectedEntries.length === 1
                              ? "Comentario publicado en el hilo"
                              : `Comentario publicado en ${selectedEntries.length} hilos`
                          );
                          setForm(null);
                        }}
                      />
                    </AnimatedActionItem>
                  )}

                  {/* El botón final: qué hacer con el avance de lo marcado.
                      Cambia de forma con el ciclo de vida de la selección, no
                      solo de estado — "Actualizar avance" no aplica a un
                      objetivo que todavía espera permiso para arrancar. */}
                  {railBranch === "inactivo" ? (
                    <AnimatedActionItem animKey={railAnimKey} staggerIndex={6}>
                      <ConfirmActionPopover
                        open={pending?.kind === "reactivar"}
                        onOpenChange={(next) => {
                          if (!next) setPending(null);
                        }}
                        trigger={
                          <button
                            type="button"
                            disabled={!onSetInactivation}
                            onClick={() =>
                              setPending({
                                kind: "reactivar",
                                ids: selectedEntries.map((entry) => entry.objective.id),
                              })
                            }
                            className={railButtonClass("primary", false)}
                          >
                            <RotateCcw className="size-4" strokeWidth={2.2} />
                            {selectedIds.size > 1 ? `Activar (${selectedIds.size})` : "Activar"}
                          </button>
                        }
                        title={confirmTitle(pending?.kind, pendingCount)}
                        description={confirmDescription(pending?.kind, pendingCount, pendingPercent)}
                        confirmLabel="Activar"
                        tone="primary"
                        onConfirm={confirmPending}
                      />
                    </AnimatedActionItem>
                  ) : railBranch === "aprobar" ? (
                    <>
                      <AnimatedActionItem animKey={railAnimKey} staggerIndex={6}>
                        <DrawerRailButton
                          icon={Check}
                          variant="primary"
                          label={selectedIds.size > 1 ? `Aprobar (${selectedIds.size})` : "Aprobar"}
                          disabled={!onApprove}
                          onClick={() => {
                            const ids = selectedEntries.map((entry) => entry.objective.id);
                            onApprove?.(ids);
                            toast.success(
                              ids.length > 1 ? `${ids.length} objetivos aprobados` : "Objetivo aprobado"
                            );
                            forget(ids);
                          }}
                        />
                      </AnimatedActionItem>
                      <AnimatedActionItem animKey={railAnimKey} staggerIndex={7}>
                        <DrawerRailButton
                          icon={X}
                          variant="danger"
                          label={selectedIds.size > 1 ? `Denegar (${selectedIds.size})` : "Denegar"}
                          disabled={!onDeny}
                          onClick={() => setDenyIds(selectedEntries.map((entry) => entry.objective.id))}
                        />
                      </AnimatedActionItem>
                    </>
                  ) : railBranch === "ajustar" ? (
                    <AnimatedActionItem animKey={railAnimKey} staggerIndex={6}>
                      <DrawerRailButton
                        icon={Wrench}
                        variant="primary"
                        label={single ? "Ajustar" : `Reenviar (${selectedIds.size})`}
                        disabled={single ? !onAdjustObjective : !onResubmit}
                        onClick={() => {
                          if (single) {
                            setEditing({ id: single.objective.id, mode: "ajustar" });
                            return;
                          }
                          const ids = selectedEntries.map((entry) => entry.objective.id);
                          onResubmit?.(ids);
                          toast.success(`${ids.length} objetivos reenviados a "Por aprobar"`);
                          forget(ids);
                        }}
                      />
                    </AnimatedActionItem>
                  ) : (
                    // Con varios marcados no hay un valor único que reportar,
                    // así que el botón se cae en vez de quedarse apagado:
                    // "Actualizar avance" solo tiene sentido de a uno.
                    single && (
                      <AnimatedActionItem animKey={railAnimKey} staggerIndex={6}>
                        <DrawerRailButton
                          icon={TrendingUp}
                          variant="primary"
                          label="Actualizar avance"
                          disabled={!onUpdateProgress}
                          onClick={() => setForm("avance")}
                        />
                      </AnimatedActionItem>
                    )
                  )}
                </>
              )
            }
          />
        ) : undefined
      }
    >
      {row && graph && (
        <div className="flex min-h-0 flex-1 flex-col bg-background">
          {/* La franja y las pestañas comparten bloque y una sola divisoria:
              son la cabecera de la ficha, y quedarse quietas arriba es lo que
              deja bajar por una tabla larga sin perder ni el contexto ni la
              navegación. */}
          <div className="flex shrink-0 flex-col gap-3 border-b border-border/60 bg-background px-4 pb-3 pt-4">
            <PersonSummaryStrip
              row={row}
              companyObjectives={data.companyObjectives}
              estados={estados}
              showsRisk={showsRisk}
            />
            <UbitsTabs
              tabs={[
                { id: "objetivos", label: "Objetivos", badge: row.entries.length },
                { id: "mapa", label: "Mapa de impacto" },
              ]}
              activeTabId={tab}
              onTabChange={(id) => setTab(id as PersonSheetTab)}
              fitContent
              className="mb-0"
            />
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">

            <div
              key={tab}
              className="cascade-enter flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
            >
              {tab === "objetivos" ? (
                <ResultsDetailCard
                  title="Sus objetivos"
                  count={row.entries.length}
                  controls={
                    <>
                      <p className="text-[11.5px] text-text-muted">
                        {row.reportedCount} de {row.entries.length} con avance reportado
                      </p>
                      {/* Sin el selector de modo: esta tabla nunca paginó —es
                          la lista de una sola persona— y va siempre de
                          corrido. Lo que sí ofrece es elegir columnas. */}
                      <TableConfigButton
                        config={objectivesConfig}
                        noun="objetivos"
                        showRowsMode={false}
                      />
                    </>
                  }
                >
                  <PersonObjectivesTable
                    config={objectivesConfig}
                    entries={row.entries}
                    companyObjectives={data.companyObjectives}
                    estados={estados}
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                    onPost={onPost}
                    editingId={editing?.id ?? null}
                    onRequestEdit={(objectiveId) => {
                      const target = row.entries.find(
                        (item) => item.objective.id === objectiveId
                      );
                      const intent = target ? editIntentOf(target) : null;
                      if (!intent) return;
                      // El lápiz de la fila abre la edición que corresponda a
                      // ese objetivo, no la de lo que hubiera marcado antes.
                      setSelectedIds(new Set([objectiveId]));
                      setEditing({ id: objectiveId, mode: intent });
                    }}
                    editSubmitLabel={
                      editing?.mode === "ajustar" ? "Guardar y reenviar" : "Guardar"
                    }
                    onCancelEdit={() => setEditing(null)}
                    onSaveEdit={(objectiveId, patch) => {
                      if (editing?.mode === "ajustar") {
                        onAdjustObjective?.(objectiveId, patch);
                        toast.success('Objetivo ajustado y reenviado a "Por aprobar"');
                        forget([objectiveId]);
                      } else {
                        onEditObjective?.(objectiveId, patch);
                        toast.success("Objetivo actualizado");
                      }
                      setEditing(null);
                    }}
                  />
                </ResultsDetailCard>
              ) : (
                <ResultsDetailCard
                  title="Mapa de impacto"
                  controls={<ImpactLegend />}
                >
                  <FillingCanvas graph={graph} fitKey={`${row.person.id}:${graph.nodes.length}`} />
                  <p className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] font-medium text-text-muted">
                    <span>De dónde le llegan sus metas y a qué objetivo de la empresa empuja cada una</span>
                    <span>Rueda para acercar · arrastra el fondo para moverte</span>
                    <span>Clic en una tarjeta para aislar sus conexiones</span>
                  </p>
                </ResultsDetailCard>
              )}
            </div>
          </div>
        </div>
      )}

      {single && onUpdateProgress && (
        <UpdateProgressDialog
          key={`avance:${single.objective.id}`}
          entry={single}
          open={form === "avance"}
          onOpenChange={(isOpen) => setForm(isOpen ? "avance" : null)}
          onSubmit={(input) => {
            onUpdateProgress(single.objective.id, input);
            toast.success("Avance actualizado y publicado en el hilo");
            setForm(null);
            forget([single.objective.id]);
          }}
        />
      )}

      {onDeny && (
        <DenyObjectiveDialog
          count={denyIds?.length ?? 0}
          open={denyIds !== null}
          onOpenChange={(isOpen) => {
            if (!isOpen) setDenyIds(null);
          }}
          onSubmit={(reason) => {
            if (!denyIds) return;
            onDeny(denyIds, reason);
            toast.success(
              denyIds.length === 1 ? "Objetivo denegado" : `${denyIds.length} objetivos denegados`
            );
            forget(denyIds);
            setDenyIds(null);
          }}
        />
      )}
    </DrawerShell>
  );
}

/**
 * El lienzo con el alto que le queda al panel, sea cual sea la pantalla.
 *
 * `useFillHeight` mide lo que el lienzo tiene encima y lo que la tarjeta lleva
 * debajo, en vez de descontar un alto fijo: una constante acierta en el
 * monitor donde se escribió y en los demás deja media pantalla en blanco o
 * —peor— empuja la pestaña fuera del panel, y con la rueda haciendo zoom
 * sobre el mapa, recuperar el scroll es una pelea.
 *
 * Vive en su propio componente y no en la ficha porque el medidor tiene que
 * correr cuando el lienzo existe: montado en la ficha, se ejecutaba con la
 * pestaña de objetivos delante y no encontraba nada que medir.
 */
function FillingCanvas({ graph, fitKey }: { graph: ImpactGraph; fitKey: string }) {
  const boxRef = React.useRef<HTMLDivElement>(null);
  // El piso es bajo a propósito: `useFillHeight` se rinde y devuelve
  // `undefined` cuando no queda ni ese mínimo, y rendirse trae de vuelta el
  // scroll que sobraba. Un mapa de 180 px en una ventana baja se sigue leyendo
  // —se encuadra solo—; media pestaña fuera del panel, no.
  const height = useFillHeight(boxRef, 180);

  return (
    <div ref={boxRef} style={{ height }} className="min-h-[11rem]">
      {/* El alto entra en la llave del encuadre: al crecer o encoger la caja,
          el mapa se vuelve a centrar en vez de quedarse en la escala vieja. */}
      <PersonImpactCanvas graph={graph} fitKey={`${fitKey}:${height ?? 0}`} />
    </div>
  );
}

// ── Popovers de la barra ────────────────────────────────────────────────────

/**
 * Crear comentario, en el mismo lenguaje: un popover anclado al botón, no un
 * `ModalShell` con velo. El mensaje y el adjunto caben de sobra en una caja
 * flotante, y abrirla no tiene por qué apagar el resto de la pantalla para
 * escribir una línea.
 */
function CommentPopover({
  open,
  onOpenChange,
  trigger,
  count,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
  /** A cuántos objetivos va el mensaje. */
  count: number;
  onSubmit: (input: { comment: string; files: readonly File[] }) => void;
}) {
  const [comment, setComment] = React.useState("");
  const [files, setFiles] = React.useState<readonly File[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Cada apertura arranca en blanco: el mensaje de la vez anterior ya se
  // publicó o se descartó, no hay nada que recuperar.
  const seenOpen = React.useRef(open);
  if (seenOpen.current !== open) {
    seenOpen.current = open;
    if (open) {
      setComment("");
      setFiles([]);
    }
  }

  const canSend = comment.trim() !== "" || files.length > 0;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={10}
        className="w-96 flex-col gap-0 rounded-2xl border border-white/10 bg-surface-nav p-3.5 text-white shadow-rail"
      >
        <p className="text-[13px] font-semibold">
          {count === 1 ? "Crear comentario" : `Comentar ${count} objetivos`}
        </p>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={3}
          placeholder="Escribe un mensaje o pide un soporte…"
          autoFocus
          className="mt-2.5 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
        />

        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            const picked = Array.from(event.target.files ?? []);
            if (picked.length > 0) setFiles((current) => [...current, ...picked]);
            // El mismo archivo dos veces seguidas no dispara `change` si el
            // input se queda con su valor.
            event.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-2 flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Paperclip className="size-3.5" />
          Adjuntar evidencia
        </button>

        {files.length > 0 && (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[11px] text-white/80"
              >
                <span className="max-w-[10rem] truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setFiles((current) => current.filter((_, at) => at !== index))}
                  aria-label={`Quitar ${file.name}`}
                  className="text-white/50 hover:text-white"
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canSend}
            onClick={() => onSubmit({ comment: comment.trim(), files })}
            className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-40"
          >
            Publicar
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Textos ─────────────────────────────────────────────────────────────────

function confirmTitle(kind: PendingKind | undefined, count: number): string {
  const many = count !== 1;
  if (kind === "reactivar") return many ? `¿Activar ${count} objetivos?` : "¿Activar este objetivo?";
  if (kind === "eliminar") return many ? `¿Eliminar ${count} objetivos?` : "¿Eliminar este objetivo?";
  return many ? `¿Inactivar ${count} objetivos?` : "¿Inactivar este objetivo?";
}

function confirmDescription(
  kind: PendingKind | undefined,
  count: number,
  percent: number | null
): string {
  const many = count !== 1;

  if (kind === "reactivar") {
    return many
      ? "Vuelven a contar en el peso y en el promedio ponderado de esta persona."
      : "Vuelve a contar en el peso y en el promedio ponderado de esta persona.";
  }

  // Eliminar no es inactivar: lo que se va se lleva por delante su hilo, sus
  // evidencias y lo que llevaba reportado. Decirlo es lo único que separa las
  // dos preguntas, porque el diálogo se ve igual.
  if (kind === "eliminar") {
    return many
      ? `Salen del ciclo de esta persona con su avance, su hilo y sus evidencias. Si lo que quieres es que dejen de contar sin perder nada, inactívalos.`
      : "Sale del ciclo de esta persona con su avance, su hilo y sus evidencias. Si lo que quieres es que deje de contar sin perder nada, inactívalo.";
  }

  if (many) {
    return "Dejan de contar en el peso y en el promedio ponderado de esta persona. El avance que cada uno lleva queda registrado.";
  }
  return `Deja de contar en el peso y en el promedio ponderado de esta persona.${
    percent !== null ? ` Su avance actual (${formatPercent(percent)}) queda registrado.` : ""
  }`;
}
