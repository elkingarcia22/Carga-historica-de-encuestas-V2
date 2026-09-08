import * as React from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TableHead } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Piezas de tabla que las dos pestañas de la vista comparten: buscador,
 * paginador, celda de encabezado y el chevrón que abre una fila. Son las
 * mismas formas que usa la lista de ciclos, sacadas a un archivo para no
 * tenerlas tres veces.
 */

import { PAGE_SIZES, formatCount } from "./tableUtils";

export function SearchBox({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const isActive = value !== "";
  return (
    <div
      className={cn(
        "relative flex h-9 w-[260px] items-center overflow-hidden rounded-lg border bg-surface transition-all",
        isActive ? "border-primary/50 ring-1 ring-primary/15" : "border-border focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/15",
        className
      )}
    >
      <Search
        className={cn(
          "absolute left-3 size-4 transition-colors",
          isActive ? "text-primary" : "text-muted-foreground"
        )}
        strokeWidth={2}
      />
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-full w-full bg-transparent pl-9 pr-8 text-[13px] text-text-primary outline-none placeholder:text-muted-foreground/70"
      />
      {isActive && (
        <button
          type="button"
          aria-label="Limpiar búsqueda"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          className="absolute right-1.5 flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-border/60 hover:text-text-primary"
        >
          <X className="size-3.5" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

function PagerButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="h-8 rounded-lg border border-border px-2.5 text-[12px] font-semibold text-text-secondary transition-all hover:border-primary/30 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text-secondary"
    >
      {children}
    </button>
  );
}

export function TablePager({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  noun,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  /** "colaboradores", "grupos"… para el contador de la izquierda. */
  noun: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pageCount);
  const first = (current - 1) * pageSize;
  const last = Math.min(total, first + pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-[12px] text-muted-foreground">
        {total === 0 ? `0 ${noun}` : `${formatCount(first + 1)}–${formatCount(last)} de ${formatCount(total)} ${noun}`}
      </p>
      <div className="flex items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger aria-label={`${noun} por página`} className="h-8 w-[130px] rounded-lg px-2.5 text-[12px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={6}>
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)} className="text-[13px]">
                {size} por página
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <PagerButton label="Página anterior" disabled={current <= 1} onClick={() => onPageChange(current - 1)}>
          Anterior
        </PagerButton>
        <span className="text-[12px] tabular-nums text-text-secondary">
          {formatCount(current)} / {formatCount(pageCount)}
        </span>
        <PagerButton label="Página siguiente" disabled={current >= pageCount} onClick={() => onPageChange(current + 1)}>
          Siguiente
        </PagerButton>
      </div>
    </div>
  );
}

export function HeaderCell({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <TableHead
      className={cn(
        "px-3 py-3.5 text-[11px] font-bold uppercase tracking-wide text-text-secondary whitespace-nowrap",
        className
      )}
    >
      {children}
    </TableHead>
  );
}

export function ExpandButton({
  expanded,
  onClick,
  label,
}: {
  expanded: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-expanded={expanded}
      aria-label={label}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        expanded
          ? "border-primary/30 bg-primary/5 text-primary"
          : "border-transparent text-text-muted hover:border-border hover:bg-surface hover:text-text-primary"
      )}
    >
      <ChevronDown
        className={cn("size-4 transition-transform duration-300", expanded && "rotate-180")}
        strokeWidth={2.4}
      />
    </button>
  );
}
