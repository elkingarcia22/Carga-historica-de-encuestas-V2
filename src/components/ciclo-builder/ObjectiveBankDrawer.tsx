import { DrawerShell } from "@/components/overlays";
import { Button } from "@/components/ui/button";
import { SheetFooter } from "@/components/ui/sheet";
import type { Objective } from "./cicloBuilderTypes";
import { ObjectiveBankPanel, useObjectiveBank } from "./ObjectiveBankPanel";
import type { ObjectiveScope } from "./objectiveBankTypes";

/**
 * El banco de objetivos como cajón propio.
 *
 * Es la puerta que se usa cuando el banco *es* el paso —los objetivos de la
 * empresa en el constructor—: nada más abierto, la única pregunta pendiente es
 * cuáles se llevan. El cuerpo entero vive en `ObjectiveBankPanel`, que es el
 * mismo que se dibuja en línea dentro de flujos que ya tienen su propio cajón,
 * para no apilar uno sobre otro.
 */
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
  const bank = useObjectiveBank(scope, open);

  const handleAdd = () => {
    const objectives = bank.buildObjectives(availableWeight);
    if (objectives.length === 0) return;
    onAddObjectives(objectives);
    onOpenChange(false);
  };

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
              {bank.selectedCount === 0
                ? "Marca al menos un objetivo para continuar"
                : `${bank.selectedCount} ${
                    bank.selectedCount === 1 ? "objetivo seleccionado" : "objetivos seleccionados"
                  }`}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAdd} disabled={bank.selectedCount === 0}>
                Agregar ({bank.selectedCount})
              </Button>
            </div>
          </div>
        </SheetFooter>
      }
    >
      <ObjectiveBankPanel bank={bank} className="min-h-full bg-background p-4" />
    </DrawerShell>
  );
}
