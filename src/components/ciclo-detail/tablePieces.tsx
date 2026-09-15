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

/**
 * El buscador que ya usa la lista de ciclos del home: un botón cuadrado con
 * la lupa que se abre a un campo de texto, en vez de un campo siempre
 * abierto. `SearchBox` (arriba) es esa segunda forma, y las dos conviven a
 * propósito —esta vive junto a ella y no la reemplaza— porque no todas las
 * tablas del módulo quieren un buscador permanentemente abierto ocupando
 * sitio en la cabecera: en las pestañas de resultados, donde ya hay Ver por,
 * Segmentación y Filtros peleando por la misma fila, un campo fijo de 260 px
 * es el que sobra.
 */
export function CollapsibleSearchBox({
  value,
  onChange,
  placeholder,
  expandedClassName = "w-[260px]",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** El ancho una vez abierto, en clases de Tailwind y no en un número, para
   *  no mezclar una unidad aparte con el resto de este archivo. */
  expandedClassName?: string;
  className?: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const isOpen = expanded || value !== "";

  return (
    <div
      className={cn(
        "relative flex h-9 shrink-0 items-center overflow-hidden rounded-lg border bg-surface transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        isOpen
          ? cn(expandedClassName, "border-primary/50 ring-1 ring-primary/15")
          : "w-9 cursor-pointer border-border hover:bg-border/50",
        className
      )}
      onClick={() => {
        if (!isOpen) {
          setExpanded(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null) && value === "") {
          setExpanded(false);
        }
      }}
    >
      <div
        className={cn(
          "absolute left-0 flex h-9 w-9 shrink-0 items-center justify-center transition-colors",
          isOpen ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Search className="h-4 w-4" strokeWidth={2} />
      </div>
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-full w-full bg-transparent pl-9 pr-8 text-[13px] text-text-primary outline-none transition-all placeholder:text-muted-foreground/70"
      />
      {value !== "" && (
        <button
          type="button"
          aria-label="Limpiar búsqueda"
          onClick={(event) => {
            event.stopPropagation();
            onChange("");
            inputRef.current?.focus();
          }}
          className="absolute right-1.5 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-border/60 hover:text-text-primary"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
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

/**
 * El aspecto de una celda de encabezado, aparte del componente porque las
 * columnas que se arrastran lo pintan sobre `DraggableHeaderCell` y no sobre
 * `HeaderCell`: sin esta constante habría dos encabezados con dos tipografías
 * en la misma fila.
 */
export const HEADER_CELL_CLASS =
  "px-3 py-3.5 text-[11px] font-bold uppercase tracking-wide text-text-secondary whitespace-nowrap";

export function HeaderCell({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <TableHead className={cn(HEADER_CELL_CLASS, className)}>{children}</TableHead>;
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
