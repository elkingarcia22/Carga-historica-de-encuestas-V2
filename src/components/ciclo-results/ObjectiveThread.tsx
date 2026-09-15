import * as React from "react";
import {
  CornerDownRight,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  Paperclip,
  Send,
  TrendingUp,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CURRENT_USER } from "@/components/app-shell/appShellData";
import { InitialsAvatar, formatDateTime, formatRelativeDate } from "@/components/ciclo-detail";
import {
  UPDATE_AUTHOR_ROLE_LABELS,
  type EvidenceFile,
  type ObjectiveUpdate,
  type UpdateAuthorRole,
} from "@/components/ciclo-detail";
import { formatFileSize, getFileExtension } from "@/components/upload";
import { MEASURE_META, type Objective } from "@/components/ciclo-builder";

/**
 * El hilo de un objetivo: la conversación entre quien lo lleva y su líder.
 *
 * El historial de un objetivo nunca fue una lista de reportes. Alguien sube un
 * avance con su soporte, el líder pregunta, quien lo lleva contesta y adjunta
 * lo que le piden: eso es un hilo, y leído como una pila de tarjetas iguales
 * se pierde justo lo que hay que ver —quién le está hablando a quién—.
 *
 * Una sola altura de anidamiento a propósito. Una respuesta a una respuesta
 * sigue colgando del mismo mensaje raíz, así que el hilo se recorre en
 * vertical y nunca se escapa hacia la derecha.
 *
 * Se escribe desde el mismo sitio en el que se lee: un redactor al pie, con
 * adjuntos, que publica en el hilo o contesta a un mensaje concreto.
 */

export interface ThreadPost {
  comment: string;
  files: readonly File[];
  /** El mensaje al que contesta, o `null` si abre hilo. */
  replyTo: string | null;
}

export function ObjectiveThread({
  objective,
  updates,
  /** Publica un mensaje. Sin ella el hilo queda de solo lectura. */
  onPost,
  className,
}: {
  objective: Objective;
  updates: readonly ObjectiveUpdate[];
  onPost?: (post: ThreadPost) => void;
  className?: string;
}) {
  const [replyTo, setReplyTo] = React.useState<string | null>(null);
  const composerRef = React.useRef<HTMLTextAreaElement>(null);

  // Cada mensaje raíz con lo que le contestaron, en el orden en que pasó.
  const threads = React.useMemo(() => groupIntoThreads(updates), [updates]);
  const replyingTo = replyTo === null ? null : updates.find((update) => update.id === replyTo) ?? null;

  const startReply = (id: string) => {
    setReplyTo(id);
    // El redactor es uno solo al pie: sin llevar el foco hasta él, pulsar
    // "Responder" en el primer mensaje de un hilo largo no parece hacer nada.
    requestAnimationFrame(() => composerRef.current?.focus());
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-2">
        <h4 className="text-[12.5px] font-bold text-text-primary">Conversación</h4>
        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-text-secondary">
          {updates.length}
        </span>
      </div>

      {threads.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/70 px-3 py-4 text-center text-[12px] text-text-muted">
          Todavía nadie ha escrito en este objetivo. Escribe el primer mensaje para pedir un avance o
          dejar una observación.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {threads.map((thread) => (
            <li key={thread.root.id} className="flex flex-col">
              <Message
                update={thread.root}
                objective={objective}
                onReply={onPost ? () => startReply(thread.root.id) : undefined}
              />
              {thread.replies.length > 0 && (
                <ol className="relative ml-4 flex flex-col gap-2 border-l border-border/70 pl-4 pt-2">
                  {thread.replies.map((reply) => (
                    <li key={reply.id}>
                      <Message
                        update={reply}
                        objective={objective}
                        isReply
                        onReply={onPost ? () => startReply(thread.root.id) : undefined}
                      />
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ol>
      )}

      {onPost && (
        <Composer
          textareaRef={composerRef}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyTo(null)}
          onPost={(post) => {
            onPost(post);
            setReplyTo(null);
          }}
        />
      )}
    </div>
  );
}

// ── Mensajes ───────────────────────────────────────────────────────────────

interface Thread {
  root: ObjectiveUpdate;
  replies: readonly ObjectiveUpdate[];
}

/**
 * Los mensajes repartidos en hilos, por fecha.
 *
 * Una respuesta cuyo mensaje raíz ya no está —se editó el ciclo, llegó a medias
 * de otra parte— se trata como raíz en vez de desaparecer: perder lo que
 * alguien escribió es peor que dibujarlo un nivel más arriba.
 */
function groupIntoThreads(updates: readonly ObjectiveUpdate[]): readonly Thread[] {
  const byDate = [...updates].sort((a, b) => a.date.localeCompare(b.date));
  const ids = new Set(byDate.map((update) => update.id));
  const repliesByRoot = new Map<string, ObjectiveUpdate[]>();

  byDate.forEach((update) => {
    const parent = update.replyTo;
    if (!parent || !ids.has(parent) || parent === update.id) return;
    repliesByRoot.set(parent, [...(repliesByRoot.get(parent) ?? []), update]);
  });

  const attached = new Set([...repliesByRoot.values()].flat().map((update) => update.id));
  return byDate
    .filter((update) => !attached.has(update.id))
    .map((root) => ({ root, replies: repliesByRoot.get(root.id) ?? [] }));
}

const ROLE_ACCENT: Readonly<Record<UpdateAuthorRole, string>> = {
  colaborador: "var(--color-indigo)",
  lider: "var(--color-brand)",
  admin: "var(--color-warning)",
};

function Message({
  update,
  objective,
  isReply = false,
  onReply,
}: {
  update: ObjectiveUpdate;
  objective: Objective;
  isReply?: boolean;
  onReply?: () => void;
}) {
  const accent = ROLE_ACCENT[update.authorRole];
  const reported = update.value === null ? null : formatReportedValue(objective, update.value);

  return (
    <article
      className={cn(
        "group/message flex gap-2.5 rounded-xl border px-3 py-2.5 transition-colors",
        isReply
          ? "border-border/50 bg-surface-muted/60"
          : "border-border/60 bg-surface shadow-sm hover:border-border"
      )}
    >
      <InitialsAvatar name={update.authorName} size="sm" className="mt-0.5" />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[12.5px] font-bold leading-none text-text-primary">
            {update.authorName}
          </span>
          <span
            className="rounded-full px-1.5 py-[1px] text-[10px] font-bold leading-[1.35]"
            style={{
              backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`,
              color: accent,
            }}
          >
            {UPDATE_AUTHOR_ROLE_LABELS[update.authorRole]}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-[11px] font-medium leading-none text-text-muted">
                {formatRelativeDate(update.date)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">{formatDateTime(update.date)}</TooltipContent>
          </Tooltip>

          {onReply && (
            <button
              type="button"
              onClick={onReply}
              className="ml-auto flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-text-muted opacity-0 transition-all hover:bg-surface-muted hover:text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 group-hover/message:opacity-100"
            >
              <CornerDownRight className="size-3" strokeWidth={2.4} />
              Responder
            </button>
          )}
        </div>

        {/* El valor reportado no es un comentario más: es el dato que mueve el
            avance, así que se lee antes que el texto y con su propia forma. */}
        {reported && (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-primary/[0.07] px-2 py-1 text-[11.5px] font-bold text-primary">
            <TrendingUp className="size-3.5" strokeWidth={2.4} />
            Reportó {reported}
          </span>
        )}

        {update.comment.trim() !== "" && (
          <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-text-secondary">
            {update.comment}
          </p>
        )}

        {update.evidences.length > 0 && <EvidenceRow evidences={update.evidences} />}
      </div>
    </article>
  );
}

// ── Evidencias ─────────────────────────────────────────────────────────────

type EvidenceKind = "image" | "pdf" | "spreadsheet" | "file";

const EVIDENCE_ICON: Readonly<Record<EvidenceKind, LucideIcon>> = {
  image: ImageIcon,
  pdf: FileText,
  spreadsheet: FileSpreadsheet,
  file: Paperclip,
};

const EVIDENCE_ACCENT: Readonly<Record<EvidenceKind, string>> = {
  image: "var(--color-indigo)",
  pdf: "var(--color-negative)",
  spreadsheet: "var(--color-positive)",
  file: "var(--color-text-muted)",
};

/** De qué es un adjunto, por su tipo MIME y, si no lo dice, por su extensión. */
function evidenceKind(file: { name: string; type: string }): EvidenceKind {
  const extension = getFileExtension(file.name);
  if (file.type.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "heic"].includes(extension)) {
    return "image";
  }
  if (file.type === "application/pdf" || extension === "pdf") return "pdf";
  if (["csv", "xls", "xlsx"].includes(extension) || file.type.includes("spreadsheet")) return "spreadsheet";
  return "file";
}

function EvidenceRow({ evidences }: { evidences: readonly EvidenceFile[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {evidences.map((evidence) => (
        <li key={evidence.id}>
          <EvidenceChip name={evidence.name} size={evidence.size} type={evidence.type} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Un adjunto: el cuadro de su tipo, el nombre y el peso.
 *
 * Una foto y una hoja de cálculo no son el mismo adjunto, así que el cuadro
 * cambia de icono y de color con el tipo — en una conversación donde se suben
 * capturas, actas y consolidados, poder distinguirlos sin leer el nombre es la
 * mitad de la lectura.
 */
export function EvidenceChip({
  name,
  size,
  type,
  onRemove,
}: {
  name: string;
  size: number;
  type: string;
  /** Solo en el redactor: quitar un archivo antes de enviarlo. */
  onRemove?: () => void;
}) {
  const kind = evidenceKind({ name, type });
  const Icon = EVIDENCE_ICON[kind];
  const accent = EVIDENCE_ACCENT[kind];

  return (
    <span
      title={`${name} · ${formatFileSize(size)}`}
      className="flex max-w-[15rem] items-center gap-2 rounded-lg border border-border/60 bg-surface py-1 pl-1 pr-2"
    >
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`, color: accent }}
      >
        <Icon className="size-3.5" strokeWidth={2.2} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11.5px] font-semibold leading-tight text-text-primary">
          {name}
        </span>
        <span className="block text-[10.5px] leading-tight text-text-muted">
          {formatFileSize(size)}
        </span>
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Quitar ${name}`}
          className="ml-0.5 flex size-5 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-muted hover:text-destructive"
        >
          <X className="size-3.5" strokeWidth={2.4} />
        </button>
      )}
    </span>
  );
}

// ── Redactor ───────────────────────────────────────────────────────────────

const ACCEPTED_EVIDENCE = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv";

function Composer({
  textareaRef,
  replyingTo,
  onCancelReply,
  onPost,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  replyingTo: ObjectiveUpdate | null;
  onCancelReply: () => void;
  onPost: (post: ThreadPost) => void;
}) {
  const [comment, setComment] = React.useState("");
  const [files, setFiles] = React.useState<readonly File[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const canSend = comment.trim() !== "" || files.length > 0;

  const send = () => {
    if (!canSend) return;
    onPost({ comment: comment.trim(), files, replyTo: replyingTo?.id ?? null });
    setComment("");
    setFiles([]);
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-surface p-2.5 shadow-sm">
      {replyingTo && (
        <div className="flex items-center gap-2 rounded-lg bg-surface-muted/80 px-2.5 py-1.5">
          <CornerDownRight className="size-3.5 shrink-0 text-text-muted" strokeWidth={2.4} />
          <p className="min-w-0 flex-1 truncate text-[11.5px] text-text-secondary">
            Respondiendo a <span className="font-bold text-text-primary">{replyingTo.authorName}</span>
            {replyingTo.comment.trim() !== "" && ` · «${replyingTo.comment}»`}
          </p>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Cancelar la respuesta"
            className="flex size-5 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface hover:text-text-primary"
          >
            <X className="size-3.5" strokeWidth={2.4} />
          </button>
        </div>
      )}

      <div className="flex gap-2.5">
        <InitialsAvatar name={CURRENT_USER.name} size="sm" className="mt-1" />
        <Textarea
          ref={textareaRef}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          onKeyDown={(event) => {
            // Enviar con ⌘/Ctrl + Enter: el Enter solo tiene que seguir
            // sirviendo para escribir un párrafo dentro del mensaje.
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder={
            replyingTo ? "Escribe tu respuesta…" : "Escribe un mensaje o pide un soporte…"
          }
          className="min-h-[4.5rem] flex-1 resize-none border-border/60 bg-background text-[12.5px]"
        />
      </div>

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 pl-[2.4rem]">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`}>
              <EvidenceChip
                name={file.name}
                size={file.size}
                type={file.type}
                onRemove={() => setFiles((current) => current.filter((_, at) => at !== index))}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2 pl-[2.4rem]">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_EVIDENCE}
          className="hidden"
          onChange={(event) => {
            const picked = Array.from(event.target.files ?? []);
            if (picked.length > 0) setFiles((current) => [...current, ...picked]);
            // El mismo archivo dos veces seguidas no dispara `change` si el
            // input se queda con su valor.
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => fileInputRef.current?.click()}
          className="gap-1.5 font-semibold"
        >
          <Paperclip className="size-3.5" />
          Adjuntar evidencia
        </Button>
        <Button
          type="button"
          size="xs"
          onClick={send}
          disabled={!canSend}
          className="gap-1.5 font-semibold"
        >
          <Send className="size-3.5" />
          {replyingTo ? "Responder" : "Enviar"}
        </Button>
      </div>
    </div>
  );
}

// ── Formato ────────────────────────────────────────────────────────────────

/** El valor reportado tal como se lee: con su símbolo, o en palabras. */
function formatReportedValue(objective: Objective, raw: string): string {
  if (objective.measure === "boolean") {
    return raw === "true" ? "que ya se cumplió" : "que todavía no se cumple";
  }
  const measure = objective.measure ? MEASURE_META[objective.measure] : null;
  const prefix = measure?.symbol === "$" ? "$" : "";
  const suffix = measure?.symbol === "%" ? " %" : "";
  return `${prefix}${raw}${suffix}`;
}
