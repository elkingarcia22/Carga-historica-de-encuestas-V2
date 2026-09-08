import * as React from "react";
import {
  AlertTriangle,
  Check,
  CircleCheck,
  Equal,
  FilePlus2,
  HelpCircle,
  Info,
  PencilLine,
  Trash2,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ObjectiveMatchPicker } from "./ObjectiveMatchPicker";
import { ComplianceCell, NumberCell, QuietSelect, ReadOnlyCell } from "./reviewCells";
import { QUIET_CELL, WEIGHT_TOTAL_MARK, fieldStateClass, formatValue, groupViolations } from "./reviewCellUtils";
import {
  MEASURE_SYMBOL,
  MEASURE_TYPES,
  TRENDS,
  hasSavedEdits,
  validateObjective,
  validateProgressUpdate,
  type MeasureType,
  type ParsedObjective,
  type Trend,
} from "@/lib/objectivesImport";

/**
 * Un objetivo en la revisión, editable en su sitio.
 *
 * La misma fila sirve para las dos clases que una tarjeta puede tener —una
 * línea que el archivo va a crear y un objetivo que la persona ya tiene en
 * UBITS— porque son el mismo objeto con las mismas reglas. Lo que cambia se
 * deriva de la fila misma: un objetivo guardado no se puede "quitar de la
 * carga" (no está en ella), lleva un chip que dice si está intacto o se va a
 * actualizar, y se sienta sobre una superficie tenue.
 */

const TITLE_LIMIT = 150;
const TITLE_WARN_AT = 130;

/** El chip bajo el nombre: qué es la fila y qué hace cargarla. */
interface ObjectiveRowChip {
  label: string;
  hint: string;
  icon: React.ReactNode;
  /** Solo "Por confirmar" conserva color: es la única pregunta abierta de la fila. */
  tone?: "warning" | "neutral" | "info";
}

function chipFor(
  objective: ParsedObjective,
  {
    isProgressLoad,
    isEditLoad,
    targetTitle,
    isGroupConfirmed,
  }: { isProgressLoad: boolean; isEditLoad: boolean; targetTitle?: string; isGroupConfirmed?: boolean }
): ObjectiveRowChip | null {
  const isSaved = objective.saved !== undefined;
  const isAdjusted = hasSavedEdits(objective);
  const pendingChip: ObjectiveRowChip = {
    label: "Por confirmar",
    hint:
      objective.link?.reason ??
      "Solo pudimos proponer a qué objetivo corresponde. Ábrelo para confirmarlo.",
    icon: <HelpCircle className="size-2.5" strokeWidth={2.5} />,
    tone: isGroupConfirmed ? "info" : "warning",
  };

  if (isProgressLoad) {
    if (objective.link?.status === "possible") return pendingChip;
    if (targetTitle !== undefined) return null;
    return {
      label: "No existe en UBITS",
      hint: `Ningún objetivo de esta persona se llama “${objective.link?.lookupTitle ?? objective.title}”. No se puede registrar avance sobre un objetivo que no existe: ábrelo y elige a cuál corresponde, o quita la fila.`,
      icon: <AlertTriangle className="size-2.5" strokeWidth={2.5} />,
    };
  }

  if (objective.link) {
    if (objective.link.status === "possible") return pendingChip;
    if (targetTitle !== undefined) {
      return {
        label: "Con cambios",
        hint: `Reescribe “${targetTitle}” en UBITS con los valores de esta fila.`,
        icon: <PencilLine className="size-2.5" strokeWidth={2.5} />,
      };
    }
    return {
      label: "Nuevo objetivo",
      hint: `“${objective.link.lookupTitle}” no existe en UBITS, así que esta fila lo creará. Ábrelo para asociarlo a uno que ya exista.`,
      icon: <FilePlus2 className="size-2.5" strokeWidth={2.5} />,
    };
  }

  if (!isSaved) return null;

  if (isEditLoad) {
    return isAdjusted
      ? {
          label: "Con cambios",
          hint: "Ninguna fila del archivo lo toca, pero lo estás ajustando a mano: al cargar se actualizará.",
          icon: <PencilLine className="size-2.5" strokeWidth={2.5} />,
        }
      : {
          label: "Sin cambios",
          hint: "Ninguna fila del archivo lo toca. Se queda como está, pero cuenta para el 100%.",
          icon: <Equal className="size-2.5" strokeWidth={2.5} />,
        };
  }

  return isAdjusted
    ? {
        label: "Se actualizará",
        hint: "Ya existe en UBITS y lo estás ajustando: al cargar se actualizará con estos valores.",
        icon: <PencilLine className="size-2.5" strokeWidth={2.5} />,
      }
    : {
        label: "Ya creado en UBITS",
        hint: "Este objetivo ya existe en UBITS. No se va a crear de nuevo; solo se actualizará si lo ajustas.",
        icon: <CircleCheck className="size-2.5" strokeWidth={2.5} />,
        tone: "neutral",
      };
}

const CHIP_TONE_CLASS: Record<NonNullable<ObjectiveRowChip["tone"]> | "default", string> = {
  warning: "border-status-warning/60 bg-status-warning/10 text-status-warning",
  info: "border-status-info/60 bg-status-info/10 text-status-info",
  neutral: "border-black/10 bg-black/[0.06] text-text-primary/90",
  default: "border-border/60 bg-surface text-text-secondary/70",
};

export interface ObjectiveReviewRowProps {
  objective: ParsedObjective;
  /** Posición 1-based dentro de la tarjeta. */
  index: number;
  columnCount: number;
  /** Carga de avances: la fila muestra el objetivo como está y ofrece una sola celda editable. */
  isProgressLoad: boolean;
  /** Carga de edición: las filas sin enlace dicen "Sin cambios". */
  isEditLoad: boolean;
  /** A qué puede apuntar una fila de edición: los objetivos del usuario en el ciclo. */
  linkCandidates?: ParsedObjective[];
  /** Objetivos que otras filas ya reescriben. */
  takenLinkIds?: ReadonlySet<string>;
  onRelink?: (targetId: string | null) => void;
  /** Falso mientras nadie es dueño de los objetivos: esa tarjeta pregunta otra cosa. */
  rulesVisible: boolean;
  /** Los pesos del usuario pasan del 100%: todas las celdas de peso se contornean. */
  isWeightOverTotal: boolean;
  onChange: (patch: Partial<ParsedObjective>) => void;
  /**
   * El "Guardar ajustes" de esta fila sola, solo en la pestaña de errores.
   * Ausente en cualquier otra pestaña y en los objetivos que ya existen —
   * confirmar es cosa de una fila del archivo, no de un objetivo que UBITS ya
   * tiene guardado.
   */
  onConfirmRow?: () => void;
  /** Todo lo de sacar la fila de la carga. Ausente en los objetivos que ya existen. */
  removal?: {
    isConfirming: boolean;
    onRequest: () => void;
    onConfirm: () => void;
    onCancel: () => void;
  };
  /** Congelada y atenuada porque otra fila de la tarjeta tiene la pregunta abierta. */
  isIdle: boolean;
  /**
   * De solo consulta: la identidad de la tarjeta todavía no está cerrada, así
   * que nada de esta fila se puede tocar —ni las celdas ni quitarla— hasta que
   * se sepa de quién son estos objetivos. A diferencia de `isIdle`, no atenúa
   * la fila: no es una espera momentánea, es el estado normal de esta pestaña.
   */
  readOnly?: boolean;
  isGroupConfirmed?: boolean;
  /**
   * Selección para acciones masivas. Ausente en las pestañas de solo
   * consulta —ahí se selecciona la tarjeta entera, no la fila— así que solo
   * "errores" y "alineados" la ofrecen.
   */
  isSelected?: boolean;
  onToggleSelected?: () => void;
}

export const ObjectiveReviewRow: React.FC<ObjectiveReviewRowProps> = ({
  objective,
  index,
  columnCount,
  isProgressLoad,
  isEditLoad,
  linkCandidates = [],
  takenLinkIds,
  onRelink,
  rulesVisible,
  isWeightOverTotal,
  onChange,
  onConfirmRow,
  removal,
  isIdle,
  readOnly = false,
  isGroupConfirmed,
  isSelected = false,
  onToggleSelected,
}) => {
  const isSaved = objective.saved !== undefined;
  const isAdjusted = hasSavedEdits(objective);
  const isRowPending = objective.link?.status === "possible";
  const hasTarget = objective.link?.targetId !== undefined;

  // Una fila de avances se juzga por el número que vino a escribir, y nada más.
  const violations = !rulesVisible
    ? []
    : isProgressLoad
      ? validateProgressUpdate(objective)
      : validateObjective(objective);
  const byField = groupViolations(violations);
  const nearTitleLimit = rulesVisible && objective.title.length >= TITLE_WARN_AT;

  const targetTitle = objective.link?.targetId
    ? linkCandidates.find((candidate) => candidate.id === objective.link?.targetId)?.title
    : undefined;
  const chip = chipFor(objective, { isProgressLoad, isEditLoad, targetTitle, isGroupConfirmed });

  /**
   * Por qué "Guardar ajustes" está deshabilitado en esta fila, en el orden en
   * que hay que resolverlo — el mismo orden que usaba el botón de la tarjeta
   * entera, ahora aplicado a una sola fila: primero saber a qué objetivo
   * corresponde, después que sus datos pasen las reglas, al final que el peso
   * del usuario no se haya ido de 100% (eso sí es cosa de todas las filas
   * juntas, así que bloquea aunque esta fila esté perfecta).
   */
  const rowConfirmBlocker: string | null = isRowPending
    ? "Confirma a qué objetivo de UBITS corresponde esta fila."
    : violations.length > 0
      ? isProgressLoad
        ? "Completa el nuevo avance de esta fila."
        : "Corrige los datos que UBITS rechaza en esta fila."
      : isWeightOverTotal
        ? "Los pesos de este usuario suman más de 100%. Ajusta esta fila o alguna otra."
        : null;

  /**
   * El chulito se anima justo cuando deja de estar bloqueado —se resolvió lo
   * que le faltaba a esta fila— y no en cualquier otro render: `rowReadyFlashKey`
   * solo sube en esa transición, y remontar el botón con ese número como
   * `key` es lo que hace que la animación se repita cada vez, no solo la
   * primera. El mismo patrón que ya usa el resto del proyecto para "esto
   * acaba de activarse" (`probarActivateFlash`).
   */
  const isRowBlocked = rowConfirmBlocker !== null;
  const [wasRowBlocked, setWasRowBlocked] = React.useState(isRowBlocked);
  const [rowReadyFlashKey, setRowReadyFlashKey] = React.useState(0);
  if (wasRowBlocked !== isRowBlocked) {
    setWasRowBlocked(isRowBlocked);
    if (wasRowBlocked && !isRowBlocked) setRowReadyFlashKey((key) => key + 1);
  }

  /*
    Pedir quitar un objetivo cambia la fila por la pregunta, igual que pedir
    quitar un usuario cambia los chips de la cabecera. Con palabras, no con dos
    glifos: el título viaja dentro de la pregunta para que diga qué se quita.
  */
  if (removal?.isConfirming) {
    return (
      <tr className="border-t border-border/25 bg-status-negative/[0.06] first:border-t-0">
        <td className="py-2 pl-3 pr-1 text-right align-middle">
          <span className="text-[10px] font-medium tabular-nums text-text-muted">{index}</span>
        </td>
        <td colSpan={columnCount - 1} className="px-2 py-2 align-middle">
          <div className="flex items-center gap-2">
            <span className="min-w-0 truncate text-[12.5px] font-bold text-status-negative">
              ¿Quitar “{objective.title.trim() === "" ? "este objetivo" : objective.title}” de la carga?
            </span>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Button type="button" variant="destructive" autoFocus onClick={removal.onConfirm} className="gap-1.5 font-bold">
                <Trash2 className="size-3.5" strokeWidth={2.25} />
                Quitar
              </Button>
              <Button type="button" variant="ghost" onClick={removal.onCancel} className="font-bold text-text-secondary">
                Cancelar
              </Button>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
      {/* Una fila que rompe una regla sigue siendo una fila normal: el color
          marca solo la celda equivocada y la frase que la explica. La
          superficie tenue de un objetivo guardado es la única excepción, y no
          es color: separa "lo que UBITS ya tiene" de "lo que trae el archivo". */}
      <tr
        inert={isIdle || readOnly || undefined}
        className={cn(
          "group border-t border-border/25 transition-opacity first:border-t-0",
          isSaved && "bg-surface-muted/40",
          isIdle ? "opacity-50" : isSaved ? "hover:bg-surface-muted/70" : "hover:bg-surface-muted/40"
        )}
      >
        <td className="py-1.5 pl-3 pr-1 align-middle">
          {/* La selección reemplaza al número de fila, no lo acompaña: son
              la misma esquina y mostrar los dos a la vez no cabía sin
              ensanchar la columna para algo que ya se ve en el tooltip. */}
          {onToggleSelected ? (
            <div className="flex items-center justify-end">
              <Checkbox
                checked={isSelected}
                onCheckedChange={onToggleSelected}
                aria-label={`Seleccionar el objetivo ${index} para acciones masivas`}
              />
            </div>
          ) : (
            <span
              className="block text-right text-[10px] font-medium tabular-nums text-text-muted"
              title={isSaved ? undefined : `Fila ${objective.sourceRow} del archivo`}
            >
              {index}
            </span>
          )}
        </td>

        <td className="px-2 py-1.5 align-middle">
          {/* En una fila de edición el nombre ES el control: reasociar es lo
              principal de este paso, así que ocurre donde ya está el ojo. */}
          {objective.link && onRelink ? (
            <ObjectiveMatchPicker
              title={objective.title}
              link={objective.link}
              candidates={linkCandidates}
              takenIds={takenLinkIds ?? new Set()}
              onChange={onRelink}
              enabled={rulesVisible}
              allowCreateNew={!isProgressLoad}
            />
          ) : (
            <input
              type="text"
              aria-label={`Título del objetivo ${index}`}
              value={objective.title}
              maxLength={400}
              onChange={(event) => onChange({ title: event.target.value })}
              className={cn(
                QUIET_CELL,
                "font-semibold",
                isRowPending && "border-border/50 bg-surface",
                fieldStateClass(byField.title)
              )}
            />
          )}
          <div className="mt-1 flex items-center gap-1.5 pl-1.5">
            {chip && (
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border py-0.5 pl-1.5 pr-2 text-[9.5px] font-bold",
                  CHIP_TONE_CLASS[chip.tone ?? "default"]
                )}
                title={chip.hint}
              >
                {chip.icon}
                {chip.label}
              </span>
            )}
            {nearTitleLimit && (
              <span
                className={cn(
                  "shrink-0 text-[10px] font-bold tabular-nums",
                  objective.title.length > TITLE_LIMIT ? "text-status-negative" : "text-status-warning"
                )}
              >
                {objective.title.length}/{TITLE_LIMIT}
              </span>
            )}
          </div>
        </td>

        {isProgressLoad ? (
          <>
            {/* Todo en estas columnas es del objetivo, así que una fila que no
                encontró el suyo no tiene nada cierto que poner: un guion dice
                lo único verdadero, que primero hay que apuntarla a algo. */}
            <td className="px-2 py-1.5 align-middle">
              <ReadOnlyCell title={hasTarget ? objective.measureType : undefined}>
                {hasTarget ? `${MEASURE_SYMBOL[objective.measureType]} ${objective.measureType}` : "—"}
              </ReadOnlyCell>
            </td>
            <td className="px-2 py-1.5 align-middle">
              <ReadOnlyCell>
                {!hasTarget ? "—" : objective.trend === "Aumentar" ? "↗ Aumentar" : "↘ Reducir"}
              </ReadOnlyCell>
            </td>
            <td className="px-2 py-1.5 align-middle">
              <ReadOnlyCell align="right">{hasTarget ? formatValue(objective.initialValue) : "—"}</ReadOnlyCell>
            </td>
            <td className="px-2 py-1.5 align-middle">
              <ReadOnlyCell align="right">{hasTarget ? formatValue(objective.target) : "—"}</ReadOnlyCell>
            </td>
            <td className="px-2 py-1.5 align-middle">
              <ReadOnlyCell
                align="right"
                title={
                  objective.currentProgress === null || objective.currentProgress === undefined
                    ? "Nadie ha reportado avance sobre este objetivo todavía."
                    : "Avance registrado hoy en UBITS, que es lo que esta carga reemplaza."
                }
              >
                {formatValue(objective.currentProgress ?? null)}
              </ReadOnlyCell>
            </td>
            {/* La única celda de la que trata toda esta operación. */}
            <td className="px-2 py-1.5 align-middle">
              <NumberCell
                ariaLabel={`Nuevo avance del objetivo ${index}`}
                value={objective.newProgress ?? null}
                violations={byField.newProgress}
                allowEmpty={false}
                onChange={(next) => onChange({ newProgress: next })}
              />
            </td>
            <td className="px-2 py-1.5 align-middle">
              {hasTarget ? <ComplianceCell objective={objective} /> : <ReadOnlyCell align="right">—</ReadOnlyCell>}
            </td>
          </>
        ) : (
          <>
            <td className="px-2 py-1.5 align-middle">
              <QuietSelect
                ariaLabel={`Tipo de medida del objetivo ${index}`}
                value={objective.measureType}
                options={MEASURE_TYPES}
                violations={byField.measureType}
                onChange={(next: MeasureType) => onChange({ measureType: next })}
                renderOption={(type) => `${MEASURE_SYMBOL[type]} ${type}`}
              />
            </td>
            <td className="px-2 py-1.5 align-middle">
              <QuietSelect
                ariaLabel={`Dirección del objetivo ${index}`}
                value={objective.trend}
                options={TRENDS}
                violations={byField.trend}
                onChange={(next: Trend) => onChange({ trend: next })}
                renderOption={(trend) => (trend === "Aumentar" ? "↗ Aumentar" : "↘ Reducir")}
              />
            </td>
            <td className="px-2 py-1.5 align-middle">
              <NumberCell
                ariaLabel={`Valor inicial del objetivo ${index}`}
                value={objective.initialValue}
                violations={byField.initialValue}
                onChange={(next) => onChange({ initialValue: next })}
              />
            </td>
            <td className="px-2 py-1.5 align-middle">
              <NumberCell
                ariaLabel={`Meta del objetivo ${index}`}
                value={objective.target}
                violations={byField.target}
                allowEmpty={false}
                onChange={(next) => onChange({ target: next === null ? NaN : next })}
              />
            </td>
            <td className="px-2 py-1.5 align-middle">
              <NumberCell
                ariaLabel={`Mínimo de avance del objetivo ${index}`}
                value={objective.minProgress}
                violations={byField.minProgress}
                onChange={(next) => onChange({ minProgress: next })}
              />
            </td>
            <td className="px-2 py-1.5 align-middle">
              <NumberCell
                ariaLabel={`Máximo de avance del objetivo ${index}`}
                value={objective.maxProgress}
                violations={byField.maxProgress}
                onChange={(next) => onChange({ maxProgress: next })}
              />
            </td>
            <td className="px-2 py-1.5 align-middle">
              <NumberCell
                ariaLabel={`Peso del objetivo ${index}`}
                value={objective.weightPercent}
                // Cuando el total se pasa, se contornea cada peso: cualquiera
                // puede ser el que se mueva, señalar uno sería arbitrario.
                violations={
                  isWeightOverTotal ? [...(byField.weightPercent ?? []), WEIGHT_TOTAL_MARK] : byField.weightPercent
                }
                allowEmpty={false}
                onChange={(next) => onChange({ weightPercent: next === null ? NaN : next })}
              />
            </td>
          </>
        )}

        {/* Una acción por clase de fila, y solo cuando puede hacer algo: quitar
            una fila del archivo, o deshacer el ajuste de un objetivo guardado. */}
        <td className="px-2 py-1.5 align-middle">
          <div className="flex items-center justify-end gap-2">
            {/* El "Confirmar ajustes" de esta fila sola — por objetivo, no
                por usuario: cada fila de la pestaña de errores se resuelve
                por su cuenta, sin esperar a que las demás también queden
                limpias. Gris mientras algo se lo impide, para que no se lea
                como una acción disponible; en cuanto deja de estarlo, pasa a
                azul primario sólido con el icono en blanco —el mismo botón
                que "Guardar ajustes" en la cabecera de la tarjeta— con un
                destello de encendido (`rowConfirmReadyFlash`, se remonta con
                `rowReadyFlashKey` para repetirse en cada conflicto que se
                resuelve). Una vez confirmada, el check pasa a un azul tenue
                sin acción: el único camino de vuelta es tocar la fila, que
                la retira sola. */}
            {onConfirmRow && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    key={rowReadyFlashKey}
                    type="button"
                    variant={objective.rowConfirmed || rowConfirmBlocker !== null ? "ghost" : "default"}
                    size="icon-sm"
                    disabled={rowConfirmBlocker !== null || objective.rowConfirmed === true}
                    aria-label={
                      objective.rowConfirmed
                        ? `Objetivo ${index} guardado`
                        : (rowConfirmBlocker ?? `Confirmar ajustes del objetivo ${index}`)
                    }
                    onClick={onConfirmRow}
                    style={
                      rowReadyFlashKey > 0 && rowConfirmBlocker === null && !objective.rowConfirmed
                        ? { animation: "rowConfirmReadyFlash 900ms ease-out" }
                        : undefined
                    }
                    className={cn(
                      "rounded-md border",
                      objective.rowConfirmed
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : rowConfirmBlocker !== null
                          ? "border-border bg-surface-muted text-text-muted"
                          : "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                    )}
                  >
                    <Check className="size-3.5" strokeWidth={2.5} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {objective.rowConfirmed
                    ? "Guardado — cualquier cambio en esta fila lo vuelve a pedir"
                    : (rowConfirmBlocker ?? "Confirmar ajustes")}
                </TooltipContent>
              </Tooltip>
            )}
            {/* Misma anatomía que "Eliminar" en la tarjeta de objetivo del
                constructor, cuadrada de esquinas redondeadas en vez de
                circular — ver la nota gemela en ObjectiveGroupHeader. */}
            {removal && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Quitar de la carga el objetivo ${index}`}
                    onClick={removal.onRequest}
                    className="rounded-md border border-status-negative/30 bg-status-negative/5 text-status-negative hover:border-status-negative/50 hover:bg-status-negative/15 hover:text-status-negative focus-visible:ring-status-negative/30"
                  >
                    <Trash2 className="size-3.5" strokeWidth={2.25} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Quitar de la carga</TooltipContent>
              </Tooltip>
            )}
            {isSaved && isAdjusted && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Deshacer los cambios del objetivo ${index}`}
                title="Volver a los valores que tiene en UBITS"
                onClick={() => onChange({ ...objective.saved })}
                className="text-text-muted hover:bg-primary/10 hover:text-primary"
              >
                <Undo2 className="size-3.5" strokeWidth={2.25} />
              </Button>
            )}
          </div>
        </td>
      </tr>

      {violations.length > 0 && (
        <tr inert={isIdle || undefined} className={cn(isIdle && "opacity-50")}>
          <td />
          <td colSpan={columnCount - 1} className="px-2 pb-2 pt-0">
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {violations.map((violation) => (
                <li
                  key={`${violation.rule}-${violation.field}`}
                  className={cn(
                    "flex items-start gap-1.5 text-[11px] font-medium",
                    violation.severity === "error"
                      ? "text-status-negative"
                      : violation.severity === "warning"
                        ? "text-status-warning"
                        : "text-status-info"
                  )}
                >
                  {violation.severity === "info" ? (
                    <Info className="mt-0.5 size-3 shrink-0" strokeWidth={2.5} />
                  ) : (
                    <AlertTriangle className="mt-0.5 size-3 shrink-0" strokeWidth={2.5} />
                  )}
                  <span>
                    <span className="font-bold">{violation.rule}</span> {violation.message}
                  </span>
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
};
