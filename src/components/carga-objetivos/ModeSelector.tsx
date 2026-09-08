import * as React from "react";
import { Pencil, Plus, TrendingUp } from "lucide-react";
import { OptionTile } from "@/components/selection";
import { BULK_UPLOAD_MODES, type BulkUploadMode } from "@/lib/objectivesImport";

/**
 * Cuál de las tres operaciones va a hacer el archivo, elegida antes de subir
 * nada: cambia qué columnas debe traer —crear necesita un usuario al que
 * asignar, editar y actualizar apuntan a objetivos que ya existen—, así que
 * mostrar la zona de carga antes de decidirlo invitaría al archivo equivocado.
 */

const MODE_ICON: Record<BulkUploadMode, React.ComponentType<{ className?: string }>> = {
  crear: Plus,
  editar: Pencil,
  actualizar: TrendingUp,
};

export function ModeSelector({
  value,
  onChange,
}: {
  /** `null` hasta que se elige: nada viene marcado por defecto. */
  value: BulkUploadMode | null;
  onChange: (next: BulkUploadMode) => void;
}) {
  return (
    /* El encabezado del grupo vive en la `DrawerSection` de fuera; aquí solo
       quedan las tres opciones. */
    <div role="radiogroup" aria-label="Qué quieres hacer" className="flex flex-col gap-2">
      {BULK_UPLOAD_MODES.map((entry) => (
        <OptionTile
          key={entry.id}
          option={{
            value: entry.id,
            label: entry.label,
            description: entry.description,
            icon: MODE_ICON[entry.id],
          }}
          selected={entry.id === value}
          onSelect={(next) => onChange(next as BulkUploadMode)}
        />
      ))}
    </div>
  );
}
