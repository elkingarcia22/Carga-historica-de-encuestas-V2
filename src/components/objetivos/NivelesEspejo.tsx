import { Copy, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { LockedStateRow } from "./objetivosConfigParts";
import type { NivelDesempenoConfig } from "./objetivosConfigStore";

/**
 * Reutilizar las bandas de cumplimiento como niveles de desempeño.
 *
 * Son dos ejes distintos a propósito —uno describe un objetivo y el otro
 * califica a una persona—, pero hay empresas que los quieren idénticos, y
 * mantener a mano dos listas que tienen que coincidir es la vía corta a que
 * dejen de coincidir. Con la opción encendida los niveles se copian solos y
 * se leen en la otra sección sin controles.
 */

/** El interruptor, al pie de la lista de bandas que va a copiar. */
export function MirrorNivelesToggle({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5">
      <Copy className="mt-0.5 size-4 shrink-0 text-text-muted" strokeWidth={2.2} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium leading-snug text-text-primary">
          Usar estas mismas bandas como niveles de cumplimiento
        </span>
        <span className="mt-0.5 block text-[11.5px] leading-snug text-text-muted">
          Los niveles de desempeño copian el nombre, el rango y el color de cada banda en vez de
          tener su propia escala.
        </span>
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="mt-0.5 shrink-0" />
    </label>
  );
}

/** Los niveles copiados, en solo lectura, con la salida a la escala propia. */
export function MirroredNivelesNotice({
  niveles,
  onEditOwnScale,
}: {
  niveles: readonly NivelDesempenoConfig[];
  onEditOwnScale: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background px-3 py-2.5">
        <p className="text-[12.5px] leading-snug text-text-secondary">
          Estos niveles se copian de los estados de cumplimiento. Para cambiarlos, edítalos allá —o
          vuelve a darles una escala propia.
        </p>
        <Button type="button" variant="outline" size="xs" onClick={onEditOwnScale} className="gap-1.5">
          <Pencil />
          Usar una escala propia
        </Button>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background p-2">
        {niveles.map((nivel) => (
          <LockedStateRow
            key={nivel.id}
            name={nivel.nombre}
            description="Copiado del estado de cumplimiento con el mismo nombre."
            colorHex={nivel.colorHex}
            range={{ min: nivel.minPorcentaje, max: nivel.maxPorcentaje }}
            lockReason="Este nivel copia una banda de cumplimiento. Se edita desde “Estados de los objetivos”."
          />
        ))}
      </div>
    </div>
  );
}
