import * as React from "react";
import { Check, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { DrawerSection } from "@/components/overlays/DrawerSection";
import {
  CADENCE_LABELS,
  CHILDREN_KIND_LABELS,
  CLOSING_HELP,
  CLOSING_LABELS,
  REQUIREMENT_LABELS,
  type ObjectiveChildrenKind,
  type ObjectiveClosing,
  type ObjectiveModelRules,
  type ObjectiveModelVocab,
  type RuleRequirement,
  type UpdateCadence,
} from "./objectiveModel";

interface ObjectiveModelRulesEditorProps {
  rules: ObjectiveModelRules;
  vocab: ObjectiveModelVocab;
  onChange: (rules: ObjectiveModelRules) => void;
  /** Las reglas que definen al modelo abierto, para marcarlas. Vacío en el
   *  modelo personalizado, que no tiene ninguna que romper. */
  coreRules?: ReadonlySet<keyof ObjectiveModelRules>;
  /** El nombre que va en la marca: "Define OKR". */
  modelLabel?: string;
  /**
   * `section` envuelve las reglas en su `DrawerSection` —el drawer del modelo—;
   * `bare` entrega solo el marco con las filas, para embutirlas en una
   * tarjeta que ya tiene cabecera propia (la parametrización del ciclo) sin
   * meter una tarjeta dentro de otra.
   */
  variant?: "section" | "bare";
}

interface ChoiceOption<T extends string> {
  value: T;
  label: string;
}

const CHILDREN_OPTIONS: ChoiceOption<ObjectiveChildrenKind>[] = (
  ["none", "actions", "results"] as const
).map((value) => ({ value, label: CHILDREN_KIND_LABELS[value] }));

const REQUIREMENT_OPTIONS: ChoiceOption<RuleRequirement>[] = (
  ["off", "optional", "required"] as const
).map((value) => ({ value, label: REQUIREMENT_LABELS[value] }));

const ALIGNMENT_OPTIONS: ChoiceOption<"optional" | "required">[] = (
  ["optional", "required"] as const
).map((value) => ({ value, label: REQUIREMENT_LABELS[value] }));

const CLOSING_OPTIONS: ChoiceOption<ObjectiveClosing>[] = (
  ["cumulative", "threshold", "binary"] as const
).map((value) => ({ value, label: CLOSING_LABELS[value] }));

const CADENCE_OPTIONS: ChoiceOption<UpdateCadence>[] = (
  ["free", "weekly", "monthly"] as const
).map((value) => ({ value, label: CADENCE_LABELS[value] }));

/** Qué significa cada valor de "qué cuelga", en una línea. */
const CHILDREN_HELP: Readonly<Record<ObjectiveChildrenKind, string>> = {
  none: "El objetivo es una sola métrica y se defiende solo.",
  actions: "Un plan de acciones o hitos bajo el objetivo, para saber cómo se va a lograr.",
  results: "De 2 a 5 resultados medibles, cada uno con su métrica: el objetivo se mide por ellos.",
};

/**
 * Los ajustes del modelo, en una sola tarjeta.
 *
 * Fueron tres acordeones y luego dos, hasta que quedaron seis reglas: a esa
 * altura plegarlas escondía menos de lo que costaba abrirlas. Ahora es una
 * `DrawerSection` con una fila por regla, la misma anatomía que el centro de
 * descargas usa para configurar un reporte — cada fila es su propia
 * tarjetita con título, lo que cambia, y su control debajo.
 *
 * Aquí solo vive lo que el modelo sí decide: la forma de un objetivo y de
 * dónde cuelga. Entre quiénes se reparte —grupos, personas, las dos cosas a
 * la vez— no está y no debe estar: eso se decide al repartir los objetivos,
 * puede ser mezclado, y fijarlo desde el modelo sería cerrar una puerta que
 * el propio constructor abre dos pasos más adelante.
 *
 * Las opciones son chips y no un control segmentado a propósito: un
 * segmentado es la forma que este producto usa para *cambiar de vista*
 * —las pestañas de resultados, los niveles del mapa—, y reutilizarla aquí
 * hacía leer "elegir un valor" como "cambiar de pantalla".
 */
export function ObjectiveModelRulesEditor({
  rules,
  vocab,
  onChange,
  coreRules,
  modelLabel,
  variant = "section",
}: ObjectiveModelRulesEditorProps) {
  const patch = (next: Partial<ObjectiveModelRules>) => onChange({ ...rules, ...next });

  /** La marca de "esta es de las que definen al modelo", o nada. */
  const coreBadge = (key: keyof ObjectiveModelRules) =>
    coreRules?.has(key) && modelLabel ? `Define ${modelLabel}` : undefined;

  // "Los hitos son obligatorios" frente a "las tareas son obligatorias": el
  // vocabulario de cada modelo trae su género, porque una etiqueta armada a
  // trozos que no concuerda se lee como un error de la interfaz.
  const isMasculine = vocab.childrenGender === "m";
  const children = vocab.children?.toLowerCase() ?? "lo que cuelga";
  const theChildren = `${isMasculine ? "Los" : "Las"} ${children}`;
  const requiredWord = isMasculine ? "obligatorios" : "obligatorias";

  const setChildren = (nextChildren: ObjectiveChildrenKind) =>
    patch({
      children: nextChildren,
      // Los resultados clave siempre miden el objetivo y siempre hacen falta;
      // sin hijos no hay nada que exigir ni que mueva el avance.
      childrenRequired:
        nextChildren === "results" ? true : nextChildren === "none" ? false : rules.childrenRequired,
      childrenDriveProgress:
        nextChildren === "results"
          ? true
          : nextChildren === "none"
            ? false
            : rules.childrenDriveProgress,
    });

  const setCompany = (companyObjectives: RuleRequirement) =>
    patch({
      companyObjectives,
      alignment: companyObjectives === "off" ? "optional" : rules.alignment,
    });

  const rows = (
      <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background p-2">
        <RuleRow
          label="Qué cuelga de cada objetivo"
          help={CHILDREN_HELP[rules.children]}
          badge={coreBadge("children")}
        >
          <RuleChips
            ariaLabel="Qué cuelga de cada objetivo"
            options={CHILDREN_OPTIONS}
            value={rules.children}
            onChange={setChildren}
          />
        </RuleRow>

        {rules.children === "actions" && (
          <>
            <RuleRow
              label={`${theChildren} son ${requiredWord}`}
              badge={coreBadge("childrenRequired")}
              help={
                rules.childrenRequired
                  ? `No se puede guardar un objetivo sin ${isMasculine ? "al menos uno" : "al menos una"}.`
                  : `Se pueden dejar en blanco: quien escriba decide si ${isMasculine ? "los" : "las"} necesita.`
              }
              inline={
                <Switch
                  checked={rules.childrenRequired}
                  onCheckedChange={(childrenRequired) => patch({ childrenRequired })}
                  aria-label={`${theChildren} son ${requiredWord}`}
                />
              }
            />
            <RuleRow
              label={`${theChildren} mueven el avance`}
              badge={coreBadge("childrenDriveProgress")}
              help={
                rules.childrenDriveProgress
                  ? `El porcentaje del objetivo sale de cuánt${isMasculine ? "os" : "as"} se completaron.`
                  : "Son el plan, no el marcador: el avance sigue saliendo de la métrica."
              }
              inline={
                <Switch
                  checked={rules.childrenDriveProgress}
                  onCheckedChange={(childrenDriveProgress) => patch({ childrenDriveProgress })}
                  aria-label={`${theChildren} mueven el avance`}
                />
              }
            />
          </>
        )}

        <RuleRow
          label="Cómo se cierra"
          help={CLOSING_HELP[rules.closing]}
          badge={coreBadge("closing")}
        >
          <RuleChips
            ariaLabel="Cómo se cierra un objetivo"
            options={CLOSING_OPTIONS}
            value={rules.closing}
            onChange={(closing) => patch({ closing })}
          />
        </RuleRow>

        <RuleRow
          label="Fecha límite por objetivo"
          badge={coreBadge("dueDatePerObjective")}
          help="Cada objetivo lleva su propio vencimiento dentro del ciclo, además del cierre del ciclo."
          inline={
            <Switch
              checked={rules.dueDatePerObjective}
              onCheckedChange={(dueDatePerObjective) => patch({ dueDatePerObjective })}
              aria-label="Fecha límite por objetivo"
            />
          }
        />

        <RuleRow
          label="Cada cuánto se actualiza"
          badge={coreBadge("cadence")}
          help={
            rules.cadence === "free"
              ? "Sin ritmo sugerido: se actualiza cuando haya algo que contar."
              : `Le recordamos a cada persona reportar su avance con frecuencia ${CADENCE_LABELS[rules.cadence].toLowerCase()}.`
          }
        >
          <RuleChips
            ariaLabel="Frecuencia de actualización"
            options={CADENCE_OPTIONS}
            value={rules.cadence}
            onChange={(cadence) => patch({ cadence })}
          />
        </RuleRow>

        <RuleRow
          label="Objetivos de la empresa"
          badge={coreBadge("companyObjectives")}
          help={
            rules.companyObjectives === "off"
              ? "El ciclo no define un norte: se sostiene solo con lo que se asigna."
              : rules.companyObjectives === "required"
                ? "El ciclo no se puede cerrar sin al menos un objetivo de empresa."
                : "Puedes definir el norte del ciclo, o dejarlo vacío."
          }
        >
          <RuleChips
            ariaLabel="Objetivos de la empresa"
            options={REQUIREMENT_OPTIONS}
            value={rules.companyObjectives}
            onChange={setCompany}
          />
        </RuleRow>

        {rules.companyObjectives !== "off" && (
          <RuleRow
            label="Alinearse al norte"
            badge={coreBadge("alignment")}
            help={
              rules.alignment === "required"
                ? "Todo objetivo asignado tiene que colgar de uno de la empresa."
                : "Un objetivo puede vivir suelto, sin colgar de ningún objetivo de empresa."
            }
          >
            <RuleChips
              ariaLabel="Alineación a objetivos de la empresa"
              options={ALIGNMENT_OPTIONS}
              value={rules.alignment}
              onChange={(alignment) => patch({ alignment })}
            />
          </RuleRow>
        )}
      </div>
  );

  if (variant === "bare") return rows;

  return (
    <DrawerSection
      icon={SlidersHorizontal}
      tone="brand"
      title="Configuración del modelo"
      hint={
        modelLabel
          ? `Cámbialo a tu manera. Las reglas marcadas son las que definen a ${modelLabel}: cambiarlas vuelve el ciclo personalizado, el resto solo lo afina.`
          : "Cámbialo a tu manera."
      }
    >
      {rows}
    </DrawerSection>
  );
}

/**
 * Una regla: cómo se llama, qué cambia, y con qué se decide.
 *
 * Misma tarjetita que las filas de configuración del centro de descargas. Un
 * interruptor cabe al lado del título (`inline`); una lista de opciones baja
 * a su propia línea (`children`), así la explicación siempre tiene el
 * renglón entero para ella.
 */
function RuleRow({
  label,
  help,
  badge,
  inline,
  children,
}: {
  label: string;
  help: string;
  /** "Define OKR" en las reglas que no se pueden tocar sin romper el modelo. */
  badge?: string;
  inline?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border/60 bg-surface px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[13px] font-semibold leading-tight text-text-primary">
              {label}
            </span>
            {badge && (
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10.5px] font-semibold text-text-secondary">
                {badge}
              </span>
            )}
          </span>
          <span className="text-[12px] leading-snug text-muted-foreground">{help}</span>
        </div>
        {inline && <span className="mt-0.5 flex shrink-0 items-center">{inline}</span>}
      </div>
      {children}
    </div>
  );
}

/**
 * Las opciones de una regla, como chips sueltos.
 *
 * Píldora neutra en reposo que se levanta al pasar por encima, y llena en
 * azul de marca con su palomita cuando está elegida. Nada de contenedor
 * compartido ni de fondo deslizante — eso es un control segmentado, y en
 * este producto un segmentado significa "cambiar de vista".
 */
function RuleChips<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.97]",
              isSelected
                ? "border-primary bg-primary/10 text-primary shadow-sm"
                : "border-border bg-surface text-text-secondary hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card"
            )}
          >
            {isSelected && <Check className="size-3.5 shrink-0" strokeWidth={2.8} />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
