import * as React from "react";
import {
  Ban,
  Bell,
  BellRing,
  CalendarRange,
  Download,
  Eye,
  Info,
  Library,
  Pencil,
  Plus,
  RotateCcw,
  Scale,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Target,
  UserMinus,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  ActionRailShell,
  AnimatedActionItem,
  RailButton,
  RailConfirmButton,
  RailCreateOption,
  RailDivider,
  RailOverflowMenu,
  RailSelectionChip,
  useContextChangeKey,
  useRailPopoutSide,
} from "@/components/action-rail";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger, PopoverTitle } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CICLO_PERIOD_LABELS } from "@/components/ciclo-builder";
import { formatLongDate, formatPercent } from "@/components/ciclo-detail";
import { ObjetivosConfigDrawerWide } from "@/components/objetivos/ObjetivosConfigDrawerWide";
import type { CreateObjectivesIntent } from "./CreatePersonObjectivesDrawer";
import type { CicloResults, PersonResultRow } from "./resultsModel";

/**
 * La barra flotante de resultados.
 *
 * Hereda del reporte de encuestas lo que allá ya se probó —el grip, los
 * ajustes, el chip de selección, la descarga y la ficha de detalles bajo el
 * ícono de información— y cambia solo lo que este dominio pide: recordarle
 * algo a alguien es una acción que una encuesta no tiene, y aquí es la que
 * desatasca el ciclo.
 *
 * No trae "Vista previa": un ciclo cerrado no tiene nada que previsualizar.
 */

interface CicloResultsActionRailProps {
  results: CicloResults;
  /** Los colaboradores marcados en la tabla, en el orden en que la tabla los
   *  tiene. De aquí sale tanto la cuenta como el bloque individual. */
  selectedRows: readonly PersonResultRow[];
  /** Objetivos frenados en aprobación, con o sin selección. */
  blockedCount: number;
  activeTab?: string;
  onClearSelection: () => void;
  onDownload: (onlySelected: boolean) => void;
  onRemindProgress: () => void;
  onRemindApproval: () => void;
  /** El recordatorio general de avance: a quien no ha reportado nada, no a
   *  una selección puntual de la tabla. */
  onRemindNoProgress: () => void;
  onCreateObjectives: () => void;
  /** Abre el chat del Agente IA para armar una métrica del reporte. La
   *  métrica no se crea aquí: se conversa al lado y se monta en el resumen. */
  onCreateMetric: () => void;
  /** Si ese chat está abierto — con él abierto la barra no se repliega. */
  isMetricChatOpen: boolean;
  /** Abre la ficha de esa persona en la pestaña de objetivos. */
  onOpenPerson: (personId: string) => void;
  /** Abre el drawer de edición con todos los objetivos de esa persona. */
  onEditObjectives: (personId: string) => void;
  /**
   * Abre el drawer que escribe objetivos nuevos para los colaboradores
   * marcados. `intent` es la vía elegida en el menú —a mano, del banco o
   * conversando con el Agente IA—, para que el drawer no vuelva a preguntar
   * lo que el clic ya contestó.
   */
  onCreatePersonObjectives: (intent: CreateObjectivesIntent) => void;
  /** Abre el reparto de pesos de esa persona. */
  onEditWeights: (personId: string) => void;
  /** Inactiva o reactiva de una vez todos los objetivos de esa persona. */
  onSetObjectivesInactive: (personId: string, inactive: boolean) => void;
  /** Saca colaboradores del ciclo, con todo lo que cargaban. */
  onRemoveFromCiclo: (personIds: readonly string[]) => void;
  /** Abre el constructor en el paso de participantes. Sin ella la fila se
   *  deshabilita en vez de desaparecer, igual que en las notificaciones. */
  onEditParticipants?: () => void;
  /** Abre el constructor en el paso de objetivos, sobre grupos o sobre una
   *  persona. */
  onAddObjectives?: (target: "groups" | "individual") => void;
  /** Comparte el enlace del ciclo. Vive en las cinco pestañas: compartir un
   *  reporte no depende de cuál se esté mirando. */
  onShare: () => void;
}

export function CicloResultsActionRail({
  results,
  selectedRows,
  blockedCount,
  activeTab,
  onClearSelection,
  onDownload,
  onRemindProgress,
  onRemindApproval,
  onRemindNoProgress,
  onCreateObjectives,
  onCreateMetric,
  isMetricChatOpen,
  onOpenPerson,
  onEditObjectives,
  onCreatePersonObjectives,
  onEditWeights,
  onSetObjectivesInactive,
  onRemoveFromCiclo,
  onEditParticipants,
  onAddObjectives,
  onShare,
}: CicloResultsActionRailProps) {
  const selectedCount = selectedRows.length;
  const [isConfigOpen, setIsConfigOpen] = React.useState(false);
  /** El menú de participantes abierto: mientras lo esté, la barra no se
   *  repliega debajo de su propio popover. */
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  /** La confirmación abierta, o null. Las dos que la piden son las que no se
   *  deshacen solas: apagar todo lo de alguien, o sacarlo del ciclo. */
  const [confirm, setConfirm] = React.useState<"inactivar" | "activar" | "sacar" | null>(null);

  /*
   * Con un solo colaborador marcado la barra cambia de registro: deja de
   * hablarle a una lista y le habla a una persona. Son gestos que solo
   * significan algo de a uno —ver *sus* objetivos, corregirlos, repartir *su*
   * 100 %— y ofrecerlos sobre diez a la vez sería prometer algo que ninguno
   * de ellos puede cumplir sin preguntar de quién se trata.
   */
  const single = selectedCount === 1 ? selectedRows[0] : null;
  const activeObjectives = single
    ? single.entries.filter((entry) => entry.inactivation === null)
    : [];
  const hasObjectives = single ? single.entries.length > 0 : false;
  const allInactive = hasObjectives && activeObjectives.length === 0;

  const mode = selectedCount === 0 ? "none" : single ? "single" : "selected";
  const animKey = useContextChangeKey(mode);
  // Cuenta en los resultados pero no reportó nada: el mismo universo que
  // `peopleWithProgress` complementa.
  const noProgressCount = results.scored.length - results.peopleWithProgress;

  const contextual =
    selectedCount === 0 ? null : (
      <>
        <AnimatedActionItem animKey={animKey} staggerIndex={0} skipColorFlash>
          <RailSelectionChip count={selectedCount} onClear={onClearSelection} gender="m" />
        </AnimatedActionItem>
        <AnimatedActionItem animKey={animKey} staggerIndex={1} skipColorFlash>
          <RailDivider />
        </AnimatedActionItem>

        {/* Primera de la tira y viva con uno o con veinte marcados: escribirle
            un objetivo a alguien es lo único de este bloque que significa lo
            mismo para una persona que para una tanda entera. Las tres vías
            —a mano, del banco, con IA— se eligen aquí y no dentro del drawer,
            para que el gesto que abre ya diga por dónde se entra. */}
        <AnimatedActionItem animKey={animKey} staggerIndex={2}>
          <CreateObjectivesMenu
            count={selectedCount}
            name={single?.collaborator.name ?? null}
            onOpenChange={setIsMenuOpen}
            onChoose={onCreatePersonObjectives}
          />
        </AnimatedActionItem>

        {single && (
          <>
            <AnimatedActionItem animKey={animKey} staggerIndex={3}>
              <RailButton
                icon={<Eye className="h-[20px] w-[20px]" strokeWidth={2} />}
                label={`Ver los objetivos de ${single.collaborator.name}`}
                onClick={() => onOpenPerson(single.person.id)}
              />
            </AnimatedActionItem>
            <AnimatedActionItem animKey={animKey} staggerIndex={4}>
              <RailButton
                icon={<Pencil className="h-[20px] w-[20px]" strokeWidth={2} />}
                label="Editar sus objetivos"
                blockedReason={hasObjectives ? null : "Este colaborador no tiene objetivos todavía"}
                onClick={() => onEditObjectives(single.person.id)}
              />
            </AnimatedActionItem>
            <AnimatedActionItem animKey={animKey} staggerIndex={5}>
              <RailButton
                icon={<Scale className="h-[20px] w-[20px]" strokeWidth={2} />}
                label="Editar el peso de sus objetivos"
                blockedReason={hasObjectives ? null : "Este colaborador no tiene objetivos todavía"}
                onClick={() => onEditWeights(single.person.id)}
              />
            </AnimatedActionItem>
            {/* Una sola casilla para los dos sentidos: si ya está todo
                apagado, lo que queda por hacer es encenderlo. El sí/no va
                pegado al botón, no en un modal con velo: la decisión es sobre
                la fila que está marcada ahí mismo. */}
            <AnimatedActionItem animKey={animKey} staggerIndex={6}>
              {allInactive ? (
                <RailConfirmButton
                  icon={<RotateCcw className="h-[20px] w-[20px]" strokeWidth={2} />}
                  label="Activar sus objetivos"
                  open={confirm === "activar"}
                  onOpenChange={(next) => setConfirm(next ? "activar" : null)}
                  title={
                    single.entries.length > 1
                      ? `¿Activar sus ${single.entries.length} objetivos?`
                      : "¿Activar su objetivo?"
                  }
                  description={`Vuelven a contar para el resultado de ${single.collaborator.name} con el avance que traían.`}
                  confirmLabel="Activar"
                  confirmTone="primary"
                  onConfirm={() => {
                    onSetObjectivesInactive(single.person.id, false);
                    setConfirm(null);
                  }}
                />
              ) : (
                <RailConfirmButton
                  icon={<Ban className="h-[20px] w-[20px]" strokeWidth={2} />}
                  label={`Inactivar sus objetivos (${activeObjectives.length})`}
                  blockedReason={
                    hasObjectives ? null : "Este colaborador no tiene objetivos todavía"
                  }
                  open={confirm === "inactivar"}
                  onOpenChange={(next) => setConfirm(next ? "inactivar" : null)}
                  title={
                    activeObjectives.length > 1
                      ? `¿Inactivar sus ${activeObjectives.length} objetivos?`
                      : "¿Inactivar su objetivo?"
                  }
                  description={`Dejan de contar para ${single.collaborator.name} y salen del ponderado. Su avance se conserva y puedes volver a activarlos.`}
                  confirmLabel="Inactivar"
                  confirmTone="warning"
                  onConfirm={() => {
                    onSetObjectivesInactive(single.person.id, true);
                    setConfirm(null);
                  }}
                />
              )}
            </AnimatedActionItem>
          </>
        )}

        <AnimatedActionItem animKey={animKey} staggerIndex={single ? 7 : 3}>
          <RailButton
            icon={<BellRing className="h-[20px] w-[20px]" strokeWidth={2} />}
            label={
              single
                ? `Recordar avance a ${single.collaborator.name}`
                : `Recordar avance a los seleccionados (${selectedCount})`
            }
            onClick={onRemindProgress}
          />
        </AnimatedActionItem>
        <AnimatedActionItem animKey={animKey} staggerIndex={single ? 8 : 4}>
          <RailButton
            icon={<Download className="h-[20px] w-[20px]" strokeWidth={2} />}
            label={single ? "Exportar sus resultados" : `Exportar seleccionados (${selectedCount})`}
            onClick={() => onDownload(true)}
          />
        </AnimatedActionItem>
        {/* Última y en rojo: es la única de la tira que borra algo. Sirve
            igual para uno que para la tanda marcada — sacar del ciclo no
            necesita saber de quién se trata para significar lo mismo. */}
        <AnimatedActionItem animKey={animKey} staggerIndex={single ? 9 : 5}>
          <RailConfirmButton
            icon={<UserMinus className="h-[20px] w-[20px]" strokeWidth={2} />}
            tone="danger"
            label={
              single
                ? `Sacar a ${single.collaborator.name} del ciclo`
                : `Sacar del ciclo a los seleccionados (${selectedCount})`
            }
            open={confirm === "sacar"}
            onOpenChange={(next) => setConfirm(next ? "sacar" : null)}
            title={
              single
                ? `¿Sacar a ${single.collaborator.name} del ciclo?`
                : `¿Sacar del ciclo a ${selectedCount} colaboradores?`
            }
            description={
              single
                ? "Se va con sus objetivos, su avance y sus comentarios. No se puede deshacer."
                : "Se van con sus objetivos, su avance y sus comentarios. No se puede deshacer."
            }
            confirmLabel="Sacar del ciclo"
            confirmTone="destructive"
            onConfirm={() => {
              onRemoveFromCiclo(selectedRows.map((row) => row.person.id));
              setConfirm(null);
            }}
          />
        </AnimatedActionItem>
      </>
    );

  return (
    <>
      <ActionRailShell
        keepOpen={selectedCount > 0 || isConfigOpen || isMenuOpen || confirm !== null}
        /* Con el chat del Agente IA abierto la barra se recoge y se queda
           inerte: sus acciones son del reporte y el panel de la izquierda ya
           tiene las suyas, así que dejarla flotando encima era ofrecer dos
           juegos de botones para dos cosas distintas. Vuelve sola al cerrar
           el chat. */
        isBlocked={isMetricChatOpen}
        contextual={contextual}
        persistent={
          selectedCount === 0 ? (
            <>
              {/* Crear métrica y enviar notificaciones van juntos, sin
                  divisoria entre ellos: las dos agregan algo a este reporte
                  en vez de actuar sobre el ciclo, la misma razón por la que
                  configuración y el resto tampoco la llevan. */}
              {activeTab === "resumen" && (
                <RailButton
                  icon={<Plus className="h-[20px] w-[20px]" strokeWidth={2} />}
                  label="Crear una métrica para este reporte"
                  onClick={onCreateMetric}
                />
              )}
              <RailNotificationsMenu
                blockedCount={blockedCount}
                noProgressCount={noProgressCount}
                withoutObjectivesCount={results.withoutObjectives.length}
                onRemindApproval={onRemindApproval}
                onRemindNoProgress={onRemindNoProgress}
                onCreateObjectives={onCreateObjectives}
              />
              {/* Sobre Colaboradores la barra hereda lo que la lista de
                  ciclos ya ofrecía sobre una fila: quién participa y a quién
                  le faltan objetivos. Van bajo un solo botón porque son el
                  mismo tema —el reparto del ciclo— y porque tres íconos más
                  sueltos vuelven ilegible la tira. */}
              {activeTab === "colaboradores" && (
                <RailOverflowMenu
                  label="Participantes y objetivos"
                  icon={<Users className="h-[20px] w-[20px]" strokeWidth={2} />}
                  onOpenChange={setIsMenuOpen}
                  items={[
                    {
                      id: "participantes",
                      label: "Editar participantes",
                      icon: <Users className="h-[18px] w-[18px]" strokeWidth={2} />,
                      blockedReason: onEditParticipants
                        ? null
                        : "No se puede editar este ciclo desde aquí",
                      onClick: () => onEditParticipants?.(),
                    },
                    {
                      id: "objetivos-grupos",
                      label: "Añadir objetivos a grupos",
                      icon: <Target className="h-[18px] w-[18px]" strokeWidth={2} />,
                      blockedReason: onAddObjectives
                        ? null
                        : "No se puede editar este ciclo desde aquí",
                      onClick: () => onAddObjectives?.("groups"),
                    },
                    {
                      id: "objetivos-individual",
                      label: "Añadir objetivos a colaborador",
                      icon: <UserPlus className="h-[18px] w-[18px]" strokeWidth={2} />,
                      blockedReason: onAddObjectives
                        ? null
                        : "No se puede editar este ciclo desde aquí",
                      onClick: () => onAddObjectives?.("individual"),
                    },
                  ]}
                />
              )}
              <RailButton
                icon={<SlidersHorizontal className="h-[20px] w-[20px]" strokeWidth={2} />}
                label="Configuración de estados, niveles y participantes"
                onClick={() => setIsConfigOpen(true)}
              />
              <CicloDetailsCard results={results} />
              <RailButton
                icon={<Share2 className="h-[20px] w-[20px]" strokeWidth={2} />}
                label="Compartir"
                onClick={onShare}
              />
              <RailButton
                icon={<Download className="h-[20px] w-[20px]" strokeWidth={2} />}
                label="Descargar información"
                onClick={() => onDownload(false)}
              />
            </>
          ) : null
        }
      />
      <ObjetivosConfigDrawerWide
        open={isConfigOpen}
        onOpenChange={setIsConfigOpen}
        initialTab="estados"
      />
    </>
  );
}

/**
 * Las tres formas de escribirle un objetivo a los colaboradores marcados.
 *
 * Es el mismo menú —y los mismos tres nombres— con los que el constructor
 * trae objetivos a una asignación: a mano, del banco, o conversando con el
 * Agente IA. Se pregunta aquí, sobre la selección, y no dentro del drawer,
 * porque el drawer ya abre trabajando: preguntar otra vez sería pedir dos
 * veces la misma decisión.
 */
function CreateObjectivesMenu({
  count,
  name,
  onOpenChange,
  onChoose,
}: {
  count: number;
  /** El nombre, cuando hay una sola persona marcada. */
  name: string | null;
  onOpenChange: (open: boolean) => void;
  onChoose: (intent: CreateObjectivesIntent) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const side = useRailPopoutSide();

  const label = name
    ? `Crear objetivos para ${name}`
    : `Crear objetivos para los seleccionados (${count})`;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    onOpenChange(next);
  };

  const choose = (intent: CreateObjectivesIntent) => () => {
    handleOpenChange(false);
    onChoose(intent);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={label}
              className={cn(
                "dock-item relative flex h-10 w-10 items-center justify-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
                open && "bg-white/10 text-white"
              )}
            >
              <Target className="h-[20px] w-[20px]" strokeWidth={2} />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-[220px]">
          {label}
        </TooltipContent>
      </Tooltip>

      <PopoverContent
        align="center"
        side={side}
        sideOffset={16}
        collisionPadding={16}
        className="w-[300px] rounded-2xl border-white/10 bg-surface-nav p-2 text-white/60 shadow-rail"
      >
        <svg width="0" height="0" className="absolute">
          <defs>
            <linearGradient id="ai-icon-gradient-results-objectives" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--ai-gradient-start))" />
              <stop offset="100%" stopColor="hsl(var(--ai-gradient-end))" />
            </linearGradient>
          </defs>
        </svg>

        {/* El Agente IA primero: es la vía que menos pide saber de antemano,
            y la que el resto del módulo ya pone arriba en este mismo menú. */}
        <button
          type="button"
          onClick={choose("ia")}
          className="hover-icon-pop group flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-white/5"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 transition-colors group-hover:bg-white/10">
            <Sparkles
              className="h-5 w-5"
              strokeWidth={2.5}
              stroke="url(#ai-icon-gradient-results-objectives)"
            />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-[14px] font-bold tracking-tight text-ai-gradient">
              Proponer con IA
            </span>
            <span className="text-[11px] font-medium text-white/45">
              Conversa y genera una propuesta base.
            </span>
          </span>
        </button>

        <RailCreateOption
          icon={<Library className="h-5 w-5" strokeWidth={2} />}
          title="Elegir del banco"
          description="Objetivos ya escritos por área y tema."
          onClick={choose("banco")}
        />
        <RailCreateOption
          icon={<Plus className="h-5 w-5" strokeWidth={2} />}
          title="Crear manualmente"
          description="Redacta un objetivo desde cero."
          onClick={choose("manual")}
        />
      </PopoverContent>
    </Popover>
  );
}

interface NotificationItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  count: number;
  onClick: () => void;
}

/**
 * Los tres recordatorios del ciclo, bajo un solo botón.
 *
 * Antes eran dos botones sueltos en la barra —"Recordar aprobación" y "Crear
 * objetivos"— que aparecían y desaparecían según hubiera algo pendiente, y un
 * tercero que solo vivía dentro de la tabla de colaboradores. Los tres
 * responden la misma pregunta ("¿a quién le aviso qué?"), así que ahora es un
 * único botón de notificaciones con una fila por destinatario: los líderes que
 * deben aprobar, los colaboradores que no han reportado avance y los que
 * todavía no tienen objetivos.
 *
 * Cada fila se deshabilita sola cuando su lista está vacía, en vez de
 * desaparecer: un recordatorio que no aplica hoy sigue siendo parte del mismo
 * menú mañana.
 */
function RailNotificationsMenu({
  blockedCount,
  noProgressCount,
  withoutObjectivesCount,
  onRemindApproval,
  onRemindNoProgress,
  onCreateObjectives,
}: {
  blockedCount: number;
  noProgressCount: number;
  withoutObjectivesCount: number;
  onRemindApproval: () => void;
  onRemindNoProgress: () => void;
  onCreateObjectives: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const side = useRailPopoutSide();
  const hasPending = blockedCount > 0 || noProgressCount > 0 || withoutObjectivesCount > 0;

  const items: readonly NotificationItem[] = [
    {
      id: "aprobacion",
      icon: <Bell className="h-[18px] w-[18px]" strokeWidth={2} />,
      label: "Recordar aprobación a líderes",
      count: blockedCount,
      onClick: onRemindApproval,
    },
    {
      id: "avance",
      icon: <BellRing className="h-[18px] w-[18px]" strokeWidth={2} />,
      label: "Recordar actualizar avance a colaboradores",
      count: noProgressCount,
      onClick: onRemindNoProgress,
    },
    {
      id: "objetivos",
      icon: <UserPlus className="h-[18px] w-[18px]" strokeWidth={2} />,
      label: "Recordar crear objetivos",
      count: withoutObjectivesCount,
      onClick: onCreateObjectives,
    },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Enviar notificaciones"
              className={cn(
                "dock-item relative flex h-10 w-10 items-center justify-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
                open && "bg-white/10 text-white"
              )}
            >
              <Bell className="h-[20px] w-[20px]" strokeWidth={2} />
              {hasPending && (
                <span className="absolute right-1.5 top-1 h-2 w-2 rounded-full border-[1.5px] border-surface-nav bg-primary" />
              )}
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side={side}>Enviar notificaciones</TooltipContent>
      </Tooltip>

      <PopoverContent
        align="center"
        side={side}
        sideOffset={16}
        collisionPadding={16}
        className="w-[400px] rounded-2xl border-white/10 bg-surface-nav p-2 text-white/60 shadow-rail"
      >
        {items.map((item) => {
          const disabled = item.count === 0;
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              title={disabled ? "Nada pendiente por aquí" : undefined}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-white/60 transition-colors group-hover:bg-white/10 group-hover:text-white group-disabled:group-hover:bg-white/5 group-disabled:group-hover:text-white/60">
                {item.icon}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-tight text-white">
                {item.label}
              </span>
              <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white/70">
                {item.count}
              </span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Los hechos del ciclo bajo el ícono de información, igual que en el reporte
 * de una encuesta: lo último antes de sacar conclusiones es una revisión
 * rápida de con qué se están sacando.
 */
function CicloDetailsCard({ results }: { results: CicloResults }) {
  const { data } = results;
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label="Detalles del ciclo"
          className="dock-item relative flex h-10 w-10 items-center justify-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          <Info className="h-[20px] w-[20px]" strokeWidth={2} />
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="center"
        sideOffset={16}
        avoidCollisions={false}
        className="w-80 gap-0 rounded-2xl border border-white/10 bg-surface-nav p-4 shadow-rail"
      >
        <PopoverTitle className="text-[13px] font-semibold text-white">
          Detalles del ciclo
        </PopoverTitle>
        <div className="mb-3 mt-2 h-px bg-white/10" />
        <dl className="flex flex-col gap-2.5">
          <InfoRow icon={CalendarRange} label="Periodo" value={CICLO_PERIOD_LABELS[data.period]} />
          <InfoRow
            icon={CalendarRange}
            label="Fechas"
            value={`${formatLongDate(`${data.startDate}T12:00:00`)} – ${formatLongDate(
              `${data.endDate}T12:00:00`
            )}`}
          />
          <InfoRow icon={Users} label="Participantes" value={results.peopleCount} />
          <InfoRow icon={Target} label="Objetivos" value={results.objectiveCount} />
          <InfoRow icon={Sparkles} label="Avance general" value={formatPercent(results.overallPercent)} />
          <InfoRow
            icon={Scale}
            label="Resultados negativos"
            value={data.status === "closed" ? "Ciclo cerrado" : "Ciclo en curso"}
          />
        </dl>
      </HoverCardContent>
    </HoverCard>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-[13px] leading-none text-white/60">
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
        {label}
      </span>
      <span className="max-w-[60%] truncate text-right text-[12.5px] font-semibold leading-none text-white">
        {value}
      </span>
    </div>
  );
}
