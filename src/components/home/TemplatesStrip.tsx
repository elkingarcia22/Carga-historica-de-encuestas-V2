import { Grid2x2Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { CicloTemplateTile } from "@/components/ciclo-templates/CicloTemplateTile";
import {
  CICLO_TEMPLATES,
  STRIP_TEMPLATE_COUNT,
  describeCicloTemplateSize,
  measureCicloTemplate,
  type CicloTemplate,
} from "@/components/ciclo-templates/cicloTemplateCatalog";

interface TemplatesStripProps {
  /** Opens a template — the caller decides what "use" means. */
  onSelectTemplate: (template: CicloTemplate) => void;
  /** Opens the full catalog (search + every template) — the row's last tile. */
  onViewAll: () => void;
  className?: string;
}

/**
 * The "start from a template" shelf above the home pulse. Each tile is a tiny
 * objective list — a sheet with its weight bars and the template's badge
 * pinned to the corner, then the name and what it holds — so the row reads as
 * a template gallery rather than another set of metric cards. Tiles grow to
 * fill the row instead of scrolling, so the shelf stays one full-width strip.
 */
export function TemplatesStrip({ onSelectTemplate, onViewAll, className }: TemplatesStripProps) {
  const promoted = CICLO_TEMPLATES.slice(0, STRIP_TEMPLATE_COUNT);

  return (
    <section aria-label="Plantillas de ciclo" className={cn("shrink-0", className)}>
      <h2 className="mb-2.5 text-[13px] font-semibold text-text-secondary">Empieza con una plantilla</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {promoted.map((template) => {
          const meta = describeCicloTemplateSize(measureCicloTemplate(template));
          return (
            <CicloTemplateTile
              key={template.id}
              icon={template.icon}
              tone={template.tone}
              label={template.label}
              meta={meta}
              title={`${template.name} · ${meta}`}
              onClick={() => onSelectTemplate(template)}
            />
          );
        })}
        <CicloTemplateTile
          icon={Grid2x2Plus}
          tone="neutral"
          label="Ver más plantillas"
          meta="Todo el catálogo"
          title="Abrir el catálogo completo de plantillas de ciclo"
          onClick={onViewAll}
          dashed
        />
      </div>
    </section>
  );
}
