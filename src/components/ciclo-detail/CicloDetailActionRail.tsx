import * as React from "react";
import { BellRing, Download, SlidersHorizontal, Upload, UserPlus } from "lucide-react";
import {
  ActionRailShell,
  AnimatedActionItem,
  RailButton,
  RailDivider,
  RailPrimaryAction,
  RailSelectionChip,
  useContextChangeKey,
} from "@/components/action-rail";
import { ObjetivosConfigDrawer } from "@/components/objetivos/ObjetivosConfigDrawer";

/**
 * La barra flotante de la vista de seguimiento. Persistentes: configurar el
 * módulo (los estados y niveles que esta misma pantalla pinta), cargar
 * objetivos desde un archivo, sumar gente y exportar. Contextuales, cuando hay
 * colaboradores marcados: recordarles y exportar solo a ellos.
 */
export function CicloDetailActionRail({
  selectedCount,
  onClearSelection,
  onAddUsers,
  onExport,
  onRemind,
  onUploadObjectives,
  isUploadOpen = false,
}: {
  selectedCount: number;
  onClearSelection: () => void;
  onAddUsers: () => void;
  onExport: (onlySelected: boolean) => void;
  onRemind: () => void;
  /** Abre la carga masiva de objetivos desde archivo. */
  onUploadObjectives: () => void;
  /** El drawer de carga está abierto: la barra no se pliega debajo. */
  isUploadOpen?: boolean;
}) {
  const [isConfigOpen, setIsConfigOpen] = React.useState(false);
  const mode = selectedCount === 0 ? "none" : "selected";
  const animKey = useContextChangeKey(mode);

  const contextual =
    selectedCount === 0 ? null : (
      <>
        <AnimatedActionItem animKey={animKey} staggerIndex={0} skipColorFlash>
          <RailSelectionChip count={selectedCount} onClear={onClearSelection} gender="m" />
        </AnimatedActionItem>
        <AnimatedActionItem animKey={animKey} staggerIndex={1} skipColorFlash>
          <RailDivider />
        </AnimatedActionItem>
        <AnimatedActionItem animKey={animKey} staggerIndex={2}>
          <RailButton
            icon={<BellRing className="h-[20px] w-[20px]" strokeWidth={2} />}
            label={`Enviar recordatorio de avance (${selectedCount})`}
            onClick={onRemind}
          />
        </AnimatedActionItem>
        <AnimatedActionItem animKey={animKey} staggerIndex={3}>
          <RailButton
            icon={<Download className="h-[20px] w-[20px]" strokeWidth={2} />}
            label={`Exportar seleccionados (${selectedCount})`}
            onClick={() => onExport(true)}
          />
        </AnimatedActionItem>
      </>
    );

  return (
    <>
      <ActionRailShell
        keepOpen={selectedCount > 0 || isConfigOpen || isUploadOpen}
        contextual={contextual}
        persistent={
          selectedCount === 0 ? (
            <>
              <RailButton
                icon={<SlidersHorizontal className="h-[20px] w-[20px]" strokeWidth={2} />}
                label="Configuración de estados y niveles"
                onClick={() => setIsConfigOpen(true)}
              />
              <RailButton
                icon={<Upload className="h-[20px] w-[20px]" strokeWidth={2} />}
                label="Cargar objetivos"
                onClick={onUploadObjectives}
              />
              <RailButton
                icon={<Download className="h-[20px] w-[20px]" strokeWidth={2} />}
                label="Exportar avance del ciclo"
                onClick={() => onExport(false)}
              />
              <RailPrimaryAction
                icon={<UserPlus className="h-4 w-4" strokeWidth={2.5} />}
                label="Agregar usuarios"
                onClick={onAddUsers}
              />
            </>
          ) : null
        }
      />
      <ObjetivosConfigDrawer open={isConfigOpen} onOpenChange={setIsConfigOpen} initialTab="estados" />
    </>
  );
}
