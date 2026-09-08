import * as React from "react";
import {
  Check,
  CircleGauge,
  FileText,
  History,
  Link2,
  MessageSquareText,
  Minus,
  Paperclip,
  PenLine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SheetFooter } from "@/components/ui/sheet";
import { DrawerSection, DrawerShell } from "@/components/overlays";
import { FileUpload } from "@/components/upload";
import { formatFileSize } from "@/components/upload/uploadUtils";
import {
  DIRECTION_META,
  MEASURE_META,
  formatRawValue,
  type CicloStatus,
  type Objective,
} from "@/components/ciclo-builder";
import {
  getEstadoBadgeConfig,
  useObjetivosConfig,
} from "@/components/objetivos/objetivosConfigStore";
import {
  UPDATE_AUTHOR_ROLE_LABELS,
  type ObjectiveUpdate,
  type ObjectiveUpdateInput,
  type TrackedObjective,
  type TrackedPerson,
} from "./cicloDetailTypes";
import {
  complianceForValue,
  formatDateTime,
  formatPercent,
  objectiveCompliance,
  resolveEstado,
} from "./cicloProgress";
import { ComplianceBar, EstadoChip, InitialsAvatar, MeasureGlyph } from "./StatusChips";

export interface ObjectiveUpdateTarget {
  person: TrackedPerson;
  tracked: TrackedObjective;
}

interface ObjectiveUpdateDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ObjectiveUpdateTarget | null;
  cicloStatus: CicloStatus;
  companyObjectives: readonly Objective[];
  onSubmit: (input: ObjectiveUpdateInput) => void;
}

const ACCEPTED_EVIDENCE = ".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv,.docx,.pptx";

/**
 * Actualizar el avance de un objetivo de una persona, sin salir de la tabla.
 *
 * El valor, el comentario y las evidencias van en el mismo formulario porque
 * son la misma acción vista por quien la lee después: "reporté 84 %, así lo
 * soporto, esto quiero decir al respecto". Y el historial va debajo, en el
 * mismo panel, porque una actualización se escribe mirando la anterior.
 */
export function ObjectiveUpdateDrawer({
  open,
  onOpenChange,
  target,
  cicloStatus,
  companyObjectives,
  onSubmit,
}: ObjectiveUpdateDrawerProps) {
  const canReport = cicloStatus === "live";
  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      size="2xl"
      title={canReport ? "Actualizar avance" : "Historial del objetivo"}
      description={target?.tracked.objective.title}
      disablePadding
      className="gap-0"
    >
      {target && (
        <DrawerBody
          key={`${target.person.id}:${target.tracked.objective.id}`}
          target={target}
          canReport={canReport}
          cicloStatus={cicloStatus}
          companyObjectives={companyObjectives}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
        />
      )}
    </DrawerShell>
  );
}

function DrawerBody({
  target,
  canReport,
  cicloStatus,
  companyObjectives,
  onCancel,
  onSubmit,
}: {
  target: ObjectiveUpdateTarget;
  canReport: boolean;
  cicloStatus: CicloStatus;
  companyObjectives: readonly Objective[];
  onCancel: () => void;
  onSubmit: (input: ObjectiveUpdateInput) => void;
}) {
  const { estados, allowNegativeResults } = useObjetivosConfig();
  const { person, tracked } = target;
  const { objective, currentValue } = tracked;
  const isBoolean = objective.measure === "boolean";
  const measure = objective.measure ? MEASURE_META[objective.measure] : null;
  const aligned = objective.alignedTo
    ? companyObjectives.find((item) => item.id === objective.alignedTo)
    : null;

  const [valueDraft, setValueDraft] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [showValidation, setShowValidation] = React.useState(false);

  const currentPercent = objectiveCompliance(tracked, allowNegativeResults);
  const currentEstado = resolveEstado(estados, currentPercent, cicloStatus);

  const isValueTouched = valueDraft !== "";
  const previewPercent = isValueTouched
    ? complianceForValue(objective, valueDraft, allowNegativeResults)
    : null;
  const previewEstado =
    previewPercent === null ? null : resolveEstado(estados, previewPercent, cicloStatus);
  const previewBadge = previewEstado ? getEstadoBadgeConfig(previewEstado) : null;
  const valueInvalid = isValueTouched && previewPercent === null;
  const valueChanged = isValueTouched && !valueInvalid && valueDraft !== currentValue;

  const hasComment = comment.trim() !== "";
  const canSubmit = valueChanged || hasComment || files.length > 0;
  const submitLabel = valueChanged
    ? "Guardar avance"
    : files.length > 0
      ? "Publicar comentario y evidencias"
      : "Publicar comentario";

  const handleSubmit = () => {
    if (valueInvalid) {
      setShowValidation(true);
      return;
    }
    if (!canSubmit) return;
    onSubmit({
      value: valueChanged ? valueDraft : null,
      comment: comment.trim(),
      files,
    });
  };

  const history = [...tracked.updates].reverse();

  return (
    <>
      {/* Las secciones entran escalonadas una vez el drawer terminó de
          deslizarse — el mismo lenguaje que el resto de los paneles. */}
      <div className="cascade-enter-drawer flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-background p-4 [scrollbar-gutter:stable]">
        {/* Contexto: de quién y de qué objetivo hablamos */}
        <section className="rounded-2xl border border-border/60 bg-surface p-3.5 shadow-card">
          <div className="flex items-start gap-3">
            <InitialsAvatar name={person.collaborator.name} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-text-primary">{person.collaborator.name}</p>
              <p className="text-[12px] text-text-secondary">
                {person.collaborator.area}
                {person.groupId ? ` · ${person.groupId}` : " · Objetivos individuales"}
              </p>
            </div>
            <EstadoChip estado={currentEstado} />
          </div>

          <div className="mt-3 flex items-start gap-3 rounded-xl border border-border/60 bg-surface-muted/40 p-3.5">
            <MeasureGlyph symbol={measure?.symbol ?? "?"} className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold leading-snug text-text-primary">{objective.title}</p>
              {objective.description && (
                <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">{objective.description}</p>
              )}
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px] sm:grid-cols-4">
                {!isBoolean && (
                  <>
                    <Meta label="Valor inicial" value={formatRawValue(objective.initialValue, objective.measure) ?? "—"} />
                    <Meta label="Meta" value={formatRawValue(objective.targetValue, objective.measure) ?? "—"} />
                  </>
                )}
                <Meta
                  label="Actual"
                  value={
                    isBoolean
                      ? currentValue === "true"
                        ? "Se cumplió"
                        : currentValue === "false"
                          ? "No se cumplió"
                          : "Pendiente"
                      : currentValue === ""
                        ? "Sin reporte"
                        : formatRawValue(currentValue, objective.measure) ?? "—"
                  }
                  emphasized
                />
                <Meta label="Peso" value={`${objective.weight} %`} />
              </dl>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-text-muted">
                {objective.direction && (
                  <span>{measure?.label} · {DIRECTION_META[objective.direction].label}</span>
                )}
                {objective.rangeEnabled && (
                  <span>
                    Mínimo {formatRawValue(objective.minValue, objective.measure) ?? "—"} · Máximo{" "}
                    {formatRawValue(objective.maxValue, objective.measure) ?? "—"}
                  </span>
                )}
                {aligned && (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <Link2 className="size-3 shrink-0" strokeWidth={2.2} />
                    <span className="truncate">{aligned.title}</span>
                  </span>
                )}
              </div>
              <ComplianceBar percent={currentPercent} estado={currentEstado} className="mt-3" />
            </div>
          </div>
        </section>

        {/* Nuevo avance */}
        {canReport && (
          <DrawerSection
            icon={PenLine}
            tone="brand"
            title="Nuevo avance"
            hint="Opcional si solo quieres comentar."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-[12px] font-semibold text-text-secondary">
                  {isBoolean ? "Resultado" : "Valor alcanzado"}
                </label>
                {isBoolean ? (
                  <div className="grid grid-cols-2 gap-2">
                    <OutcomeOption
                      selected={valueDraft === "true"}
                      onClick={() => setValueDraft(valueDraft === "true" ? "" : "true")}
                      icon={Check}
                      label="Se cumplió"
                      tone="positive"
                    />
                    <OutcomeOption
                      selected={valueDraft === "false"}
                      onClick={() => setValueDraft(valueDraft === "false" ? "" : "false")}
                      icon={Minus}
                      label="No se cumplió"
                      tone="negative"
                    />
                  </div>
                ) : (
                  <span className="relative block">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[12px] font-bold text-text-muted">
                      {measure?.symbol}
                    </span>
                    <input
                      inputMode="decimal"
                      value={valueDraft}
                      onChange={(event) => setValueDraft(event.target.value)}
                      onBlur={() => setShowValidation(true)}
                      placeholder={
                        currentValue === ""
                          ? `Ej. ${formatRawValue(objective.targetValue, objective.measure)?.replace(/[$%\s]/g, "") ?? ""}`
                          : `Actual: ${formatRawValue(currentValue, objective.measure) ?? ""}`
                      }
                      aria-invalid={showValidation && valueInvalid}
                      className={cn(
                        "h-10 w-full rounded-md border bg-surface pl-8 pr-3 text-[13px] tabular-nums text-text-primary outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/25 placeholder:text-muted-foreground/70",
                        showValidation && valueInvalid ? "border-destructive/60" : "border-border"
                      )}
                    />
                  </span>
                )}
                {showValidation && valueInvalid ? (
                  <span className="text-[11.5px] text-destructive">Escribe un número válido.</span>
                ) : (
                  <span className="text-[11.5px] text-text-muted">
                    {isBoolean
                      ? "Vuelve a pulsar la opción para dejarla sin cambios."
                      : "Usa punto para miles y coma para decimales, como 80.000 o 62,5."}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1.5 text-[12px] font-semibold text-text-secondary">
                  <CircleGauge className="size-3.5" strokeWidth={2.2} />
                  Cumplimiento
                </span>
                <div className="flex h-10 items-center gap-2 rounded-md border border-primary/15 px-3">
                  {previewPercent !== null ? (
                    <>
                      <span className="flex shrink-0 items-baseline gap-0.5">
                        <span
                          className={cn(
                            "text-[20px] font-black leading-none tabular-nums tracking-tight",
                            previewBadge?.iconColor ?? "text-primary"
                          )}
                        >
                          {formatPercent(previewPercent).replace(" %", "")}
                        </span>
                        <span className="text-[12px] font-bold text-muted-foreground/70">%</span>
                      </span>
                      {previewEstado && <EstadoChip estado={previewEstado} size="sm" className="ml-auto" />}
                    </>
                  ) : (
                    <span className="text-[15px] font-black text-text-muted">--</span>
                  )}
                </div>
                {previewPercent !== null && (
                  <span
                    className={cn(
                      "text-[11.5px] tabular-nums",
                      previewPercent >= currentPercent ? "text-status-positive" : "text-status-negative"
                    )}
                  >
                    {previewPercent >= currentPercent ? "+" : ""}
                    {formatPercent(Math.round((previewPercent - currentPercent) * 10) / 10)} frente al avance actual
                  </span>
                )}
              </div>
            </div>
          </DrawerSection>
        )}

        {/* Comentario */}
        <DrawerSection
          icon={MessageSquareText}
          tone="brand"
          title="Comentario"
          hint={canReport ? "Lo verán el colaborador y su líder." : "El ciclo está cerrado: puedes comentar, no cambiar el avance."}
        >
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value.slice(0, 600))}
            placeholder="Cuéntale al equipo qué pasó con este avance, qué falta o qué apoyo necesitas…"
            className="min-h-[96px]"
          />
          <span className="mt-1.5 block text-right text-[11px] tabular-nums text-text-muted">
            {comment.length}/600
          </span>
        </DrawerSection>

        {/* Evidencias */}
        <DrawerSection
          icon={Paperclip}
          tone="brand"
          title="Evidencias"
          hint="Soportes del avance: reportes, capturas, certificados."
        >
          <FileUpload
            value={files}
            onChange={setFiles}
            multiple
            maxFiles={5}
            maxSizeMB={15}
            accept={ACCEPTED_EVIDENCE}
            buttonLabel="Adjuntar evidencia"
          />
        </DrawerSection>

        {/* Historial */}
        <DrawerSection
          icon={History}
          tone="brand"
          title="Historial"
          badge={history.length > 0 ? String(history.length) : undefined}
          hint={
            history.length === 0
              ? "Todavía no hay actualizaciones."
              : `${history.length === 1 ? "Una entrada" : "Entradas"}, la más reciente primero.`
          }
        >
          {history.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface-muted/30 px-5 py-8 text-center text-[12.5px] text-text-secondary">
              Cuando alguien reporte un valor o deje un comentario, aparecerá aquí con su fecha y sus soportes.
            </div>
          ) : (
            <ol className="relative flex flex-col gap-3 before:absolute before:bottom-4 before:left-4 before:top-4 before:w-px before:bg-border/70">
              {history.map((update) => (
                <HistoryEntry
                  key={update.id}
                  update={update}
                  objective={objective}
                  allowNegative={allowNegativeResults}
                  cicloStatus={cicloStatus}
                />
              ))}
            </ol>
          )}
        </DrawerSection>
      </div>

      <SheetFooter className="flex-row items-center justify-between gap-3 border-t border-border/60 bg-surface px-4 py-3">
        <span className="text-[11.5px] text-text-muted">
          {valueChanged
            ? "Se registrará el nuevo valor con tu comentario."
            : canReport
              ? "Sin un valor nuevo, se publica solo el comentario."
              : ""}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel} className="h-9 px-4 text-[13px]">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit && !valueInvalid} className="h-9 px-4 text-[13px]">
            {submitLabel}
          </Button>
        </div>
      </SheetFooter>
    </>
  );
}

function Meta({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className={cn("truncate tabular-nums", emphasized ? "font-bold text-text-primary" : "font-medium text-text-secondary")}>
        {value}
      </dd>
    </div>
  );
}

function OutcomeOption({
  selected,
  onClick,
  icon: Icon,
  label,
  tone,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  tone: "positive" | "negative";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex h-10 items-center justify-center gap-2 rounded-md border text-[13px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.98]",
        selected
          ? tone === "positive"
            ? "border-status-positive/40 bg-status-positive/10 text-status-positive"
            : "border-status-negative/40 bg-status-negative/10 text-status-negative"
          : "border-border bg-surface text-text-secondary hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
      )}
    >
      <Icon className="size-4" strokeWidth={2.6} />
      {label}
    </button>
  );
}

const ROLE_STYLES: Readonly<Record<ObjectiveUpdate["authorRole"], string>> = {
  colaborador: "bg-surface-muted text-text-secondary",
  lider: "bg-primary/10 text-primary",
  admin: "bg-ai-bg text-[#6b3fd6]",
};

function HistoryEntry({
  update,
  objective,
  allowNegative,
  cicloStatus,
}: {
  update: ObjectiveUpdate;
  objective: Objective;
  allowNegative: boolean;
  cicloStatus: CicloStatus;
}) {
  const { estados } = useObjetivosConfig();
  const percent = update.value === null ? null : complianceForValue(objective, update.value, allowNegative);
  const estado = percent === null ? null : resolveEstado(estados, percent, cicloStatus);
  const valueLabel =
    update.value === null
      ? null
      : objective.measure === "boolean"
        ? update.value === "true"
          ? "Se cumplió"
          : "No se cumplió"
        : formatRawValue(update.value, objective.measure);

  return (
    <li className="relative pl-11">
      <InitialsAvatar name={update.authorName} className="absolute left-0 top-0 ring-4 ring-surface" />
      <article className="rounded-xl border border-border/60 bg-surface p-3.5 shadow-card">
        <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[12.5px] font-bold text-text-primary">{update.authorName}</span>
          <span className={cn("rounded-full px-2 py-px text-[10px] font-bold uppercase tracking-wide", ROLE_STYLES[update.authorRole])}>
            {UPDATE_AUTHOR_ROLE_LABELS[update.authorRole]}
          </span>
          <time dateTime={update.date} className="ml-auto text-[11px] tabular-nums text-text-muted">
            {formatDateTime(update.date)}
          </time>
        </header>

        {valueLabel !== null && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-surface-muted/40 px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Reportó</span>
            <span className="text-[13px] font-bold tabular-nums text-text-primary">{valueLabel}</span>
            {percent !== null && (
              <>
                <span aria-hidden className="h-3.5 w-px bg-border" />
                <span className="text-[12px] font-semibold tabular-nums text-text-secondary">{formatPercent(percent)} de cumplimiento</span>
                <EstadoChip estado={estado} size="sm" className="ml-auto" />
              </>
            )}
          </div>
        )}

        {update.comment && (
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-text-secondary">{update.comment}</p>
        )}

        {update.evidences.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {update.evidences.map((file) => (
              <li
                key={file.id}
                className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border/60 bg-surface px-2.5 py-1 text-[11.5px] text-text-secondary transition-colors hover:border-primary/40 hover:text-primary"
              >
                <FileText className="size-3.5 shrink-0" strokeWidth={2} />
                <span className="truncate font-medium">{file.name}</span>
                <span className="shrink-0 text-text-muted">{formatFileSize(file.size)}</span>
              </li>
            ))}
          </ul>
        )}
      </article>
    </li>
  );
}
