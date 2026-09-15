import * as React from "react";
import { Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModalShell } from "@/components/overlays";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SegmentedControl } from "@/components/selection/SegmentedControl";
import { formatPercent } from "@/components/ciclo-detail";
import { MEASURE_META, type Objective } from "@/components/ciclo-builder";
import { EvidenceChip } from "./ObjectiveThread";
import type { ResultEntry } from "./resultsModel";

/**
 * Los dos formularios que todavía piden una caja propia: reportar un avance
 * —valor, comentario y soportes— y denegar un objetivo con su motivo.
 *
 * Los demás gestos de la ficha no llegan hasta aquí: eliminar, inactivar y
 * comentar se resuelven en un popover anclado a su botón, y corregir cómo está
 * escrito el objetivo se hace en la propia fila de la tabla, en línea.
 */

/** Lo que devuelve el formulario de avance. */
export interface ProgressInput {
  value: string;
  comment: string;
  files: readonly File[];
}

/**
 * Los campos que la edición puede cambiar de un objetivo: cómo está escrito y
 * hacia dónde empuja. El avance no está aquí a propósito —se reporta, con su
 * fecha y su autor— y editarlo de contrabando borraría el rastro de quién dijo
 * qué.
 */
export interface ObjectivePatch {
  title: string;
  description: string;
  weight: number;
  initialValue: string;
  targetValue: string;
  /** A qué objetivo de empresa empuja, o `null` si no empuja a ninguno. */
  alignedTo: string | null;
}

/** El objetivo tal como entra al formulario que lo edita. */
export const objectivePatchOf = (objective: Objective): ObjectivePatch => ({
  title: objective.title,
  description: objective.description,
  weight: objective.weight,
  initialValue: objective.initialValue,
  targetValue: objective.targetValue,
  alignedTo: objective.alignedTo,
});

const ACCEPTED_EVIDENCE = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv";

// ── Actualizar avance ──────────────────────────────────────────────────────

/**
 * Reportar un avance: el valor nuevo, con la conversación que lo acompaña.
 *
 * El valor va primero y con el recorrido a la vista —de dónde salió, a dónde
 * tiene que llegar— porque un número suelto no dice si 62 está cerca o lejos.
 * El comentario y los soportes son opcionales: obligar a escribir algo cada
 * vez es la forma más corta de llenar un hilo de "ok".
 */
export function UpdateProgressDialog({
  entry,
  open,
  onOpenChange,
  onSubmit,
}: {
  entry: ResultEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: ProgressInput) => void;
}) {
  const measure = entry.objective.measure;
  const meta = measure ? MEASURE_META[measure] : null;
  const isBoolean = measure === "boolean";

  const [value, setValue] = React.useState(entry.tracked.currentValue);
  const [comment, setComment] = React.useState("");
  const [files, setFiles] = React.useState<readonly File[]>([]);

  // Cada apertura arranca del valor que hay hoy: dejar el de la vez anterior
  // sería proponer un número que ya nadie está mirando.
  const [seen, setSeen] = React.useState(open);
  if (seen !== open) {
    setSeen(open);
    if (open) {
      setValue(entry.tracked.currentValue);
      setComment("");
      setFiles([]);
    }
  }

  const canSend = value.trim() !== "" && value.trim() !== entry.tracked.currentValue.trim();

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Actualizar avance"
      description={entry.objective.title || "Objetivo sin nombre"}
      actions={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!canSend}
            onClick={() => onSubmit({ value: value.trim(), comment: comment.trim(), files })}
          >
            Guardar avance
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-muted px-3 py-2.5 text-[12px]">
          <span className="text-text-secondary">
            {meta ? meta.label : "Sin tipo de medida"}
            {entry.objective.targetValue.trim() !== "" && (
              <>
                {" · "}
                {entry.objective.initialValue.trim() !== "" &&
                  `${formatRaw(entry.objective, entry.objective.initialValue)} → `}
                {formatRaw(entry.objective, entry.objective.targetValue)}
              </>
            )}
          </span>
          <span className="font-semibold tabular-nums text-text-primary">
            Hoy va en {formatPercent(entry.percent)}
          </span>
        </div>

        {isBoolean ? (
          <Field label="¿Ya se cumplió?">
            <SegmentedControl
              ariaLabel="Si el objetivo ya se cumplió"
              options={[
                { value: "true", label: "Se cumplió" },
                { value: "false", label: "Todavía no" },
              ]}
              value={value === "true" ? "true" : "false"}
              onChange={setValue}
            />
          </Field>
        ) : (
          <Field label="Valor alcanzado" hint={`El valor de hoy, en ${meta?.label.toLowerCase() ?? "la medida del objetivo"}.`}>
            <Input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={entry.objective.targetValue || "Escribe el valor…"}
              inputMode="decimal"
              autoFocus
            />
          </Field>
        )}

        <Field label="Comentario" hint="Opcional. Entra al hilo del objetivo junto al valor.">
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            placeholder="Qué pasó para llegar a este valor…"
            className="min-h-[5rem] resize-none text-[13px]"
          />
        </Field>

        <AttachmentField files={files} onChange={setFiles} />
      </div>
    </ModalShell>
  );
}

// ── Denegar objetivo ───────────────────────────────────────────────────────

/**
 * Devuelve uno o varios objetivos a "Por ajustar", con el motivo.
 *
 * El motivo es obligatorio y no opcional como el de un comentario cualquiera:
 * es lo único que le dice a quien lo escribió qué tiene que cambiar antes de
 * volver a enviarlo, y sin él "denegado" es solo un semáforo en rojo sin
 * explicación.
 */
export function DenyObjectiveDialog({
  count,
  open,
  onOpenChange,
  onSubmit,
}: {
  /** A cuántos objetivos alcanza el mismo motivo. */
  count: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = React.useState("");

  const [seen, setSeen] = React.useState(open);
  if (seen !== open) {
    setSeen(open);
    if (open) setReason("");
  }

  const canSend = reason.trim() !== "";

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={count === 1 ? "Denegar objetivo" : `Denegar ${count} objetivos`}
      description="Vuelve a quien lo escribió como 'Por ajustar'. No cuenta en su avance hasta que lo reenvíe."
      actions={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={!canSend}
            onClick={() => onSubmit(reason.trim())}
          >
            Denegar
          </Button>
        </>
      }
    >
      <Field label="Motivo" hint="Obligatorio. Es lo que le dice qué cambiar antes de reenviarlo.">
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={4}
          placeholder="Qué hay que ajustar…"
          className="min-h-[6rem] resize-none text-[13px]"
          autoFocus
        />
      </Field>
    </ModalShell>
  );
}

// ── Piezas compartidas ─────────────────────────────────────────────────────

function Field({
  label,
  hint,
  invalid = false,
  children,
}: {
  label: string;
  hint?: string;
  invalid?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[12px] font-semibold text-text-primary">{label}</Label>
      {children}
      {hint && (
        <p className={cn("text-[11px]", invalid ? "text-destructive" : "text-text-muted")}>{hint}</p>
      )}
    </div>
  );
}

/** El adjuntador de los tres formularios: un botón y las fichas de lo elegido. */
function AttachmentField({
  files,
  onChange,
}: {
  files: readonly File[];
  onChange: (files: readonly File[]) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_EVIDENCE}
        className="hidden"
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? []);
          if (picked.length > 0) onChange([...files, ...picked]);
          // El mismo archivo dos veces seguidas no dispara `change` si el
          // input se queda con su valor.
          event.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        className="w-fit gap-1.5 font-semibold"
      >
        <Paperclip className="size-3.5" />
        Adjuntar evidencia
      </Button>
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`}>
              <EvidenceChip
                name={file.name}
                size={file.size}
                type={file.type}
                onRemove={() => onChange(files.filter((_, at) => at !== index))}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Un valor crudo con el símbolo de su medida: "$180.000.000", "96 %". */
function formatRaw(objective: Objective, raw: string): string {
  const meta = objective.measure ? MEASURE_META[objective.measure] : null;
  const prefix = meta?.symbol === "$" ? "$" : "";
  const suffix = meta?.symbol === "%" ? " %" : "";
  return `${prefix}${raw}${suffix}`;
}
