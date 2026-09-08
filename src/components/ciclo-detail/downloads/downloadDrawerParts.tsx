import * as React from "react";
import { ChevronDown, Download, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { UbitsTabs } from "@/components/navigation";
import { toneChip, toneSelected } from "@/lib/tone";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { CicloReportTypeDefinition } from "./cicloDownloadTypes";

/**
 * Las piezas con las que se arma el panel de configuración del centro de
 * descargas: la barra de pestañas, la fila de formato, la fila de bloque con su
 * interruptor y el selector múltiple que ambas embuten.
 *
 * Viven aparte del drawer porque son la gramática y no el contenido: el drawer
 * decide *qué* se configura, estas filas fijan cómo se ve configurar algo.
 */

export type DownloadTab = "reports" | "downloads";

export function DrawerTabs({
  activeTab,
  onTabChange,
  downloadsBadge,
}: {
  activeTab: DownloadTab;
  onTabChange: (tab: DownloadTab) => void;
  downloadsBadge: number;
}) {
  return (
    // El control segmentado del sistema —el mismo del detalle de un ciclo y
    // del drawer de configuración—, no una tira de subrayados propia de este
    // panel. El número de descargas en preparación cuelga de su pestaña.
    <div className="shrink-0 bg-background px-4 pb-2 pt-4">
      <UbitsTabs
        tabs={[
          { id: "reports", label: "Reportes", icon: <FileDown className="size-4" /> },
          {
            id: "downloads",
            label: "Descargas",
            icon: <Download className="size-4" />,
            badge: downloadsBadge,
          },
        ]}
        activeTabId={activeTab}
        onTabChange={(id) => onTabChange(id as DownloadTab)}
        fitContent
        className="mb-0"
      />
    </div>
  );
}

/**
 * Una fila del selector de formato: icono, título, radio, y — solo en la
 * seleccionada — su descripción.
 *
 * Las cinco descripciones a la vez eran una pantalla de texto que se leía una
 * sola vez; la fila elegida es la única cuya letra pequeña describe el archivo
 * que el botón de abajo va a producir.
 */
export function ReportTypeRow({
  type,
  selected,
  onSelect,
}: {
  type: CicloReportTypeDefinition;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = type.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      // Misma receta de "esta es la elegida" que las tarjetas del builder:
      // borde y fondo teñidos en el tono, y la etiqueta en el acento.
      style={selected ? toneSelected("brand") : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/30",
        selected ? "shadow-sm" : "border-border/60 bg-surface hover:bg-muted/40"
      )}
    >
      <span
        style={selected ? toneChip("brand") : undefined}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
          !selected && "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn("text-[13px] font-semibold leading-tight", !selected && "text-text-primary")}
        >
          {type.title}
        </span>
        {selected && (
          <span className="text-[12px] leading-snug text-text-muted">{type.description}</span>
        )}
      </span>
      <span
        aria-hidden
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          selected ? "border-primary" : "border-border"
        )}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
      </span>
    </button>
  );
}

export interface RowPicker {
  items: readonly { id: string; label: string }[];
  selected: ReadonlySet<string>;
  onChange: (next: ReadonlySet<string>) => void;
  placeholder: string;
}

/**
 * Un bloque de contenido — una sección del PDF o una hoja del libro — como
 * fila de la lista agrupada: número, título, interruptor y, si el bloque se
 * despliega, el selector que decide cómo.
 *
 * La descripción larga vive en el `title` de la fila —un hover la trae de
 * vuelta— salvo cuando explica por qué la fila está apagada: esa razón sí se
 * imprime, porque un interruptor deshabilitado sin explicación parece un bug.
 */
export function ConfigSectionRow({
  index,
  label,
  description,
  unavailableReason,
  enabled,
  disabled,
  onEnabledChange,
  pickerLabel,
  pickerEmptyHint,
  picker,
}: {
  /**
   * Posición en el archivo, o null cuando el bloque no sale. Es texto y no
   * número porque una tanda de hojas ocupa un rango ("3–6"), no un lugar.
   */
  index: string | null;
  label: string;
  description: string;
  /** Por qué este ciclo no puede producir el bloque, o null si puede. */
  unavailableReason: string | null;
  enabled: boolean;
  disabled?: boolean;
  onEnabledChange: (enabled: boolean) => void;
  pickerLabel?: string;
  pickerEmptyHint?: string;
  picker: RowPicker | null;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-lg border border-border/60 bg-surface px-3 py-2.5 transition-colors",
        disabled && "opacity-45"
      )}
      title={unavailableReason ?? description}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold leading-tight text-text-primary">
            {index !== null && (
              <span className="inline-flex h-[17px] shrink-0 items-center justify-center rounded-sm bg-primary/10 px-[5px] text-[11px] font-bold tabular-nums text-primary">
                {index}
              </span>
            )}
            <span className="truncate">{label}</span>
          </span>
          {unavailableReason && (
            <span className="text-[12px] leading-snug text-muted-foreground">
              {unavailableReason}
            </span>
          )}
        </div>
        <Switch
          checked={enabled}
          disabled={disabled}
          onCheckedChange={onEnabledChange}
          className="shrink-0"
        />
      </div>
      {enabled && picker && (
        <div className="flex flex-col gap-1.5">
          {/*
            * Rótulo a la izquierda y selector en una columna de ancho fijo a la
            * derecha, alineado con el interruptor de arriba: dejar que el
            * selector ocupara el resto de la línea lo hacía arrancar en una `x`
            * distinta en cada fila y la lista bajaba en escalera.
            */}
          <div className="flex items-center justify-between gap-3">
            {pickerLabel && (
              <span className="min-w-0 flex-1 text-[12px] font-medium leading-snug text-muted-foreground">
                {pickerLabel}
              </span>
            )}
            <div className="w-[184px] shrink-0">
              <MultiSelectDropdown
                compact
                items={picker.items}
                selected={picker.selected}
                onToggle={(id) => {
                  const next = new Set(picker.selected);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  picker.onChange(next);
                }}
                onSelectAll={(checked, ids) => {
                  const next = new Set(picker.selected);
                  ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
                  picker.onChange(next);
                }}
                placeholder={picker.placeholder}
              />
            </div>
          </div>
          {picker.selected.size === 0 && pickerEmptyHint && (
            <span className="text-[12px] leading-snug text-muted-foreground">
              {pickerEmptyHint}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Una fila que es solo un selector múltiple, sin interruptor que la encienda.
 *
 * Se usa donde elegir no es opcional sino el punto de la fila: a quién cubre el
 * reporte. Vacío no es un error —significa "todos"—, así que la línea de apoyo
 * dice qué pasa cuando no se elige nada en vez de advertirlo en rojo.
 */
export function PickerRow({
  title,
  hint,
  items,
  selected,
  onChange,
  placeholder = "Selecciona",
  searchable = false,
  action,
}: {
  title: string;
  hint: string;
  items: readonly { id: string; label: string }[];
  selected: ReadonlySet<string>;
  onChange: (next: ReadonlySet<string>) => void;
  placeholder?: string;
  searchable?: boolean;
  /** Un atajo a la derecha del título — "usar los de la tabla", por ejemplo. */
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-surface px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13px] font-semibold leading-tight text-text-primary">{title}</span>
          <span className="text-[12px] leading-snug text-muted-foreground">{hint}</span>
        </div>
        {action}
      </div>
      <MultiSelectDropdown
        items={items}
        selected={selected}
        onToggle={(id) => {
          const next = new Set(selected);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          onChange(next);
        }}
        onSelectAll={(checked, ids) => {
          const next = new Set(selected);
          ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
          onChange(next);
        }}
        placeholder={placeholder}
        searchable={searchable}
      />
    </div>
  );
}

/** Una fila con un selector de una sola opción: título, apoyo y el `select`. */
export function SelectRow({
  title,
  hint,
  value,
  items,
  onChange,
}: {
  title: string;
  hint: string;
  value: string;
  items: readonly { id: string; label: string }[];
  onChange: (next: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-surface px-3 py-2.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px] font-semibold leading-tight text-text-primary">{title}</span>
        <span className="text-[12px] leading-snug text-muted-foreground">{hint}</span>
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10 w-full text-[13px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.id} value={item.id} className="text-[13px]">
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Una fila que o incluye todo (interruptor apagado) o recorta a una selección
 * (encendido, revelando el selector múltiple). El texto de apoyo se queda
 * visible porque aquí *es* la promesa —"sin filtrar entra todo"— y no la
 * descripción de un contenido.
 */
export function ToggleMultiSelectRow({
  title,
  hint,
  enabled,
  onEnabledChange,
  items,
  selected,
  onChange,
  pickerLabel = "Incluir",
  placeholder = "Selecciona",
  emptyWarning,
}: {
  title: string;
  hint: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  items: readonly { id: string; label: string }[];
  selected: ReadonlySet<string>;
  onChange: (next: ReadonlySet<string>) => void;
  pickerLabel?: string;
  placeholder?: string;
  /** Se muestra bajo el selector cuando está encendido y no hay nada elegido. */
  emptyWarning?: string;
}) {
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border/60 bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13px] font-semibold leading-tight text-text-primary">{title}</span>
          <span className="text-[12px] leading-snug text-muted-foreground">{hint}</span>
        </div>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} className="shrink-0" />
      </div>
      {enabled && (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 flex-1 text-[12px] font-medium leading-snug text-muted-foreground">
              {pickerLabel}
            </span>
            <div className="w-[184px] shrink-0">
              <MultiSelectDropdown
                compact
                items={items}
                selected={selected}
                onToggle={toggle}
                onSelectAll={(checked, ids) => {
                  const next = new Set(selected);
                  ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
                  onChange(next);
                }}
                placeholder={placeholder}
              />
            </div>
          </div>
          {emptyWarning && selected.size === 0 && (
            <span className="text-[12px] font-medium text-status-negative">{emptyWarning}</span>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Un disparador con forma de `Select` que abre una lista de chequeo en vez de
 * una de elección única — cerrado se lee como cualquier otro dropdown; abierto,
 * una fila maestra "Todos" (indeterminada cuando solo van algunos) se sienta
 * sobre las opciones, así que elegir todo o exactamente tres cuesta un clic.
 */
export function MultiSelectDropdown({
  items,
  selected,
  onToggle,
  onSelectAll,
  placeholder = "Selecciona",
  allLabel = "Todos",
  compact = false,
  searchable = false,
}: {
  items: readonly { id: string; label: string }[];
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  /**
   * La fila maestra. Recibe los ids sobre los que aplica —los visibles, que con
   * un filtro escrito no son todos— porque quien la implementa no sabe qué se
   * está viendo dentro del popover.
   */
  onSelectAll: (checked: boolean, ids: readonly string[]) => void;
  placeholder?: string;
  allLabel?: string;
  /** La variante de una línea que embuten las filas de la lista agrupada. */
  compact?: boolean;
  /**
   * Abre con un buscador arriba. Para listas que no se recorren con la rueda:
   * el directorio del ciclo son cientos de nombres, y encontrar a una persona
   * scrolleando es más trabajo que escribir su apellido.
   */
  searchable?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [width, setWidth] = React.useState<number>();
  // El Sheet de Radix bloquea el scroll del fondo mientras está abierto y solo
  // exime a su propio contenido. Un popover se portea a `document.body` por
  // defecto —hermano de ese contenido, fuera de la exención— así que su lista
  // scrolleable recibe el bloqueo también y la rueda del mouse no hace nada
  // sobre ella. Montar el portal dentro del contenido del sheet la convierte en
  // descendiente real del nodo eximido, y su scroll pasa.
  const [container, setContainer] = React.useState<HTMLElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useLayoutEffect(() => {
    if (open && triggerRef.current) {
      setWidth(triggerRef.current.offsetWidth);
      setContainer(triggerRef.current.closest<HTMLElement>('[data-slot="sheet-content"]'));
    }
  }, [open]);

  const allSelected = items.length > 0 && items.every((item) => selected.has(item.id));
  const someSelected = items.some((item) => selected.has(item.id));
  const summary = allSelected
    ? allLabel
    : someSelected
      ? items
          .filter((item) => selected.has(item.id))
          .map((item) => item.label)
          .join(", ")
      : placeholder;

  // El buscador filtra sin acentos ni mayúsculas: quien escribe "diaz" espera
  // encontrar a "Díaz".
  const fold = (value: string): string =>
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  const needle = fold(query.trim());
  const visible = needle === "" ? items : items.filter((item) => fold(item.label).includes(needle));

  // "Todos" marca lo que se está viendo, no el catálogo entero: con un filtro
  // escrito, marcarlo y que entren los seiscientos de detrás sería una trampa.
  const allVisibleSelected =
    visible.length > 0 && visible.every((item) => selected.has(item.id));
  const someVisibleSelected = visible.some((item) => selected.has(item.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            compact ? "h-8 px-2.5 text-[13px]" : "h-10 px-3 text-[13px]"
          )}
        >
          {/* El disparador es una columna fija de 184px, así que un resumen de
              varias elecciones se trunca por diseño — `title` es cómo la lista
              completa sigue alcanzable sin ensanchar cada fila. */}
          <span
            title={summary}
            className={cn(
              "truncate",
              someSelected || allSelected ? "text-text-primary" : "text-muted-foreground"
            )}
          >
            {summary}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        container={container ?? undefined}
        style={width ? { width } : undefined}
        className="flex max-h-[320px] flex-col gap-0 overflow-hidden p-0"
      >
        {searchable && (
          <div className="border-b border-border/70 p-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar…"
              aria-label="Buscar en la lista"
              className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-[13px] text-text-primary outline-none transition-colors focus:border-primary/50 focus:ring-1 focus:ring-primary/15 placeholder:text-muted-foreground/70"
            />
          </div>
        )}
        <label className="flex cursor-pointer items-center gap-3 border-b border-border/70 bg-muted/30 px-3 py-2 transition-colors hover:bg-muted/40">
          <Checkbox
            checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
            onCheckedChange={(checked) =>
              onSelectAll(checked === true, visible.map((item) => item.id))
            }
          />
          <span className="text-[13px] font-semibold text-text-primary">
            {needle === "" ? allLabel : `${allLabel} los que coinciden`}
          </span>
        </label>
        {/* `min-h-0` sostiene el scroll: sin él un hijo flex nunca se encoge por
            debajo de su contenido, así que crece más allá del `max-h-[320px]`
            del padre en vez de scrollear. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {visible.length === 0 ? (
            <p className="px-3 py-4 text-center text-[12px] text-muted-foreground">
              Nada coincide con “{query.trim()}”.
            </p>
          ) : (
            visible.map((item) => (
              <label
                key={item.id}
                className="flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/40"
              >
                <Checkbox
                  checked={selected.has(item.id)}
                  onCheckedChange={() => onToggle(item.id)}
                />
                <span className="text-[13px] text-text-primary">{item.label}</span>
              </label>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
