import * as React from "react";
import { Trash2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Las piezas con las que se arma el drawer de configuración de objetivos: el
 * bloque de permisos, la barra de distribución y la fila de un rango con
 * nombre. Las pestañas no están aquí: son las `UbitsTabs` del sistema.
 *
 * Viven aparte del drawer por la misma razón que las del centro de descargas:
 * son la gramática y no el contenido. El drawer decide *qué* se configura;
 * estas piezas fijan cómo se ve configurar algo, y lo fijan una sola vez para
 * los estados y para los niveles, que son la misma fila con otro nombre.
 */

export type ConfigTab = "permisos" | "estados" | "niveles";

export interface PermissionDefinition {
  label: string;
  defaultEnabled: boolean;
}

/**
 * Un juego de permisos —"objetivos propios", "objetivos del equipo"— como
 * lista de filas con interruptor, agrupadas sobre el fondo del drawer igual
 * que los bloques del centro de descargas.
 *
 * El título va encima de la caja y no como `<legend>` de un `<fieldset>`: un
 * legend nativo se dibuja montado a mitad del borde superior —la mitad
 * afuera, la mitad adentro— y ese corte se lee como un defecto, no como un
 * rótulo.
 */
export function PermissionGroup({
  title,
  permissions,
}: {
  title: string;
  permissions: readonly PermissionDefinition[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="px-0.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
        {title}
      </h4>
      <div className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-background p-2">
        {permissions.map((permission) => (
          <div
            key={permission.label}
            className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface px-3 py-2"
          >
            <span className="truncate text-[13px] font-medium leading-tight text-text-primary">
              {permission.label}
            </span>
            <Switch defaultChecked={permission.defaultEnabled} className="shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

export interface DistributionSegment {
  id: string;
  nombre: string;
  minPorcentaje: number;
  maxPorcentaje: number;
  colorHex: string;
}

/**
 * Los rangos configurados vistos de un golpe: una barra en la que cada tramo
 * ocupa lo que abarca y dice su nombre al pasar por encima.
 *
 * El ancho de un tramo no es su porcentaje real sino su tamaño relativo con un
 * mínimo, porque un estado de un solo punto ("Cumplido", 100 a 100) tiene que
 * seguir siendo visible al lado de uno que abarca setenta.
 */
export function DistributionBar({ segments }: { segments: readonly DistributionSegment[] }) {
  const ordered = [...segments].sort((a, b) => a.minPorcentaje - b.minPorcentaje);
  return (
    <TooltipProvider>
      <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full border border-border/50 bg-surface-muted/60 p-0.5 shadow-inner">
        {ordered.map((segment) => (
          <Tooltip key={segment.id} delayDuration={0}>
            <TooltipTrigger asChild>
              <div
                style={{
                  flex: Math.max(1, segment.maxPorcentaje - segment.minPorcentaje || 5),
                  backgroundColor: segment.colorHex,
                }}
                className="relative h-full cursor-pointer rounded-full transition-all duration-200 hover:opacity-80 hover:brightness-110"
              />
            </TooltipTrigger>
            <TooltipContent
              side="top"
              sideOffset={8}
              className="z-50 flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-white shadow-2xl !opacity-100 data-closed:animate-none data-closed:duration-0 dark:bg-slate-950 dark:text-slate-50"
            >
              <div className="flex items-center gap-2 text-xs font-bold">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full shadow-xs"
                  style={{ backgroundColor: segment.colorHex }}
                />
                <span>{segment.nombre}</span>
              </div>
              <div className="pl-4.5 text-[11px] font-medium tabular-nums text-slate-300">
                Rango:{" "}
                <span className="font-semibold text-white">
                  {segment.minPorcentaje}% a {segment.maxPorcentaje}%
                </span>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

/** Un campo con su rótulo pequeño encima, como en el resto de los drawers. */
function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-[11px] font-semibold text-text-muted">{label}</span>
      {children}
    </label>
  );
}

/** Un campo de porcentaje: número a la izquierda y el signo pegado al borde. */
function PercentInput({
  value,
  onChange,
  allowNegative,
}: {
  value: number;
  onChange: (value: number) => void;
  allowNegative: boolean;
}) {
  return (
    <div className="relative">
      <Input
        type="number"
        value={value}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          onChange(!allowNegative && parsed < 0 ? 0 : parsed);
        }}
        className="h-9 pr-7 text-[13px] font-semibold tabular-nums"
        min={allowNegative ? -999 : 0}
        max={999}
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">
        %
      </span>
    </div>
  );
}

export interface RangeColorOption {
  label: string;
  hex: string;
}

/**
 * Una banda con nombre, rango y color: la fila con la que se editan tanto los
 * estados de un objetivo como los niveles de desempeño.
 *
 * El nombre va solo en la primera línea y los tres campos angostos debajo,
 * porque en un panel lateral los cinco en fila obligaban a que el nombre —lo
 * único que se lee de un vistazo— fuera el campo más estrecho de todos.
 */
export function RangeRow({
  index,
  nameLabel,
  namePlaceholder,
  name,
  onNameChange,
  min,
  max,
  onMinChange,
  onMaxChange,
  colorHex,
  colors,
  onColorChange,
  allowNegative,
  onDelete,
  deleteDisabledReason,
}: {
  index: number;
  nameLabel: string;
  namePlaceholder: string;
  name: string;
  onNameChange: (name: string) => void;
  min: number;
  max: number;
  onMinChange: (value: number) => void;
  onMaxChange: (value: number) => void;
  colorHex: string;
  colors: readonly RangeColorOption[];
  onColorChange: (hex: string) => void;
  allowNegative: boolean;
  onDelete: () => void;
  /** Por qué no se puede borrar esta fila, o null si sí se puede. */
  deleteDisabledReason: string | null;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border/60 bg-surface px-3 py-2.5 transition-colors hover:border-primary/40">
      <div className="flex items-end gap-2">
        <span className="mb-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-xs font-bold tabular-nums text-text-secondary">
          {index}
        </span>
        <Field label={nameLabel} className="flex-1">
          <Input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            className="h-9 border-border/70 text-[13px] font-semibold"
            placeholder={namePlaceholder}
          />
        </Field>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          disabled={deleteDisabledReason !== null}
          title={deleteDisabledReason ?? "Eliminar"}
          className="mb-0.5 h-9 w-9 shrink-0 rounded-lg border border-status-negative/30 bg-status-negative/10 text-status-negative hover:border-status-negative/50 hover:bg-status-negative/20 hover:text-status-negative disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-[1fr_1fr_9rem] gap-2 pl-9">
        <Field label="Desde (%)">
          <PercentInput value={min} onChange={onMinChange} allowNegative={allowNegative} />
        </Field>
        <Field label="Hasta (%)">
          <PercentInput value={max} onChange={onMaxChange} allowNegative={allowNegative} />
        </Field>
        <Field label="Color">
          <Select value={colorHex} onValueChange={onColorChange}>
            {/*
              * El valor va dentro de `SelectValue` y no como marcado propio:
              * Radix mide ese nodo para colocar la lista alineada al ítem
              * elegido, y sin él el panel no llega a abrirse. La muestra de
              * color y su nombre viven en el ítem, y Radix los clona aquí.
              */}
            <SelectTrigger className="h-9 w-full px-2 text-[13px] font-semibold">
              <SelectValue placeholder="Color" />
            </SelectTrigger>
            <SelectContent>
              {colors.map((color) => (
                <SelectItem key={color.hex} value={color.hex} className="text-[12px]">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-4 w-4 shrink-0 rounded-md border border-border/50"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="truncate">{color.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </div>
  );
}

/**
 * El botón con el que crece una lista de rangos, y la razón por la que no
 * puede crecer más cuando ya llegó al tope.
 */
export function AddRangeButton({
  label,
  onClick,
  disabledReason,
  icon: Icon,
}: {
  label: string;
  onClick: () => void;
  disabledReason: string | null;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-center gap-3">
      <Button
        onClick={onClick}
        variant="outline"
        disabled={disabledReason !== null}
        className="gap-2 text-[13px] font-semibold"
      >
        <Icon className="h-4 w-4" />
        {label}
      </Button>
      {disabledReason && (
        <span className="text-[12px] leading-snug text-text-muted">{disabledReason}</span>
      )}
    </div>
  );
}
