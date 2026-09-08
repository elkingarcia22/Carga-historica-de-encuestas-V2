import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AXIS_LABELS, type ResultsAxis } from "./resultsModel";

/**
 * El "Ver por" del árbol de cumplimiento: por qué eje se recorre el ciclo.
 *
 * Lo único que quedó en la cabecera de la tarjeta después de que los filtros
 * subieran a la barra global. No es un filtro —no quita nada de la vista—
 * sino un recorrido, y por eso sigue viviendo junto a la tarjeta que dibuja
 * ese recorrido en vez de arriba con lo que sí recorta.
 *
 * Mismas medidas que los controles del reporte de encuestas —altura 9, borde
 * `border-border`, texto 13— porque comparten cabecera.
 */
export function ResultsAxisSelect({
  axis,
  onAxisChange,
}: {
  axis: ResultsAxis;
  onAxisChange: (axis: ResultsAxis) => void;
}) {
  return (
    <>
      <span className="text-[13px] font-medium text-muted-foreground">Ver por:</span>
      <Select value={axis} onValueChange={(value) => onAxisChange(value as ResultsAxis)}>
        <SelectTrigger className="h-9 w-[190px] rounded-lg border-border bg-surface px-3 text-[13px] transition-colors hover:bg-border/30 focus:ring-2 focus:ring-primary/20">
          <SelectValue className="truncate text-text-primary" />
        </SelectTrigger>
        <SelectContent position="popper">
          {(Object.keys(AXIS_LABELS) as ResultsAxis[]).map((key) => (
            <SelectItem key={key} value={key} className="text-[13px]">
              {AXIS_LABELS[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
