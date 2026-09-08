import { Download, LogOut, Minimize2, RefreshCw, Sparkles, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SheetFooter } from "@/components/ui/sheet";
import {
  AnimatedActionItem,
  DrawerActionRail,
  DrawerRailButton,
  RailSelectionChip,
  useContextChangeKey,
} from "@/components/action-rail";
import type { BulkUploadModeConfig } from "@/lib/objectivesImport";
import type { ReviewSelectionInfo } from "./reviewTabs";

/**
 * El pie del drawer de carga masiva, paso por paso.
 *
 * Las dos preguntas que destruyen o comprometen trabajo —descartar la revisión
 * y cargar con pendientes— se contestan aquí mismo, en la fila desde la que se
 * hicieron: la respuesta destructiva es la que hay que apuntar, y el cuerpo de
 * atrás queda inerte para que nada se mueva debajo de la respuesta.
 */

export type FooterStep = "dropzone" | "summary" | "error" | "empty" | "detail";

export interface CargaObjetivosFooterProps {
  step: FooterStep;
  /** Pestaña del asistente en el paso inicial. */
  tab: "nueva" | "cargas";
  modeConfig: BulkUploadModeConfig;
  filesCount: number;
  /** Sin ciclo fijo, todavía no se eligió uno (o no se nombró el nuevo). */
  cicloMissing: boolean;
  /** Todavía no se eligió qué operación va a hacer el archivo. */
  modeMissing: boolean;
  activeUploads: number;
  /** Filas que la carga abierta en detalle dejó sin entrar. */
  pendingInDetail: number;
  isAnalyzing: boolean;
  /** La revisión tiene una pregunta de borrado abierta. */
  isConfirmingDelete: boolean;
  isConfirmingCancel: boolean;
  isConfirmingPartialLoad: boolean;
  hasReviewInFlight: boolean;
  reviewedRows: number;
  readyObjectives: number;
  remainingUsers: number;
  /** Lo que hay marcado con checkbox en la revisión, si algo. */
  selection: ReviewSelectionInfo | null;
  onClose: () => void;
  onResumeDetail: () => void;
  onRequestCancel: () => void;
  onKeepReviewing: () => void;
  onDiscard: () => void;
  onAnalyze: () => void;
  onMinimize: () => void;
  onRequestLoad: () => void;
  onCancelPartialLoad: () => void;
  onConfirmLoad: () => void;
  onAcknowledgeError: () => void;
  onDownloadAnalysis: () => void;
}

/**
 * El pie es una barra de acciones, no una fila de controles sueltos: todos sus
 * botones comparten la altura grande (h-9) del sistema, que es la que aguanta
 * un panel de 1.240px de ancho, y el pie mismo se separa del cuerpo con la
 * misma sombra invertida que el resto de las barras fijas del proyecto.
 */
const FOOTER_CLASS = "flex-row items-center gap-2 border-t border-border/60 bg-surface px-4 py-3";

export function CargaObjetivosFooter({
  step,
  tab,
  modeConfig,
  filesCount,
  cicloMissing,
  modeMissing,
  activeUploads,
  pendingInDetail,
  isAnalyzing,
  isConfirmingDelete,
  isConfirmingCancel,
  isConfirmingPartialLoad,
  hasReviewInFlight,
  reviewedRows,
  readyObjectives,
  remainingUsers,
  selection,
  onClose,
  onResumeDetail,
  onRequestCancel,
  onKeepReviewing,
  onDiscard,
  onAnalyze,
  onMinimize,
  onRequestLoad,
  onCancelPartialLoad,
  onConfirmLoad,
  onAcknowledgeError,
  onDownloadAnalysis,
}: CargaObjetivosFooterProps) {
  // La misma entrada escalonada que usan las acciones contextuales del home
  // al seleccionar una fila: no es solo que la barra aparezca, es que sus
  // botones lo hacen uno detrás de otro. El contexto es fijo porque estas
  // tres acciones no cambian de identidad dentro del paso —lo que dispara la
  // animación es que `DrawerActionRail` se vuelve a montar cada vez que se
  // entra a este paso, no un cambio de contexto en el sentido del hook.
  const railAnimKey = useContextChangeKey("carga-summary-actions");

  if (step === "dropzone" && tab === "cargas") {
    // Mientras algo sigue escribiendo, lo único que dice el pie es que la
    // plataforma no tiene que esperar por ello.
    return (
      <SheetFooter className={FOOTER_CLASS}>
        <Button type="button" variant="outline" size="lg" className="w-full gap-2" onClick={onClose}>
          <Minimize2 className="size-4" />
          {activeUploads > 0 ? "Minimizar y continuar" : "Cerrar"}
        </Button>
      </SheetFooter>
    );
  }

  if (step === "detail") {
    if (pendingInDetail === 0) return null;
    return (
      <SheetFooter className={FOOTER_CLASS}>
        <div className="flex-1" />
        <Button type="button" size="lg" className="gap-2" onClick={onResumeDetail}>
          <RefreshCw className="size-4" />
          Retomar carga ({pendingInDetail})
        </Button>
      </SheetFooter>
    );
  }

  // La revisión, en su estado normal, deja el pie fijo del sistema por la
  // misma barra flotante del constructor: "Cancelar" pasa a ser una de sus
  // tres acciones, no la fila entera. `isBlocked` la recoge y la bloquea
  // mientras la tabla de arriba tiene su propia pregunta abierta —igual que
  // antes hacía el `opacity-50` + `inert` del pie plano—, y `keepOpen` la
  // mantiene visible durante toda la revisión: es una sesión larga de varias
  // pestañas, y que se escondiera sola a media lectura habría sido peor que
  // un pie que nunca se mueve.
  if (step === "summary" && !isConfirmingCancel && !isConfirmingPartialLoad) {
    return (
      <DrawerActionRail
        keepOpen
        isBlocked={isConfirmingDelete}
        tools={
          selection && (
            <>
              <RailSelectionChip count={selection.count} onClear={selection.onClear} gender="m" />
              <DrawerRailButton
                icon={Trash2}
                variant="danger"
                label={`Quitar de la carga (${selection.count})`}
                onClick={selection.onRemove}
              />
            </>
          )
        }
        actions={
          <>
            <AnimatedActionItem animKey={railAnimKey} staggerIndex={0}>
              {/* Mismo botón de "Salir" del rail del constructor: icono
                  `LogOut`, tono de peligro y solo icono con tooltip. Rojo
                  porque, aunque el clic solo abre la pregunta de "¿Descartar
                  esta carga?", lo que hay al final de ese camino es perder la
                  revisión. */}
              <DrawerRailButton
                icon={LogOut}
                variant="danger"
                label="Salir"
                iconOnly
                onClick={hasReviewInFlight ? onRequestCancel : onDiscard}
              />
            </AnimatedActionItem>
            <AnimatedActionItem animKey={railAnimKey} staggerIndex={1}>
              <DrawerRailButton icon={Minimize2} label="Minimizar" iconOnly onClick={onMinimize} />
            </AnimatedActionItem>
            <AnimatedActionItem animKey={railAnimKey} staggerIndex={2}>
              <DrawerRailButton
                icon={Download}
                label="Descargar análisis"
                iconOnly
                onClick={onDownloadAnalysis}
              />
            </AnimatedActionItem>
            <AnimatedActionItem animKey={railAnimKey} staggerIndex={3}>
              <DrawerRailButton
                icon={Upload}
                variant={readyObjectives > 0 ? "primary" : "ghost"}
                disabled={readyObjectives === 0}
                onClick={onRequestLoad}
                // El botón nombra su propio alcance: "Cargar 10 objetivos
                // alineados" dice lo mismo que la pestaña que produce el 10.
                label={
                  readyObjectives > 0
                    ? `${modeConfig.confirmVerb} ${readyObjectives} ${readyObjectives === 1 ? "objetivo alineado" : "objetivos alineados"}`
                    : modeConfig.confirmLabel
                }
              />
            </AnimatedActionItem>
          </>
        }
      />
    );
  }

  const isFrozen = isConfirmingDelete || isAnalyzing;

  return (
    <SheetFooter
      inert={isFrozen || undefined}
      className={cn(FOOTER_CLASS, "transition-opacity", isFrozen && "opacity-50")}
    >
      {isConfirmingCancel ? (
        <>
          <p className="flex-1 text-[12.5px] font-medium leading-relaxed text-text-secondary">
            <span className="font-bold text-status-negative">¿Descartar esta carga?</span> Se pierden las{" "}
            {reviewedRows} {reviewedRows === 1 ? "fila revisada" : "filas revisadas"} y todo lo que resolviste. Si
            solo necesitas la pantalla, minimízala.
          </p>
          <Button type="button" variant="outline" size="lg" onClick={onKeepReviewing}>
            Seguir revisando
          </Button>
          <Button type="button" variant="destructive" size="lg" autoFocus onClick={onDiscard}>
            Descartar
          </Button>
        </>
      ) : step === "summary" && isConfirmingPartialLoad ? (
        <>
          <p className="flex-1 text-[12.5px] font-medium leading-relaxed text-text-secondary">
            <span className="font-bold text-status-warning">
              ¿Cargar con {remainingUsers} {remainingUsers === 1 ? "pendiente" : "pendientes"}?
            </span>{" "}
            Solo se {readyObjectives === 1 ? "cargará" : "cargarán"} {readyObjectives}{" "}
            {readyObjectives === 1 ? "objetivo alineado" : "objetivos alineados"}. Puedes retomar los demás más
            adelante.
          </p>
          <Button type="button" variant="outline" size="lg" onClick={onCancelPartialLoad}>
            Cancelar
          </Button>
          <Button type="button" size="lg" autoFocus className="gap-2" onClick={onConfirmLoad}>
            <Upload className="size-4" />
            Confirmar carga
          </Button>
        </>
      ) : (
        <>
          {/* Un solo botón, a todo el ancho: el primer paso no tiene nada
              hecho que perder, así que no hace falta ofrecer "Cancelar" al
              lado del avanzar — la X del encabezado (y Escape) siguen siendo
              la salida, como en cualquier panel del sistema. */}
          {step === "dropzone" && (
            <Button
              type="button"
              size="lg"
              disabled={filesCount === 0 || cicloMissing || modeMissing}
              title={
                cicloMissing
                  ? "Elige un ciclo (o crea uno nuevo) para poder analizar el archivo"
                  : modeMissing
                    ? "Elige qué quieres hacer para poder analizar el archivo"
                    : undefined
              }
              className="w-full gap-2"
              onClick={onAnalyze}
            >
              <Sparkles className="size-4" />
              Analizar {filesCount > 0 ? `(${filesCount})` : ""}
            </Button>
          )}

          {/* Nombra la salida en vez de solo acusar recibo: el clic limpia el
              archivo y devuelve a la zona de carga, que es lo único que queda
              por hacer con un archivo ilegible o que no es la plantilla. Aquí
              tampoco hay revisión en curso, así que "Cancelar" descarta al
              toque en vez de preguntar. */}
          {(step === "error" || step === "empty") && (
            <>
              <Button type="button" variant="outline" size="lg" className="flex-1" onClick={onDiscard}>
                Cancelar
              </Button>
              <Button type="button" size="lg" className="flex-1" onClick={onAcknowledgeError}>
                Subir otro archivo
              </Button>
            </>
          )}
        </>
      )}
    </SheetFooter>
  );
}
