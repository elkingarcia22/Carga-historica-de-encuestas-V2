import * as React from "react";
import { AlertTriangle, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { ObjectiveGroupHeader } from "./ObjectiveGroupHeader";
import { ObjectiveReviewRow } from "./ObjectiveReviewRow";
import type { PendingQuestion } from "./reviewTabs";
import {
  bucketForGroup,
  describeGroupWeight,
  groupAllRowsConfirmed,
  groupDisplayName,
  groupTargetedIds,
  groupUntouchedObjectives,
  validateObjective,
  validateProgressUpdate,
  type ObjectiveUserGroup,
  type ParsedObjective,
  type RosterUser,
} from "@/lib/objectivesImport";

/**
 * Anchos de columna, compartidos por todas las tarjetas para que se alineen
 * entre sí. `table-fixed` más un colgroup explícito es lo que las mantiene al
 * paso. Una carga de avances tiene su propio juego, más corto: ocho de los once
 * campos que mostraría son campos que esa carga no puede escribir.
 */
const TableColumns: React.FC<{ isProgressLoad: boolean }> = ({ isProgressLoad }) =>
  isProgressLoad ? (
    <colgroup>
      <col style={{ width: 34 }} />
      <col style={{ width: 300 }} />
      <col style={{ width: 128 }} />
      <col style={{ width: 112 }} />
      <col style={{ width: 92 }} />
      <col style={{ width: 92 }} />
      <col style={{ width: 104 }} />
      <col style={{ width: 104 }} />
      <col style={{ width: 100 }} />
      <col style={{ width: 74 }} />
    </colgroup>
  ) : (
    <colgroup>
      <col style={{ width: 34 }} />
      <col style={{ width: 268 }} />
      <col style={{ width: 128 }} />
      <col style={{ width: 112 }} />
      <col style={{ width: 88 }} />
      <col style={{ width: 88 }} />
      <col style={{ width: 80 }} />
      <col style={{ width: 80 }} />
      <col style={{ width: 68 }} />
      <col style={{ width: 74 }} />
    </colgroup>
  );

const COLUMN_COUNT = 10;

const HeadCell: React.FC<{ children: React.ReactNode; align?: "right" | "center"; title?: string }> = ({
  children,
  align,
  title,
}) => (
  <th
    scope="col"
    title={title}
    className={cn("px-2 py-2", align === "right" && "text-right", align === "center" && "text-center")}
  >
    {children}
  </th>
);

export interface ReviewGroupCardProps {
  /** Su puesto en la lista visible (1-based), para el chip numerado de la cabecera. */
  position: number;
  group: ObjectiveUserGroup;
  /** Las filas del archivo que pasan los filtros. */
  objectives: ParsedObjective[];
  isProgressLoad: boolean;
  isEditLoad: boolean;
  candidates: RosterUser[];
  isDuplicate: boolean;
  isCollapsed: boolean;
  onToggle: () => void;
  pendingQuestion: PendingQuestion | null;
  onPendingQuestionChange: (next: PendingQuestion | null) => void;
  /** El grupo con el que se unificaría, resuelto por la tabla. */
  mergeTarget?: ObjectiveUserGroup;
  findGroupFor: (username: string) => ObjectiveUserGroup | undefined;
  onDelete: (id: string) => void;
  onDeleteMany: (ids: string[]) => void;
  onChange: (id: string, patch: Partial<ParsedObjective>) => void;
  onAssignUser: (user: RosterUser | null) => void;
  /** El "Guardar ajustes" de una fila puntual, no de la tarjeta entera. */
  onConfirmObjective: (objectiveId: string) => void;
  onMerge: (targetIdentifier: string) => void;
  onRelinkObjective?: (objectiveId: string, targetId: string | null) => void;
  /**
   * Selección para acciones masivas. Marca la tarjeta entera —todo lo que
   * pasa los filtros— con un solo clic; qué significa "todo" para el resto
   * de la fila (el grupo, o cada objetivo) lo decide `selectedRowIds`.
   */
  isSelected: boolean;
  isSelectedIndeterminate: boolean;
  onToggleSelected: () => void;
  /** Presente solo en "errores"/"alineados": ahí la fila es la unidad. */
  selectedRowIds?: ReadonlySet<string>;
  onToggleRowSelected?: (objectiveId: string) => void;
}

/**
 * La tarjeta de un usuario: cabecera, aviso del peso y la tabla con todo lo
 * que la persona llevará cuando termine la carga — las filas del archivo
 * primero, después los objetivos que ya tenía y el archivo no toca.
 */
export const ReviewGroupCard: React.FC<ReviewGroupCardProps> = ({
  position,
  group,
  objectives,
  isProgressLoad,
  isEditLoad,
  candidates,
  isDuplicate,
  isCollapsed,
  onToggle,
  pendingQuestion,
  onPendingQuestionChange,
  mergeTarget,
  findGroupFor,
  onDelete,
  onDeleteMany,
  onChange,
  onAssignUser,
  onConfirmObjective,
  onMerge,
  onRelinkObjective,
  isSelected,
  isSelectedIndeterminate,
  onToggleSelected,
  selectedRowIds,
  onToggleRowSelected,
}) => {
  const displayName = groupDisplayName(group);
  const visibleIds = objectives.map((objective) => objective.id);
  /**
   * Mientras la identidad no esté cerrada —falta la persona, o hay una
   * propuesta todavía sin aceptar— la tarjeta es de solo consulta: no dice
   * nada de sus datos (`rulesVisible`) y ninguna celda ni el borrar-fila se
   * puede tocar. Editar objetivos de alguien que podría no ser el dueño no
   * tiene sentido; primero se cierra de quién son.
   */
  const isReadOnly = group.matchStatus !== "matched";
  /** Aparte de `isReadOnly`, porque solo "errores" ofrece guardar por fila. */
  const bucket = bucketForGroup(group);

  // Medido sobre el grupo entero, nunca sobre el subconjunto filtrado. Callado
  // en una carga de avances: esa carga no mueve ningún peso.
  const weightNotice = isReadOnly || isProgressLoad ? null : describeGroupWeight(group);
  const isWeightOverTotal = weightNotice !== null && weightNotice.tone === "error";
  const hasSaved = group.existing.length > 0;

  /** Mismo criterio que bloquea el chulito de cada fila, pero calculado aquí
      para poder contarlo sin abrir la tarjeta. */
  const isObjectiveBlocked = (objective: ParsedObjective): boolean => {
    if (objective.link?.status === "possible") return true;
    const violations = isProgressLoad ? validateProgressUpdate(objective) : validateObjective(objective);
    if (violations.length > 0) return true;
    return isWeightOverTotal;
  };

  /**
   * Solo en "errores", y solo se ve colapsada: abierta, cada fila ya dice lo
   * suyo. Dos cosas distintas, no una: filas que UBITS todavía rechaza (nadie
   * puede guardarlas, hay que abrir y corregir) y filas que ya pasaron la
   * validación pero nadie apretó "Guardar ajustes" — a esas sí se les puede
   * guardar de una desde aquí mismo, sin abrir la tarjeta.
   */
  const pendingRows = bucket === "errores" ? group.objectives.filter((objective) => objective.rowConfirmed !== true) : [];
  const blockedRowCount = pendingRows.filter(isObjectiveBlocked).length;
  const readyRowIds = pendingRows.filter((objective) => !isObjectiveBlocked(objective)).map((objective) => objective.id);

  const targetedIds = groupTargetedIds(group);
  const untouched = groupUntouchedObjectives(group);

  const isConfirming = pendingQuestion !== null;
  const isConfirmingThisGroup = pendingQuestion?.kind === "group" && pendingQuestion.identifier === group.identifier;
  const isConfirmingRowHere =
    pendingQuestion?.kind === "row" && objectives.some((objective) => objective.id === pendingQuestion.id);
  const mergeQuestion =
    pendingQuestion?.kind === "merge" && pendingQuestion.identifier === group.identifier && mergeTarget
      ? { user: pendingQuestion.user, target: mergeTarget }
      : undefined;
  const isCardIdle = isConfirming && !isConfirmingThisGroup && !isConfirmingRowHere && mergeQuestion === undefined;

  const cancelQuestion = () => onPendingQuestionChange(null);

  // El borde de la tarjeta queda neutro en todos los estados: el color va en
  // el campo, el chip o el mensaje, nunca en el marco. Lo que sí toma del
  // sistema es la forma: el mismo radio, borde y sombra que cualquier otra
  // tarjeta del proyecto, para que sobre el fondo del drawer se lea como una
  // pieza y no como una franja más de la misma hoja blanca.
  return (
    <section
      inert={isCardIdle || undefined}
      className={cn(
        "rounded-2xl border border-border/60 bg-surface shadow-card transition-[opacity,border-color]",
        !isCardIdle && "hover:border-primary/25",
        isCardIdle && "opacity-50"
      )}
    >
      <div
        inert={isConfirmingRowHere || undefined}
        className={cn(
          "sticky top-0 z-20 rounded-t-2xl bg-surface transition-opacity",
          !isCollapsed && "shadow-sm",
          isCollapsed && "rounded-b-2xl",
          isConfirmingRowHere && "opacity-50"
        )}
      >
        <ObjectiveGroupHeader
          position={position}
          group={group}
          visibleObjectives={objectives}
          candidates={candidates}
          isDuplicate={isDuplicate}
          isCollapsed={isCollapsed}
          onToggle={onToggle}
          isSelected={isSelected}
          isSelectedIndeterminate={isSelectedIndeterminate}
          onToggleSelected={onToggleSelected}
          blockedRowCount={blockedRowCount}
          readyRowCount={readyRowIds.length}
          onConfirmReadyRows={() => readyRowIds.forEach((id) => onConfirmObjective(id))}
          onAssignUser={onAssignUser}
          isConfirmingDelete={isConfirmingThisGroup}
          onRequestDelete={() => onPendingQuestionChange({ kind: "group", identifier: group.identifier })}
          onCancelDelete={cancelQuestion}
          onDeleteVisible={() => {
            cancelQuestion();
            onDeleteMany(visibleIds);
          }}
          // El único botón que queda a nivel de tarjeta es el de identidad —
          // "errores" y "alineados" ya no tienen uno: el primero se resuelve
          // por fila, el segundo no tiene nada pendiente que confirmar.
          showConfirm={isReadOnly}
          findGroupFor={findGroupFor}
          mergeQuestion={mergeQuestion}
          onRequestMerge={(user, target) =>
            onPendingQuestionChange({
              kind: "merge",
              identifier: group.identifier,
              user,
              targetIdentifier: target.identifier,
            })
          }
          onCancelMerge={cancelQuestion}
          onMerge={() => {
            cancelQuestion();
            if (mergeQuestion) onMerge(mergeQuestion.target.identifier);
          }}
        />
      </div>

      {/* Cómo suman los pesos, dicho una vez por tarjeta y solo abierta: habla
          de filas y apunta a las celdas contorneadas de abajo. Tres tonos,
          porque una tarjeta con objetivos de UBITS tiene tres cosas que decir
          y solo una es un error. */}
      {weightNotice && !isCollapsed && (
        <div
          inert={isConfirmingRowHere || undefined}
          className={cn("px-3 py-2.5 transition-opacity", isConfirmingRowHere && "opacity-50")}
        >
          <div
            className={cn(
              "flex items-start gap-2.5 rounded-xl border px-3 py-2.5",
              weightNotice.tone === "error" && "border-status-negative/20 bg-status-negative/[0.05]",
              weightNotice.tone === "warning" && "border-status-warning/25 bg-status-warning/[0.06]",
              weightNotice.tone === "info" && "border-border/50 bg-surface-muted/60"
            )}
          >
            {weightNotice.tone === "info" ? (
              <CircleCheck className="mt-px size-4 shrink-0 text-text-muted" strokeWidth={2.5} />
            ) : (
              <AlertTriangle
                className={cn(
                  "mt-px size-4 shrink-0",
                  weightNotice.tone === "error" ? "text-status-negative" : "text-status-warning"
                )}
                strokeWidth={2.5}
              />
            )}
            <p className="text-[12.5px] font-medium leading-relaxed text-text-secondary">
              <span
                className={cn(
                  "font-bold",
                  weightNotice.tone === "error" && "text-status-negative",
                  weightNotice.tone === "warning" && "text-status-warning",
                  weightNotice.tone === "info" && "text-text-primary"
                )}
              >
                {weightNotice.headline}
              </span>{" "}
              {weightNotice.detail}
            </p>
          </div>
        </div>
      )}

      {!isCollapsed && (
        <div className="px-3 pb-2.5 pt-2" inert={isConfirmingThisGroup || undefined}>
          <table className="w-full table-fixed border-collapse text-left">
            <caption className="sr-only">
              {isProgressLoad
                ? `Avances de ${displayName}: las ${objectives.length} filas del archivo, con el objetivo de UBITS al que cada una reporta y el avance que registrará.`
                : isEditLoad
                  ? `Objetivos de ${displayName}: las ${objectives.length} filas del archivo y los ${untouched.length} que el archivo no cambia, con el objetivo de UBITS que cada fila reescribe.`
                  : hasSaved
                    ? `Objetivos de ${displayName}: los ${untouched.length} que ya tiene en el ciclo y los ${objectives.length} del archivo, todos editables antes de cargar.`
                    : `Objetivos de ${displayName} detectados en el archivo, editables antes de cargarlos.`}
            </caption>
            <TableColumns isProgressLoad={isProgressLoad} />
            <thead>
              <tr className="bg-muted-solid sticky top-[61px] z-10 border-b border-border/60 text-[10.5px] font-bold uppercase tracking-wide text-text-secondary shadow-sm">
                <th scope="col" className="py-2 pl-3 pr-1 text-right" title="Fila en el archivo">
                  #
                </th>
                <HeadCell>Objetivo</HeadCell>
                <HeadCell>Medida</HeadCell>
                <HeadCell>Dirección</HeadCell>
                <HeadCell align="right">Inicial</HeadCell>
                <HeadCell align="right">Meta</HeadCell>
                {isProgressLoad ? (
                  <>
                    <HeadCell align="right">Avance actual</HeadCell>
                    <HeadCell align="right">Nuevo avance</HeadCell>
                    <HeadCell align="right" title="Cumplimiento que quedará registrado con el nuevo avance">
                      Cumplimiento
                    </HeadCell>
                  </>
                ) : (
                  <>
                    <HeadCell align="right">Mínimo</HeadCell>
                    <HeadCell align="right">Máximo</HeadCell>
                    <HeadCell align="right">Peso</HeadCell>
                  </>
                )}
                <HeadCell align="center">
                  <span className="sr-only">Acciones</span>
                </HeadCell>
              </tr>
            </thead>
            {/* Una sola lista; los chips de cada fila dicen cuál es cuál. Las
                filas del archivo primero, porque ahí está el trabajo. */}
            <tbody>
              {objectives.map((objective, position) => (
                <ObjectiveReviewRow
                  key={objective.id}
                  objective={objective}
                  index={position + 1}
                  columnCount={COLUMN_COUNT}
                  isProgressLoad={isProgressLoad}
                  isEditLoad={isEditLoad}
                  linkCandidates={group.existing}
                  takenLinkIds={targetedIds}
                  onRelink={onRelinkObjective ? (targetId) => onRelinkObjective(objective.id, targetId) : undefined}
                  rulesVisible={!isReadOnly}
                  readOnly={isReadOnly}
                  isWeightOverTotal={isWeightOverTotal}
                  onChange={(patch) => onChange(objective.id, patch)}
                  // Solo en "errores": ni antes (la identidad manda ahí) ni
                  // después (ya no queda nada por guardar en "alineados").
                  onConfirmRow={bucket === "errores" ? () => onConfirmObjective(objective.id) : undefined}
                  // Quitar una fila es una acción sobre el objetivo, así que
                  // tampoco está disponible mientras la tarjeta es de consulta.
                  removal={
                    isReadOnly
                      ? undefined
                      : {
                          isConfirming: pendingQuestion?.kind === "row" && pendingQuestion.id === objective.id,
                          onRequest: () => onPendingQuestionChange({ kind: "row", id: objective.id }),
                          onConfirm: () => {
                            cancelQuestion();
                            onDelete(objective.id);
                          },
                          onCancel: cancelQuestion,
                        }
                  }
                  isIdle={isConfirmingRowHere}
                  isGroupConfirmed={groupAllRowsConfirmed(group)}
                  isSelected={selectedRowIds?.has(objective.id) ?? false}
                  onToggleSelected={
                    onToggleRowSelected ? () => onToggleRowSelected(objective.id) : undefined
                  }
                />
              ))}

              {/* Solo lo que el archivo deja intacto. Una carga de avances no
                  lista ninguno: ahí no son peso sobrante, son objetivos sobre
                  los que nadie reportó. */}
              {(isProgressLoad ? [] : untouched).map((objective, position) => (
                <ObjectiveReviewRow
                  key={objective.id}
                  objective={objective}
                  index={objectives.length + position + 1}
                  columnCount={COLUMN_COUNT}
                  isProgressLoad={isProgressLoad}
                  isEditLoad={isEditLoad}
                  rulesVisible={!isReadOnly}
                  readOnly={isReadOnly}
                  isWeightOverTotal={isWeightOverTotal}
                  onChange={(patch) => onChange(objective.id, patch)}
                  isIdle={isConfirmingRowHere}
                  isGroupConfirmed={groupAllRowsConfirmed(group)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
