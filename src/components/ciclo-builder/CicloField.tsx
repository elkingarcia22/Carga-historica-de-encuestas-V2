import * as React from "react";

interface CicloFieldProps {
  label: string;
  /** Draws the red dot the rest of the product uses for required fields. */
  required?: boolean;
  hint?: string;
  /** Takes over the hint slot in the error's voice — one message per field. */
  error?: string;
  children: React.ReactNode;
}

/** Label, control, and a single line under it: either the hint or the error. */
export function CicloField({ label, required, hint, error, children }: CicloFieldProps) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="flex items-center gap-1 text-[13px] font-semibold text-text-primary">
        {label}
        {required && <span className="text-destructive">•</span>}
      </span>
      {children}
      {error ? (
        <span className="text-[12px] text-destructive">{error}</span>
      ) : (
        hint && <span className="text-[12px] leading-relaxed text-muted-foreground">{hint}</span>
      )}
    </label>
  );
}
