import * as React from "react";
import { MessageSquareText, Pencil, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ComplianceBar, EstadoChip, formatRelativeDate } from "@/components/ciclo-detail";
import { MEASURE_META, type Objective } from "@/components/ciclo-builder";
import { InactiveChip, LifecycleChip } from "./ResultsChips";
import { objectivePatchOf, type ObjectivePatch } from "./PersonObjectiveDialogs";
import { SIN_OBJETIVO_EMPRESA, lastActivityOf } from "./objectiveColumns";
import type { ResultEntry } from "./resultsModel";

/**
 * Las piezas que la fila de un objetivo y su versión en edición comparten.
 *
 * Están fuera de `PersonObjectivesTable` porque las dos filas tienen que decir
 * exactamente lo mismo —el mismo chip de estado, la misma línea de contexto— y
 * porque el formulario en línea, solo, ya mide más que muchas pantallas.
 */

/**
 * El estado de la columna "Estado": uno solo, nunca dos.
 *
 * Inactivo manda sobre todo; un objetivo sin aprobar todavía no tiene banda de
 * cumplimiento propia —"Por iniciar" junto a "Por ajustar" leería como dos
 * estados a la vez—, así que ahí manda el ciclo de vida. Vive aparte porque la
 * fila y su versión en edición tienen que decir exactamente lo mismo.
 */
export function ObjectiveStateChip({ entry }: { entry: ResultEntry }) {
  if (entry.inactivation) {
    return (
      <InactiveChip
        date={formatRelativeDate(entry.inactivation.date)}
        percentAtInactivation={entry.inactivation.percentAtInactivation}
        size="sm"
      />
    );
  }
  if (entry.lifecycle === "por-aprobar" || entry.lifecycle === "por-ajustar") {
    return <LifecycleChip lifecycle={entry.lifecycle} size="sm" />;
  }
  return <EstadoChip estado={entry.estado} size="sm" />;
}


// ── La fila en edición ─────────────────────────────────────────────────────

/** La llave del selector cuando el objetivo no empuja a ninguno de empresa:
 *  un `SelectItem` no admite `value=""`, así que la ausencia necesita la
 *  suya. */
const SIN_ALINEACION = "sin-alineacion";

/**
 * Editar sin salir de la tabla: la fila se convierte en el formulario.
 *
 * Cada columna edita lo suyo y donde se leía —el nombre y sus cifras en
 * "Objetivo", a qué empuja en su propia celda—, y las dos que este formulario
 * no toca —estado y avance— se quedan en gris al lado en vez de desaparecer:
 * son justo el contexto que uno mira mientras corrige una meta.
 *
 * El avance no se edita a propósito: se reporta, con su fecha y su autor, y
 * cambiarlo de contrabando desde un campo de texto borraría el rastro de quién
 * dijo qué.
 */
export function ObjectiveEditRow({
  entry,
  companyObjectives,
  submitLabel,
  colSpan,
  onSave,
  onCancel,
}: {
  entry: ResultEntry;
  companyObjectives: readonly Objective[];
  submitLabel: string;
  /** La fila ocupa la tabla entera, y esa anchura cambia con las columnas. */
  colSpan: number;
  onSave: (patch: ObjectivePatch) => void;
  onCancel: () => void;
}) {
  const [patch, setPatch] = React.useState<ObjectivePatch>(() =>
    objectivePatchOf(entry.objective)
  );

  // El `autoFocus` del nombre deja visible la primera línea del formulario, y
  // el pie —que es donde se guarda— se queda abajo del corte. Al montar se
  // arrastra el pie a la vista: como el bloque entero cabe, sube con él.
  const footerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    footerRef.current?.scrollIntoView({ block: "nearest" });
  }, []);

  const update = <K extends keyof ObjectivePatch>(key: K, value: ObjectivePatch[K]) =>
    setPatch((current) => ({ ...current, [key]: value }));

  const measure = entry.objective.measure ? MEASURE_META[entry.objective.measure] : null;
  const isBoolean = entry.objective.measure === "boolean";
  const weightIsValid = patch.weight >= 1 && patch.weight <= 100;
  const canSave = patch.title.trim() !== "" && weightIsValid;

  const save = () => {
    if (!canSave) return;
    onSave({ ...patch, title: patch.title.trim() });
  };

  /** Enter cierra desde cualquier campo de texto. Dentro del selector la tecla
   *  es suya —abre la lista y elige—, así que ahí no se toca. */
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
      event.preventDefault();
      event.stopPropagation();
      save();
    }
  };

  const cancelRef = React.useRef(onCancel);
  cancelRef.current = onCancel;

  React.useEffect(() => {
    /*
     * Escape descarta la edición, no la ficha.
     *
     * El drawer escucha la tecla en `document` y en fase de captura, así que
     * cuando llega al campo que se está escribiendo el cierre ya está
     * decidido: frenarla desde la fila llega tarde. `window` es el primer
     * escalón de esa captura —va antes que `document`—, que es el único sitio
     * desde donde se le puede ganar sin tocar el shell del drawer.
     */
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Dentro de un desplegable abierto la tecla es suya: cierra la lista.
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-radix-popper-content-wrapper]")) return;
      event.preventDefault();
      event.stopPropagation();
      cancelRef.current();
    };
    window.addEventListener("keydown", onEscape, true);
    return () => window.removeEventListener("keydown", onEscape, true);
  }, []);

  return (
    <>
    <TableRow
      className="border-b-0 bg-primary/[0.04] hover:bg-primary/[0.04]"
      onKeyDown={handleKeyDown}
    >
      <TableCell className="border-l-2 border-primary py-3 pl-[26px] pr-5 align-top">
        <span
          aria-hidden
          className="mt-1 flex size-5 items-center justify-center rounded-md bg-primary/10 text-primary"
        >
          <Pencil className="size-3" strokeWidth={2.4} />
        </span>
      </TableCell>

      <TableCell className="px-4 py-3 align-top">
        <div className="flex flex-col gap-2">
          <Input
            value={patch.title}
            onChange={(event) => update("title", event.target.value)}
            placeholder="Qué se quiere lograr…"
            aria-label="Nombre del objetivo"
            autoFocus
            className="h-8 px-2.5 text-[13px] font-semibold"
          />
          <Input
            value={patch.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder="Descripción (opcional)"
            aria-label="Descripción del objetivo"
            className="h-8 px-2.5 text-[12px]"
          />

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <label className="flex items-center gap-1.5 text-[11.5px] font-semibold text-text-muted">
              Peso
              <Input
                value={String(patch.weight)}
                onChange={(event) =>
                  update("weight", Number(event.target.value.replace(/\D/g, "")) || 0)
                }
                inputMode="numeric"
                aria-label="Peso del objetivo"
                className={cn(
                  "h-8 w-14 px-2 text-center text-[12.5px] font-semibold",
                  !weightIsValid && "border-destructive focus-visible:ring-destructive/30"
                )}
              />
              %
            </label>

            {!isBoolean && (
              <label className="flex items-center gap-1.5 text-[11.5px] font-semibold text-text-muted">
                {measure?.label ?? "Valores"}
                <Input
                  value={patch.initialValue}
                  onChange={(event) => update("initialValue", event.target.value)}
                  inputMode="decimal"
                  placeholder="Inicial"
                  aria-label="Valor inicial"
                  className="h-8 w-24 px-2 text-[12.5px]"
                />
                <span aria-hidden className="text-text-muted">
                  →
                </span>
                <Input
                  value={patch.targetValue}
                  onChange={(event) => update("targetValue", event.target.value)}
                  inputMode="decimal"
                  placeholder="Meta"
                  aria-label="Meta"
                  className="h-8 w-24 px-2 text-[12.5px]"
                />
              </label>
            )}
          </div>

        </div>
      </TableCell>

      <TableCell className="px-4 py-3 align-top">
        <Select
          value={patch.alignedTo ?? SIN_ALINEACION}
          onValueChange={(value) => update("alignedTo", value === SIN_ALINEACION ? null : value)}
        >
          <SelectTrigger size="sm" aria-label="Empuja a" className="h-8 px-2.5 text-[12.5px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SIN_ALINEACION}>{SIN_OBJETIVO_EMPRESA}</SelectItem>
            {companyObjectives.map((objective) => (
              <SelectItem key={objective.id} value={objective.id}>
                {objective.title.trim() === "" ? "Objetivo sin nombre" : objective.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      <TableCell className="px-4 py-3 align-top opacity-60">
        <ObjectiveStateChip entry={entry} />
      </TableCell>

      <TableCell className="px-4 py-3 align-top opacity-60">
        <ComplianceBar percent={entry.percent} estado={entry.estado} />
      </TableCell>

      <TableCell className="px-4 py-3 align-top opacity-60">
        <LastActivity entry={entry} />
      </TableCell>

      <TableCell className="py-3 pr-4" />
    </TableRow>

    {/* El pie va en su propia fila a todo lo ancho y pegado a la izquierda:
        la tabla es más ancha que el panel, así que un botón alineado a la
        derecha se queda fuera de la vista y habría que buscarlo con scroll
        horizontal para guardar lo que uno acaba de escribir. */}
    <TableRow
      className="border-b border-border/60 bg-primary/[0.04] hover:bg-primary/[0.04]"
      onKeyDown={handleKeyDown}
    >
      <TableCell colSpan={colSpan} className="border-l-2 border-primary py-3 pl-[26px] pr-4">
        <div
          ref={footerRef}
          // El margen de scroll evita que el pie quede pegado al filo de la
          // caja: `scrollIntoView` lo respeta y deja aire bajo los botones.
          className="sticky left-[26px] flex w-fit scroll-mb-4 flex-wrap items-center gap-2"
        >
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          <Button size="sm" disabled={!canSave} onClick={save}>
            {submitLabel}
          </Button>
          <span className="ml-1 text-[11px] text-text-muted">
            {weightIsValid ? "Enter guarda · Esc descarta" : "El peso va entre 1 y 100"}
          </span>
        </div>
      </TableCell>
    </TableRow>
    </>
  );
}

/**
 * Qué fue lo último que pasó: cuándo, y si movió el número o la conversación.
 *
 * Van juntos porque son la misma pregunta. Una fecha sola no distingue un
 * objetivo que avanzó ayer de uno que ayer solo recibió una pregunta, y esa es
 * justo la diferencia que hay que ver antes de decidir a quién recordarle qué.
 */
export function LastActivity({ entry }: { entry: ResultEntry }) {
  const last = lastActivityOf(entry);
  if (!last) {
    return <span className="text-[12.5px] text-text-muted">Sin actividad</span>;
  }
  const isReport = last.value !== null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12.5px] text-text-secondary">{formatRelativeDate(last.date)}</span>
      <span
        className={cn(
          "inline-flex w-fit items-center gap-1 rounded-full px-1.5 py-px text-[10.5px] font-bold",
          isReport ? "bg-primary/10 text-primary" : "bg-surface-muted text-text-secondary"
        )}
      >
        {isReport ? (
          <TrendingUp className="size-2.5" strokeWidth={2.6} />
        ) : (
          <MessageSquareText className="size-2.5" strokeWidth={2.6} />
        )}
        {isReport ? "Actualización" : "Comentario"}
      </span>
    </div>
  );
}

/** "Peso 25 % · Porcentaje · 78 % → 96 %", según lo que el objetivo traiga. */
export function ObjectiveMetaLine({ objective }: { objective: Objective }) {
  const measure = objective.measure ? MEASURE_META[objective.measure] : null;
  const prefix = measure?.symbol === "$" ? "$" : "";
  const suffix = measure?.symbol === "%" ? " %" : "";
  const initial = objective.initialValue.trim();
  const target = objective.targetValue.trim();
  const parts = [`Peso ${objective.weight} %`];
  if (measure) parts.push(measure.label);
  if (target !== "") {
    parts.push(
      initial !== ""
        ? `${prefix}${initial}${suffix} → ${prefix}${target}${suffix}`
        : `Meta ${prefix}${target}${suffix}`
    );
  }
  return <>{parts.join(" · ")}</>;
}
