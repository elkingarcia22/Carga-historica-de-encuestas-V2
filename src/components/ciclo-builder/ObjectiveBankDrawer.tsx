import * as React from "react";
import { ArrowRight, Eye, EyeOff, Inbox, Layers, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DrawerShell } from "@/components/overlays";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { SheetFooter } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/feedback";
import { toneBar, toneBorder, toneChip, toneText, toneWash } from "@/lib/tone";
import { AMBITION_META, AMBITION_ORDER, type AmbitionLevel } from "./aiObjectiveGenerator";
import { MEASURE_META, MEASURE_ORDER, type MeasureType, type Objective } from "./cicloBuilderTypes";
import { MEASURE_VISUAL } from "./measureVisual";
import { useObjectiveBankLibrary } from "./objectiveBankLibrary";
import {
  OBJECTIVE_SCOPE_META,
  bankItemToObjective,
  bankItemValues,
  type ObjectiveBankItem,
  type ObjectiveScope,
} from "./objectiveBankTypes";

/**
 * El banco de objetivos.
 *
 * Mismo recorrido que el banco de preguntas de encuestas —dos listas en
 * cascada, un buscador encima y una sola lista de casillas debajo— porque es
 * el gesto que aquí ya se sabe hacer. Lo que cambia es lo que hay dentro: un
 * objetivo no es una frase suelta, trae consigo cómo se mide y hasta dónde
 * llega, así que cada fila enseña esas cifras antes de marcarse.
 *
 * El alcance no se elige aquí. Lo decide el paso desde el que se abrió el
 * banco: en objetivos de empresa salen los de la compañía, en grupos los de
 * área y en individuales los de una persona. Preguntarlo otra vez sería
 * preguntar algo que el autor ya contestó al pararse donde está.
 */

/** "Todos" como valor de un select: los Select de Radix no admiten opción con
 *  valor vacío, así que la ausencia de filtro necesita un valor propio. */
const ANY = "todos";

const formatValue = (measure: MeasureType, value: string): string => {
  if (value === "") return "";
  if (measure === "money") return `$${value}`;
  if (measure === "percentage") return `${value} %`;
  return value;
};

/** Una fila del banco: la casilla, el objetivo escrito y la regla con la que
 *  se va a medir. */
function BankItemRow({
  entry,
  ambition,
  isSelected,
  onToggle,
  context,
}: {
  entry: ObjectiveBankItem;
  ambition: AmbitionLevel;
  isSelected: boolean;
  onToggle: () => void;
  /** "Comercial · Ventas" — solo en la vista de seleccionadas, donde las
   *  filas ya no comparten tema. */
  context?: string;
}) {
  const visual = MEASURE_VISUAL[entry.measure];
  const MeasureIcon = visual.icon;
  const values = bankItemValues(entry, ambition);
  // El color de una fila es el del tipo de medida — el mismo que ya usa la
  // tarjeta de creación de objetivos — y no el del área o el tema: esos son
  // una taxonomía para navegar, no una categoría con un color propio, y
  // dárselo inventaría un segundo sistema de color compitiendo con el que el
  // resto del producto ya usa para decir "esto es dinero", "esto es un hito".
  const tone = visual.tone;

  return (
    <label
      style={isSelected ? { ...toneBorder(tone, 45), ...toneWash(tone, 7) } : undefined}
      className={cn(
        "group relative flex cursor-pointer items-start gap-3 overflow-hidden rounded-xl border py-3.5 pl-4 pr-3.5 transition-all",
        isSelected ? "shadow-card" : "border-border bg-surface hover:border-border-strong"
      )}
    >
      {/* La barra lateral marca el tipo de medida, tenue mientras está libre
          y a fondo en cuanto se marca. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[3px] transition-colors"
        style={toneBar(tone, isSelected ? 100 : 35)}
      />
      <Checkbox checked={isSelected} onCheckedChange={onToggle} className="mt-0.5 shrink-0" />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13px] font-medium leading-snug text-text-primary">{entry.title}</p>
          <Badge
            variant="outline"
            className="mt-[-2px] shrink-0 bg-surface text-[10px] text-muted-foreground"
          >
            {entry.origin === "custom" ? "Personalizado" : "Creado por UBITS"}
          </Badge>
        </div>

        <p className="text-[12px] leading-relaxed text-text-secondary">{entry.description}</p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-medium"
            style={toneText(visual.tone)}
          >
            <MeasureIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
            {MEASURE_META[entry.measure].label}
          </span>

          {entry.measure === "boolean" ? (
            <span className="text-[11px] font-medium text-text-muted">Se cumple o no se cumple</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tabular-nums text-text-secondary">
              {formatValue(entry.measure, values.initialValue)}
              <ArrowRight className="h-3 w-3 text-text-muted" strokeWidth={2.5} />
              <span className="text-text-primary">
                {formatValue(entry.measure, values.targetValue)}
              </span>
            </span>
          )}

          {context && (
            <span className="ml-auto rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              {context}
            </span>
          )}
        </div>
      </div>
    </label>
  );
}

export interface ObjectiveBankDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Qué familia de objetivos se ofrece — la decide el paso, no el lector. */
  scope: ObjectiveScope;
  /**
   * Entrega los objetivos ya construidos, con su peso repartido entre ellos.
   * El banco no sabe cuánto peso queda libre en el destino: lo reparte a
   * partes iguales sobre lo que el llamador le diga que hay disponible.
   */
  onAddObjectives: (objectives: readonly Objective[]) => void;
  /** Peso que queda sin asignar en el destino, para repartirlo entre lo que
   *  se añada. Por defecto 0 — el autor ajusta después. */
  availableWeight?: number;
}

export function ObjectiveBankDrawer({
  open,
  onOpenChange,
  scope,
  onAddObjectives,
  availableWeight = 0,
}: ObjectiveBankDrawerProps) {
  const areas = useObjectiveBankLibrary();
  const [areaId, setAreaId] = React.useState(areas[0].id);
  const [themeId, setThemeId] = React.useState(areas[0].themes[0].id);
  const [measure, setMeasure] = React.useState<string>(ANY);
  const [ambition, setAmbition] = React.useState<AmbitionLevel>("conservador");
  const [query, setQuery] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<ReadonlySet<string>>(new Set());
  const [isShowingSelection, setIsShowingSelection] = React.useState(false);

  // Cada apertura empieza limpia: una selección heredada de la vez anterior se
  // añadiría sin que nadie la haya vuelto a mirar.
  React.useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set());
    setIsShowingSelection(false);
    setQuery("");
    setMeasure(ANY);
    setAmbition("conservador");
  }, [open]);

  const area = areas.find((entry) => entry.id === areaId) ?? areas[0];

  /** Solo los temas que tienen algo escrito para este alcance: ofrecer un
   *  tema que va a abrirse vacío es ofrecer un callejón. */
  const themes = React.useMemo(
    () => area.themes.filter((theme) => theme.items.some((entry) => entry.scope === scope)),
    [area, scope]
  );

  // Cambiar de área deja el tema anterior colgando; el primero del área nueva
  // es el único que seguro existe.
  React.useEffect(() => {
    if (themes.length === 0) return;
    if (themes.some((theme) => theme.id === themeId)) return;
    setThemeId(themes[0].id);
  }, [themes, themeId]);

  const theme = themes.find((entry) => entry.id === themeId) ?? themes[0] ?? null;

  /**
   * Lo que la lista muestra.
   *
   * Buscar sale del tema y recorre el banco entero: quien escribe "rotación"
   * no sabe —ni tiene por qué— en qué área la guardamos.
   */
  const visible = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    const pool =
      term === "" ? (theme?.items ?? []) : areas.flatMap((entry) => entry.themes.flatMap((one) => one.items));

    return pool.filter((entry) => {
      if (entry.scope !== scope) return false;
      if (measure !== ANY && entry.measure !== measure) return false;
      if (term === "") return true;
      return `${entry.title} ${entry.description}`.toLowerCase().includes(term);
    });
  }, [query, theme, areas, scope, measure]);

  /** Dónde vive cada entrada, para poder decirlo en la vista de
   *  seleccionadas y en los resultados de una búsqueda global. */
  const locationById = React.useMemo(() => {
    const map = new Map<string, string>();
    areas.forEach((entry) =>
      entry.themes.forEach((one) =>
        one.items.forEach((bankItem) => map.set(bankItem.id, `${entry.name} · ${one.name}`))
      )
    );
    return map;
  }, [areas]);

  const selectedEntries = React.useMemo(
    () =>
      areas.flatMap((entry) => entry.themes.flatMap((one) => one.items)).filter((bankItem) =>
        selectedIds.has(bankItem.id)
      ),
    [areas, selectedIds]
  );

  const toggle = (id: string) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allVisibleSelected =
    visible.length > 0 && visible.every((entry) => selectedIds.has(entry.id));

  const toggleAllVisible = () =>
    setSelectedIds((current) => {
      const next = new Set(current);
      visible.forEach((entry) => {
        if (allVisibleSelected) next.delete(entry.id);
        else next.add(entry.id);
      });
      return next;
    });

  const handleAdd = () => {
    if (selectedEntries.length === 0) return;
    // El peso libre se reparte a partes iguales; si no queda ninguno, los
    // objetivos entran en cero y el autor decide. Es preferible a inventar un
    // reparto que descuadre lo que ya estaba pesado.
    const share = Math.floor(Math.max(0, availableWeight) / selectedEntries.length);
    onAddObjectives(selectedEntries.map((entry) => bankItemToObjective(entry, ambition, share)));
    onOpenChange(false);
  };

  const total = React.useMemo(
    () =>
      areas.reduce(
        (sum, entry) =>
          sum +
          entry.themes.reduce(
            (themeSum, one) => themeSum + one.items.filter((item) => item.scope === scope).length,
            0
          ),
        0
      ),
    [areas, scope]
  );
  const scopeMeta = OBJECTIVE_SCOPE_META[scope];
  const isSearching = query.trim() !== "";

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title="Banco de objetivos"
      description="Explora los objetivos de UBITS por área y tema, y elige los que quieras añadir."
      size="4xl"
      disablePadding
      footer={
        <SheetFooter className="border-t border-border/60 bg-surface px-4 py-3">
          <div className="flex w-full items-center justify-between gap-3">
            <span className="text-[12px] text-text-secondary">
              {selectedIds.size === 0
                ? "Marca al menos un objetivo para continuar"
                : `${selectedIds.size} ${
                    selectedIds.size === 1 ? "objetivo seleccionado" : "objetivos seleccionados"
                  }`}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAdd} disabled={selectedIds.size === 0}>
                Agregar ({selectedIds.size})
              </Button>
            </div>
          </div>
        </SheetFooter>
      }
    >
      <div className="flex min-h-full flex-col gap-3 bg-background p-4">
        {!isShowingSelection && (
          <section className="rounded-2xl border border-border/70 bg-surface p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-[14px] font-bold text-text-primary">
                  Elige objetivos del catálogo
                </h3>
                <p className="mt-0.5 text-[12px] text-text-secondary">
                  {total} objetivos listos para usar, escritos y validados por UBITS.
                </p>
              </div>
              <div
                className={cn(
                  "relative flex h-10 w-[280px] shrink-0 items-center overflow-hidden rounded-lg border transition-colors",
                  isSearching ? "border-primary/50 ring-1 ring-primary/15" : "border-border"
                )}
              >
                <Search
                  className={cn(
                    "ml-3 h-4 w-4 shrink-0",
                    isSearching ? "text-primary" : "text-muted-foreground"
                  )}
                  strokeWidth={2}
                />
                <input
                  className="h-full w-full bg-transparent px-2.5 text-[13px] text-text-primary outline-none placeholder:text-muted-foreground/70"
                  placeholder="Buscar por texto o tema..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {isSearching && (
                  <button
                    type="button"
                    aria-label="Limpiar búsqueda"
                    onClick={() => setQuery("")}
                    className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-border/60 hover:text-text-primary"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] text-text-secondary">Área</label>
                <Select value={areaId} onValueChange={setAreaId}>
                  <SelectTrigger className="h-10 w-full bg-surface">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {areas.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {entry.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] text-text-secondary">Tema</label>
                <Select value={theme?.id ?? ""} onValueChange={setThemeId}>
                  <SelectTrigger className="h-10 w-full bg-surface">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {themes.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {entry.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] text-text-secondary">Tipo de medida</label>
                <Select value={measure} onValueChange={setMeasure}>
                  <SelectTrigger className="h-10 w-full bg-surface">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>Todos</SelectItem>
                    {MEASURE_ORDER.map((entry) => (
                      <SelectItem key={entry} value={entry}>
                        {MEASURE_META[entry].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* El nivel no es una carpeta del banco, es un ajuste sobre lo que
                se lleva: la misma entrada baja o sube su meta según esto, y
                por eso vive junto a los filtros y no dentro de ellos. */}
            <div className="mt-4 border-t border-border/60 pt-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[12px] font-medium text-text-secondary">Nivel de la meta</span>
                <div className="flex gap-1.5" role="radiogroup" aria-label="Nivel de la meta">
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
                <span className="text-[11px] text-text-muted">
                  {AMBITION_META[ambition].tagline} · cambia las cifras que traen los objetivos.
                </span>
              </div>
            </div>
          </section>
        )}

        <section className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-surface p-3">
          <header className="flex items-center justify-between gap-3 pb-1">
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={toneChip(area.tone)}
              >
                <Layers className="h-[18px] w-[18px]" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-[13px] font-bold text-text-primary">
                  {isShowingSelection
                    ? "Tus objetivos seleccionados"
                    : isSearching
                      ? `Resultados para "${query.trim()}"`
                      : (theme?.name ?? area.name)}
                </h3>
                <p className="truncate text-[11px] text-text-muted">
                  {isShowingSelection
                    ? "Estos son los que se añadirán. Desmarca cualquiera para quitarlo."
                    : `${scopeMeta.label} · ${visible.length} ${
                        visible.length === 1 ? "objetivo" : "objetivos"
                      }${selectedIds.size > 0 ? ` · ${selectedIds.size} seleccionados` : ""}`}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsShowingSelection((showing) => !showing)}
                disabled={!isShowingSelection && selectedIds.size === 0}
              >
                {isShowingSelection ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" strokeWidth={2} />
                    Ver catálogo
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" strokeWidth={2} />
                    Ver seleccionadas ({selectedIds.size})
                  </>
                )}
              </Button>
              {isShowingSelection ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                  disabled={selectedIds.size === 0}
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} />
                  Quitar todo
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleAllVisible}
                  disabled={visible.length === 0}
                >
                  {allVisibleSelected ? "Quitar todo" : "Añadir todo"}
                </Button>
              )}
            </div>
          </header>

          {isShowingSelection ? (
            selectedEntries.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="Todavía no has elegido ninguno"
                description="Vuelve al catálogo y marca los objetivos que quieras añadir."
                className="border-none bg-transparent shadow-none"
              />
            ) : (
              <div className="flex flex-col gap-2">
                {selectedEntries.map((entry) => (
                  <BankItemRow
                    key={entry.id}
                    entry={entry}
                    ambition={ambition}
                    isSelected
                    onToggle={() => toggle(entry.id)}
                    context={locationById.get(entry.id)}
                  />
                ))}
              </div>
            )
          ) : visible.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No hay objetivos que coincidan"
              description="Prueba con otro término, otro tema, u otro tipo de medida."
              className="border-none bg-transparent shadow-none"
            />
          ) : (
            <div className="flex flex-col gap-2">
              {visible.map((entry) => (
                <BankItemRow
                  key={entry.id}
                  entry={entry}
                  ambition={ambition}
                  isSelected={selectedIds.has(entry.id)}
                  onToggle={() => toggle(entry.id)}
                  context={isSearching ? locationById.get(entry.id) : undefined}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </DrawerShell>
  );
}
