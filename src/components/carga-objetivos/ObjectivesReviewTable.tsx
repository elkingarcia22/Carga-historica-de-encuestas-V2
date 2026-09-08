import * as React from "react";
import { AlertTriangle, CircleCheck, Info, SearchX, UserRoundSearch, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SearchBox } from "@/components/ciclo-detail/tablePieces";
import { SelectionHeaderMenu } from "@/components/data-display";
import { toneBorder, toneChip, toneText, toneWash } from "@/lib/tone";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UbitsTabs } from "@/components/navigation";
import { ReviewGroupCard } from "./ReviewGroupCard";
import { FilterButton } from "./ReviewListControls";
import {
  EMPTY_BUCKETS,
  TAB_META,
  TAB_ORDER,
  type PendingQuestion,
  type ReviewSelectionInfo,
  type VisibleGroup,
} from "./reviewTabs";
import {
  MEASURE_TYPES,
  TRENDS,
  bucketForGroup,
  groupDisplayName,
  type BulkUploadMode,
  type GroupBucket,
  type MeasureType,
  type ObjectiveUserGroup,
  type ParsedObjective,
  type RosterUser,
  type Trend,
} from "@/lib/objectivesImport";

/**
 * En qué se convirtió el archivo, agrupado por el usuario de cada objetivo y
 * editable en su sitio. Aquí la carga deja de ser una caja negra: cada campo
 * que UBITS guarda está a la vista y las reglas corren en vivo.
 *
 * Las pestañas parten el trabajo por lo que lo bloquea, no por tipo de dato, y
 * en el orden en que se resuelve: identidad primero, datos después, cargar al
 * final. Una tarjeta baja de pestaña sola a medida que se arregla.
 */

export interface ObjectivesReviewTableProps {
  groups: ObjectiveUserGroup[];
  mode: BulkUploadMode;
  /** A quién puede asignarse cada identificador: el ciclo más el directorio. */
  candidates: RosterUser[];
  onDelete: (id: string) => void;
  onDeleteMany: (ids: string[]) => void;
  onChange: (id: string, patch: Partial<ParsedObjective>) => void;
  onAssignUser: (identifier: string, user: RosterUser | null) => void;
  /** El "Guardar ajustes" de una fila puntual, no de la tarjeta entera. */
  onConfirmObjective: (objectiveId: string) => void;
  onMergeGroups?: (sourceIdentifier: string, targetIdentifier: string) => void;
  onRelinkObjective?: (objectiveId: string, targetId: string | null) => void;
  /** Avisa cuando se abre o cierra una pregunta, para que el drawer congele su pie. */
  onConfirmingChange?: (isConfirming: boolean) => void;
  /**
   * Avisa qué hay marcado para acciones masivas, para que el rail flotante
   * del drawer le preste sus botones — `null` en cuanto no hay nada marcado.
   */
  onSelectionChange?: (selection: ReviewSelectionInfo | null) => void;
}

function toggleFilter<T extends string>(current: T[], option: T): T[] {
  return current.includes(option) ? current.filter((entry) => entry !== option) : [...current, option];
}

const collapseAllButFirst = (list: ObjectiveUserGroup[]): ReadonlySet<string> =>
  new Set(list.slice(1).map((group) => group.identifier));

const collapseAll = (list: ObjectiveUserGroup[]): ReadonlySet<string> =>
  new Set(list.map((group) => group.identifier));

/**
 * "Sin alinear" y "Alineación sugerida" son de solo consulta —nada se edita
 * hasta que la identidad quede resuelta—, así que abrir la primera tarjeta de
 * entrada no adelanta ningún trabajo, solo ocupa espacio. Las otras dos sí se
 * trabajan fila por fila, y ahí la primera tarjeta abierta sigue ahorrando un
 * clic.
 */
const TABS_DEFAULT_ALL_COLLAPSED: ReadonlySet<GroupBucket> = new Set(["sinAlinear", "asociaciones"]);

const defaultCollapsedFor = (tab: GroupBucket, list: ObjectiveUserGroup[]): ReadonlySet<string> =>
  TABS_DEFAULT_ALL_COLLAPSED.has(tab) ? collapseAll(list) : collapseAllButFirst(list);

const EMPTY_SELECTION: ReadonlySet<string> = new Set();

function formatCount(n: number): string {
  return new Intl.NumberFormat("es-CO").format(n);
}

export const ObjectivesReviewTable: React.FC<ObjectivesReviewTableProps> = ({
  groups,
  mode,
  candidates,
  onDelete,
  onDeleteMany,
  onChange,
  onAssignUser,
  onConfirmObjective,
  onMergeGroups,
  onRelinkObjective,
  onConfirmingChange,
  onSelectionChange,
}) => {
  const isProgressLoad = mode === "actualizar";
  const isEditLoad = mode === "editar";

  const [query, setQuery] = React.useState("");
  const [measureFilters, setMeasureFilters] = React.useState<MeasureType[]>([]);
  const [trendFilters, setTrendFilters] = React.useState<Trend[]>([]);
  const [areaFilters, setAreaFilters] = React.useState<string[]>([]);
  const [leaderFilters, setLeaderFilters] = React.useState<string[]>([]);

  const allAreas = React.useMemo(
    () => [...new Set(groups.map((group) => group.matchedUser?.area).filter((area): area is string => Boolean(area)))],
    [groups]
  );
  const allLeaders = React.useMemo(
    () => [...new Set(groups.map((group) => group.matchedUser?.leader).filter((leader): leader is string => Boolean(leader)))],
    [groups]
  );

  const groupsByBucket = React.useMemo(
    () =>
      groups.reduce<Record<GroupBucket, ObjectiveUserGroup[]>>((buckets, group) => {
        const bucket = bucketForGroup(group);
        return { ...buckets, [bucket]: [...buckets[bucket], group] };
      }, EMPTY_BUCKETS),
    [groups]
  );

  /**
   * El contador de la pestaña cuenta objetivos, no usuarios — el mismo dato
   * que el botón "Cargar N objetivos alineados" del pie. Un badge en
   * "usuarios" y un botón en "objetivos" son cada uno correcto por su cuenta,
   * pero un badge pelado sin unidad al lado del otro número del drawer se lee
   * como el mismo dato, y ahí es donde no cuadraban.
   */
  const objectivesByBucket = React.useMemo(
    () =>
      TAB_ORDER.reduce<Record<GroupBucket, number>>(
        (counts, bucket) => ({
          ...counts,
          [bucket]: groupsByBucket[bucket].reduce((total, group) => total + group.objectives.length, 0),
        }),
        { alineados: 0, asociaciones: 0, sinAlinear: 0, errores: 0 }
      ),
    [groupsByBucket]
  );

  /** Abre en la pestaña que tiene trabajo, no siempre en "Listos". */
  const [selectedTab, setSelectedTab] = React.useState<GroupBucket>(() => {
    const initial = groups.reduce<Record<GroupBucket, number>>(
      (counts, group) => ({ ...counts, [bucketForGroup(group)]: counts[bucketForGroup(group)] + 1 }),
      { alineados: 0, asociaciones: 0, sinAlinear: 0, errores: 0 }
    );
    return TAB_ORDER.find((bucket) => initial[bucket] > 0) ?? "alineados";
  });

  /**
   * Cuántas tarjetas tenía la pestaña abierta la última vez. Distingue "el
   * revisor acaba de vaciar esta pestaña" (se lo lleva a la siguiente con
   * trabajo) de "abrió una pestaña vacía a propósito" (se le muestra el vacío).
   */
  const [lastTabCount, setLastTabCount] = React.useState(() => groupsByBucket[selectedTab].length);
  const openTabCount = groupsByBucket[selectedTab].length;
  if (openTabCount !== lastTabCount) {
    setLastTabCount(openTabCount);
    if (openTabCount === 0 && lastTabCount > 0) {
      const next = TAB_ORDER.find((bucket) => groupsByBucket[bucket].length > 0);
      if (next) setSelectedTab(next);
    }
  }
  const tab = selectedTab;

  /**
   * Estado de plegado por pestaña; ausente significa el plegado por defecto
   * de esa pestaña — ver `defaultCollapsedFor`.
   */
  const [collapsedByTab, setCollapsedByTab] = React.useState<Partial<Record<GroupBucket, ReadonlySet<string>>>>({});
  const collapsed = collapsedByTab[tab] ?? defaultCollapsedFor(tab, groupsByBucket[tab]);
  const setCollapsed = (next: ReadonlySet<string>) =>
    setCollapsedByTab((current) => ({ ...current, [tab]: next }));

  /**
   * Selección para acciones masivas, también por pestaña — como el plegado,
   * porque cambia de unidad al cambiar de pestaña: en "sin alinear" y
   * "alineación sugerida" el identificador es un usuario entero (ahí la fila
   * es de solo consulta), en "errores" y "listos" es cada objetivo.
   */
  const isRowSelection = tab === "errores" || tab === "alineados";
  const [selectedByTab, setSelectedByTab] = React.useState<Partial<Record<GroupBucket, ReadonlySet<string>>>>({});
  const selectedIds = selectedByTab[tab] ?? EMPTY_SELECTION;
  const setSelectedIds = (next: ReadonlySet<string>) =>
    setSelectedByTab((current) => ({ ...current, [tab]: next }));

  /** La única pregunta abierta en toda la revisión. */
  const [pendingQuestion, setPendingQuestion] = React.useState<PendingQuestion | null>(null);
  const isConfirming = pendingQuestion !== null;

  /*
    Escape retira la pregunta. Capturado en `window`, que corre antes que el
    manejador del drawer: sin ganar esa carrera, Escape para abandonar un
    borrado cerraría el drawer y descartaría toda la revisión.
  */
  React.useEffect(() => {
    if (!isConfirming) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setPendingQuestion(null);
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [isConfirming]);

  React.useEffect(() => {
    onConfirmingChange?.(isConfirming);
  }, [isConfirming, onConfirmingChange]);

  const switchTab = (next: GroupBucket) => {
    setSelectedTab(next);
    setLastTabCount(groupsByBucket[next].length);
  };

  /** Usernames a los que apuntan dos o más grupos: sus pesos se cargarían dos veces. */
  const duplicateUsernames = React.useMemo(() => {
    const seen = new Map<string, number>();
    groups.forEach((group) => {
      const username = group.matchedUser?.username;
      if (username) seen.set(username, (seen.get(username) ?? 0) + 1);
    });
    return new Set([...seen.entries()].filter(([, count]) => count > 1).map(([name]) => name));
  }, [groups]);

  const findGroupFor = React.useCallback(
    (identifier: string, username: string) =>
      groups.find((candidate) => candidate.identifier !== identifier && candidate.matchedUser?.username === username),
    [groups]
  );

  const hasFilters =
    query.trim() !== "" ||
    measureFilters.length > 0 ||
    trendFilters.length > 0 ||
    areaFilters.length > 0 ||
    leaderFilters.length > 0;
  const showUserFilters = tab === "errores" || tab === "alineados";

  /** La búsqueda decide sobre el grupo; los filtros de campo recortan sus filas. */
  const visibleGroups = React.useMemo<VisibleGroup[]>(() => {
    const needle = query.trim().toLowerCase();
    return groupsByBucket[tab].reduce<VisibleGroup[]>((visible, group) => {
      const matchesUser =
        needle === "" ||
        groupDisplayName(group).toLowerCase().includes(needle) ||
        group.identifier.toLowerCase().includes(needle);
      const matchesArea =
        !showUserFilters || areaFilters.length === 0 || areaFilters.includes(group.matchedUser?.area ?? "");
      const matchesLeader =
        !showUserFilters || leaderFilters.length === 0 || leaderFilters.includes(group.matchedUser?.leader ?? "");
      if (!matchesUser || !matchesArea || !matchesLeader) return visible;

      const objectives = group.objectives.filter(
        (objective) =>
          (measureFilters.length === 0 || measureFilters.includes(objective.measureType)) &&
          (trendFilters.length === 0 || trendFilters.includes(objective.trend))
      );
      return objectives.length === 0 ? visible : [...visible, { group, objectives }];
    }, []);
  }, [groupsByBucket, tab, query, measureFilters, trendFilters, areaFilters, leaderFilters, showUserFilters]);

  /** Filtrar es buscar, así que cada coincidencia se abre. Limpiar restaura el plegado. */
  const updateFilters = (patch: {
    query?: string;
    measures?: MeasureType[];
    trends?: Trend[];
    areas?: string[];
    leaders?: string[];
  }) => {
    setQuery(patch.query ?? query);
    setMeasureFilters(patch.measures ?? measureFilters);
    setTrendFilters(patch.trends ?? trendFilters);
    setAreaFilters(patch.areas ?? areaFilters);
    setLeaderFilters(patch.leaders ?? leaderFilters);
    setCollapsed(defaultCollapsedFor(tab, groupsByBucket[tab]));
    // Lo marcado deja de tener sentido en cuanto la lista que lo mostraba
    // cambia: un filtro puede esconder justo lo seleccionado, y el rail
    // quedaría prometiendo una acción sobre algo que ya no se ve.
    setSelectedIds(EMPTY_SELECTION);
  };
  const clearFilters = () => updateFilters({ query: "", measures: [], trends: [], areas: [], leaders: [] });

  const toggleGroup = (identifier: string) => {
    const next = new Set(groupsByBucket[tab].map((group) => group.identifier));
    // Abrir uno cierra los demás; cerrarlo cierra todos.
    if (collapsed.has(identifier)) next.delete(identifier);
    setCollapsed(next);
  };

  const visibleUsers = visibleGroups.length;
  const visibleObjectives = visibleGroups.reduce((total, entry) => total + entry.objectives.length, 0);

  /** Todo lo que esta pestaña deja marcar ahora mismo, para "seleccionar todos". */
  const selectableIds = React.useMemo(
    () =>
      isRowSelection
        ? visibleGroups.flatMap(({ objectives }) => objectives.map((objective) => objective.id))
        : visibleGroups.map(({ group }) => group.identifier),
    [visibleGroups, isRowSelection]
  );

  const toggleManySelected = (ids: readonly string[]) => {
    const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id));
    const next = new Set(selectedIds);
    ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
    setSelectedIds(next);
  };

  const toggleOneSelected = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  /** Los objetivos que de verdad se tocarían al "quitar de la carga": ya
      aplanados, sea cual sea la unidad que esta pestaña selecciona —un
      usuario entero en las de solo consulta, cada fila en las otras dos. */
  const selectedObjectiveIds = React.useMemo(() => {
    if (isRowSelection) return [...selectedIds];
    return visibleGroups
      .filter(({ group }) => selectedIds.has(group.identifier))
      .flatMap(({ objectives }) => objectives.map((objective) => objective.id));
  }, [isRowSelection, selectedIds, visibleGroups]);

  React.useEffect(() => {
    if (selectedIds.size === 0) {
      onSelectionChange?.(null);
      return;
    }
    onSelectionChange?.({
      count: selectedIds.size,
      onClear: () => setSelectedIds(EMPTY_SELECTION),
      onRemove: () => {
        onDeleteMany(selectedObjectiveIds);
        setSelectedIds(EMPTY_SELECTION);
      },
    });
    // El paso desmonta esta tabla al salir de "summary" sin pasar por
    // selectedIds.size === 0 primero: sin esta limpieza, el rail se
    // quedaría ofreciendo una acción sobre una tabla que ya no existe.
    return () => onSelectionChange?.(null);
  }, [selectedIds, selectedObjectiveIds, onSelectionChange, onDeleteMany]);

  const selectionState: boolean | "indeterminate" =
    selectedIds.size === 0
      ? false
      : selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id))
        ? true
        : "indeterminate";

  return (
    /* La revisión es dueña de la altura del drawer y solo desplaza sus
       tarjetas: pestañas, cabecera y aviso se quedan quietos. */
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div inert={isConfirming || undefined} className={cn("shrink-0 transition-opacity", isConfirming && "opacity-50")}>
        {/* Cuatro estados, no cuatro secciones: la tira se ajusta a sus
            etiquetas —estirada a lo ancho del drawer se leía como una barra de
            navegación— y cada contador lleva el tono de su pestaña. */}
        <UbitsTabs
          tabs={TAB_ORDER.map((bucket) => ({
            id: bucket,
            label: TAB_META[bucket].label,
            badge: objectivesByBucket[bucket],
            badgeTone: TAB_META[bucket].tone,
          }))}
          activeTabId={tab}
          onTabChange={(id) => switchTab(id as GroupBucket)}
          fitContent
          className="mb-0"
        />
      </div>

      {/* Una cabecera de lista, no una barra de herramientas: el nombre de lo
          que se mira con su conteo a la izquierda, los controles plegados a
          iconos a la derecha. */}
      <div
        inert={isConfirming || undefined}
        className={cn("flex shrink-0 items-center justify-between gap-4 px-1 transition-opacity", isConfirming && "opacity-50")}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {/* El mismo menú de selección masiva que usan el home y el
              seguimiento del ciclo: marca todo lo visible en la pestaña de
              un solo clic, o lo deshace. */}
          {selectableIds.length > 0 && (
            <div className="w-8 shrink-0">
              <SelectionHeaderMenu
                state={selectionState}
                pageCount={selectableIds.length}
                matchCount={selectableIds.length}
                showSelectPage={false}
                showSelectAll={selectedIds.size < selectableIds.length}
                showDeselectPage={false}
                showDeselectAll={selectedIds.size > 0}
                onSelectPage={() => {}}
                onSelectAll={() => setSelectedIds(new Set(selectableIds))}
                onDeselectPage={() => {}}
                onDeselectAll={() => setSelectedIds(EMPTY_SELECTION)}
                formatCount={formatCount}
                align="start"
              />
            </div>
          )}

          {/* El mismo glifo y el mismo tono que llevan las tarjetas de abajo:
              la cabecera nombra la cola, no el hecho de que haya un filtro. */}
          <span
            style={toneChip(TAB_META[tab].tone)}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg"
            aria-hidden
          >
            {React.createElement(TAB_META[tab].icon, { className: "size-3.5", strokeWidth: 2.5 })}
          </span>
          <h3 className="truncate text-[14px] font-bold tracking-tight text-text-primary">{TAB_META[tab].listTitle}</h3>
          <span className="whitespace-nowrap rounded-md bg-surface-muted px-2 py-0.5 text-[11.5px] font-semibold tabular-nums text-text-secondary">
            {visibleUsers} {visibleUsers === 1 ? "usuario" : "usuarios"} · {visibleObjectives}{" "}
            {visibleObjectives === 1 ? "objetivo" : "objetivos"}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <SearchBox
            value={query}
            onChange={(value) => updateFilters({ query: value })}
            placeholder="Buscar por nombre o identificador"
          />
          <FilterButton
            onClearAll={clearFilters}
            groups={[
              {
                id: "medida",
                label: "Tipo de medida",
                options: MEASURE_TYPES,
                selected: measureFilters,
                onToggle: (option) => updateFilters({ measures: toggleFilter(measureFilters, option as MeasureType) }),
              },
              {
                id: "direccion",
                label: "Dirección",
                options: TRENDS,
                selected: trendFilters,
                onToggle: (option) => updateFilters({ trends: toggleFilter(trendFilters, option as Trend) }),
              },
              ...(showUserFilters
                ? [
                    {
                      id: "area",
                      label: "Área",
                      options: allAreas,
                      selected: areaFilters,
                      onToggle: (option: string) => updateFilters({ areas: toggleFilter(areaFilters, option) }),
                    },
                    {
                      id: "lider",
                      label: "Líder",
                      options: allLeaders,
                      selected: leaderFilters,
                      onToggle: (option: string) => updateFilters({ leaders: toggleFilter(leaderFilters, option) }),
                    },
                  ]
                : []),
            ]}
          />
          {hasFilters && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Limpiar búsqueda y filtros"
                  onClick={clearFilters}
                  className="rounded-full text-text-secondary"
                >
                  <X className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Limpiar búsqueda y filtros</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Por qué estas son propuestas y no matches: se dice una vez arriba de
          la pestaña, no en cada tarjeta. */}
      {tab === "asociaciones" && visibleGroups.length > 0 && (
        <div
          style={{ ...toneWash(TAB_META.asociaciones.tone, 7), ...toneBorder(TAB_META.asociaciones.tone, 30) }}
          className="flex shrink-0 items-start gap-2.5 rounded-xl border px-3.5 py-3"
        >
          <Info style={toneText(TAB_META.asociaciones.tone)} className="mt-px size-4 shrink-0" strokeWidth={2.5} />
          <p className="text-[12.5px] font-medium leading-relaxed text-text-secondary">
            <span className="font-bold text-text-primary">Ninguno coincidió por username ni por correo</span>, que son los
            únicos datos con los que UBITS identifica a una persona. Los encontramos por nombre, documento o teléfono,
            así que confirma de quién se trata.
          </p>
        </div>
      )}

      {tab === "sinAlinear" && visibleGroups.length > 0 && (
        <div
          style={{ ...toneWash(TAB_META.sinAlinear.tone, 7), ...toneBorder(TAB_META.sinAlinear.tone, 30) }}
          className="flex shrink-0 items-start gap-2.5 rounded-xl border px-3.5 py-3"
        >
          <UserRoundSearch style={toneText(TAB_META.sinAlinear.tone)} className="mt-px size-4 shrink-0" strokeWidth={2.5} />
          <p className="text-[12.5px] font-medium leading-relaxed text-text-secondary">
            <span className="font-bold text-text-primary">Falta decir de quién son estos objetivos</span>: ningún usuario
            de UBITS coincide con estos identificadores. Abre <span className="font-bold">Selecciona un usuario</span>{" "}
            en cada tarjeta para elegirlo.
          </p>
        </div>
      )}

      {visibleGroups.length === 0 ? (
        /* Tres vacíos distintos: trabajo terminado (check), filtros que
           escondieron todo (con salida) y "Listos" vacío, que es la única
           mala noticia. */
        <div className="shrink-0 rounded-2xl border border-border/60 bg-surface px-4 py-14 text-center shadow-card">
          <span
            className={cn(
              "mb-3 inline-flex size-11 items-center justify-center rounded-xl",
              hasFilters
                ? "bg-surface-muted text-text-muted"
                : tab === "alineados"
                  ? "bg-status-warning/10 text-status-warning"
                  : "bg-status-positive/10 text-status-positive"
            )}
          >
            {hasFilters ? (
              <SearchX className="size-5" strokeWidth={2} />
            ) : tab === "alineados" ? (
              <AlertTriangle className="size-5" strokeWidth={2} />
            ) : (
              <CircleCheck className="size-5" strokeWidth={2} />
            )}
          </span>
          <p className="text-[14px] font-bold text-text-primary">
            {hasFilters ? "Ningún objetivo coincide" : TAB_META[tab].emptyTitle}
          </p>
          <p className="mx-auto mt-1.5 max-w-[440px] text-[12.5px] font-medium leading-relaxed text-text-secondary">
            {hasFilters
              ? "Ajusta la búsqueda o los filtros para volver a ver los objetivos del archivo."
              : TAB_META[tab].empty}
          </p>
          {hasFilters && (
            <Button type="button" variant="outline" size="lg" onClick={clearFilters} className="mt-4 font-bold">
              Limpiar búsqueda y filtros
            </Button>
          )}
        </div>
      ) : (
        /* Un solo scroller para todas las tarjetas, en ambos ejes: de lado por
           las columnas, hacia abajo por los usuarios. */
        <div className="min-h-0 flex-1 overflow-auto pb-0.5">
          {/* 1020px de columnas más los 12px de margen de cada lado. Va al paso
              del colgroup de la tarjeta. */}
          <div className="min-w-[1044px] space-y-3">
            {visibleGroups.map(({ group, objectives }, index) => {
              // Qué representa "esta tarjeta" para la selección: un usuario
              // entero en las pestañas de solo consulta, cada una de sus
              // filas en las otras dos — mismos ids que ya usa "quitar de la
              // carga" en cada caso.
              const cardSelectionIds = isRowSelection ? objectives.map((objective) => objective.id) : [group.identifier];
              const isCardSelected =
                cardSelectionIds.length > 0 && cardSelectionIds.every((id) => selectedIds.has(id));

              return (
                <ReviewGroupCard
                  key={group.identifier}
                  position={index + 1}
                  group={group}
                  objectives={objectives}
                  isProgressLoad={isProgressLoad}
                  isEditLoad={isEditLoad}
                  candidates={candidates}
                  isDuplicate={group.matchedUser !== undefined && duplicateUsernames.has(group.matchedUser.username)}
                  isCollapsed={collapsed.has(group.identifier)}
                  onToggle={() => toggleGroup(group.identifier)}
                  pendingQuestion={pendingQuestion}
                  onPendingQuestionChange={setPendingQuestion}
                  mergeTarget={
                    pendingQuestion?.kind === "merge" && pendingQuestion.identifier === group.identifier
                      ? groups.find((candidate) => candidate.identifier === pendingQuestion.targetIdentifier)
                      : undefined
                  }
                  findGroupFor={(username) => findGroupFor(group.identifier, username)}
                  onDelete={onDelete}
                  onDeleteMany={onDeleteMany}
                  onChange={onChange}
                  onAssignUser={(user) => onAssignUser(group.identifier, user)}
                  onConfirmObjective={onConfirmObjective}
                  onMerge={(targetIdentifier) => onMergeGroups?.(group.identifier, targetIdentifier)}
                  onRelinkObjective={onRelinkObjective}
                  isSelected={isCardSelected}
                  isSelectedIndeterminate={!isCardSelected && cardSelectionIds.some((id) => selectedIds.has(id))}
                  onToggleSelected={() => toggleManySelected(cardSelectionIds)}
                  selectedRowIds={isRowSelection ? selectedIds : undefined}
                  onToggleRowSelected={isRowSelection ? toggleOneSelected : undefined}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
