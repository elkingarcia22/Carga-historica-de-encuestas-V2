import * as React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Marca de procedencia: esto lo escribió la IA.
 *
 * Solo la chispa, con el degradado de la IA. No es un estado ni una acción —
 * no se puede pulsar y no cambia con la edición: dice de dónde salió el
 * contenido, que es justo lo que alguien revisando la lista más tarde no
 * puede deducir mirando los campos. Va en la línea del rótulo ("SECCIÓN 3",
 * "OBJETIVO 1") y no junto al título, para que se lea como metadato de la
 * tarjeta y no como parte de lo que dice.
 *
 * Sin pastilla ni letra: al lado de un rótulo que ya está en versalitas, un
 * segundo bloque de texto competía con él por la misma línea. La chispa sola
 * es la misma marca que el botón que lo generó, y el tooltip guarda la
 * palabra para quien la necesite.
 */
export function AiGeneratedBadge({ className }: { className?: string }) {
  // Cada instancia pinta con su propio degradado: dos iconos a la vez con el
  // mismo id harían que el segundo tomara el del primero.
  const gradientId = `${React.useId()}-ai-badge`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex shrink-0 items-center", className)}>
          <Sparkles
            className="size-3.5"
            stroke={`url(#${gradientId})`}
            strokeWidth={2.4}
            aria-hidden
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="hsl(var(--ai-gradient-start))" />
                <stop offset="100%" stopColor="hsl(var(--ai-gradient-end))" />
              </linearGradient>
            </defs>
          </Sparkles>
          <span className="sr-only">Generado con IA</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">Generado con IA</TooltipContent>
    </Tooltip>
  );
}
