import * as React from "react";
import { cn } from "@/lib/utils";
import { CreateMetricDrawer } from "./CreateMetricDrawer";
import { MetricComposerDrawer } from "./MetricComposerDrawer";
import type { MetricDefinition } from "./metricDefinition";

/**
 * Las dos formas de crear una métrica, con el interruptor entre ellas.
 *
 * El compositor con IA es la propuesta nueva; el formulario de secciones con
 * vista previa al lado es el que ya existía. Ninguno de los dos sabe del
 * otro: este componente elige cuál se monta y pinta el conmutador, así que
 * volver al de siempre no cuesta nada — y quitar la propuesta es borrar
 * `MetricComposerDrawer`, `metricQuestions` y este archivo, dejando el
 * original exactamente donde estaba.
 *
 * La preferencia se guarda: quien ya decidió cuál prefiere no debería tener
 * que volver a elegir en cada apertura.
 */

const STORAGE_KEY = "objetivos:metric-drawer-layout";

type MetricLayout = "composer" | "form";

function readStored(): MetricLayout {
  if (typeof window === "undefined") return "composer";
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "form" ? "form" : "composer";
  } catch {
    // Modo privado o almacenamiento bloqueado: la propuesta nueva es el
    // punto de partida y no pasa nada por no recordarlo.
    return "composer";
  }
}

export function MetricDrawerSwitch({
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
  const [layout, setLayout] = React.useState<MetricLayout>(readStored);

  const switchTo = (next: MetricLayout) => {
    setLayout(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Sin persistencia el conmutador sigue funcionando dentro de la sesión.
    }
  };

  const toggle = (
    <LayoutToggle
      layout={layout}
      onChange={switchTo}
      className={layout === "composer" ? undefined : "fixed bottom-4 left-4 z-[60]"}
    />
  );

  if (layout === "composer") {
    return (
      <MetricComposerDrawer
        open={open}
        onOpenChange={onOpenChange}
        cicloName={cicloName}
        onSubmit={onSubmit}
        footerSlot={toggle}
      />
    );
  }

  return (
    <>
      <CreateMetricDrawer
        open={open}
        onOpenChange={onOpenChange}
        cicloName={cicloName}
        onSubmit={onSubmit}
      />
      {/* El formulario anterior no tiene dónde recibir el conmutador —y no se
          toca a propósito—, así que aquí va suelto por encima del panel. */}
      {open && toggle}
    </>
  );
}

function LayoutToggle({
  layout,
  onChange,
  className,
}: {
  layout: MetricLayout;
  onChange: (next: MetricLayout) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Versión del creador de métricas"
      className={cn(
        "flex shrink-0 items-center gap-0.5 rounded-full border border-border/60 bg-surface p-0.5 shadow-card",
        className
      )}
    >
      <ToggleOption label="Con IA" active={layout === "composer"} onSelect={() => onChange("composer")} />
      <ToggleOption label="Formulario" active={layout === "form"} onSelect={() => onChange("form")} />
    </div>
  );
}

function ToggleOption({
  label,
  active,
  onSelect,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
        active ? "bg-primary/10 text-primary" : "text-text-muted hover:text-text-primary"
      )}
    >
      {label}
    </button>
  );
}
