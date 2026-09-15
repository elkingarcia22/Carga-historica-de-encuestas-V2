import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * La caja de una tabla que va de lado a lado de su tarjeta.
 *
 * Es la forma que ya tiene la lista de ciclos del home: sin recuadro propio ni
 * esquinas redondeadas, solo una regla arriba y otra abajo, y las filas
 * llegando hasta el borde de la tarjeta. Un recuadro dentro de otro recuadro
 * dibuja dos marcos concéntricos y encoge la tabla por los dos lados justo
 * donde más falta hace el ancho.
 *
 * El `bleed` es el relleno del contenedor, en negativo: la tabla se sale de él
 * para volver al borde de la tarjeta. Se pide explícito porque cada panel tiene
 * el suyo —el paso de participantes va a `px-6`, el cajón de asignación a
 * `p-3.5`— y adivinarlo desde dentro es justo el tipo de constante que acierta
 * en una pantalla y falla en la siguiente.
 */
export function TableBleedBox({
  bleed = "-mx-6",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { bleed?: string }) {
  return (
    <div className={cn(bleed, "overflow-x-auto border-y border-border/60", className)} {...props}>
      {children}
    </div>
  );
}
