import * as React from "react";
import { ArrowRight, BookPlus, Plus, Target } from "lucide-react";
import { DrawerShell } from "@/components/overlays/DrawerShell";
import { DrawerSection } from "@/components/overlays/DrawerSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toneBar, toneChip, toneText } from "@/lib/tone";
import { AMBITION_META, AMBITION_ORDER, type AmbitionLevel } from "./aiObjectiveGenerator";
import { formatRawValue, type Objective } from "./cicloBuilderTypes";
import { OBJECTIVE_BANK } from "./objectiveBankData";
import { addObjectiveToBank, useObjectiveBankLibrary } from "./objectiveBankLibrary";
import { OBJECTIVE_SCOPE_META, type ObjectiveScope } from "./objectiveBankTypes";

const NEW_THEME_VALUE = "__new-theme__";

export interface AddObjectiveToBankDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** El objetivo tal como está escrito en la tarjeta — el banco lo guarda
   *  con estos mismos datos, sin volver a preguntarlos. */
  objective: Objective;
  /** A quién se le pone — la decide la tarjeta desde la que se abrió, igual
   *  que en el banco de explorar. */
  scope: ObjectiveScope;
}

/**
 * "Guardar en el banco de objetivos" para un solo objetivo: mismo mundo
 * visual que `ObjectiveBankDrawer`, pero mucho más chico — dos decisiones
 * (área y tema), no un catálogo para recorrer. El área sigue siendo una de
 * las seis fijas de UBITS: esa taxonomía no se toca desde el constructor,
 * igual que el tipo de encuesta no se toca desde el banco de preguntas.
 */
export function AddObjectiveToBankDrawer({
  open,
  onOpenChange,
  objective,
  scope,
}: AddObjectiveToBankDrawerProps) {
  const [session, setSession] = React.useState({ open, count: 0 });
  if (session.open !== open) {
    setSession({ open, count: open ? session.count + 1 : session.count });
  }

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title="Guardar objetivo en el banco"
      description="Elige en qué área y tema del banco queda este objetivo."
      size="lg"
      disablePadding
    >
      <AddObjectiveToBankBody
        key={session.count}
        objective={objective}
        scope={scope}
        onClose={() => onOpenChange(false)}
      />
    </DrawerShell>
  );
}

function AddObjectiveToBankBody({
  objective,
  scope,
  onClose,
}: {
  objective: Objective;
  scope: ObjectiveScope;
  onClose: () => void;
}) {
  const areas = useObjectiveBankLibrary();
  const [areaId, setAreaId] = React.useState(OBJECTIVE_BANK[0].id);
  const currentArea = areas.find((area) => area.id === areaId) ?? areas[0];

  const [themeValue, setThemeValue] = React.useState<string>(
    currentArea.themes[0]?.id ?? NEW_THEME_VALUE
  );
  const [newThemeName, setNewThemeName] = React.useState("");
  // En qué nivel están las cifras que trae la tarjeta — el banco solo guarda
  // una referencia (la retadora) y estira desde ahí, así que hace falta
  // saber desde cuál de los tres niveles se está partiendo. "Retador" es la
  // lectura por defecto: es el nivel más común y el que no exige ningún
  // ajuste al guardar.
  const [ambition, setAmbition] = React.useState<AmbitionLevel>("retador");

  const isNewTheme = themeValue === NEW_THEME_VALUE;
  const canSave = isNewTheme ? newThemeName.trim() !== "" : themeValue !== "";

  const handleAreaChange = (value: string) => {
    setAreaId(value);
    const nextArea = areas.find((area) => area.id === value);
    setThemeValue(nextArea?.themes[0]?.id ?? NEW_THEME_VALUE);
    setNewThemeName("");
  };

  const handleSave = () => {
    if (!canSave) return;
    addObjectiveToBank({
      areaId,
      themeId: isNewTheme ? undefined : themeValue,
      newThemeName: isNewTheme ? newThemeName.trim() : undefined,
      ambition,
      objective: {
        scope,
        title: objective.title,
        description: objective.description,
        measure: objective.measure ?? "numeric",
        direction: objective.direction,
        initialValue: objective.initialValue,
        targetValue: objective.targetValue,
      },
    });
    onClose();
  };

  const isBoolean = objective.measure === "boolean";
  const from = formatRawValue(objective.initialValue, objective.measure);
  const to = formatRawValue(objective.targetValue, objective.measure);

  return (
    <div className="flex flex-1 flex-col gap-3 bg-background p-4">
      <DrawerSection
        icon={BookPlus}
        tone="brand"
        title="Datos del objetivo"
        hint={`Se guarda para ${OBJECTIVE_SCOPE_META[scope].label.toLowerCase()}, en el área y tema que elijas.`}
      >
        <div className="flex flex-col gap-3.5">
          <div className="relative flex gap-3 overflow-hidden rounded-xl border border-border/60 bg-surface-muted/50 py-3 pl-4 pr-3.5">
            <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-[3px]" style={toneBar("brand")} />
            <span
              aria-hidden
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-border/40"
              style={toneChip("brand")}
            >
              <Target className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">Objetivo</p>
              <p className="mt-1 text-[13.5px] font-medium leading-snug text-text-primary">
                {objective.title.trim() || "Sin título"}
              </p>
              {!isBoolean && from && to && (
                <p className="mt-1 inline-flex items-center gap-1.5 text-[12px] font-semibold tabular-nums text-text-secondary">
                  {from}
                  <ArrowRight className="h-3 w-3 text-text-muted" strokeWidth={2.5} />
                  <span className="text-text-primary">{to}</span>
                </p>
              )}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-text-secondary">Área</span>
            <Select value={areaId} onValueChange={handleAreaChange}>
              <SelectTrigger className="h-9 w-full border-border/60 bg-surface text-[13px]">
                <SelectValue placeholder="Selecciona el área" />
              </SelectTrigger>
              <SelectContent>
                {OBJECTIVE_BANK.map((area) => (
                  <SelectItem key={area.id} value={area.id}>
                    {area.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-text-secondary">Tema</span>
            <Select value={themeValue} onValueChange={setThemeValue}>
              <SelectTrigger className="h-9 w-full border-border/60 bg-surface text-[13px]">
                <SelectValue placeholder="Selecciona el tema" />
              </SelectTrigger>
              <SelectContent>
                {currentArea.themes.map((theme) => (
                  <SelectItem key={theme.id} value={theme.id}>
                    {theme.name}
                  </SelectItem>
                ))}
                <SelectSeparator />
                <SelectItem value={NEW_THEME_VALUE}>
                  <span className="flex items-center gap-1.5 font-semibold" style={toneText("brand")}>
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Crear tema nuevo
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </label>

          {isNewTheme && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-text-secondary">Nombre del tema nuevo</span>
              <Input
                value={newThemeName}
                onChange={(event) => setNewThemeName(event.target.value)}
                placeholder="Escribe el nombre del tema"
                className="border-border/60 bg-surface text-[13px]"
                autoFocus
              />
            </label>
          )}

          {/* El banco guarda una sola cifra de referencia y estira desde ahí
              las otras dos — igual que en el catálogo de explorar—, así que
              hace falta saber en qué nivel están las que trae esta tarjeta. */}
          {!isBoolean && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-text-secondary">
                Nivel de la meta que estás guardando
              </span>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Nivel de la meta">
                {AMBITION_ORDER.map((level) => (
                  <button
                    key={level}
                    type="button"
                    role="radio"
                    aria-checked={ambition === level}
                    onClick={() => setAmbition(level)}
                    title={AMBITION_META[level].headline}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
                      ambition === level
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border bg-surface text-text-secondary hover:text-text-primary"
                    )}
                  >
                    {AMBITION_META[level].label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] leading-relaxed text-text-muted">
                Las otras dos metas se calculan a partir de esta cuando alguien lo elija del banco.
              </p>
            </div>
          )}
        </div>
      </DrawerSection>

      {/* Barra de acciones a sangre, igual que el resto de drawers del banco. */}
      <div className="-mx-4 -mb-4 mt-auto flex shrink-0 items-center justify-end gap-2 border-t border-border/60 bg-surface px-4 py-3">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={!canSave}>
          Guardar en el banco
        </Button>
      </div>
    </div>
  );
}
