import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { computeCompliance, toNumber, type ParsedObjective, type RuleViolation } from "@/lib/objectivesImport";
import { QUIET_CELL, fieldStateClass } from "./reviewCellUtils";

/**
 * Las celdas de la tabla de revisión.
 *
 * Dos decisiones las gobiernan, ambas para que la tabla se lea como datos y no
 * como un formulario de 130 campos: las celdas son silenciosas —borde y fondo
 * solo al pasar el cursor o al enfocar— y el color marca únicamente la
 * excepción: una celda que rompe una regla conserva su contorno en reposo.
 */

interface NumberCellProps {
  value: number | null;
  onChange: (next: number | null) => void;
  /** Con `false`, vaciar la celda produce NaN para que la validación lo marque. */
  allowEmpty?: boolean;
  ariaLabel: string;
  violations?: RuleViolation[];
}

/**
 * Celda numérica con borrador local mientras tiene el foco: sin él, escribir
 * "-" o "1," se parsearía, rechazaría y devolvería, y el campo pelearía con la
 * persona a mitad de número.
 */
export const NumberCell: React.FC<NumberCellProps> = ({
  value,
  onChange,
  allowEmpty = true,
  ariaLabel,
  violations,
}) => {
  const [draft, setDraft] = React.useState<string | null>(null);
  const canonical = value === null || Number.isNaN(value) ? "" : String(value);

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      value={draft ?? canonical}
      placeholder="—"
      onChange={(event) => {
        const raw = event.target.value;
        setDraft(raw);
        if (raw.trim() === "") {
          onChange(allowEmpty ? null : NaN);
          return;
        }
        onChange(toNumber(raw) ?? NaN);
      }}
      onBlur={() => setDraft(null)}
      className={cn(QUIET_CELL, "text-right tabular-nums placeholder:text-text-muted/60", fieldStateClass(violations))}
    />
  );
};

interface QuietSelectProps<T extends string> {
  value: T;
  options: readonly T[];
  onChange: (next: T) => void;
  ariaLabel: string;
  violations?: RuleViolation[];
  renderOption: (option: T) => string;
}

/** El Select del sistema, encogido al tamaño de una celda. */
export function QuietSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  violations,
  renderOption,
}: QuietSelectProps<T>) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as T)}>
      <SelectTrigger
        aria-label={ariaLabel}
        title={renderOption(value)}
        className={cn(
          "h-7 w-full gap-1 rounded-md border border-border/60 bg-transparent px-1.5 dark:bg-transparent",
          "cursor-pointer text-[12px] text-text-primary transition-colors",
          "hover:border-border hover:bg-surface-muted/60",
          "focus:border-primary focus:bg-surface focus:ring-2 focus:ring-primary/20",
          "[&>svg]:size-3 [&>svg]:shrink-0 [&>svg]:text-text-muted",
          // Deja que la etiqueta se encoja en vez de empujar el chevrón.
          "[&>span]:min-w-0 [&>span]:flex-1 [&>span]:truncate [&>span]:text-left",
          fieldStateClass(violations)
        )}
      >
        <SelectValue>{renderOption(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="start" className="min-w-[--radix-select-trigger-width]">
        {options.map((option) => (
          <SelectItem key={option} value={option} className="text-[12px]">
            {renderOption(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Un valor que la carga lee pero no escribe. Idéntico a la celda silenciosa en
 * reposo: una fila de avances tiene que leerse como la misma tabla, no como
 * una versión apagada.
 */
export const ReadOnlyCell: React.FC<{
  children: React.ReactNode;
  align?: "left" | "right";
  title?: string;
}> = ({ children, align = "left", title }) => (
  <span
    title={title}
    className={cn(
      "block h-7 truncate px-1.5 text-[12px] leading-7 text-text-primary",
      align === "right" && "text-right tabular-nums"
    )}
  >
    {children}
  </span>
);

/**
 * Cuánto puntúa el nuevo avance. Es la razón de estar leyendo esta tabla: un
 * número suelto no dice nada —38 contra una meta de 40 es 95% o 0% según el
 * mínimo tres columnas a la izquierda— y hacer esa cuenta cuarenta veces a
 * mano es justo lo que una carga masiva debería evitar.
 */
export const ComplianceCell: React.FC<{ objective: ParsedObjective }> = ({ objective }) => {
  const { newProgress } = objective;
  if (newProgress === null || newProgress === undefined || !Number.isFinite(newProgress)) {
    return <ReadOnlyCell align="right">—</ReadOnlyCell>;
  }

  const compliance = computeCompliance({
    trend: objective.trend,
    initialValue: objective.initialValue,
    target: objective.target,
    minProgress: objective.minProgress,
    maxProgress: objective.maxProgress,
    progress: newProgress,
  });

  return <ReadOnlyCell align="right">{Math.round(compliance * 10) / 10}%</ReadOnlyCell>;
};
