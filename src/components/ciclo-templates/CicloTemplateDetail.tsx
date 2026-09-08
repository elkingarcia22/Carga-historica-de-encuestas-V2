import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  ChevronRight,
  Layers,
  Link2,
  Target,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toneChip, toneText } from "@/lib/tone";
import {
  DIRECTION_META,
  DIRECTION_VISUAL,
  MEASURE_META,
  MEASURE_VISUAL,
} from "@/components/ciclo-builder";
import {
  CICLO_TEMPLATE_SCOPE_META,
  CICLO_TEMPLATE_SCOPE_ORDER,
  describeCicloTemplateSize,
  findShelfOf,
  measureCicloTemplate,
  pluralize,
  suggestCicloTemplates,
  type CicloTemplate,
  type CicloTemplateScope,
  type TemplateAlignedObjective,
  type TemplateObjective,
} from "./cicloTemplateCatalog";
import { CicloTemplateTile, ObjectiveSheetThumb } from "./CicloTemplateTile";

const SUGGESTION_LIMIT = 3;

interface CicloTemplateDetailProps {
  template: CicloTemplate;
  onBack: () => void;
  /** Sigue adelante con la plantilla — a qué se le aplican sus objetivos
   *  (empresa, grupo, individuos, o cualquier combinación) se decide en el
   *  siguiente paso, no aquí: aquí solo se lee lo que la plantilla trae. */
  onUseTemplate: () => void;
  onOpenTemplate: (template: CicloTemplate) => void;
  /** Qué cascada tocar — lo decide el drawer según si su entrada sigue
   *  corriendo. El drawer remonta este panel por plantilla
   *  (`key={template.id}`), que es lo que reproduce la cascada en cada pick. */
  cascadeClassName: string;
}

/** Los objetivos que le corresponden a cada alcance de la plantilla. */
function objectivesForScope(
  template: CicloTemplate,
  scope: CicloTemplateScope
): readonly (TemplateObjective | TemplateAlignedObjective)[] {
  if (scope === "empresa") return template.objectives;
  return scope === "grupal" ? template.groupObjectives : template.individualObjectives;
}

/**
 * Una plantilla, abierta: la vuelta a la galería, su cabecera (el mismo pliego
 * que tenía la tile, para que las dos se lean como un solo objeto), para qué
 * sirve, su tamaño, los objetivos que trae escritos —y, debajo de todo, una
 * fila corta de otras plantillas en el mismo estilo de tile, para que comparar
 * nunca signifique salirse.
 */
export function CicloTemplateDetail({
  template,
  onBack,
  onUseTemplate,
  onOpenTemplate,
  cascadeClassName,
}: CicloTemplateDetailProps) {
  const size = measureCicloTemplate(template);
  const shelf = findShelfOf(template);
  const trail = shelf ? [shelf.category, ...shelf.path] : [];
  const suggestions = suggestCicloTemplates(template, SUGGESTION_LIMIT);
  // El total real de la plantilla: los tres alcances traen objetivos propios,
  // así que "objetivos" en la cabecera tiene que sumar los tres en vez de
  // contar solo los de empresa — eso es lo que `size.objectives` mide, y aquí
  // arriba se lee como si fuera todo lo que la plantilla trae.
  const totalObjectives =
    template.objectives.length +
    template.groupObjectives.length +
    template.individualObjectives.length;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3", cascadeClassName)}>
      <nav
        aria-label="Ubicación de la plantilla"
        className="flex shrink-0 items-center gap-1 px-1 text-[12.5px]"
      >
        <button
          type="button"
          onClick={onBack}
          className="-ml-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-semibold text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          Todas las plantillas
        </button>
        {trail.map((crumb) => (
          <React.Fragment key={crumb}>
            <ChevronRight className="h-3.5 w-3.5 text-text-muted" strokeWidth={2} />
            <span className="font-medium text-text-muted">{crumb}</span>
          </React.Fragment>
        ))}
      </nav>

      <header className="group shrink-0 rounded-2xl border border-border/60 bg-surface px-6 py-5 shadow-card">
        <div className="flex items-start justify-between gap-6">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <ObjectiveSheetThumb icon={template.icon} tone={template.tone} size="md" />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold leading-snug tracking-tight text-text-primary">
                {template.name}
              </h2>
            </div>
          </div>
          <Button onClick={onUseTemplate} className="shrink-0">
            Usar plantilla
          </Button>
        </div>

        {/* Para qué sirve es lo que decide si la plantilla vale, así que se lee
            como una cita destacada, con su propio filete. */}
        <div className="mt-4 border-l-2 border-primary/40 pl-3.5">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-text-muted">
            <Target className="h-3.5 w-3.5" strokeWidth={2} />
            Objetivo
          </p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-text-secondary">
            {template.description}
          </p>
        </div>

        {/* El peso ya no es un solo número de la plantilla: cada alcance
            reparte el suyo por su cuenta (100 % dentro de empresa, 100 %
            dentro de grupo, 100 % dentro de individual), así que esa cifra
            vive en el acordeón de cada uno y no aquí arriba. */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <MetaChip icon={Layers}>{pluralize(totalObjectives, "objetivo", "objetivos")} en total</MetaChip>
          <MetaChip icon={CalendarRange}>{size.periodLabel} sugerido</MetaChip>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="flex flex-col gap-6 pb-2">
          {/* Empresa trae el punto de partida; grupo e individual no son la
              misma redacción bajada de nivel — son objetivos propios, escritos
              a la escala de un equipo o de una persona, que contribuyen a los
              de empresa (la etiqueta "Contribuye a" de cada tarjeta dice a
              cuál). Cada alcance tiene por tanto su propia cuenta de
              objetivos y su propio peso, no el de la plantilla entera — así
              que cada uno vive en su propio panel, plegado o abierto por
              separado, igual que las secciones de una plantilla de encuesta. */}
          <Accordion
            key={template.id}
            type="multiple"
            defaultValue={["empresa"]}
            className="flex flex-col gap-2.5"
          >
            {CICLO_TEMPLATE_SCOPE_ORDER.map((scope) => {
              const meta = CICLO_TEMPLATE_SCOPE_META[scope];
              const objectives = objectivesForScope(template, scope);
              const weight = objectives.reduce((total, item) => total + item.weight, 0);
              return (
                <AccordionItem
                  key={scope}
                  value={scope}
                  className="overflow-hidden rounded-2xl border border-border/60 bg-surface px-5 shadow-card"
                >
                  <AccordionTrigger className="py-4 hover:no-underline">
                    <div className="flex min-w-0 flex-1 items-start gap-3 pr-2">
                      <span
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                        style={toneChip(meta.tone)}
                      >
                        <meta.icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-bold tracking-tight text-text-primary">
                          {meta.label}
                        </p>
                        <p className="mt-0.5 truncate text-[12px] font-normal text-text-secondary">
                          {meta.tagline}
                        </p>
                      </div>
                      <span className="mt-1 shrink-0 text-[11px] font-semibold tabular-nums text-text-muted">
                        {pluralize(objectives.length, "objetivo", "objetivos")} · Peso {weight} %
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-col gap-2 pb-3 pt-1">
                      {objectives.map((objective, index) => (
                        <TemplateObjectiveCard
                          key={`${scope}-${objective.title}`}
                          objective={objective}
                          index={index}
                          alignedToTitle={
                            "alignedToTitle" in objective ? objective.alignedToTitle : undefined
                          }
                        />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          {suggestions.length > 0 && (
            <section aria-label="Otras plantillas">
              <h3 className="mb-2.5 px-1 text-[13px] font-semibold text-text-secondary">
                Otras plantillas que te pueden servir
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {suggestions.map((suggestion) => {
                  const meta = describeCicloTemplateSize(measureCicloTemplate(suggestion));
                  return (
                    <CicloTemplateTile
                      key={suggestion.id}
                      icon={suggestion.icon}
                      tone={suggestion.tone}
                      label={suggestion.name}
                      meta={meta}
                      title={`${suggestion.name} · ${meta}`}
                      onClick={() => onOpenTemplate(suggestion)}
                    />
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/** Cómo se lee una cifra según lo que mide: el símbolo pegado en dinero y
 *  separado en porcentaje, que es como se escriben en español. */
function formatValue(measure: TemplateObjective["measure"], value: string): string {
  if (measure === "money") return `$${value}`;
  if (measure === "percentage") return `${value} %`;
  return value;
}

/**
 * Un objetivo de la plantilla, entero y a la vista.
 *
 * No se pliega a propósito: una plantilla trae tres objetivos, y esconder tras
 * un acordeón justamente lo que se vino a leer solo añade un clic por
 * objetivo. Lo que se ve es lo que el constructor va a escribir —titular, para
 * qué es, y la regla con la que se medirá—.
 */
function TemplateObjectiveCard({
  objective,
  index,
  alignedToTitle,
}: {
  objective: TemplateObjective;
  index: number;
  /** El objetivo de empresa de esta misma plantilla al que contribuye —solo
   *  en las tarjetas de grupo e individual. */
  alignedToTitle?: string;
}) {
  const measure = MEASURE_VISUAL[objective.measure];
  const MeasureIcon = measure.icon;
  const direction = objective.direction ? DIRECTION_VISUAL[objective.direction] : null;
  const DirectionIcon = direction?.icon;

  return (
    <article className="rounded-xl border border-border/60 bg-surface p-3.5">
      <header className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums"
          style={toneChip("brand")}
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-[13px] font-semibold leading-snug text-text-primary">
            {objective.title}
          </h4>
          <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">
            {objective.description}
          </p>
          {alignedToTitle && (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-primary">
              <Link2 className="h-3 w-3" strokeWidth={2.25} />
              Contribuye a "{alignedToTitle}"
            </p>
          )}
        </div>
        <span className="shrink-0 rounded-md bg-surface-muted px-2 py-1 text-[11px] font-semibold tabular-nums text-text-secondary">
          {objective.weight} %
        </span>
      </header>

      {/* La regla de medición, separada del texto por una línea: es la parte
          que el autor va a tener que ajustar a sus propias cifras. */}
      <footer className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/60 pt-2.5">
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-medium"
          style={toneText(measure.tone)}
        >
          <MeasureIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
          {MEASURE_META[objective.measure].label}
        </span>

        {direction && DirectionIcon && objective.direction && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-text-secondary">
            <DirectionIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
            {DIRECTION_META[objective.direction].label}
          </span>
        )}

        {objective.measure === "boolean" ? (
          <span className="ml-auto text-[11px] font-medium text-text-muted">
            Se cumple o no se cumple
          </span>
        ) : (
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold tabular-nums text-text-secondary">
            {formatValue(objective.measure, objective.initialValue)}
            <ArrowRight className="h-3 w-3 text-text-muted" strokeWidth={2.5} />
            <span className="text-text-primary">
              {formatValue(objective.measure, objective.targetValue)}
            </span>
          </span>
        )}
      </footer>
    </article>
  );
}

function MetaChip({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-[12px] font-medium tabular-nums text-text-secondary">
      <Icon className="h-3.5 w-3.5 text-text-muted" strokeWidth={2} />
      {children}
    </span>
  );
}
