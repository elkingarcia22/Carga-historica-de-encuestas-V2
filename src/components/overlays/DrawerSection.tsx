import * as React from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { toneChip, type Tone } from "@/lib/tone";
import { cn } from "@/lib/utils";

interface DrawerSectionProps {
  icon: LucideIcon;
  tone: Tone;
  title: string;
  hint: string;
  /** Un dato al vuelo sobre lo que hay dentro — cuántas opciones van escritas. */
  badge?: string;
  /**
   * La acción que opera sobre el contenido de la tarjeta —agregar una fila,
   * por ejemplo—, alineada a la derecha del título.
   */
  action?: React.ReactNode;
  /**
   * Mantiene la cabecera a la vista mientras se recorre una tarjeta más alta
   * que el panel. Vale la pena solo cuando la acción vive en la cabecera: sin
   * ella, quedarse arriba no sirve de nada y sí tapa contenido.
   */
  stickyHeader?: boolean;
  /**
   * La propia cabecera —icono, título, hint— se vuelve el disparador que
   * abre y cierra la tarjeta, con un chevron al final. Para contenido de
   * referencia que no hace falta ver siempre abierto (una lista de estados
   * fijos, por ejemplo): un acordeón aparte metido dentro del cuerpo
   * duplicaba la misma anatomía dos veces, una caja de cabecera dentro de
   * otra caja de cabecera.
   */
  collapsible?: boolean;
  /** Si `collapsible`, si arranca abierta. Por defecto arranca cerrada. */
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * Un grupo de contenido de un drawer como tarjeta: el chip de su icono en su
 * tono, el título, la línea que explica para qué sirve y, bajo una divisoria,
 * lo que contenga.
 *
 * Es la unidad con la que se arman todos los paneles laterales del producto
 * —actualizar un avance, asignar objetivos, ver un demográfico— para que
 * cualquiera de ellos se lea como el mismo sistema y no como tres formularios
 * distintos. Lo que cambia entre sitios es el icono, el tono y el texto;
 * nunca la anatomía.
 */
export function DrawerSection({
  icon: Icon,
  tone,
  title,
  hint,
  badge,
  action,
  stickyHeader,
  collapsible = false,
  defaultOpen = false,
  children,
}: DrawerSectionProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const isOpen = !collapsible || open;

  return (
    <section className="rounded-2xl border border-border/60 bg-surface p-3.5 shadow-card">
      {/*
        * La divisoria y el espacio bajo el título viven en este bloque y no
        * arriba del contenido: pegada a la cabecera, es ella la que se lleva
        * el borde al quedarse fija y el contenido pasa por debajo cortado y
        * no encima del texto.
        *
        * Los márgenes negativos con su padding de vuelta hacen que el fondo
        * llegue hasta el borde de la tarjeta —si no, el contenido asomaría por
        * los costados de la cabecera fija— sin moverla de donde estaba.
        */}
      <div
        className={cn(
          isOpen && "border-b border-border/50 pb-3",
          stickyHeader &&
            "sticky top-0 z-10 -mx-3.5 -mt-3.5 rounded-t-2xl bg-surface px-3.5 pt-3.5"
        )}
      >
        <header
          className={cn("flex items-start gap-2.5", collapsible && "cursor-pointer select-none")}
          onClick={collapsible ? () => setOpen((prev) => !prev) : undefined}
          role={collapsible ? "button" : undefined}
          aria-expanded={collapsible ? open : undefined}
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-border/40"
            style={toneChip(tone)}
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-[13.5px] font-semibold leading-tight text-text-primary">
                {title}
              </h3>
              {badge && (
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-text-secondary">
                  {badge}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[12px] leading-relaxed text-text-muted">{hint}</p>
          </div>
          {action && (
            <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
              {action}
            </div>
          )}
          {collapsible && (
            <ChevronDown
              className={cn(
                "mt-1 size-4 shrink-0 text-text-muted transition-transform duration-200",
                open && "rotate-180"
              )}
              strokeWidth={2.3}
            />
          )}
        </header>
      </div>
      {isOpen && <div className="pt-3.5">{children}</div>}
    </section>
  );
}
