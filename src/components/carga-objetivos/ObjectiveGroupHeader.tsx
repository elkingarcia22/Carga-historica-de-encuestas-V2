import * as React from "react";
import { AlertTriangle, Check, ChevronDown, CircleAlert, Info, Merge, Trash2, UserRoundCheck } from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserIdentityPicker } from "./UserMatchPicker";
import {
  TOTAL_WEIGHT_PERCENT,
  getWeightStatus,
  groupDisplayName,
  groupUntouchedObjectives,
  groupWeightTotal,
  type IdentifierType,
  type ObjectiveUserGroup,
  type ParsedObjective,
  type RosterUser,
} from "@/lib/objectivesImport";

/**
 * Cabecera de la tarjeta de un usuario en la revisión.
 *
 * Como el resto de los acordeones del sistema: chip de icono, título, las
 * métricas al otro lado y el chevrón de despliegue al final. Solo el dato que
 * produjo el match se muestra en línea; todo lo demás que UBITS sabe de la
 * persona vive en un tooltip — cinco atributos en una línea eran ruido, pero
 * tienen que estar a la mano, porque confirmar una identidad es el trabajo de
 * este paso.
 */

const IDENTIFIER_LABEL: Record<IdentifierType, string> = {
  correo: "correo",
  documento: "documento",
  username: "username",
  nombre: "nombre",
  telefono: "teléfono",
};

/**
 * Qué tan cerca están los pesos del 100%. Siempre un chip para que la forma no
 * se mueva, y solo el exceso lleva color: quedarse corto es el estado normal
 * de un archivo a medio revisar.
 */
const WeightTotal: React.FC<{ total: number; muted?: boolean }> = ({ total, muted }) => {
  const status = getWeightStatus(total);
  const gap = Math.round(Math.abs(TOTAL_WEIGHT_PERCENT - total) * 100) / 100;
  const isOver = status === "over" && !muted;

  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-[11.5px] font-semibold tabular-nums",
        isOver ? "bg-status-negative/10 font-bold text-status-negative" : "bg-surface-muted text-text-secondary"
      )}
      title={
        status === "ok"
          ? `Los pesos de este usuario suman ${TOTAL_WEIGHT_PERCENT}%, como debe ser.`
          : `Los pesos de este usuario suman ${total}% y deben sumar ${TOTAL_WEIGHT_PERCENT}%.`
      }
    >
      {isOver && <AlertTriangle className="size-3 shrink-0" strokeWidth={2.5} />}
      Peso {total}%
      {!muted && status !== "ok" && ` · ${status === "over" ? "sobra" : "falta"} ${gap}%`}
    </span>
  );
};

const TooltipRow: React.FC<{ label: string; value?: string }> = ({ label, value }) => {
  if (!value) return null;
  return (
    <span className="grid grid-cols-[62px_1fr] items-baseline gap-x-2">
      <span className="text-[9.5px] font-bold uppercase tracking-wider opacity-50">{label}</span>
      <span className="break-words text-[11px] font-medium">{value}</span>
    </span>
  );
};

const CountChip: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
  <span
    className="inline-flex h-6 shrink-0 items-center rounded-md bg-surface-muted px-2 text-[11.5px] font-semibold tabular-nums text-text-secondary"
    title={title}
  >
    {children}
  </span>
);

export interface ObjectiveGroupHeaderProps {
  /**
   * Su puesto en la lista visible (1-based). Antes este chip llevaba un icono
   * distinto por pestaña y después un tono de color; con cuatro pestañas y
   * filas moviéndose entre ellas, ninguno de los dos aportaba nada que la
   * posición en la lista no dijera ya, así que el chip quedó neutro: solo el
   * número, sin significado de estado.
   */
  position: number;
  group: ObjectiveUserGroup;
  /** Las filas que pasan los filtros, para el conteo "N de M". */
  visibleObjectives: ParsedObjective[];
  candidates: RosterUser[];
  /** Otro grupo resuelve al mismo usuario de UBITS. */
  isDuplicate: boolean;
  isCollapsed: boolean;
  onToggle: () => void;
  /** Selección para acciones masivas: esta tarjeta, con todo lo que representa. */
  isSelected: boolean;
  isSelectedIndeterminate: boolean;
  onToggleSelected: () => void;
  /**
   * Las dos formas de tener filas pendientes en "errores" — 0 en cualquier
   * otra pestaña. Bloqueadas: UBITS todavía rechaza algo, hay que abrir y
   * corregir. Listas: ya pasaron la validación pero nadie guardó todavía —
   * esas sí se pueden guardar de una desde aquí, sin abrir la tarjeta.
   */
  blockedRowCount: number;
  readyRowCount: number;
  onConfirmReadyRows: () => void;
  onAssignUser: (user: RosterUser | null) => void;
  isConfirmingDelete: boolean;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onDeleteVisible: () => void;
  /**
   * Falso una vez la identidad está cerrada: "errores" y "alineados" ya no
   * tienen nada que este botón resuelva —el primero se guarda por fila, el
   * segundo no tiene nada pendiente—, así que solo vive aquí para
   * "sinAlinear"/"asociaciones".
   */
  showConfirm: boolean;
  /** El otro grupo que ya resuelve a un usuario dado, si existe. */
  findGroupFor: (username: string) => ObjectiveUserGroup | undefined;
  mergeQuestion?: { user: RosterUser; target: ObjectiveUserGroup };
  onRequestMerge: (user: RosterUser, target: ObjectiveUserGroup) => void;
  onCancelMerge: () => void;
  onMerge: () => void;
}

export const ObjectiveGroupHeader: React.FC<ObjectiveGroupHeaderProps> = ({
  position,
  group,
  visibleObjectives,
  candidates,
  isDuplicate,
  isCollapsed,
  onToggle,
  isSelected,
  isSelectedIndeterminate,
  onToggleSelected,
  blockedRowCount,
  readyRowCount,
  onConfirmReadyRows,
  onAssignUser,
  isConfirmingDelete,
  onRequestDelete,
  onCancelDelete,
  onDeleteVisible,
  showConfirm,
  findGroupFor,
  mergeQuestion,
  onRequestMerge,
  onCancelMerge,
  onMerge,
}) => {
  const isResolved = group.matchStatus === "matched";
  const isUnmatched = group.matchStatus === "unmatched";
  const isProposal = group.matchStatus === "possible" && group.suggestion !== undefined;
  const isProgressLoad = group.mode === "actualizar";

  /**
   * Alguien elegido en el campo pero todavía no confirmado. Elegir y confirmar
   * eran el mismo clic, y la tarjeta saltaba de pestaña al cerrar el
   * desplegable sin dar tiempo a comprobar que era la persona correcta.
   */
  const [stagedUser, setStagedUser] = React.useState<RosterUser | undefined>();

  // Cualquier cosa que resuelva la identidad por otro lado descarta lo apilado.
  const resolvedKey = `${group.matchStatus}:${group.matchedUser?.username ?? ""}`;
  const [lastResolvedKey, setLastResolvedKey] = React.useState(resolvedKey);
  if (lastResolvedKey !== resolvedKey) {
    setLastResolvedKey(resolvedKey);
    setStagedUser(undefined);
  }

  const pendingUser = stagedUser ?? (isProposal ? group.suggestion : undefined);
  const hasIdentityChange =
    pendingUser !== undefined && pendingUser.username !== group.matchedUser?.username;

  const displayName = groupDisplayName(group);
  const detailUser = pendingUser ?? group.matchedUser;
  const total = groupWeightTotal(group);
  const savedCount = groupUntouchedObjectives(group).length;
  const isPartial = visibleObjectives.length !== group.objectives.length;

  /**
   * Qué impide confirmar la identidad. Ya no mira datos ni pesos: ese trabajo
   * se mudó a "Guardar ajustes" de cada fila, en la pestaña de errores, y este
   * botón no vuelve a aparecer ahí — ver `showConfirm`.
   */
  const confirmBlocker: string | null =
    pendingUser === undefined && group.matchedUser === undefined
      ? "Elige el usuario dueño de estos objetivos para poder confirmar."
      : null;

  const conflictGroup = hasIdentityChange && pendingUser ? findGroupFor(pendingUser.username) : undefined;

  const handleConfirm = () => {
    // El botón no se ve sin un candidato pendiente en estas dos pestañas
    // —`confirmBlocker` lo mantiene deshabilitado hasta entonces—, así que
    // aquí siempre hay alguien de quien hablar.
    if (!pendingUser) return;
    if (conflictGroup) {
      onRequestMerge(pendingUser, conflictGroup);
      return;
    }
    const user = pendingUser;
    setStagedUser(undefined);
    onAssignUser(user);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3.5 py-3 transition-colors",
        !isCollapsed && "border-b border-border/50",
        isConfirmingDelete && "bg-status-negative/[0.04]",
        mergeQuestion && "bg-status-warning/[0.05]"
      )}
    >
      {/* Selecciona la tarjeta entera para acciones masivas — un check por
          persona, no por objetivo, aunque "errores"/"alineados" también
          dejen marcar cada fila por su cuenta abajo. */}
      <Checkbox
        checked={isSelectedIndeterminate ? "indeterminate" : isSelected}
        onCheckedChange={onToggleSelected}
        aria-label={`Seleccionar los objetivos de ${displayName}`}
        className="shrink-0"
      />

      {/* El chip no repite que esto es una persona —el nombre está justo al
          lado—: numera su lugar en la pestaña, sin más. El color de estado ya
          lo llevan la pestaña y sus contadores; aquí solo hacía ruido. */}
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-[13px] font-extrabold tabular-nums text-text-secondary ring-1 ring-inset ring-border/40">
        {position}
      </span>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <UserIdentityPicker
          candidates={candidates}
          value={group.matchedUser}
          proposed={pendingUser}
          identifier={group.identifier}
          identifierType={group.identifierType}
          matchStatus={group.matchStatus}
          // Elegir apila; limpiar aplica.
          onChange={(user) => (user === null ? onAssignUser(null) : setStagedUser(user))}
        />

        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[12px] font-medium text-text-muted">
            <span className={cn("font-bold", isResolved ? "text-text-secondary/80" : "text-text-secondary")}>
              {group.identifier}
            </span>
            <span className="opacity-80"> · {IDENTIFIER_LABEL[group.identifierType]}</span>
            {isUnmatched && !stagedUser && <span className="opacity-80"> · sin usuario asociado</span>}
            {!stagedUser && isProposal && group.suggestionBasis && (
              <span className="opacity-80"> · coincide por {group.suggestionBasis}</span>
            )}
            {stagedUser && <span className="font-bold text-status-warning"> · sin confirmar</span>}
          </span>

          {detailUser && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`Ver los datos de ${detailUser.name}`}
                  className="shrink-0 text-text-muted/70 transition-colors hover:text-text-secondary"
                >
                  <Info className="size-3.5" strokeWidth={2.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" className="max-w-[300px]">
                <span className="flex flex-col gap-1 py-0.5">
                  <span className="pb-0.5 text-[11px] font-bold">{detailUser.name}</span>
                  <TooltipRow label="Username" value={detailUser.username} />
                  <TooltipRow label="Correo" value={detailUser.email} />
                  <TooltipRow label="Documento" value={detailUser.documentId} />
                  <TooltipRow label="Teléfono" value={detailUser.phone} />
                  <TooltipRow label="Área" value={detailUser.area} />
                  <TooltipRow label="Líder" value={detailUser.leader} />
                  {isProposal && group.suggestionReason && (
                    <span className="mt-0.5 border-t border-current/15 pt-1 text-[10.5px] font-medium opacity-70">
                      {group.suggestionReason}
                    </span>
                  )}
                </span>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {mergeQuestion ? (
        /* La misma persona, nombrada dos veces por el mismo archivo. No se
           bloquea —suele ser deliberado— pero no puede pasar sin aviso: dos
           grupos contra un usuario suman sus pesos por encima del 100%. */
        <div className="flex shrink-0 items-center gap-2">
          <span className="max-w-[46ch] text-right text-[12.5px] font-medium leading-snug text-text-secondary">
            <span className="font-bold text-text-primary">{mergeQuestion.user.name}</span> ya está en la carga como{" "}
            <span className="font-bold text-text-primary">{mergeQuestion.target.identifier}</span>, con{" "}
            {mergeQuestion.target.objectives.length}{" "}
            {mergeQuestion.target.objectives.length === 1 ? "objetivo" : "objetivos"}.
          </span>
          <Button
            type="button"
            autoFocus
            onClick={onMerge}
            title={`Pasar estos ${group.objectives.length} objetivos al grupo de ${mergeQuestion.target.identifier}`}
            className="gap-1 bg-status-warning font-bold text-primary-foreground hover:bg-status-warning/90"
          >
            <Merge className="size-3.5" strokeWidth={2.5} />
            Unificar
          </Button>
          <Button type="button" variant="ghost" onClick={onCancelMerge} className="font-bold text-text-secondary">
            Cancelar
          </Button>
        </div>
      ) : isConfirmingDelete ? (
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[12.5px] font-bold text-status-negative">
            ¿Quitar {visibleObjectives.length} {visibleObjectives.length === 1 ? "objetivo" : "objetivos"} de la carga?
          </span>
          <Button type="button" variant="destructive" autoFocus onClick={onDeleteVisible} className="gap-1.5 font-bold">
            <Trash2 className="size-3.5" strokeWidth={2.25} />
            Quitar
          </Button>
          <Button type="button" variant="ghost" onClick={onCancelDelete} className="font-bold text-text-secondary">
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          <CountChip
            title={
              isPartial
                ? `Los filtros dejan ver ${visibleObjectives.length} de los ${group.objectives.length} objetivos de este usuario.`
                : undefined
            }
          >
            {isPartial ? `${visibleObjectives.length} de ${group.objectives.length}` : group.objectives.length}{" "}
            {group.objectives.length === 1 ? "objetivo" : "objetivos"}
            {savedCount > 0 && <span className="opacity-60">&nbsp;del archivo</span>}
          </CountChip>

          {/* El peso que la persona ya gastó, como cantidad propia: sin él los
              totales se contradicen entre sí. */}
          {savedCount > 0 && (
            <CountChip
              title={
                isProgressLoad
                  ? `${displayName} tiene ${savedCount} ${savedCount === 1 ? "objetivo más" : "objetivos más"} en este ciclo sobre los que el archivo no reporta avance. Se quedan como están.`
                  : `${displayName} ya tiene ${savedCount} ${savedCount === 1 ? "objetivo" : "objetivos"} en este ciclo. Se muestran en la tarjeta y también puedes ajustarles el peso.`
              }
            >
              + {savedCount} en UBITS
            </CountChip>
          )}

          {!(isProgressLoad && isUnmatched) && <WeightTotal total={total} muted={isUnmatched || isProgressLoad} />}

          {/* Solo colapsada: abierta, cada fila ya dice lo suyo y repetirlo
              aquí sería el mismo aviso dos veces. Informativo nada más —el
              botón de verdad para lo que ya está listo vive más allá, junto
              a Eliminar, no aquí entre chips. */}
          {isCollapsed && blockedRowCount > 0 && (
            <span
              className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md bg-status-negative/10 px-2 text-[11px] font-bold text-status-negative"
              title={`${displayName} tiene ${blockedRowCount} ${blockedRowCount === 1 ? "objetivo" : "objetivos"} con datos que UBITS rechaza. Ábrela para corregirlos.`}
            >
              <CircleAlert className="size-3 shrink-0" strokeWidth={2.5} />
              {blockedRowCount} {blockedRowCount === 1 ? "objetivo por corregir" : "objetivos por corregir"}
            </span>
          )}

          {group.isManual && isResolved && (
            <span
              className="inline-flex h-6 items-center gap-1 rounded-md bg-primary/10 px-2 text-[11px] font-bold text-primary"
              title="Asociado a mano en esta revisión"
            >
              <UserRoundCheck className="size-3 shrink-0" strokeWidth={2.5} />
              Asociado
            </span>
          )}

          {isDuplicate && (
            <span
              className="inline-flex h-6 items-center gap-1 rounded-md bg-status-negative/10 px-2 text-[11px] font-bold text-status-negative"
              title={`Otro identificador del archivo también apunta a ${displayName}. Si cargas los dos, sus pesos se sumarán por encima del 100%.`}
            >
              <AlertTriangle className="size-3 shrink-0" strokeWidth={2.5} />
              Usuario repetido
            </span>
          )}

          <span className="h-5 w-px bg-border/60" aria-hidden="true" />

          <div className="flex items-center gap-1">
            {showConfirm && (
              <Button
                type="button"
                // Sin flash: el propio cambio de variante —de "outline" a
                // "default" en cuanto se resuelve el conflicto— ya se anima
                // solo, con la transición que trae `Button` de fábrica
                // (`transition-all` en su clase base). El botón se pone
                // primario; no hay nada más encima que parpadee.
                variant={confirmBlocker === null ? "default" : "outline"}
                disabled={confirmBlocker !== null}
                onClick={handleConfirm}
                aria-label={confirmBlocker ?? `Confirmar que estos objetivos son de ${pendingUser?.name ?? displayName}`}
                title={
                  confirmBlocker ??
                  (conflictGroup
                    ? `${pendingUser!.name} ya está en la carga. Te preguntaremos si unificar.`
                    : pendingUser
                      ? `Confirmar a ${pendingUser.name} como dueño de estos objetivos`
                      : `Cargar los objetivos de ${displayName}`)
                }
                className="gap-1.5 font-bold"
              >
                <Check className="size-3.5" strokeWidth={3} />
                Confirmar alineación
              </Button>
            )}

            {/* Solo colapsada: abierta, cada fila ya tiene su propio
                "Confirmar ajustes" y este sería el mismo botón dos veces.
                Un botón de verdad, no un chip, y a la izquierda de Eliminar
                —el orden en que se decide: primero guardar lo que ya sirve,
                después, si acaso, quitar la tarjeta entera. */}
            {isCollapsed && readyRowCount > 0 && (
              <Button
                type="button"
                variant="default"
                onClick={onConfirmReadyRows}
                title={`Guardar los ${readyRowCount} ${readyRowCount === 1 ? "objetivo" : "objetivos"} de ${displayName} que ya pasan las reglas de UBITS, sin abrir la tarjeta`}
                className="gap-1.5 font-bold"
              >
                <Check className="size-3.5" strokeWidth={3} />
                Guardar ajustes ({readyRowCount})
              </Button>
            )}

            {/* Misma anatomía que "Eliminar" en la tarjeta de objetivo del
                constructor —borde, fondo tenue, aro de foco rojo, tooltip
                de verdad en vez de `title`— pero cuadrada de esquinas
                redondeadas en lugar de circular, para no romper la fila
                del resto de los iconos de esta cabecera. */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onRequestDelete}
                  aria-label={`Quitar los objetivos de ${displayName} de la carga`}
                  className="rounded-md border border-status-negative/30 bg-status-negative/5 text-status-negative hover:border-status-negative/50 hover:bg-status-negative/15 hover:text-status-negative focus-visible:ring-status-negative/30"
                >
                  <Trash2 className="size-3.5" strokeWidth={2.25} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Quitar los {visibleObjectives.length} objetivos de {displayName}
              </TooltipContent>
            </Tooltip>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-expanded={!isCollapsed}
              aria-label={`${isCollapsed ? "Mostrar" : "Ocultar"} los objetivos de ${displayName}`}
              onClick={onToggle}
              className="text-text-secondary hover:text-text-primary"
            >
              <ChevronDown className={cn("size-4 transition-transform", isCollapsed && "-rotate-90")} strokeWidth={2.5} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
