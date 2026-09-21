import { useMemo } from "react";
import {
  Award,
  Layers,
  Lock,
  Plus,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import { DrawerSection, DrawerShell } from "@/components/overlays";
import { SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toneChip, toneSelected, toneText } from "@/lib/tone";
import { cn } from "@/lib/utils";
import {
  AddRangeHeaderButton,
  DistributionBar,
  LockedStateRow,
  PermissionGroup,
  RangeRow,
  type ConfigTab,
} from "./objetivosConfigParts";
import { aplicaEnDe } from "./objetivosConfigStore";
import { MirroredNivelesNotice, MirrorNivelesToggle } from "./NivelesEspejo";
import {
  COLOR_VARIANTS,
  EDITABLE_COLOR_VARIANTS,
  MAX_ESTADOS,
  MAX_NIVELES,
  MIN_ESTADOS,
  MIN_NIVELES,
  PERMISOS_COLABORADOR,
  PERMISOS_LIDER_EQUIPO,
  PERMISOS_LIDER_PROPIOS,
  useObjetivosConfigDraft,
} from "./useObjetivosConfigDraft";
export interface ObjetivosConfigDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: ConfigTab;
}

/**
 * El drawer de configuración de objetivos: un menú lateral con las tres
 * secciones a la izquierda y el contenido a la derecha.
 *
 * Es ancho a propósito: "Estados de los objetivos" tiene cuatro tarjetas, una
 * de ellas con cinco filas de rango de dos líneas cada una, y en un panel
 * angosto quedaban apiladas y muy altas. El ancho compra dos cosas: las
 * tarjetas livianas se acomodan de a dos por fila, y cada fila de rango cabe
 * en una sola línea —nombre, desde, hasta, color— con lo que la lista mide la
 * mitad.
 *
 * El menú lateral no es solo navegación: cada entrada lleva una línea que
 * dice qué se configura ahí, así que quien abre el drawer por primera vez
 * sabe dónde está cada cosa sin tener que abrirlas una por una.
 */

interface NavItem {
  id: ConfigTab;
  label: string;
  hint: string;
  icon: LucideIcon;
}

const NAV_ITEMS: readonly NavItem[] = [
  {
    id: "permisos",
    label: "Permisos",
    hint: "Qué puede hacer cada rol con los objetivos.",
    icon: ShieldCheck,
  },
  {
    id: "estados",
    label: "Estados configurables de objetivos",
    hint: "El flujo, las bandas de cumplimiento y los resultados negativos.",
    icon: Target,
  },
  {
    id: "niveles",
    label: "Niveles de cumplimiento",
    hint: "Con qué calificación cierra un colaborador.",
    icon: Award,
  },
];

export function ObjetivosConfigDrawerWide({
  open,
  onOpenChange,
  initialTab = "permisos",
}: ObjetivosConfigDrawerProps) {
  const {
    activeTab,
    switchTab,
    hasSwitchedTab,
    estadosEditables,
    estadosFijos,
    estadoNegativo,
    niveles,
    allowNegativeResults,
    setAllowNegativeResults,
    nivelesSiguenEstados,
    setNivelesSiguenEstados,
    handleUpdateEstado,
    handleAddEstado,
    handleDeleteEstado,
    handleUpdateNivel,
    handleAddNivel,
    handleDeleteNivel,
    handleSaveConfig,
  } = useObjetivosConfigDraft({ open, initialTab, onSaved: () => onOpenChange(false) });

  // La banda negativa solo cuenta como estado configurado mientras el
  // permiso de "Resultados negativos" la mantiene con vida.
  const estadosParaDistribucion = useMemo(
    () =>
      allowNegativeResults && estadoNegativo
        ? [...estadosEditables, estadoNegativo]
        : estadosEditables,
    [estadosEditables, estadoNegativo, allowNegativeResults]
  );

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title="Configuración de objetivos"
      description="Los permisos, estados y niveles que aplican a todos los ciclos del módulo."
      size="6xl"
      // Con piso en 60rem: es lo que necesita una fila de rango en una sola
      // línea al lado del menú. `!bg-background` por lo mismo que la versión
      // angosta: que el hueco entre el header y el cuerpo no se lea como una
      // franja en blanco.
      className="!w-[68vw] !max-w-[78rem] !min-w-[60rem] gap-0 !bg-background"
      disablePadding
      footer={
        <SheetFooter className="flex-row items-center justify-between border-t border-border/60 bg-surface px-4 py-3">
          <p className="text-[12px] text-text-muted">
            Los cambios aplican a todos los ciclos del módulo.
          </p>
          <Button onClick={handleSaveConfig} className="gap-2 font-semibold">
            <Save className="h-4 w-4" />
            Guardar cambios
          </Button>
        </SheetFooter>
      }
    >
      <div className="flex min-h-0 flex-1 bg-background">
        <ConfigSideNav active={activeTab} onChange={switchTab} />

        {/* La llave es la sección, así que cambiar de sección remonta las
            tarjetas y vuelve a correr la cascada — igual que en la versión
            de pestañas. */}
        <div
          key={activeTab}
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4",
            hasSwitchedTab ? "cascade-enter" : "cascade-enter-drawer"
          )}
        >
          {activeTab === "permisos" && (
            <div className="flex flex-col gap-3">
              <DrawerSection
                icon={ShieldCheck}
                tone="brand"
                title="Permisos de líderes"
                hint="Qué puede hacer un líder con sus propios objetivos y con los de su equipo."
              >
                <div className="grid grid-cols-2 gap-3">
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
                {/* A la mitad del ancho, como cualquiera de las dos columnas
                    de "Permisos de líderes": con una sola columna suelta, sus
                    filas quedaban el doble de anchas que las de esa tarjeta y
                    se leían como un tamaño distinto en vez del mismo patrón. */}
                <div className="grid grid-cols-2 gap-3">
                  <PermissionGroup title="Objetivos propios" permissions={PERMISOS_COLABORADOR} />
                </div>
              </DrawerSection>
            </div>
          )}

          {activeTab === "estados" && (
            <>
              <DrawerSection
                icon={Layers}
                tone="brand"
                title="Distribución de estados"
                hint="Cuánto abarca cada banda de cumplimiento sobre el total del rango configurado."
                badge={`${estadosParaDistribucion.length} estados`}
              >
                <DistributionBar segments={estadosParaDistribucion} />
              </DrawerSection>

              <DrawerSection
                icon={Lock}
                tone="brand"
                title="Estados fijos del flujo"
                hint="Los define el flujo por el que pasa un objetivo, así que no se editan ni se eliminan."
                badge={`${estadosFijos.length} estados`}
                collapsible
              >
                <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background p-2">
                  {estadosFijos.map((estado) => (
                    <LockedStateRow
                      key={estado.id}
                      name={estado.nombre}
                      description={estado.descripcion}
                      colorHex={estado.colorHex}
                      range={estado.rango}
                      rangeLabel={estado.rangoLabel}
                      lockReason={
                        estado.id === "en-progreso" && estado.rango
                          ? `Su rango no se edita: llega hasta justo antes de la primera banda que aplica en curso (hoy, ${estado.rango.max + 1} %). Muévela abajo y este rango la sigue.`
                          : undefined
                      }
                    />
                  ))}
                </div>
              </DrawerSection>

              <DrawerSection
                icon={SlidersHorizontal}
                tone="brand"
                title="Resultados negativos"
                hint="Habilítalo si un objetivo puede quedar por debajo de 0% y restar en el ciclo."
                // El interruptor va en la cabecera y no en una caja aparte
                // dentro del cuerpo: la propia tarjeta ya dice qué se está
                // prendiendo, repetirlo abajo era una cabecera dentro de otra.
                action={
                  <Switch
                    checked={allowNegativeResults}
                    onCheckedChange={setAllowNegativeResults}
                  />
                }
              >
                {allowNegativeResults && estadoNegativo && (
                  <RangeRow
                    index={1}
                    nameLabel="Nombre del estado"
                    namePlaceholder="Nombre del estado..."
                    name={estadoNegativo.nombre}
                    onNameChange={(nombre) => handleUpdateEstado(estadoNegativo.id, { nombre })}
                    min={estadoNegativo.minPorcentaje}
                    max={estadoNegativo.maxPorcentaje}
                    onMinChange={(minPorcentaje) =>
                      handleUpdateEstado(estadoNegativo.id, { minPorcentaje })
                    }
                    onMaxChange={(maxPorcentaje) =>
                      handleUpdateEstado(estadoNegativo.id, { maxPorcentaje })
                    }
                    colorHex={estadoNegativo.colorHex}
                    colors={EDITABLE_COLOR_VARIANTS}
                    onColorChange={(hex) => {
                      const color = EDITABLE_COLOR_VARIANTS.find((item) => item.hex === hex);
                      if (!color) return;
                      handleUpdateEstado(estadoNegativo.id, {
                        variant: color.variant,
                        colorHex: color.hex,
                      });
                    }}
                    aplicaEn={aplicaEnDe(estadoNegativo)}
                    onAplicaEnChange={(aplicaEn) =>
                      handleUpdateEstado(estadoNegativo.id, { aplicaEn })
                    }
                    allowNegative={allowNegativeResults}
                    onDelete={() => {}}
                    deleteDisabledReason="Apaga el permiso de arriba para quitarla."
                  />
                )}
              </DrawerSection>

              <DrawerSection
                icon={Target}
                tone="brand"
                title="Estados configurables de objetivos"
                hint="El nombre, el rango, el color y en qué momento del ciclo puede aparecer cada banda."
                badge={`${estadosEditables.length} de ${MAX_ESTADOS}`}
                stickyHeader
                action={
                  <AddRangeHeaderButton
                    icon={Plus}
                    label="Agregar estado"
                    onClick={handleAddEstado}
                    disabledReason={
                      estadosEditables.length >= MAX_ESTADOS
                        ? `Ya están los ${MAX_ESTADOS} estados que se pueden configurar`
                        : null
                    }
                  />
                }
              >
                <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background p-2">
                  {estadosEditables.map((est, index) => (
                    <RangeRow
                      key={est.id}
                      // Apilada y no en línea: con "Aplica" ya son cuatro
                      // controles, y en una sola línea el nombre —lo único que
                      // se lee de un vistazo— se quedaba sin ancho.
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
                      colors={EDITABLE_COLOR_VARIANTS}
                      onColorChange={(hex) => {
                        const color = EDITABLE_COLOR_VARIANTS.find((item) => item.hex === hex);
                        if (!color) return;
                        handleUpdateEstado(est.id, {
                          variant: color.variant,
                          colorHex: color.hex,
                        });
                      }}
                      aplicaEn={aplicaEnDe(est)}
                      onAplicaEnChange={(aplicaEn) => handleUpdateEstado(est.id, { aplicaEn })}
                      allowNegative={allowNegativeResults}
                      onDelete={() => handleDeleteEstado(est.id)}
                      deleteDisabledReason={
                        estadosEditables.length <= MIN_ESTADOS
                          ? `Debe haber mínimo ${MIN_ESTADOS} estados`
                          : null
                      }
                    />
                  ))}
                </div>

                {/* La opción vive al pie de las bandas que copia, no en la
                    sección de niveles: se decide mirando la lista que se va
                    a reutilizar. */}
                <MirrorNivelesToggle
                  checked={nivelesSiguenEstados}
                  onCheckedChange={setNivelesSiguenEstados}
                />
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
                tone="brand"
                title="Niveles de desempeño"
                hint="Con qué calificación cierra un colaborador según el cumplimiento que alcance."
                badge={
                  nivelesSiguenEstados
                    ? "Copiados de los estados"
                    : `${niveles.length} de ${MAX_NIVELES}`
                }
                stickyHeader={!nivelesSiguenEstados}
                action={
                  nivelesSiguenEstados ? undefined : (
                    <AddRangeHeaderButton
                      icon={Plus}
                      label="Agregar nivel"
                      onClick={handleAddNivel}
                      disabledReason={
                        niveles.length >= MAX_NIVELES
                          ? `Ya están los ${MAX_NIVELES} niveles que se pueden configurar`
                          : null
                      }
                    />
                  )
                }
              >
                {nivelesSiguenEstados ? (
                  <MirroredNivelesNotice
                    niveles={niveles}
                    onEditOwnScale={() => setNivelesSiguenEstados(false)}
                  />
                ) : (
                  <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background p-2">
                    {niveles.map((nivel, index) => (
                      <RangeRow
                        key={nivel.id}
                        layout="inline"
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
                )}
              </DrawerSection>
            </>
          )}
        </div>
      </div>
    </DrawerShell>
  );
}

/**
 * El menú lateral. Cada entrada es una tarjeta pequeña con su chip, su nombre
 * y una línea de qué va ahí; la activa toma el tratamiento de "tarjeta
 * elegida" del resto del módulo (borde y lavado en el tono, rótulo en el
 * acento), no un subrayado propio de este menú.
 */
function ConfigSideNav({
  active,
  onChange,
}: {
  active: ConfigTab;
  onChange: (tab: ConfigTab) => void;
}) {
  return (
    <nav
      aria-label="Secciones de la configuración"
      className="flex w-[15.5rem] shrink-0 flex-col gap-1 border-r border-border/60 bg-surface p-3"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            aria-current={isActive ? "page" : undefined}
            style={isActive ? toneSelected("brand") : undefined}
            className={cn(
              "flex w-full items-start gap-2.5 rounded-xl border border-transparent px-2.5 py-2.5 text-left transition-colors",
              !isActive && "hover:bg-surface-muted"
            )}
          >
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ring-border/40",
                !isActive && "bg-surface-muted text-text-secondary"
              )}
              style={isActive ? toneChip("brand") : undefined}
            >
              <item.icon className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="block text-[13px] font-semibold leading-tight text-text-primary"
                style={isActive ? toneText("brand") : undefined}
              >
                {item.label}
              </span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-text-muted">
                {item.hint}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
