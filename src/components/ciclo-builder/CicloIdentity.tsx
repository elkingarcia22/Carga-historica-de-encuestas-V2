import * as React from "react";
import { cn } from "@/lib/utils";
import { AutosaveIndicator } from "@/components/survey-builder";
import type { AutosaveState } from "@/hooks/useAutosave";
import { CICLO_STATUS_LABELS, type CicloStatus } from "./cicloBuilderTypes";

interface CicloIdentityProps {
  name: string;
  status: CicloStatus;
  autosave: AutosaveState;
  onNameChange: (name: string) => void;
}

/** Tone per lifecycle state. Draft is deliberately the quietest. */
const STATUS_TONE: Readonly<Record<CicloStatus, string>> = {
  draft: "bg-surface-muted text-text-secondary",
  scheduled: "bg-status-info/10 text-status-info",
  live: "bg-status-positive/10 text-status-positive",
  closed: "bg-border/40 text-muted-foreground",
};

/**
 * What you are editing, rendered into the app shell's breadcrumb.
 *
 * The ciclo's name *is* the current crumb, editable in place, with its status
 * and autosave trailing as attributes of that title — the same treatment the
 * survey builder gives its own name, so moving between the two builders never
 * moves the field that says what you are working on.
 */
export function CicloIdentity({ name, status, autosave, onNameChange }: CicloIdentityProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const measureRef = React.useRef<HTMLSpanElement>(null);
  const [width, setWidth] = React.useState(0);

  React.useLayoutEffect(() => {
    if (measureRef.current) setWidth(measureRef.current.offsetWidth);
  }, [name]);

  return (
    <>
      <span
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute whitespace-pre text-sm font-semibold"
      >
        {name || "Ciclo sin título"}
      </span>

      <input
        ref={inputRef}
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && inputRef.current?.blur()}
        placeholder="Ciclo sin título"
        aria-label="Nombre del ciclo"
        style={{ width: `${Math.min(width + 18, 420)}px` }}
        className="min-w-[110px] max-w-full cursor-text truncate rounded-md bg-transparent px-1.5 py-1 text-sm font-semibold text-text-primary outline-none transition-colors hover:bg-surface-muted focus:bg-surface-muted placeholder:text-text-muted"
      />

      <span
        className={cn(
          "inline-flex h-[22px] shrink-0 items-center rounded-full px-2.5 text-[11px] font-bold leading-none",
          STATUS_TONE[status]
        )}
      >
        {CICLO_STATUS_LABELS[status]}
      </span>

      <AutosaveIndicator {...autosave} />
    </>
  );
}
