import * as React from "react";
import { DrawerShell } from "@/components/overlays";
import { CicloTemplateDetail } from "./CicloTemplateDetail";
import { CicloTemplateGallery } from "./CicloTemplateGallery";
import {
  FEATURED_CICLO_TEMPLATE,
  findCicloTemplate,
  type CicloTemplate,
} from "./cicloTemplateCatalog";

interface CicloTemplatesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Estrena la plantilla: cierra el drawer y abre el constructor en Datos
   *  generales, con sus objetivos ya puestos — de empresa, de una vez, y de
   *  grupo/individual en cuanto se llega a su paso. */
  onUseTemplate: (template: CicloTemplate) => void;
  /** Abre directamente en la ficha de esta plantilla en vez de en la galería.
   *  Se lee de nuevo en cada apertura, para que un atajo de fuera (una tile
   *  del home) caiga en la que apunta; "Ver más plantillas" no pasa nada y
   *  recibe la galería. */
  initialTemplateId?: string | null;
}

/**
 * "Crear con plantilla": una galería de tiles agrupadas por estante —las
 * mismas tiles que usa el home— y, un toque más adentro, la plantilla misma
 * con sus objetivos escritos y una fila de alternativas debajo. Un tercer
 * nivel decide dónde acaba: en un ciclo nuevo o en uno que ya existe.
 *
 * El cuerpo se remonta en cada apertura (con la llave de un contador) para
 * que pueda tener su propio estado —dónde está, qué se busca— arrancando de
 * las props cada vez, sin efectos sincronizando nada. El contador se sube con
 * el patrón de "guardar información de renders anteriores": comparar la prop
 * `open` con la que vio el último render y ajustar el estado ahí mismo, que
 * es algo que React resuelve antes de pintar.
 */
export function CicloTemplatesDrawer({
  open,
  onOpenChange,
  onUseTemplate,
  initialTemplateId,
}: CicloTemplatesDrawerProps) {
  const [session, setSession] = React.useState({ open, count: 0 });
  if (session.open !== open) {
    setSession({ open, count: open ? session.count + 1 : session.count });
  }

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title="Crear con plantilla"
      description="Explora las plantillas por categoría, abre una para ver sus objetivos y úsala como punto de partida de tu ciclo."
      size="6xl"
      disablePadding
      // El scroll vive dentro de cada vista (la galería y la ficha tienen su
      // propio `overflow-y-auto`), así que el contenedor del drawer nunca
      // desborda — el `scrollbar-gutter: stable` por defecto solo reservaba
      // una franja del fondo del Sheet a la derecha.
      disableScrollbarGutter
      className="!w-[95vw] !max-w-[1240px] gap-0 p-0"
    >
      <CicloTemplatesDrawerBody
        key={session.count}
        initialTemplateId={initialTemplateId}
        onUseTemplate={onUseTemplate}
      />
    </DrawerShell>
  );
}

/** Dónde está el drawer: recorriendo el catálogo o leyendo una plantilla. */
type DrawerView = { kind: "gallery" } | { kind: "detail"; templateId: string };

const GALLERY_VIEW: DrawerView = { kind: "gallery" };

function initialView(templateId: string | null | undefined): DrawerView {
  const template = findCicloTemplate(templateId ?? undefined);
  return template ? { kind: "detail", templateId: template.id } : GALLERY_VIEW;
}

function CicloTemplatesDrawerBody({
  initialTemplateId,
  onUseTemplate,
}: {
  initialTemplateId?: string | null;
  onUseTemplate: (template: CicloTemplate) => void;
}) {
  const [view, setView] = React.useState<DrawerView>(() => initialView(initialTemplateId));
  const [query, setQuery] = React.useState("");

  // Si el lector se ha movido de la vista con la que abrió el drawer. La
  // primera vista llega mientras el Sheet todavía está entrando, así que
  // necesita el retardo extra de `cascade-enter-drawer` para dejar pasar ese
  // movimiento; una vista alcanzada tocando —abrir una plantilla, volver a la
  // galería— no tiene nada que esperar y usa el `cascade-enter` inmediato (el
  // retardado dejaría el panel en blanco un instante en cada cambio, que se
  // lee como un fallo).
  const [hasNavigated, setHasNavigated] = React.useState(false);

  const navigate = (next: DrawerView) => {
    setView(next);
    setHasNavigated(true);
  };

  const openTemplate =
    view.kind === "gallery" ? null : findCicloTemplate(view.templateId) ?? FEATURED_CICLO_TEMPLATE;

  const cascadeClassName = hasNavigated ? "cascade-enter" : "cascade-enter-drawer";

  return (
    // Las tiles se apoyan directamente sobre el fondo del drawer, igual que en
    // el home se apoyan sobre el fondo de la página — sin una tarjeta que las
    // agrupe. El propio Sheet hace la entrada/salida; lo que cascada es lo que
    // hay dentro, una vez ese slide libera el paso.
    <div className="flex min-h-0 flex-1 flex-col bg-background p-4">
      {openTemplate === null ? (
        <CicloTemplateGallery
          query={query}
          onQueryChange={setQuery}
          onOpenTemplate={(template) => navigate({ kind: "detail", templateId: template.id })}
          // El atajo de la destacada salta la ficha y estrena la plantilla
          // directo, igual que el botón "Usar plantilla" de la ficha misma.
          onUseTemplate={onUseTemplate}
          cascadeClassName={cascadeClassName}
        />
      ) : (
        <CicloTemplateDetail
          key={openTemplate.id}
          template={openTemplate}
          onBack={() => navigate(GALLERY_VIEW)}
          onUseTemplate={() => onUseTemplate(openTemplate)}
          onOpenTemplate={(template) => navigate({ kind: "detail", templateId: template.id })}
          cascadeClassName={cascadeClassName}
        />
      )}
    </div>
  );
}
