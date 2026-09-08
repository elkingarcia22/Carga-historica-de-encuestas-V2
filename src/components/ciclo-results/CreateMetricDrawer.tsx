import * as React from "react";
import { Check, Eye, LayoutGrid, PenLine, Plus, Shapes, SlidersHorizontal, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toneChip } from "@/lib/tone";
import { DrawerSection } from "@/components/overlays/DrawerSection";
import { DrawerShell } from "@/components/overlays/DrawerShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MetricSketch } from "./MetricSketch";
import {
  EMPTY_METRIC,
  METRIC_DIMENSIONS,
  METRIC_MEASURES,
  METRIC_PLACES,
  METRIC_PRESETS,
  METRIC_SHAPES,
  METRIC_TOPICS,
  describeMetric,
  shapeOf,
  type MetricDefinition,
} from "./metricDefinition";

/**
 * Crear una métrica.
 *
 * Un cuadro de texto que dice "cuéntanos qué te falta" recoge deseos, no
 * métricas: llegan frases como "quiero ver mejor el avance" y nadie sabe qué
 * construir. Así que la métrica se arma por partes —tema, qué se mide, por
 * qué se agrupa, con qué forma se dibuja y dónde vive— con opciones cerradas.
 *
 * El drawer está partido en dos: las decisiones a la izquierda y la métrica
 * dibujándose a la derecha, fija mientras se baja por el formulario. Esa es
 * la razón de ser de la pantalla — se ve el resultado de cada elección en el
 * momento de hacerla, no al final. Con la vista previa metida entre las
 * secciones había que desplazarse hasta ella para comprobar cada cambio, y a
 * la tercera vez ya nadie la miraba.
 */

export function CreateMetricDrawer({
  open,
  onOpenChange,
  cicloName,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cicloName: string;
  onSubmit: (metric: MetricDefinition) => void;
}) {
  // Cada apertura empieza de cero: una métrica a medio armar de la vez
  // anterior confundiría a quien vuelve a abrirlo por otra cosa.
  const [session, setSession] = React.useState({ open, count: 0 });
  if (session.open !== open) {
    setSession({ open, count: open ? session.count + 1 : session.count });
  }

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title="Crear una métrica"
      description={`Arma lo que te falta ver en ${cicloName} y mira cómo queda antes de crearlo.`}
      size="5xl"
      disablePadding
    >
      <CreateMetricBody
        key={session.count}
        onClose={() => onOpenChange(false)}
        onSubmit={onSubmit}
      />
    </DrawerShell>
  );
}

function CreateMetricBody({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (metric: MetricDefinition) => void;
}) {
  const [draft, setDraft] = React.useState<MetricDefinition>(EMPTY_METRIC);
  const patch = (next: Partial<MetricDefinition>) =>
    setDraft((current) => ({ ...current, ...next }));

  const shape = shapeOf(draft);
  // Sin nombre no se crea: es lo único que no se puede deducir de las
  // opciones, y es lo primero que va a leer quien se encuentre la métrica.
  const canCreate = draft.title.trim() !== "";

  const togglePlace = (id: string) =>
    patch({
      places: draft.places.includes(id)
        ? draft.places.filter((place) => place !== id)
        : [...draft.places, id],
    });

  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="grid flex-1 grid-cols-1 items-start gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        {/* ── Las decisiones ── */}
        <div className="order-2 flex min-w-0 flex-col gap-3 lg:order-1">
          <DrawerSection
            icon={Wand2}
            tone="ai"
            title="Empieza por una plantilla"
            hint="Tres métricas ya armadas. Ajusta lo que quieras después."
          >
            <div className="flex flex-wrap gap-1.5">
              {METRIC_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setDraft(preset.metric)}
                  className="group flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-[11.5px] font-medium text-text-secondary transition-colors hover:border-primary/40 hover:bg-primary/[0.06] hover:text-primary"
                >
                  <Plus className="size-3 text-text-muted transition-colors group-hover:text-primary" strokeWidth={2.5} />
                  {preset.label}
                </button>
              ))}
            </div>
          </DrawerSection>

          <DrawerSection
            icon={PenLine}
            tone="brand"
            title="Qué vas a medir"
            hint="Escríbelo como se lo dirías a alguien del equipo."
          >
            <div className="flex flex-col gap-3.5">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-text-secondary">
                  Nombre de la métrica
                </span>
                <Input
                  value={draft.title}
                  onChange={(event) => patch({ title: event.target.value })}
                  placeholder="Ej. Avance promedio por líder"
                  className="border-border/60 bg-surface text-[13px]"
                  autoFocus
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-text-secondary">
                  ¿Para qué la vas a usar?{" "}
                  <span className="font-medium text-text-muted">(opcional)</span>
                </span>
                <Textarea
                  value={draft.detail}
                  onChange={(event) => patch({ detail: event.target.value })}
                  placeholder="Qué decisión tomarías con este dato, o qué estás haciendo hoy a mano para conseguirlo."
                  rows={3}
                  className="resize-none border-border/60 bg-surface text-[13px]"
                />
              </label>
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-text-secondary">Tema del reporte</span>
                <div
                  className="grid grid-cols-1 gap-1.5 sm:grid-cols-2"
                  role="radiogroup"
                  aria-label="Tema del reporte"
                >
                  {METRIC_TOPICS.map((topic) => (
                    <TopicOption
                      key={topic.id}
                      topic={topic}
                      selected={draft.topic === topic.id}
                      onSelect={() => patch({ topic: topic.id })}
                    />
                  ))}
                </div>
              </div>
            </div>
          </DrawerSection>

          <DrawerSection
            icon={SlidersHorizontal}
            tone="neutral"
            title="Qué va en cada eje"
            hint="Todo gráfico es una medida mirada a través de una categoría. Elige las dos."
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-text-secondary">Qué se mide</span>
                <Select value={draft.measureId} onValueChange={(value) => patch({ measureId: value })}>
                  <SelectTrigger className="h-9 w-full border-border/60 bg-surface text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METRIC_MEASURES.map((measure) => (
                      <SelectItem key={measure.id} value={measure.id}>
                        {measure.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-text-secondary">Agrupado por</span>
                <Select
                  value={draft.dimensionId}
                  onValueChange={(value) => patch({ dimensionId: value })}
                  disabled={!shape.needsDimension}
                >
                  <SelectTrigger className="h-9 w-full border-border/60 bg-surface text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METRIC_DIMENSIONS.map((dimension) => (
                      <SelectItem key={dimension.id} value={dimension.id}>
                        {dimension.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!shape.needsDimension && (
                  <span className="text-[11px] leading-relaxed text-text-muted">
                    Un número solo no agrupa nada. Cambia la forma si quieres partirlo.
                  </span>
                )}
              </label>
            </div>
          </DrawerSection>

          <DrawerSection
            icon={Shapes}
            tone="positive"
            title="Con qué forma se dibuja"
            hint="La forma no es decoración: cada una responde una pregunta distinta."
          >
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3" role="radiogroup" aria-label="Forma del gráfico">
              {METRIC_SHAPES.map((option) => (
                <ShapeOption
                  key={option.id}
                  option={option}
                  selected={draft.shape === option.id}
                  onSelect={() => patch({ shape: option.id })}
                />
              ))}
            </div>
          </DrawerSection>

          <DrawerSection
            icon={LayoutGrid}
            tone="warning"
            title="Dónde va a vivir"
            hint="Si es una tarjeta más, una pestaña nueva o una columna del Excel."
          >
            <div className="flex flex-wrap gap-1.5">
              {METRIC_PLACES.map((place) => (
                <Chip
                  key={place.id}
                  label={place.label}
                  selected={draft.places.includes(place.id)}
                  onSelect={() => togglePlace(place.id)}
                />
              ))}
            </div>
          </DrawerSection>
        </div>

        {/* ── La métrica, dibujándose ──
            Pegada arriba: el formulario es largo y la gracia de la vista
            previa es que esté a la vista mientras se elige, no que haya que
            ir a buscarla. Cuando no caben dos columnas se va arriba del
            formulario y no debajo, por lo mismo. */}
        <aside className="order-1 flex min-w-0 flex-col gap-3 lg:sticky lg:top-0 lg:order-2">
          <DrawerSection
            icon={Eye}
            tone="ai"
            title="Así se vería"
            hint="Datos de ejemplo con la forma que acabas de elegir."
          >
            <div className="flex flex-col gap-3">
              <MetricSketch metric={draft} />
              <p className="rounded-lg bg-surface-muted/60 px-2.5 py-2 text-[11.5px] leading-relaxed text-text-secondary">
                <span className="font-semibold text-text-primary">Se va a crear: </span>
                {describeMetric(draft)}
                {draft.places.length > 0 && (
                  <>
                    {", en "}
                    {METRIC_PLACES.filter((place) => draft.places.includes(place.id))
                      .map((place) => place.label.replace(/^En /, "").toLowerCase())
                      .join(" y ")}
                  </>
                )}
                .
              </p>
            </div>
          </DrawerSection>
        </aside>
      </div>

      {/* Barra de acciones a sangre, igual que el resto de drawers. */}
      <div className="sticky bottom-0 mt-auto flex shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-surface px-4 py-3">
        <p className="min-w-0 truncate text-[11.5px] font-medium text-text-muted">
          {canCreate ? describeMetric(draft) : "Ponle un nombre para poder crearla."}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!canCreate}
            onClick={() => {
              onSubmit(draft);
              onClose();
            }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Crear métrica
          </Button>
        </div>
      </div>
    </div>
  );
}

function TopicOption({
  topic,
  selected,
  onSelect,
}: {
  topic: (typeof METRIC_TOPICS)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = topic.icon;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition-colors",
        selected
          ? "border-primary/60 bg-primary/[0.06]"
          : "border-border/60 bg-surface hover:border-border hover:bg-muted/40"
      )}
    >
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-border/40"
        style={toneChip(topic.tone)}
      >
        <Icon className="size-3.5" strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block text-[12.5px] font-semibold leading-tight",
            selected ? "text-primary" : "text-text-primary"
          )}
        >
          {topic.label}
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug text-text-muted">{topic.hint}</span>
      </span>
    </button>
  );
}

function ShapeOption({
  option,
  selected,
  onSelect,
}: {
  option: (typeof METRIC_SHAPES)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = option.icon;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      title={option.hint}
      className={cn(
        "relative flex flex-col items-start gap-1.5 rounded-xl border p-2.5 text-left transition-colors",
        selected
          ? "border-primary/60 bg-primary/[0.06]"
          : "border-border/60 bg-surface hover:border-border hover:bg-muted/40"
      )}
    >
      {selected && (
        <span className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-primary text-white">
          <Check className="size-2.5" strokeWidth={3} />
        </span>
      )}
      <Icon className={cn("size-4", selected ? "text-primary" : "text-text-muted")} strokeWidth={2} />
      <span
        className={cn(
          "text-[12.5px] font-semibold leading-tight",
          selected ? "text-primary" : "text-text-primary"
        )}
      >
        {option.label}
      </span>
      <span className="text-[10.5px] leading-snug text-text-muted">{option.hint}</span>
    </button>
  );
}

function Chip({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "rounded-full border px-3 py-1 text-[11.5px] font-medium transition-colors",
        selected
          ? "border-primary/60 bg-primary/10 text-primary"
          : "border-border bg-surface text-text-secondary hover:text-text-primary"
      )}
    >
      {label}
    </button>
  );
}
