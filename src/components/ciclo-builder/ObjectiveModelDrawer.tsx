import * as React from "react";
import { Check, Lightbulb, RotateCcw, TriangleAlert } from "lucide-react";
import { toneBorder } from "@/lib/tone";
import { Button } from "@/components/ui/button";
import { SheetFooter } from "@/components/ui/sheet";
import { DrawerSection, DrawerShell } from "@/components/overlays";
import { ObjectiveModelRulesEditor } from "./ObjectiveModelRulesEditor";
import {
  OBJECTIVE_MODEL_CORE,
  OBJECTIVE_MODEL_META,
  brokenObjectiveModelCore,
  isObjectiveModelAdjusted,
  objectiveModelVocab,
  resolveObjectiveModel,
  type ObjectiveModelId,
  type ObjectiveModelRules,
} from "./objectiveModel";

/** "esto", "esto y aquello", "esto, aquello y lo otro". */
function listRules(rules: readonly string[]): string {
  if (rules.length <= 1) return rules[0] ?? "";
  return `${rules.slice(0, -1).join(", ")} y ${rules[rules.length - 1]}`;
}

interface ObjectiveModelDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** El modelo que se acaba de tocar en la grilla. */
  model: ObjectiveModelId;
  /** Las reglas con las que abre: el preset del modelo, o las que ya tenía
   *  el ciclo cuando se abre "Personalizado" o se reabre para revisarlo. */
  rules: ObjectiveModelRules;
  /** Se llama al confirmar. El modelo puede volver distinto del que entró:
   *  tocar una regla de un preset lo convierte en personalizado. */
  onConfirm: (model: ObjectiveModelId, rules: ObjectiveModelRules) => void;
  /** "Usar este modelo" la primera vez, "Guardar cambios" al reabrirlo. */
  isApplied: boolean;
}

/**
 * Lo que trae un modelo, y cómo cambiarlo.
 *
 * Elegir OKR o MBO no es marcar una casilla: decide qué se le va a pedir a
 * cada objetivo del ciclo durante meses. Por eso la elección se confirma
 * aquí y no en la grilla — hay sitio para decir qué se está aceptando, con
 * un ejemplo escrito en ese modelo, y para cambiar cualquier regla antes de
 * aceptarla.
 *
 * Tocar una regla de un preset no lo rompe: el modelo pasa a ser
 * "Personalizado" y el pie lo dice. Si los ajustes vuelven a coincidir con
 * un preset, vuelve a ser ese preset — un ciclo no debería llamarse
 * "personalizado" por unas reglas que son exactamente las de OKR.
 */
export function ObjectiveModelDrawer({
  open,
  onOpenChange,
  model,
  rules,
  onConfirm,
  isApplied,
}: ObjectiveModelDrawerProps) {
  // El borrador vive lo que dure esta apertura y se tira al cerrarla:
  // cancelar tiene que dejar el ciclo exactamente como estaba. Quien lo abre
  // le da una `key` por apertura, así que basta con inicializarlo aquí —
  // mientras está abierto manda el borrador, no el ciclo.
  const [draftRules, setDraftRules] = React.useState(rules);

  // Tres estados, no dos: el preset intacto, el preset afinado —que sigue
  // llamándose igual—, y el que rompió su núcleo y pasa a personalizado.
  const isAdjusted = isObjectiveModelAdjusted(model, draftRules);
  const resolvedModel = resolveObjectiveModel(model, draftRules);
  const breaksCore = model !== "custom" && resolvedModel === "custom";
  const brokenRules = breaksCore ? brokenObjectiveModelCore(model, draftRules) : [];
  // Personalizado que acabó reproduciendo un preset entero: se gana su nombre.
  const earnedName = model === "custom" && resolvedModel !== "custom";

  // Se marcan en el editor para que el autor sepa cuáles pesan antes de
  // tocarlas, no después. El personalizado no tiene núcleo que romper.
  const coreRules = React.useMemo(
    () =>
      model === "custom"
        ? new Set<keyof ObjectiveModelRules>()
        : new Set<keyof ObjectiveModelRules>(OBJECTIVE_MODEL_CORE[model]),
    [model]
  );

  const openedMeta = OBJECTIVE_MODEL_META[model];
  const resolvedMeta = OBJECTIVE_MODEL_META[resolvedModel];
  const vocab = objectiveModelVocab(resolvedModel, draftRules);
  const borderStyle = openedMeta.tone ? toneBorder(openedMeta.tone, 100) : undefined;

  const handleConfirm = () => {
    onConfirm(resolvedModel, draftRules);
    onOpenChange(false);
  };

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title={model === "custom" ? "Tu modelo de objetivos" : `Modelo ${openedMeta.label}`}
      description={
        model === "custom"
          ? "Ajusta cada regla a tu manera. Así queda el ciclo."
          : `${openedMeta.fullName}. Así queda el ciclo si lo usas.`
      }
      size="2xl"
      disablePadding
      footer={
        <SheetFooter className="flex-col gap-2.5 border-t border-border/60 bg-surface px-4 py-3">
          {/* Solo se avisa cuando hay algo que advertir. Afinar una regla que
              no define al modelo no merece una alarma; romper su núcleo sí. */}
          {breaksCore && (
            <p className="flex w-full items-start gap-2 text-[12px] leading-relaxed text-text-secondary">
              <TriangleAlert
                className="mt-px size-3.5 shrink-0 text-status-warning"
                strokeWidth={2}
              />
              <span>
                Cambiaste {listRules(brokenRules)}, que es lo que define a {openedMeta.label}. El
                ciclo va a usar un{" "}
                <span className="font-semibold text-text-primary">modelo personalizado</span>.
              </span>
            </p>
          )}
          {isAdjusted && !breaksCore && (
            <p className="flex w-full items-start gap-2 text-[12px] leading-relaxed text-text-secondary">
              <Check className="mt-px size-3.5 shrink-0 text-status-positive" strokeWidth={2.4} />
              <span>
                Sigue siendo <span className="font-semibold text-text-primary">
                  {openedMeta.label}
                </span>
                , con tus ajustes.
              </span>
            </p>
          )}
          {earnedName && (
            <p className="flex w-full items-start gap-2 text-[12px] leading-relaxed text-text-secondary">
              <RotateCcw className="mt-px size-3.5 shrink-0" strokeWidth={2} />
              <span>
                Estas reglas son exactamente las de{" "}
                <span className="font-semibold text-text-primary">{resolvedMeta.label}</span>, así
                que lo guardamos con ese nombre.
              </span>
            </p>
          )}
          <Button size="lg" className="w-full gap-2" onClick={handleConfirm}>
            <Check className="h-4 w-4" />
            {isApplied && !isAdjusted ? "Listo" : "Usar este modelo"}
          </Button>
        </SheetFooter>
      }
    >
      {/* Mismo chasis que el centro de descargas: fondo hundido y una
          tarjeta por bloque, en vez de contenido suelto sobre la superficie. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 bg-background p-4">
        <DrawerSection
          icon={openedMeta.icon}
          tone={openedMeta.tone ?? "brand"}
          title={`Cómo funciona ${openedMeta.label}`}
          hint={openedMeta.fullName}
        >
          <div className="flex flex-col gap-2.5">
            <p className="text-[13px] leading-relaxed text-text-primary">
              {openedMeta.structure}
            </p>

            {/* El ejemplo como cita, con el filete del modelo a la izquierda:
                se lee como "esto es lo que sale", no como otro campo más. */}
            <figure className="rounded-lg border border-border/60 bg-background px-3 py-2.5">
              <figcaption className="flex items-center gap-1.5 text-[12px] font-semibold text-text-secondary">
                <Lightbulb className="size-3.5" strokeWidth={2.2} />
                Un objetivo escrito así
              </figcaption>
              <p
                className="mt-1.5 border-l-2 pl-3 text-[13px] italic leading-relaxed text-text-primary"
                style={borderStyle}
              >
                {openedMeta.example}
              </p>
            </figure>

            <p className="text-[12px] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-text-primary">Mejor para</span>{" "}
              {openedMeta.help.replace(/^Para /, "").replace(/^El modelo de siempre: /, "")}
            </p>
          </div>
        </DrawerSection>

        <ObjectiveModelRulesEditor
          rules={draftRules}
          vocab={vocab}
          onChange={setDraftRules}
          coreRules={coreRules}
          modelLabel={model === "custom" ? undefined : openedMeta.label}
        />
      </div>
    </DrawerShell>
  );
}
