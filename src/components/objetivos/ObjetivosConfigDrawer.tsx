import * as React from "react";
import {
  Award,
  Layers,
  Plus,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Trash2,
  Users,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UbitsTabs } from "@/components/navigation";
import { DrawerSection, DrawerShell } from "@/components/overlays";
import { SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AddRangeButton,
  DistributionBar,
  PermissionGroup,
  RangeRow,
  type ConfigTab,
  type PermissionDefinition,
} from "./objetivosConfigParts";
import {
  DEFAULT_ESTADOS_OBJETIVOS,
  getEstadoBadgeConfig,
  getObjetivosConfig,
  setObjetivosConfig,
  type EstadoParticipanteConfig,
  type NivelDesempenoConfig,
  type ObjetivoEstadoConfig,
} from "./objetivosConfigStore";

// Re-exportados para no romper a quien ya los importaba desde este archivo
// (o desde el barrel `objetivos/index.ts`) antes de que se movieran al store.
export { DEFAULT_ESTADOS_OBJETIVOS, getEstadoBadgeConfig };
export type { ObjetivoEstadoConfig };

export type { NivelDesempenoConfig };

interface ObjetivosConfigDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: ConfigTab;
}

const COLOR_VARIANTS: { label: string; variant: ObjetivoEstadoConfig["variant"]; hex: string }[] = [
  { label: "Verde", variant: "positive", hex: "#86EFAC" },
  { label: "Verde Intenso", variant: "positive", hex: "#22C55E" },
  { label: "Amarillo", variant: "warning", hex: "#FCD34D" },
  { label: "Naranja", variant: "warning", hex: "#FDBA74" },
  { label: "Azul", variant: "info", hex: "#93C5FD" },
  { label: "Rojo", variant: "negative", hex: "#FCA5A5" },
  { label: "Rojo Intenso", variant: "negative", hex: "#EF4444" },
  { label: "Gris", variant: "neutral", hex: "#CBD5E1" },
];

const CONFIG_TABS = [
  { id: "permisos", label: "Permisos", icon: <ShieldCheck className="size-4" /> },
  { id: "estados", label: "Estados del colaborador", icon: <Target className="size-4" /> },
  { id: "niveles", label: "Niveles", icon: <Award className="size-4" /> },
];

/**
 * Los permisos del módulo, escritos como datos y no como catorce filas
 * repetidas: la única diferencia entre una y otra era su etiqueta y si venía
 * encendida.
 */
const PERMISOS_LIDER_PROPIOS: readonly PermissionDefinition[] = [
  { label: "Ver", defaultEnabled: true },
  { label: "Crear", defaultEnabled: true },
  { label: "Actualizar", defaultEnabled: true },
  { label: "Editar", defaultEnabled: true },
  { label: "Eliminar", defaultEnabled: true },
  { label: "Subir sin aprobación", defaultEnabled: true },
  { label: "Inactivar / Activar", defaultEnabled: true },
];

const PERMISOS_LIDER_EQUIPO: readonly PermissionDefinition[] = [
  { label: "Ver", defaultEnabled: true },
  { label: "Crear", defaultEnabled: true },
  { label: "Actualizar", defaultEnabled: true },
  { label: "Editar", defaultEnabled: true },
  { label: "Eliminar", defaultEnabled: true },
  { label: "Aprobar / Denegar", defaultEnabled: true },
  { label: "Inactivar / Activar", defaultEnabled: true },
];

const PERMISOS_COLABORADOR: readonly PermissionDefinition[] = [
  { label: "Ver", defaultEnabled: true },
  { label: "Crear", defaultEnabled: true },
  { label: "Actualizar", defaultEnabled: true },
  { label: "Editar", defaultEnabled: false },
  { label: "Eliminar", defaultEnabled: false },
  { label: "Subir sin aprobación", defaultEnabled: false },
  { label: "Inactivar / Activar", defaultEnabled: false },
];

const MIN_ESTADOS = 3;
const MAX_ESTADOS = 8;
const MIN_NIVELES = 1;
const MAX_NIVELES = 5;

export function ObjetivosConfigDrawer({
  open,
  onOpenChange,
  initialTab = "permisos",
}: ObjetivosConfigDrawerProps) {
  const [activeTab, setActiveTab] = React.useState<ConfigTab>(initialTab);
  const [estados, setEstados] = React.useState<ObjetivoEstadoConfig[]>(
    () => getObjetivosConfig().estados
  );
  const [niveles, setNiveles] = React.useState<NivelDesempenoConfig[]>(
    () => getObjetivosConfig().niveles
  );
  const [estadosParticipante, setEstadosParticipante] = React.useState<EstadoParticipanteConfig[]>(
    () => getObjetivosConfig().estadosParticipante
  );
  const [allowNegativeResults, setAllowNegativeResults] = React.useState(
    () => getObjetivosConfig().allowNegativeResults
  );

  /**
   * La primera tanda de tarjetas llega mientras el panel todavía está
   * entrando, así que espera a que esa animación despeje; a partir del primer
   * cambio de pestaña ya no hay nada que esperar y la cascada corre de una.
   */
  const [hasSwitchedTab, setHasSwitchedTab] = React.useState(false);

  const switchTab = (tab: ConfigTab) => {
    setActiveTab(tab);
    setHasSwitchedTab(true);
  };

  React.useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
      setHasSwitchedTab(false);
      // Vuelve a partir de lo último guardado, no de lo que haya quedado
      // editado sin guardar la vez anterior que se abrió el drawer.
      setEstados(getObjetivosConfig().estados);
      setEstadosParticipante(getObjetivosConfig().estadosParticipante);
      setAllowNegativeResults(getObjetivosConfig().allowNegativeResults);
    }
  }, [open, initialTab]);

  React.useEffect(() => {
    setEstados((prev) => {
      if (!allowNegativeResults) {
        // Remove purely negative states and clamp overlapping ones
        const filtered = prev.filter((est) => est.maxPorcentaje >= 0);
        let changed = filtered.length !== prev.length;
        
        const newEstados = filtered.map((est) => {
          if (est.minPorcentaje < 0) {
            changed = true;
            return { ...est, minPorcentaje: 0 };
          }
          return est;
        });
        
        return changed ? newEstados : prev;
      } else {
        // When enabled, if there's no negative state, restore the default 'resto' state
        const hasNegative = prev.some((est) => est.minPorcentaje < 0 || est.id === "resto");
        if (!hasNegative) {
          const restoState = DEFAULT_ESTADOS_OBJETIVOS.find((e) => e.id === "resto");
          if (restoState) {
            const next = [...prev, restoState].sort((a, b) => a.minPorcentaje - b.minPorcentaje);
            return next;
          }
        }
        return prev;
      }
    });
  }, [allowNegativeResults]);

  const handleUpdateEstado = (id: string, patch: Partial<ObjetivoEstadoConfig>) => {
    setEstados((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index === -1) return prev;

      const oldState = prev[index];
      const nextStates = [...prev];
      nextStates[index] = { ...oldState, ...patch };

      // Auto-adjust topology downwards
      if (patch.maxPorcentaje !== undefined && patch.maxPorcentaje !== oldState.maxPorcentaje) {
        let currentMax = patch.maxPorcentaje;
        for (let i = index + 1; i < nextStates.length; i++) {
          const wasConnected = prev[i].minPorcentaje === prev[i - 1].maxPorcentaje + 1;
          if (wasConnected) {
            nextStates[i] = { ...nextStates[i], minPorcentaje: currentMax + 1 };
            if (nextStates[i].maxPorcentaje < nextStates[i].minPorcentaje) {
              nextStates[i].maxPorcentaje = nextStates[i].minPorcentaje;
            }
            currentMax = nextStates[i].maxPorcentaje;
          } else {
            break;
          }
        }
      }

      // Auto-adjust topology upwards
      if (patch.minPorcentaje !== undefined && patch.minPorcentaje !== oldState.minPorcentaje) {
        let currentMin = patch.minPorcentaje;
        for (let i = index - 1; i >= 0; i--) {
          const wasConnected = prev[i].maxPorcentaje === prev[i + 1].minPorcentaje - 1;
          if (wasConnected) {
            nextStates[i] = { ...nextStates[i], maxPorcentaje: currentMin - 1 };
            if (nextStates[i].minPorcentaje > nextStates[i].maxPorcentaje) {
              nextStates[i].minPorcentaje = nextStates[i].maxPorcentaje;
            }
            currentMin = nextStates[i].minPorcentaje;
          } else {
            break;
          }
        }
      }

      return nextStates;
    });
  };

  const handleAddEstado = () => {
    if (estados.length >= MAX_ESTADOS) {
      toast.error(`Máximo ${MAX_ESTADOS} estados permitidos`);
      return;
    }
    const highest = estados.length > 0 ? Math.max(...estados.map(e => e.maxPorcentaje)) : 0;
    const newMin = highest + 1;
    const newMax = newMin + 49;
    const newId = `custom-estado-${Date.now()}`;
    const newEstado: ObjetivoEstadoConfig = {
      id: newId,
      nombre: "Nuevo estado",
      minPorcentaje: newMin,
      maxPorcentaje: newMax,
      variant: "info",
      colorHex: COLOR_VARIANTS[estados.length % COLOR_VARIANTS.length].hex,
      descripcion: "Estado personalizado para seguimiento de objetivos.",
    };
    setEstados((prev) => [...prev, newEstado]);
    toast.success("Nuevo estado agregado");
  };

  const handleDeleteEstado = (id: string) => {
    if (estados.length <= MIN_ESTADOS) return;
    setEstados((prev) => prev.filter((item) => item.id !== id));
    toast.info("Estado eliminado");
  };

  const handleUpdateNivel = (id: string, patch: Partial<NivelDesempenoConfig>) => {
    setNiveles((prev) => {
      const index = prev.findIndex((item) => item.id === id);
      if (index === -1) return prev;

      const oldState = prev[index];
      const nextStates = [...prev];
      nextStates[index] = { ...oldState, ...patch };

      // Auto-adjust topology downwards
      if (patch.maxPorcentaje !== undefined && patch.maxPorcentaje !== oldState.maxPorcentaje) {
        let currentMax = patch.maxPorcentaje;
        for (let i = index + 1; i < nextStates.length; i++) {
          const wasConnected = prev[i].minPorcentaje === prev[i - 1].maxPorcentaje + 1;
          if (wasConnected) {
            nextStates[i] = { ...nextStates[i], minPorcentaje: currentMax + 1 };
            if (nextStates[i].maxPorcentaje < nextStates[i].minPorcentaje) {
              nextStates[i].maxPorcentaje = nextStates[i].minPorcentaje;
            }
            currentMax = nextStates[i].maxPorcentaje;
          } else {
            break;
          }
        }
      }

      // Auto-adjust topology upwards
      if (patch.minPorcentaje !== undefined && patch.minPorcentaje !== oldState.minPorcentaje) {
        let currentMin = patch.minPorcentaje;
        for (let i = index - 1; i >= 0; i--) {
          const wasConnected = prev[i].maxPorcentaje === prev[i + 1].minPorcentaje - 1;
          if (wasConnected) {
            nextStates[i] = { ...nextStates[i], maxPorcentaje: currentMin - 1 };
            if (nextStates[i].minPorcentaje > nextStates[i].maxPorcentaje) {
              nextStates[i].minPorcentaje = nextStates[i].maxPorcentaje;
            }
            currentMin = nextStates[i].minPorcentaje;
          } else {
            break;
          }
        }
      }

      return nextStates;
    });
  };

  const handleDeleteNivel = (id: string) => {
    if (niveles.length <= MIN_NIVELES) return;
    setNiveles((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddNivel = () => {
    if (niveles.length >= MAX_NIVELES) {
      toast.error(`Máximo ${MAX_NIVELES} niveles permitidos`);
      return;
    }
    const highest = niveles.length > 0 ? Math.max(...niveles.map(n => n.maxPorcentaje)) : 0;
    const newMin = highest + 1;
    const newMax = newMin + 49;
    const newId = `nivel-${Date.now()}`;
    const newColor = COLOR_VARIANTS[niveles.length % COLOR_VARIANTS.length].hex;
    setNiveles((prev) => [
      ...prev,
      { id: newId, nombre: "Nuevo nivel", minPorcentaje: newMin, maxPorcentaje: newMax, colorHex: newColor },
    ].sort((a, b) => a.minPorcentaje - b.minPorcentaje));
    toast.success("Nuevo nivel agregado");
  };

  const handleSaveConfig = () => {
    // Validar Estados
    const estadoNames = new Set<string>();
    const estadoColors = new Set<string>();
    
    for (const est of estados) {
      const nombreTrimmed = est.nombre.trim();
      if (!nombreTrimmed) {
        toast.error("Todos los estados deben tener un nombre.");
        return;
      }
      
      if (nombreTrimmed.toLowerCase() === "nuevo estado") {
        toast.error("Debes asignarle un nombre real al nuevo estado que creaste.");
        return;
      }
      
      const nombreLower = nombreTrimmed.toLowerCase();
      if (estadoNames.has(nombreLower)) {
        toast.error(`El nombre de estado "${nombreTrimmed}" está repetido.`);
        return;
      }
      estadoNames.add(nombreLower);

      if (estadoColors.has(est.colorHex)) {
        toast.error(`El color de "${nombreTrimmed}" ya está siendo usado. Cada estado debe tener un color único.`);
        return;
      }
      estadoColors.add(est.colorHex);

      if (est.minPorcentaje > est.maxPorcentaje) {
        toast.error(`En "${nombreTrimmed}", el porcentaje "Desde" (${est.minPorcentaje}%) no puede ser mayor que "Hasta" (${est.maxPorcentaje}%).`);
        return;
      }
    }

    // Validar Niveles
    const nivelNames = new Set<string>();
    const nivelColors = new Set<string>();
    
    for (const nivel of niveles) {
      const nombreTrimmed = nivel.nombre.trim();
      if (!nombreTrimmed) {
        toast.error("Todos los niveles deben tener un nombre.");
        return;
      }
      
      if (nombreTrimmed.toLowerCase() === "nuevo nivel") {
        toast.error("Debes asignarle un nombre real al nuevo nivel que creaste.");
        return;
      }
      
      const nombreLower = nombreTrimmed.toLowerCase();
      if (nivelNames.has(nombreLower)) {
        toast.error(`El nombre de nivel "${nombreTrimmed}" está repetido.`);
        return;
      }
      nivelNames.add(nombreLower);

      if (nivelColors.has(nivel.colorHex)) {
        toast.error(`El color de "${nombreTrimmed}" ya está siendo usado. Cada nivel debe tener un color único.`);
        return;
      }
      nivelColors.add(nivel.colorHex);

      if (nivel.minPorcentaje > nivel.maxPorcentaje) {
        toast.error(`En "${nombreTrimmed}", el porcentaje "Desde" (${nivel.minPorcentaje}%) no puede ser mayor que "Hasta" (${nivel.maxPorcentaje}%).`);
        return;
      }
    }

    // Estados, niveles y el permiso de resultados negativos son la parte de
    // esta pantalla que otros componentes necesitan leer —el simulador de
    // avance de un objetivo, la vista de seguimiento de un ciclo— así que se
    // comitean al store compartido. Los permisos, por ahora, no salen de aquí.
    const participanteNames = new Set<string>();
    for (const estado of estadosParticipante) {
      const nombre = estado.nombre.trim();
      if (!nombre) {
        toast.error("Todos los estados del participante deben tener un nombre.");
        return;
      }
      if (participanteNames.has(nombre.toLowerCase())) {
        toast.error(`Ya existe un estado del participante llamado "${nombre}".`);
        return;
      }
      participanteNames.add(nombre.toLowerCase());
    }
    if (!estadosParticipante.some((estado) => estado.cuentaEnResultados)) {
      toast.error("Al menos un estado del participante tiene que contar en los resultados.");
      return;
    }

    setObjetivosConfig({ estados, niveles, estadosParticipante, allowNegativeResults });

    toast.success("Configuración de objetivos guardada correctamente");
    onOpenChange(false);
  };

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title="Configuración de objetivos"
      description="Los permisos, estados y niveles que aplican a todos los ciclos del módulo."
      size="2xl"
      // Un punto más ancho que un drawer de lectura, con piso: la fila de un
      // rango lleva dos porcentajes y un color debajo del nombre, y por debajo
      // de ese mínimo esos tres campos se rompen.
      //
      // `!bg-background`: el gap-4 del Sheet entre el header y el cuerpo deja
      // un hueco pintado con el blanco de fábrica del panel; en este tono se
      // funde con el resto del contenido en vez de leerse como una franja
      // en blanco.
      className="!w-[36vw] !max-w-[46rem] !min-w-[34rem] gap-0 !bg-background"
      disablePadding
      footer={
        <SheetFooter className="border-t border-border/60 bg-surface px-4 py-3">
          <Button onClick={handleSaveConfig} className="w-full gap-2 font-semibold">
            <Save className="h-4 w-4" />
            Guardar cambios
          </Button>
        </SheetFooter>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col bg-background">
        {/* Las mismas pestañas que el detalle de un ciclo: el control segmentado
            del sistema, no una tira de subrayados propia de este drawer. Va
            fuera del contenedor con llave para que el indicador se deslice de
            una pestaña a la otra en vez de remontarse con el contenido. */}
        {/* Fijas arriba del área que scrollea: la pestaña de permisos es más
            alta que el panel, y perder la vuelta a "Estados del colaborador"
            al bajar anula la navegación — igual que la tira del home. */}
        <div className="shrink-0 px-4 pb-2 pt-4">
          <UbitsTabs
            tabs={CONFIG_TABS}
            activeTabId={activeTab}
            onTabChange={(id) => switchTab(id as ConfigTab)}
            fitContent
            className="mb-0"
          />
        </div>

        {/*
          * Cada parte de la configuración en su propia tarjeta sobre el fondo
          * del drawer, con la misma anatomía que el centro de descargas y el
          * drawer de actualizar un objetivo: chip del icono, título, la línea
          * que explica para qué sirve y, bajo una divisoria, sus controles.
          *
          * La llave del contenedor es la pestaña, así que cambiar de pestaña
          * remonta las tarjetas y vuelve a correr la cascada. La primera de
          * ellas espera a que el panel termine de entrar; las de un cambio de
          * pestaña ya no tienen nada que esperar.
          */}
        <div
          key={activeTab}
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4 pt-1",
            hasSwitchedTab ? "cascade-enter" : "cascade-enter-drawer"
          )}
        >
          {activeTab === "permisos" && (
            <>
              <DrawerSection
                icon={ShieldCheck}
                tone="brand"
                title="Permisos de líderes"
                hint="Qué puede hacer un líder con sus propios objetivos y con los de su equipo."
              >
                <div className="flex flex-col gap-3">
                  <PermissionGroup title="Objetivos propios" permissions={PERMISOS_LIDER_PROPIOS} />
                  <PermissionGroup title="Objetivos del equipo" permissions={PERMISOS_LIDER_EQUIPO} />
                </div>
              </DrawerSection>

              <DrawerSection
                icon={Users}
                tone="neutral"
                title="Permisos de colaboradores"
                hint="Qué puede hacer un colaborador con los objetivos que le pertenecen."
              >
                <PermissionGroup title="Objetivos propios" permissions={PERMISOS_COLABORADOR} />
              </DrawerSection>
            </>
          )}

          {activeTab === "estados" && (
            <>
              <DrawerSection
                icon={SlidersHorizontal}
                tone="warning"
                title="Resultados negativos"
                hint="Habilítalo si un objetivo puede quedar por debajo de 0% y restar en el ciclo."
              >
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5">
                  <span className="text-[13px] font-medium leading-snug text-text-primary">
                    Permitir porcentajes menores a 0%
                  </span>
                  <Switch
                    checked={allowNegativeResults}
                    onCheckedChange={setAllowNegativeResults}
                    className="shrink-0"
                  />
                </div>
              </DrawerSection>

              <DrawerSection
                icon={Layers}
                tone="brand"
                title="Distribución de estados"
                hint="Cuánto abarca cada estado sobre el total del rango configurado."
                badge={`${estados.length} estados`}
              >
                <DistributionBar segments={estados} />
              </DrawerSection>

              <DrawerSection
                icon={Target}
                tone="brand"
                title="Estados del colaborador"
                hint="El nombre, el rango de cumplimiento y el color con los que se marca a un colaborador según el avance que lleva."
              >
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background p-2">
                    {estados.map((est, index) => (
                      <RangeRow
                        key={est.id}
                        index={index + 1}
                        nameLabel="Nombre del estado"
                        namePlaceholder="Nombre del estado..."
                        name={est.nombre}
                        onNameChange={(nombre) => handleUpdateEstado(est.id, { nombre })}
                        min={est.minPorcentaje}
                        max={est.maxPorcentaje}
                        onMinChange={(minPorcentaje) =>
                          handleUpdateEstado(est.id, { minPorcentaje })
                        }
                        onMaxChange={(maxPorcentaje) =>
                          handleUpdateEstado(est.id, { maxPorcentaje })
                        }
                        colorHex={est.colorHex}
                        colors={COLOR_VARIANTS}
                        onColorChange={(hex) => {
                          const color = COLOR_VARIANTS.find((item) => item.hex === hex);
                          if (!color) return;
                          handleUpdateEstado(est.id, {
                            variant: color.variant,
                            colorHex: color.hex,
                          });
                        }}
                        allowNegative={allowNegativeResults}
                        onDelete={() => handleDeleteEstado(est.id)}
                        deleteDisabledReason={
                          estados.length <= MIN_ESTADOS
                            ? `Debe haber mínimo ${MIN_ESTADOS} estados`
                            : null
                        }
                      />
                    ))}
                  </div>

                  <AddRangeButton
                    icon={Plus}
                    label="Agregar estado"
                    onClick={handleAddEstado}
                    disabledReason={
                      estados.length >= MAX_ESTADOS ? `Máximo ${MAX_ESTADOS} estados` : null
                    }
                  />
                </div>
              </DrawerSection>
            </>
          )}

          {activeTab === "niveles" && (
            <>
              <DrawerSection
                icon={Layers}
                tone="brand"
                title="Distribución de niveles"
                hint="Cuánto abarca cada nivel sobre el total del rango configurado."
                badge={`${niveles.length} niveles`}
              >
                <DistributionBar segments={niveles} />
              </DrawerSection>

              <DrawerSection
                icon={Award}
                tone="positive"
                title="Niveles de desempeño"
                hint="Con qué calificación cierra un colaborador según el cumplimiento que alcance."
              >
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background p-2">
                    {niveles.map((nivel, index) => (
                      <RangeRow
                        key={nivel.id}
                        index={index + 1}
                        nameLabel="Nombre del nivel"
                        namePlaceholder="Nombre del nivel..."
                        name={nivel.nombre}
                        onNameChange={(nombre) => handleUpdateNivel(nivel.id, { nombre })}
                        min={nivel.minPorcentaje}
                        max={nivel.maxPorcentaje}
                        onMinChange={(minPorcentaje) =>
                          handleUpdateNivel(nivel.id, { minPorcentaje })
                        }
                        onMaxChange={(maxPorcentaje) =>
                          handleUpdateNivel(nivel.id, { maxPorcentaje })
                        }
                        colorHex={nivel.colorHex}
                        colors={COLOR_VARIANTS}
                        onColorChange={(hex) => handleUpdateNivel(nivel.id, { colorHex: hex })}
                        allowNegative={allowNegativeResults}
                        onDelete={() => handleDeleteNivel(nivel.id)}
                        deleteDisabledReason={
                          niveles.length <= MIN_NIVELES
                            ? `Debe haber mínimo ${MIN_NIVELES} nivel`
                            : null
                        }
                      />
                    ))}
                  </div>

                  <AddRangeButton
                    icon={Plus}
                    label="Agregar nivel"
                    onClick={handleAddNivel}
                    disabledReason={
                      niveles.length >= MAX_NIVELES ? `Máximo ${MAX_NIVELES} niveles` : null
                    }
                  />
                </div>
              </DrawerSection>
            </>
          )}
        </div>
      </div>
    </DrawerShell>
  );
}
