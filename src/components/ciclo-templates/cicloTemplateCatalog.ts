import {
  Award,
  Briefcase,
  Building2,
  Cpu,
  Globe2,
  HeartHandshake,
  HeartPulse,
  Lightbulb,
  Megaphone,
  Package,
  Rocket,
  Settings2,
  ShieldCheck,
  TrendingUp,
  Truck,
  UserRound,
  Users,
  UsersRound,
  Wallet,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { Tone } from "@/lib/tone";
import {
  CICLO_PERIOD_LABELS,
  createBlankObjective,
  type CicloPeriod,
  type MeasureType,
  type Objective,
  type ObjectiveDirection,
  type ObjectiveSetKind,
} from "@/components/ciclo-builder";

/**
 * Everything the app needs to *show* and to *open* a ciclo template — icon,
 * color tone, short name, what it holds and the objectives it starts from — in
 * one place, so the home shelf and the full catalog draw the same template the
 * same way.
 *
 * A template is not a ciclo: it carries no dates, no participants and no
 * assignments, only the company objectives an author would otherwise type from
 * scratch. Picking one opens the builder with those already written, which is
 * the whole point — the hard part of a ciclo is wording its objectives, not
 * filling the calendar.
 */

/** The app-wide accent palette — a template's tone is one of the same five
 *  every other surface picks from. */
export type CicloTemplateTone = Tone;

/** One objective as a template writes it: the wording plus the numbers that
 *  make it measurable, with no id yet. */
export interface TemplateObjective {
  title: string;
  description: string;
  measure: MeasureType;
  direction: ObjectiveDirection | null;
  initialValue: string;
  targetValue: string;
  weight: number;
}

/**
 * Un objetivo de grupo o individual de la plantilla.
 *
 * No es el mismo objetivo de empresa puesto a otro nivel: es uno escrito a la
 * escala de un equipo o de una persona, que **contribuye** al de empresa que
 * señala `alignedToTitle` — igual que en el constructor, donde un objetivo
 * grupal o individual puede alinearse a uno de compañía para ver después
 * cuánto aportó cada equipo al resultado grande. `alignedToTitle` es el
 * título exacto de un objetivo de `CicloTemplate.objectives` en esta misma
 * plantilla; se resuelve al id real de ese objetivo en el momento en que la
 * plantilla se usa, porque hasta entonces el objetivo de empresa no existe
 * todavía.
 */
export interface TemplateAlignedObjective extends TemplateObjective {
  alignedToTitle: string;
}

/**
 * Un estante de la galería: una categoría sobre sus plantillas.
 *
 * Existen para que el catálogo se pueda recorrer sin leerlo entero, y para
 * que la ficha de una plantilla pueda ofrecer "otras que te pueden servir"
 * sin ofrecer las seis: dentro de un estante las plantillas compiten de
 * verdad entre sí —quien mira Comercial puede querer Marketing, no Rotación—.
 *
 * `path` es el rastro de carpetas bajo la categoría. Se guarda como dato y no
 * como carpetas anidadas porque la galería dibuja todos los estantes en
 * plano; el rastro es lo que le dice al lector dónde vive el estante.
 */
export type CicloTemplateCategoryId = "negocio" | "operacion" | "personas" | "producto";

export interface CicloTemplateShelf {
  id: CicloTemplateCategoryId;
  category: string;
  /** Una línea sobre lo que el estante guarda, bajo su título. */
  description: string;
  /** El distintivo del estante. No es el icono de ninguna de sus plantillas:
   *  el estante tiene que poder reconocerse aunque quien mire no haya abierto
   *  todavía ninguna de las que contiene. */
  icon: LucideIcon;
  path: readonly string[];
  items: readonly CicloTemplate[];
}

export interface CicloTemplate {
  id: string;
  /** The short label the shelf shows. */
  label: string;
  /** The full name, and what the builder starts the ciclo's own name with. */
  name: string;
  /** One line on what the template is for — the catalog's own subtitle. */
  description: string;
  /** Which family of the catalog it belongs to. */
  category: CicloTemplateCategoryId;
  icon: LucideIcon;
  tone: CicloTemplateTone;
  /** The length this kind of ciclo is usually run over. */
  period: CicloPeriod;
  /**
   * La que el catálogo promueve arriba del todo.
   *
   * Existe una sola: una lista de seis plantillas donde todas pesan igual deja
   * la primera decisión entera en manos de quien mira, y la mayoría de quienes
   * abren esto por primera vez no vienen con una elegida. `pitch` es el
   * argumento que solo se usa ahí —por qué empezar por esta y no por otra—,
   * distinto de la descripción que la plantilla lleva en su propia tarjeta.
   */
  featured?: boolean;
  pitch?: string;
  /** Los objetivos de empresa: el punto de partida de la plantilla. */
  objectives: readonly TemplateObjective[];
  /** Objetivos de equipo que contribuyen a los de empresa — distintos de
   *  ellos, pensados para la escala de un área. */
  groupObjectives: readonly TemplateAlignedObjective[];
  /** La misma idea a escala de una persona. */
  individualObjectives: readonly TemplateAlignedObjective[];
}

export const CICLO_TEMPLATES: readonly CicloTemplate[] = [
  {
    id: "comercial",
    label: "Comercial",
    name: "Objetivos comerciales",
    description: "Ventas, clientes nuevos y retención de cuentas para el equipo comercial.",
    category: "negocio",
    icon: TrendingUp,
    tone: "brand",
    period: "trimestre",
    featured: true,
    pitch:
      "Corta y concreta: tres objetivos que casi cualquier compañía reconoce como suyos, y la forma más rápida de ver cómo funciona un ciclo de punta a punta.",
    objectives: [
      {
        title: "Aumentar las ventas del trimestre",
        description: "Facturación cerrada del equipo comercial dentro de la ventana del ciclo.",
        measure: "money",
        direction: "increase",
        initialValue: "500.000.000",
        targetValue: "650.000.000",
        weight: 40,
      },
      {
        title: "Sumar clientes nuevos",
        description: "Cuentas que firman por primera vez, sin contar renovaciones.",
        measure: "numeric",
        direction: "increase",
        initialValue: "18",
        targetValue: "30",
        weight: 35,
      },
      {
        title: "Bajar la pérdida de cuentas",
        description: "Porcentaje de clientes activos que no renuevan en el periodo.",
        measure: "percentage",
        direction: "decrease",
        initialValue: "12",
        targetValue: "6",
        weight: 25,
      },
    ],
    groupObjectives: [
      {
        title: "Aumentar las ventas del área",
        description: "Facturación cerrada por este equipo dentro de la ventana del ciclo.",
        measure: "money",
        direction: "increase",
        initialValue: "120.000.000",
        targetValue: "160.000.000",
        weight: 40,
        alignedToTitle: "Aumentar las ventas del trimestre",
      },
      {
        title: "Abrir cuentas nuevas en el territorio",
        description: "Clientes de primera vez conseguidos por este equipo.",
        measure: "numeric",
        direction: "increase",
        initialValue: "6",
        targetValue: "12",
        weight: 35,
        alignedToTitle: "Sumar clientes nuevos",
      },
      {
        title: "Retener las cuentas del área",
        description: "Clientes del equipo que siguen activos al cierre del ciclo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "82",
        targetValue: "92",
        weight: 25,
        alignedToTitle: "Bajar la pérdida de cuentas",
      },
    ],
    individualObjectives: [
      {
        title: "Cerrar mi cuota del periodo",
        description: "Facturación firmada a mi nombre dentro del ciclo.",
        measure: "money",
        direction: "increase",
        initialValue: "25.000.000",
        targetValue: "35.000.000",
        weight: 40,
        alignedToTitle: "Aumentar las ventas del trimestre",
      },
      {
        title: "Traer clientes nuevos a mi cartera",
        description: "Cuentas que firmo por primera vez en el periodo.",
        measure: "numeric",
        direction: "increase",
        initialValue: "2",
        targetValue: "5",
        weight: 35,
        alignedToTitle: "Sumar clientes nuevos",
      },
      {
        title: "Renovar mis contratos del periodo",
        description: "Contratos a mi nombre que vencen y quedan firmados de nuevo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "80",
        targetValue: "95",
        weight: 25,
        alignedToTitle: "Bajar la pérdida de cuentas",
      },
    ],
  },
  {
    id: "servicio",
    label: "Servicio al cliente",
    name: "Objetivos de servicio al cliente",
    description: "Satisfacción, tiempos de respuesta y resolución en primer contacto.",
    category: "operacion",
    icon: HeartHandshake,
    tone: "positive",
    period: "trimestre",
    objectives: [
      {
        title: "Subir la satisfacción del cliente",
        description: "Promedio de la encuesta de satisfacción posterior a cada caso atendido.",
        measure: "percentage",
        direction: "increase",
        initialValue: "78",
        targetValue: "90",
        weight: 40,
      },
      {
        title: "Reducir el tiempo de primera respuesta",
        description: "Horas promedio entre la llegada de un caso y la primera respuesta real.",
        measure: "numeric",
        direction: "decrease",
        initialValue: "8",
        targetValue: "3",
        weight: 30,
      },
      {
        title: "Resolver en el primer contacto",
        description: "Casos cerrados sin necesidad de una segunda interacción.",
        measure: "percentage",
        direction: "increase",
        initialValue: "55",
        targetValue: "75",
        weight: 30,
      },
    ],
    groupObjectives: [
      {
        title: "Subir la satisfacción de los casos del área",
        description: "Calificación media de los casos atendidos por este equipo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "80",
        targetValue: "92",
        weight: 40,
        alignedToTitle: "Subir la satisfacción del cliente",
      },
      {
        title: "Responder más rápido en el área",
        description: "Horas promedio de primera respuesta de los casos del equipo.",
        measure: "numeric",
        direction: "decrease",
        initialValue: "6",
        targetValue: "2",
        weight: 30,
        alignedToTitle: "Reducir el tiempo de primera respuesta",
      },
      {
        title: "Subir la resolución del área",
        description: "Casos que el equipo cierra sin escalar a nadie más.",
        measure: "percentage",
        direction: "increase",
        initialValue: "60",
        targetValue: "80",
        weight: 30,
        alignedToTitle: "Resolver en el primer contacto",
      },
    ],
    individualObjectives: [
      {
        title: "Mantener alta la calificación de mis casos",
        description: "Promedio de las encuestas de los casos que atiendo yo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "82",
        targetValue: "93",
        weight: 40,
        alignedToTitle: "Subir la satisfacción del cliente",
      },
      {
        title: "Responder mis casos el mismo día",
        description: "Casos míos con primera respuesta dentro de la jornada.",
        measure: "percentage",
        direction: "increase",
        initialValue: "75",
        targetValue: "92",
        weight: 30,
        alignedToTitle: "Reducir el tiempo de primera respuesta",
      },
      {
        title: "Resolver sin escalar",
        description: "Casos míos cerrados sin pasar a otro nivel.",
        measure: "percentage",
        direction: "increase",
        initialValue: "65",
        targetValue: "85",
        weight: 30,
        alignedToTitle: "Resolver en el primer contacto",
      },
    ],
  },
  {
    id: "operaciones",
    label: "Operaciones",
    name: "Objetivos de operaciones",
    description: "Productividad, costos y calidad del proceso operativo.",
    category: "operacion",
    icon: Settings2,
    tone: "warning",
    period: "semestre",
    objectives: [
      {
        title: "Reducir el costo por unidad producida",
        description: "Costo directo promedio de cada unidad que sale del proceso.",
        measure: "money",
        direction: "decrease",
        initialValue: "12.000",
        targetValue: "9.500",
        weight: 35,
      },
      {
        title: "Bajar la tasa de reprocesos",
        description: "Órdenes que hay que rehacer sobre el total producido.",
        measure: "percentage",
        direction: "decrease",
        initialValue: "9",
        targetValue: "4",
        weight: 35,
      },
      {
        title: "Cumplir las entregas a tiempo",
        description: "Órdenes despachadas dentro de la fecha prometida al cliente.",
        measure: "percentage",
        direction: "increase",
        initialValue: "82",
        targetValue: "95",
        weight: 30,
      },
    ],
    groupObjectives: [
      {
        title: "Bajar el desperdicio del área",
        description: "Material perdido en el proceso de este equipo.",
        measure: "percentage",
        direction: "decrease",
        initialValue: "9",
        targetValue: "5",
        weight: 35,
        alignedToTitle: "Reducir el costo por unidad producida",
      },
      {
        title: "Bajar los rechazos del área",
        description: "Unidades rechazadas en control de calidad sobre las entregadas.",
        measure: "percentage",
        direction: "decrease",
        initialValue: "6",
        targetValue: "2",
        weight: 35,
        alignedToTitle: "Bajar la tasa de reprocesos",
      },
      {
        title: "Entregar a tiempo desde el equipo",
        description: "Órdenes del equipo despachadas dentro de la fecha.",
        measure: "percentage",
        direction: "increase",
        initialValue: "85",
        targetValue: "96",
        weight: 30,
        alignedToTitle: "Cumplir las entregas a tiempo",
      },
    ],
    individualObjectives: [
      {
        title: "Reducir mi desperdicio",
        description: "Material perdido en las unidades que yo proceso.",
        measure: "percentage",
        direction: "decrease",
        initialValue: "7",
        targetValue: "3",
        weight: 35,
        alignedToTitle: "Reducir el costo por unidad producida",
      },
      {
        title: "Reducir mis unidades rechazadas",
        description: "Unidades mías devueltas por control de calidad.",
        measure: "numeric",
        direction: "decrease",
        initialValue: "15",
        targetValue: "5",
        weight: 35,
        alignedToTitle: "Bajar la tasa de reprocesos",
      },
      {
        title: "Cerrar mis órdenes dentro de la fecha",
        description: "Órdenes a mi cargo terminadas antes del vencimiento.",
        measure: "percentage",
        direction: "increase",
        initialValue: "85",
        targetValue: "97",
        weight: 30,
        alignedToTitle: "Cumplir las entregas a tiempo",
      },
    ],
  },
  {
    id: "gente",
    label: "Gente y cultura",
    name: "Objetivos de gente y cultura",
    description: "Rotación, clima y desarrollo de los equipos de la compañía.",
    category: "personas",
    icon: Users,
    tone: "neutral",
    period: "anio",
    objectives: [
      {
        title: "Reducir la rotación voluntaria",
        description: "Personas que renuncian sobre la planta promedio del periodo.",
        measure: "percentage",
        direction: "decrease",
        initialValue: "18",
        targetValue: "10",
        weight: 35,
      },
      {
        title: "Subir la favorabilidad de clima",
        description: "Resultado de la medición de clima organizacional del periodo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "72",
        targetValue: "85",
        weight: 35,
      },
      {
        title: "Cerrar los planes de formación",
        description: "Colaboradores que completan la ruta de formación asignada.",
        measure: "percentage",
        direction: "increase",
        initialValue: "45",
        targetValue: "80",
        weight: 30,
      },
    ],
    groupObjectives: [
      {
        title: "Retener al equipo del área",
        description: "Personas del equipo que siguen al cierre del ciclo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "85",
        targetValue: "95",
        weight: 35,
        alignedToTitle: "Reducir la rotación voluntaria",
      },
      {
        title: "Subir el clima del área",
        description: "Favorabilidad de la medición dentro de este equipo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "70",
        targetValue: "84",
        weight: 35,
        alignedToTitle: "Subir la favorabilidad de clima",
      },
      {
        title: "Completar la ruta del área",
        description: "Personas del equipo que terminan la formación asignada.",
        measure: "percentage",
        direction: "increase",
        initialValue: "50",
        targetValue: "85",
        weight: 30,
        alignedToTitle: "Cerrar los planes de formación",
      },
    ],
    individualObjectives: [
      {
        title: "Hacer mis conversaciones de seguimiento",
        description: "Reuniones uno a uno sostenidas con cada persona a mi cargo.",
        measure: "numeric",
        direction: "increase",
        initialValue: "6",
        targetValue: "12",
        weight: 35,
        alignedToTitle: "Reducir la rotación voluntaria",
      },
      {
        title: "Cerrar el plan de acción de mi equipo",
        description: "Hito: se cumple cuando los compromisos del plan de clima quedan ejecutados.",
        measure: "boolean",
        direction: null,
        initialValue: "",
        targetValue: "",
        weight: 35,
        alignedToTitle: "Subir la favorabilidad de clima",
      },
      {
        title: "Completar mi ruta de formación",
        description: "Cursos de mi plan terminados dentro del ciclo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "40",
        targetValue: "100",
        weight: 30,
        alignedToTitle: "Cerrar los planes de formación",
      },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    name: "Objetivos de marketing",
    description: "Demanda, costo de adquisición y presencia de marca.",
    category: "negocio",
    icon: Megaphone,
    tone: "brand",
    period: "trimestre",
    objectives: [
      {
        title: "Generar oportunidades calificadas",
        description: "Contactos que el equipo comercial acepta como oportunidad real.",
        measure: "numeric",
        direction: "increase",
        initialValue: "120",
        targetValue: "200",
        weight: 40,
      },
      {
        title: "Reducir el costo por oportunidad",
        description: "Inversión en pauta y contenidos dividida entre las oportunidades logradas.",
        measure: "money",
        direction: "decrease",
        initialValue: "180.000",
        targetValue: "120.000",
        weight: 35,
      },
      {
        title: "Lanzar la nueva marca de producto",
        description: "Hito de lanzamiento: se cumple cuando la marca sale al mercado.",
        measure: "boolean",
        direction: null,
        initialValue: "",
        targetValue: "",
        weight: 25,
      },
    ],
    groupObjectives: [
      {
        title: "Aportar oportunidades desde el equipo",
        description: "Oportunidades calificadas atribuidas a las campañas del área.",
        measure: "numeric",
        direction: "increase",
        initialValue: "45",
        targetValue: "75",
        weight: 40,
        alignedToTitle: "Generar oportunidades calificadas",
      },
      {
        title: "Optimizar el gasto de pauta del área",
        description: "Inversión ejecutada por el equipo frente a la aprobada.",
        measure: "percentage",
        direction: "decrease",
        initialValue: "108",
        targetValue: "100",
        weight: 35,
        alignedToTitle: "Reducir el costo por oportunidad",
      },
      {
        title: "Ejecutar los lanzamientos del periodo",
        description: "Lanzamientos del área entregados dentro de la fecha comprometida.",
        measure: "percentage",
        direction: "increase",
        initialValue: "70",
        targetValue: "90",
        weight: 25,
        alignedToTitle: "Lanzar la nueva marca de producto",
      },
    ],
    individualObjectives: [
      {
        title: "Publicar mis piezas del periodo",
        description: "Contenidos que salgo a producir y publicar yo.",
        measure: "numeric",
        direction: "increase",
        initialValue: "4",
        targetValue: "8",
        weight: 40,
        alignedToTitle: "Generar oportunidades calificadas",
      },
      {
        title: "Cerrar el reporte de inversión a tiempo",
        description: "Hito: se cumple cuando el reporte del periodo queda entregado.",
        measure: "boolean",
        direction: null,
        initialValue: "",
        targetValue: "",
        weight: 35,
        alignedToTitle: "Reducir el costo por oportunidad",
      },
      {
        title: "Entregar mi lanzamiento a tiempo",
        description: "Hito: se cumple cuando la pieza de la que respondo sale publicada.",
        measure: "boolean",
        direction: null,
        initialValue: "",
        targetValue: "",
        weight: 25,
        alignedToTitle: "Lanzar la nueva marca de producto",
      },
    ],
  },
  {
    id: "finanzas",
    label: "Finanzas",
    name: "Objetivos financieros",
    description: "Margen, cartera y control del gasto de la compañía.",
    category: "negocio",
    icon: Wallet,
    tone: "positive",
    period: "semestre",
    objectives: [
      {
        title: "Subir el margen bruto",
        description: "Margen sobre ventas del periodo, después de costo directo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "34",
        targetValue: "42",
        weight: 40,
      },
      {
        title: "Reducir la cartera vencida",
        description: "Saldo por cobrar con más de 60 días de mora.",
        measure: "money",
        direction: "decrease",
        initialValue: "320.000.000",
        targetValue: "150.000.000",
        weight: 35,
      },
      {
        title: "Cumplir el presupuesto de gasto",
        description: "Gasto ejecutado frente al aprobado para el periodo.",
        measure: "percentage",
        direction: "decrease",
        initialValue: "108",
        targetValue: "100",
        weight: 25,
      },
    ],
    groupObjectives: [
      {
        title: "Mejorar el margen del área",
        description: "Margen de los negocios cerrados por este equipo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "30",
        targetValue: "38",
        weight: 40,
        alignedToTitle: "Subir el margen bruto",
      },
      {
        title: "Bajar la mora de las cuentas del área",
        description: "Cartera vencida de los clientes que atiende este equipo.",
        measure: "money",
        direction: "decrease",
        initialValue: "80.000.000",
        targetValue: "40.000.000",
        weight: 35,
        alignedToTitle: "Reducir la cartera vencida",
      },
      {
        title: "Ejecutar el presupuesto del área sin desviarse",
        description: "Gasto del equipo frente al presupuesto que le fue asignado.",
        measure: "percentage",
        direction: "decrease",
        initialValue: "112",
        targetValue: "100",
        weight: 25,
        alignedToTitle: "Cumplir el presupuesto de gasto",
      },
    ],
    individualObjectives: [
      {
        title: "Cuidar el margen de mis negocios",
        description: "Margen promedio de los negocios que cierro yo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "29",
        targetValue: "37",
        weight: 40,
        alignedToTitle: "Subir el margen bruto",
      },
      {
        title: "Bajar la mora de mis clientes",
        description: "Saldo vencido de las cuentas que gestiono.",
        measure: "money",
        direction: "decrease",
        initialValue: "18.000.000",
        targetValue: "8.000.000",
        weight: 35,
        alignedToTitle: "Reducir la cartera vencida",
      },
      {
        title: "Legalizar mis gastos a tiempo",
        description: "Gastos reportados dentro del plazo establecido.",
        measure: "percentage",
        direction: "increase",
        initialValue: "70",
        targetValue: "95",
        weight: 25,
        alignedToTitle: "Cumplir el presupuesto de gasto",
      },
    ],
  },
  {
    id: "expansion",
    label: "Expansión",
    name: "Objetivos de expansión y nuevos mercados",
    description: "Apertura de mercados, nuevos canales y crecimiento fuera del negocio actual.",
    category: "negocio",
    icon: Globe2,
    tone: "brand",
    period: "anio",
    objectives: [
      {
        title: "Abrir nuevas ciudades o países",
        description: "Mercados donde la compañía factura por primera vez en el periodo.",
        measure: "numeric",
        direction: "increase",
        initialValue: "2",
        targetValue: "5",
        weight: 40,
      },
      {
        title: "Generar ventas del negocio nuevo",
        description: "Facturación proveniente de los mercados o canales abiertos en el periodo.",
        measure: "money",
        direction: "increase",
        initialValue: "0",
        targetValue: "800.000.000",
        weight: 35,
      },
      {
        title: "Cumplir el plan de expansión a tiempo",
        description: "Hitos del plan de apertura entregados dentro del cronograma aprobado.",
        measure: "percentage",
        direction: "increase",
        initialValue: "60",
        targetValue: "90",
        weight: 25,
      },
    ],
    groupObjectives: [
      {
        title: "Abrir el mercado asignado al área",
        description: "Mercado bajo responsabilidad de este equipo que queda habilitado en el periodo.",
        measure: "numeric",
        direction: "increase",
        initialValue: "0",
        targetValue: "1",
        weight: 40,
        alignedToTitle: "Abrir nuevas ciudades o países",
      },
      {
        title: "Vender en el mercado nuevo del área",
        description: "Facturación del equipo en el mercado o canal recién abierto.",
        measure: "money",
        direction: "increase",
        initialValue: "0",
        targetValue: "150.000.000",
        weight: 35,
        alignedToTitle: "Generar ventas del negocio nuevo",
      },
      {
        title: "Entregar el plan de apertura del área a tiempo",
        description: "Hitos del área dentro del plan de expansión entregados a tiempo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "65",
        targetValue: "95",
        weight: 25,
        alignedToTitle: "Cumplir el plan de expansión a tiempo",
      },
    ],
    individualObjectives: [
      {
        title: "Levantar mi mercado asignado",
        description: "Hito: se cumple cuando el mercado bajo mi cargo queda operando.",
        measure: "boolean",
        direction: null,
        initialValue: "",
        targetValue: "",
        weight: 40,
        alignedToTitle: "Abrir nuevas ciudades o países",
      },
      {
        title: "Cerrar mis primeras ventas en el mercado nuevo",
        description: "Facturación que consigo yo en el mercado o canal recién abierto.",
        measure: "money",
        direction: "increase",
        initialValue: "0",
        targetValue: "40.000.000",
        weight: 35,
        alignedToTitle: "Generar ventas del negocio nuevo",
      },
      {
        title: "Entregar mis hitos del plan a tiempo",
        description: "Hitos del plan de expansión a mi cargo entregados a tiempo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "60",
        targetValue: "95",
        weight: 25,
        alignedToTitle: "Cumplir el plan de expansión a tiempo",
      },
    ],
  },
  {
    id: "logistica",
    label: "Logística",
    name: "Objetivos de logística y cadena de suministro",
    description: "Nivel de servicio, costo de transporte y exactitud del inventario.",
    category: "operacion",
    icon: Truck,
    tone: "warning",
    period: "trimestre",
    objectives: [
      {
        title: "Subir el nivel de servicio al cliente",
        description: "Pedidos entregados completos y a tiempo sobre el total despachado.",
        measure: "percentage",
        direction: "increase",
        initialValue: "84",
        targetValue: "96",
        weight: 40,
      },
      {
        title: "Reducir el costo de transporte",
        description: "Costo de flete sobre el valor de la mercancía despachada.",
        measure: "percentage",
        direction: "decrease",
        initialValue: "9",
        targetValue: "6",
        weight: 30,
      },
      {
        title: "Subir la exactitud del inventario",
        description: "Coincidencia entre el inventario físico y el registrado en el sistema.",
        measure: "percentage",
        direction: "increase",
        initialValue: "88",
        targetValue: "98",
        weight: 30,
      },
    ],
    groupObjectives: [
      {
        title: "Subir el nivel de servicio del área",
        description: "Pedidos del equipo entregados completos y a tiempo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "85",
        targetValue: "97",
        weight: 40,
        alignedToTitle: "Subir el nivel de servicio al cliente",
      },
      {
        title: "Bajar el costo de transporte del área",
        description: "Costo de flete de las rutas que opera este equipo.",
        measure: "percentage",
        direction: "decrease",
        initialValue: "10",
        targetValue: "7",
        weight: 30,
        alignedToTitle: "Reducir el costo de transporte",
      },
      {
        title: "Subir la exactitud del inventario del área",
        description: "Coincidencia del inventario físico frente al sistema en las bodegas del equipo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "89",
        targetValue: "98",
        weight: 30,
        alignedToTitle: "Subir la exactitud del inventario",
      },
    ],
    individualObjectives: [
      {
        title: "Despachar mis pedidos completos y a tiempo",
        description: "Pedidos a mi cargo entregados completos dentro del plazo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "86",
        targetValue: "97",
        weight: 40,
        alignedToTitle: "Subir el nivel de servicio al cliente",
      },
      {
        title: "Bajar el costo de mis rutas",
        description: "Costo de flete de las rutas que administro yo.",
        measure: "percentage",
        direction: "decrease",
        initialValue: "11",
        targetValue: "7",
        weight: 30,
        alignedToTitle: "Reducir el costo de transporte",
      },
      {
        title: "Mantener exacto mi inventario asignado",
        description: "Coincidencia del inventario físico frente al sistema en mi bodega.",
        measure: "percentage",
        direction: "increase",
        initialValue: "90",
        targetValue: "99",
        weight: 30,
        alignedToTitle: "Subir la exactitud del inventario",
      },
    ],
  },
  {
    id: "calidad",
    label: "Calidad y seguridad",
    name: "Objetivos de calidad y seguridad industrial",
    description: "No conformidades, accidentalidad y cumplimiento normativo del proceso.",
    category: "operacion",
    icon: ShieldCheck,
    tone: "warning",
    period: "semestre",
    objectives: [
      {
        title: "Bajar las no conformidades de calidad",
        description: "Hallazgos de auditoría de calidad sobre el total de procesos revisados.",
        measure: "percentage",
        direction: "decrease",
        initialValue: "14",
        targetValue: "6",
        weight: 35,
      },
      {
        title: "Bajar la accidentalidad laboral",
        description: "Accidentes de trabajo reportados por cada cien colaboradores.",
        measure: "numeric",
        direction: "decrease",
        initialValue: "6",
        targetValue: "2",
        weight: 35,
      },
      {
        title: "Cerrar las auditorías normativas",
        description: "Auditorías de cumplimiento cerradas sin hallazgos abiertos.",
        measure: "percentage",
        direction: "increase",
        initialValue: "70",
        targetValue: "95",
        weight: 30,
      },
    ],
    groupObjectives: [
      {
        title: "Bajar las no conformidades del área",
        description: "Hallazgos de auditoría sobre los procesos que corren en este equipo.",
        measure: "percentage",
        direction: "decrease",
        initialValue: "15",
        targetValue: "7",
        weight: 35,
        alignedToTitle: "Bajar las no conformidades de calidad",
      },
      {
        title: "Bajar la accidentalidad del área",
        description: "Accidentes de trabajo del equipo por cada cien colaboradores.",
        measure: "numeric",
        direction: "decrease",
        initialValue: "5",
        targetValue: "1",
        weight: 35,
        alignedToTitle: "Bajar la accidentalidad laboral",
      },
      {
        title: "Cerrar las auditorías del área",
        description: "Auditorías del equipo cerradas sin hallazgos abiertos.",
        measure: "percentage",
        direction: "increase",
        initialValue: "72",
        targetValue: "96",
        weight: 30,
        alignedToTitle: "Cerrar las auditorías normativas",
      },
    ],
    individualObjectives: [
      {
        title: "Cerrar mis hallazgos de calidad",
        description: "Hallazgos a mi cargo que quedan cerrados dentro del plazo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "60",
        targetValue: "95",
        weight: 35,
        alignedToTitle: "Bajar las no conformidades de calidad",
      },
      {
        title: "Trabajar sin accidentes en mi puesto",
        description: "Hito: se cumple cuando cierro el periodo sin accidentes reportados.",
        measure: "boolean",
        direction: null,
        initialValue: "",
        targetValue: "",
        weight: 35,
        alignedToTitle: "Bajar la accidentalidad laboral",
      },
      {
        title: "Cerrar mis compromisos de auditoría",
        description: "Compromisos de auditoría a mi cargo cerrados dentro del plazo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "65",
        targetValue: "97",
        weight: 30,
        alignedToTitle: "Cerrar las auditorías normativas",
      },
    ],
  },
  {
    id: "liderazgo",
    label: "Liderazgo",
    name: "Objetivos de liderazgo y desarrollo gerencial",
    description: "Cobertura de sucesión, evaluación de líderes y planes de desarrollo.",
    category: "personas",
    icon: Award,
    tone: "neutral",
    period: "anio",
    objectives: [
      {
        title: "Cubrir los cargos críticos con plan de sucesión",
        description: "Cargos clave de la compañía con al menos un sucesor identificado.",
        measure: "percentage",
        direction: "increase",
        initialValue: "40",
        targetValue: "80",
        weight: 35,
      },
      {
        title: "Subir la favorabilidad de liderazgo",
        description: "Resultado de la medición de liderazgo respondida por los equipos.",
        measure: "percentage",
        direction: "increase",
        initialValue: "68",
        targetValue: "85",
        weight: 35,
      },
      {
        title: "Cerrar los planes de desarrollo de líderes",
        description: "Líderes que completan el plan de desarrollo asignado en el periodo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "45",
        targetValue: "85",
        weight: 30,
      },
    ],
    groupObjectives: [
      {
        title: "Cubrir la sucesión de los cargos del área",
        description: "Cargos críticos del equipo con sucesor identificado.",
        measure: "percentage",
        direction: "increase",
        initialValue: "40",
        targetValue: "85",
        weight: 35,
        alignedToTitle: "Cubrir los cargos críticos con plan de sucesión",
      },
      {
        title: "Subir la favorabilidad de los líderes del área",
        description: "Resultado de la medición de liderazgo entre los líderes de este equipo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "65",
        targetValue: "87",
        weight: 35,
        alignedToTitle: "Subir la favorabilidad de liderazgo",
      },
      {
        title: "Completar el desarrollo de los líderes del área",
        description: "Líderes del equipo que terminan su plan de desarrollo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "50",
        targetValue: "90",
        weight: 30,
        alignedToTitle: "Cerrar los planes de desarrollo de líderes",
      },
    ],
    individualObjectives: [
      {
        title: "Identificar mi sucesor",
        description: "Hito: se cumple cuando dejo un sucesor identificado y en desarrollo para mi cargo.",
        measure: "boolean",
        direction: null,
        initialValue: "",
        targetValue: "",
        weight: 35,
        alignedToTitle: "Cubrir los cargos críticos con plan de sucesión",
      },
      {
        title: "Subir mi favorabilidad como líder",
        description: "Resultado de la medición de liderazgo que recibo de mi equipo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "66",
        targetValue: "88",
        weight: 35,
        alignedToTitle: "Subir la favorabilidad de liderazgo",
      },
      {
        title: "Completar mi plan de desarrollo",
        description: "Actividades de mi plan de desarrollo terminadas en el periodo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "40",
        targetValue: "100",
        weight: 30,
        alignedToTitle: "Cerrar los planes de desarrollo de líderes",
      },
    ],
  },
  {
    id: "sst",
    label: "Seguridad y salud",
    name: "Objetivos de seguridad y salud en el trabajo",
    description: "Accidentalidad laboral, ausentismo y cierre del plan SG-SST.",
    category: "personas",
    icon: HeartPulse,
    tone: "positive",
    period: "anio",
    objectives: [
      {
        title: "Bajar la accidentalidad laboral",
        description: "Accidentes de trabajo reportados por cada cien colaboradores en el periodo.",
        measure: "numeric",
        direction: "decrease",
        initialValue: "7",
        targetValue: "2",
        weight: 35,
      },
      {
        title: "Bajar el ausentismo por enfermedad",
        description: "Días de incapacidad sobre los días laborados en el periodo.",
        measure: "percentage",
        direction: "decrease",
        initialValue: "6",
        targetValue: "3",
        weight: 35,
      },
      {
        title: "Cerrar el plan SG-SST",
        description: "Actividades del plan de seguridad y salud en el trabajo ejecutadas en el periodo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "55",
        targetValue: "100",
        weight: 30,
      },
    ],
    groupObjectives: [
      {
        title: "Bajar la accidentalidad del área",
        description: "Accidentes de trabajo del equipo por cada cien colaboradores.",
        measure: "numeric",
        direction: "decrease",
        initialValue: "6",
        targetValue: "1",
        weight: 35,
        alignedToTitle: "Bajar la accidentalidad laboral",
      },
      {
        title: "Bajar el ausentismo del área",
        description: "Días de incapacidad del equipo sobre los días laborados.",
        measure: "percentage",
        direction: "decrease",
        initialValue: "7",
        targetValue: "3",
        weight: 35,
        alignedToTitle: "Bajar el ausentismo por enfermedad",
      },
      {
        title: "Ejecutar el plan SG-SST del área",
        description: "Actividades del plan asignadas a este equipo ya ejecutadas.",
        measure: "percentage",
        direction: "increase",
        initialValue: "60",
        targetValue: "100",
        weight: 30,
        alignedToTitle: "Cerrar el plan SG-SST",
      },
    ],
    individualObjectives: [
      {
        title: "Trabajar sin accidentes",
        description: "Hito: se cumple cuando cierro el periodo sin accidentes reportados en mi puesto.",
        measure: "boolean",
        direction: null,
        initialValue: "",
        targetValue: "",
        weight: 35,
        alignedToTitle: "Bajar la accidentalidad laboral",
      },
      {
        title: "Bajar mi ausentismo",
        description: "Días de incapacidad míos sobre los días laborados en el periodo.",
        measure: "percentage",
        direction: "decrease",
        initialValue: "8",
        targetValue: "3",
        weight: 35,
        alignedToTitle: "Bajar el ausentismo por enfermedad",
      },
      {
        title: "Cumplir mis actividades del plan SG-SST",
        description: "Actividades del plan a mi cargo ya ejecutadas en el periodo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "60",
        targetValue: "100",
        weight: 30,
        alignedToTitle: "Cerrar el plan SG-SST",
      },
    ],
  },
  {
    id: "producto",
    label: "Producto",
    name: "Objetivos de producto",
    description: "Adopción, retención y velocidad de entrega del producto.",
    category: "producto",
    icon: Package,
    tone: "brand",
    period: "trimestre",
    objectives: [
      {
        title: "Subir la adopción de la funcionalidad clave",
        description: "Usuarios activos que usan la funcionalidad principal del producto en el periodo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "35",
        targetValue: "60",
        weight: 35,
      },
      {
        title: "Reducir la fuga de usuarios",
        description: "Usuarios que dejan de usar el producto sobre el total activo al inicio del periodo.",
        measure: "percentage",
        direction: "decrease",
        initialValue: "8",
        targetValue: "4",
        weight: 35,
      },
      {
        title: "Entregar el roadmap del trimestre",
        description: "Funcionalidades comprometidas en el roadmap que salen a producción en el periodo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "55",
        targetValue: "90",
        weight: 30,
      },
    ],
    groupObjectives: [
      {
        title: "Subir la adopción en el módulo del área",
        description: "Usuarios activos del módulo que atiende este equipo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "30",
        targetValue: "55",
        weight: 35,
        alignedToTitle: "Subir la adopción de la funcionalidad clave",
      },
      {
        title: "Bajar la fuga en el segmento del área",
        description: "Usuarios del segmento que atiende este equipo que dejan de usar el producto.",
        measure: "percentage",
        direction: "decrease",
        initialValue: "10",
        targetValue: "5",
        weight: 35,
        alignedToTitle: "Reducir la fuga de usuarios",
      },
      {
        title: "Entregar las funcionalidades del área a tiempo",
        description: "Funcionalidades del roadmap a cargo de este equipo entregadas a tiempo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "60",
        targetValue: "92",
        weight: 30,
        alignedToTitle: "Entregar el roadmap del trimestre",
      },
    ],
    individualObjectives: [
      {
        title: "Subir la adopción de mis usuarios asignados",
        description: "Cuentas o usuarios que atiendo yo y usan la funcionalidad principal.",
        measure: "percentage",
        direction: "increase",
        initialValue: "32",
        targetValue: "58",
        weight: 35,
        alignedToTitle: "Subir la adopción de la funcionalidad clave",
      },
      {
        title: "Retener a mis cuentas asignadas",
        description: "Cuentas bajo mi cargo que dejan de usar el producto.",
        measure: "percentage",
        direction: "decrease",
        initialValue: "9",
        targetValue: "4",
        weight: 35,
        alignedToTitle: "Reducir la fuga de usuarios",
      },
      {
        title: "Entregar mis historias del periodo",
        description: "Historias de usuario a mi cargo que quedan cerradas en el periodo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "65",
        targetValue: "95",
        weight: 30,
        alignedToTitle: "Entregar el roadmap del trimestre",
      },
    ],
  },
  {
    id: "tecnologia",
    label: "Tecnología",
    name: "Objetivos de tecnología",
    description: "Disponibilidad, incidentes y deuda técnica del equipo de TI.",
    category: "producto",
    icon: Cpu,
    tone: "neutral",
    period: "trimestre",
    objectives: [
      {
        title: "Subir la disponibilidad de las plataformas",
        description: "Tiempo en que los sistemas críticos están disponibles para los usuarios.",
        measure: "percentage",
        direction: "increase",
        initialValue: "97",
        targetValue: "99",
        weight: 40,
      },
      {
        title: "Reducir los incidentes críticos",
        description: "Incidentes de severidad alta reportados en producción durante el periodo.",
        measure: "numeric",
        direction: "decrease",
        initialValue: "14",
        targetValue: "5",
        weight: 30,
      },
      {
        title: "Bajar la deuda técnica",
        description: "Tickets de deuda técnica pendientes sobre el total del backlog.",
        measure: "percentage",
        direction: "decrease",
        initialValue: "25",
        targetValue: "12",
        weight: 30,
      },
    ],
    groupObjectives: [
      {
        title: "Subir la disponibilidad de los sistemas del área",
        description: "Disponibilidad de los servicios que administra este equipo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "96",
        targetValue: "99",
        weight: 40,
        alignedToTitle: "Subir la disponibilidad de las plataformas",
      },
      {
        title: "Bajar los incidentes del área",
        description: "Incidentes de severidad alta reportados en los sistemas del equipo.",
        measure: "numeric",
        direction: "decrease",
        initialValue: "6",
        targetValue: "2",
        weight: 30,
        alignedToTitle: "Reducir los incidentes críticos",
      },
      {
        title: "Bajar la deuda técnica del área",
        description: "Tickets de deuda técnica pendientes en el backlog del equipo.",
        measure: "percentage",
        direction: "decrease",
        initialValue: "28",
        targetValue: "14",
        weight: 30,
        alignedToTitle: "Bajar la deuda técnica",
      },
    ],
    individualObjectives: [
      {
        title: "Cumplir mi SLA de disponibilidad",
        description: "Disponibilidad de los servicios que administro yo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "95",
        targetValue: "99",
        weight: 40,
        alignedToTitle: "Subir la disponibilidad de las plataformas",
      },
      {
        title: "Resolver mis incidentes críticos a tiempo",
        description: "Incidentes a mi cargo cerrados dentro del acuerdo de servicio.",
        measure: "percentage",
        direction: "increase",
        initialValue: "70",
        targetValue: "95",
        weight: 30,
        alignedToTitle: "Reducir los incidentes críticos",
      },
      {
        title: "Cerrar mis tickets de deuda técnica",
        description: "Tickets de deuda técnica a mi cargo que quedan resueltos.",
        measure: "numeric",
        direction: "decrease",
        initialValue: "20",
        targetValue: "5",
        weight: 30,
        alignedToTitle: "Bajar la deuda técnica",
      },
    ],
  },
  {
    id: "innovacion",
    label: "Innovación",
    name: "Objetivos de innovación",
    description: "Nuevas iniciativas probadas, ingresos de productos nuevos y cultura de experimentación.",
    category: "producto",
    icon: Lightbulb,
    tone: "ai",
    period: "anio",
    objectives: [
      {
        title: "Probar iniciativas nuevas",
        description: "Experimentos o pilotos completados con un resultado medible en el periodo.",
        measure: "numeric",
        direction: "increase",
        initialValue: "4",
        targetValue: "10",
        weight: 35,
      },
      {
        title: "Generar ingresos de productos nuevos",
        description: "Facturación de productos o servicios lanzados en los últimos doce meses.",
        measure: "money",
        direction: "increase",
        initialValue: "0",
        targetValue: "300.000.000",
        weight: 35,
      },
      {
        title: "Lanzar el laboratorio de innovación",
        description: "Hito: se cumple cuando el espacio de experimentación queda operando.",
        measure: "boolean",
        direction: null,
        initialValue: "",
        targetValue: "",
        weight: 30,
      },
    ],
    groupObjectives: [
      {
        title: "Probar iniciativas del área",
        description: "Experimentos o pilotos del equipo completados con resultado medible.",
        measure: "numeric",
        direction: "increase",
        initialValue: "1",
        targetValue: "3",
        weight: 35,
        alignedToTitle: "Probar iniciativas nuevas",
      },
      {
        title: "Vender el producto nuevo del área",
        description: "Facturación del equipo en los productos lanzados en los últimos doce meses.",
        measure: "money",
        direction: "increase",
        initialValue: "0",
        targetValue: "60.000.000",
        weight: 35,
        alignedToTitle: "Generar ingresos de productos nuevos",
      },
      {
        title: "Aportar al laboratorio de innovación",
        description: "Avance del área en los compromisos del laboratorio.",
        measure: "percentage",
        direction: "increase",
        initialValue: "50",
        targetValue: "100",
        weight: 30,
        alignedToTitle: "Lanzar el laboratorio de innovación",
      },
    ],
    individualObjectives: [
      {
        title: "Proponer y probar mi iniciativa",
        description: "Hito: se cumple cuando mi iniciativa queda probada con resultado.",
        measure: "boolean",
        direction: null,
        initialValue: "",
        targetValue: "",
        weight: 35,
        alignedToTitle: "Probar iniciativas nuevas",
      },
      {
        title: "Vender mi producto nuevo asignado",
        description: "Facturación que consigo yo en el producto nuevo asignado.",
        measure: "money",
        direction: "increase",
        initialValue: "0",
        targetValue: "15.000.000",
        weight: 35,
        alignedToTitle: "Generar ingresos de productos nuevos",
      },
      {
        title: "Cumplir mis compromisos del laboratorio",
        description: "Compromisos del laboratorio a mi cargo cerrados en el periodo.",
        measure: "percentage",
        direction: "increase",
        initialValue: "55",
        targetValue: "100",
        weight: 30,
        alignedToTitle: "Lanzar el laboratorio de innovación",
      },
    ],
  },
];

/** How many templates the home shelf promotes; the rest live in the catalog. */
export const STRIP_TEMPLATE_COUNT = 5;

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * The template's objectives as real `Objective`s, ready for the builder.
 *
 * Built fresh on every call: two ciclos started from the same template must
 * not end up sharing objective ids, or editing one would edit the other.
 */
export const cicloTemplateObjectives = (template: CicloTemplate): readonly Objective[] =>
  template.objectives.map((item) => ({
    ...createBlankObjective(item.weight),
    title: item.title,
    description: item.description,
    measure: item.measure,
    direction: item.direction,
    initialValue: item.initialValue,
    targetValue: item.targetValue,
  }));

/**
 * Los objetivos de grupo o individual de la plantilla, ya resueltos en
 * `Objective`s reales — distintos de los de empresa, y alineados a ellos.
 *
 * `companyObjectives` son los de empresa **ya creados en esta misma
 * operación**, con sus ids reales: es lo único que permite resolver a qué
 * apunta cada `alignedToTitle`, porque un objetivo de empresa no tiene id
 * hasta que se crea. Si la plantilla no se usó también para empresa, se pasa
 * vacío y estos objetivos entran sin alinear — siguen siendo objetivos
 * válidos por su cuenta, la alineación es un plus, no un requisito.
 */
export function cicloTemplateAlignedObjectives(
  template: CicloTemplate,
  kind: "grupal" | "individual",
  companyObjectives: readonly Objective[]
): readonly Objective[] {
  const source = kind === "grupal" ? template.groupObjectives : template.individualObjectives;
  return source.map((item) => {
    const alignedTo =
      companyObjectives.find((company) => company.title === item.alignedToTitle)?.id ?? null;
    return {
      ...createBlankObjective(item.weight),
      title: item.title,
      description: item.description,
      measure: item.measure,
      direction: item.direction,
      initialValue: item.initialValue,
      targetValue: item.targetValue,
      alignedTo,
    };
  });
}

/** Las plantillas de un estante, en el orden del catálogo. */
export const cicloTemplatesInCategory = (
  category: CicloTemplateCategoryId
): readonly CicloTemplate[] => CICLO_TEMPLATES.filter((template) => template.category === category);

export const CICLO_TEMPLATE_SHELVES: readonly CicloTemplateShelf[] = [
  {
    id: "negocio",
    category: "Negocio",
    description: "Ventas, demanda y rentabilidad: lo que la compañía vende, gana y cobra.",
    icon: Briefcase,
    path: [],
    items: cicloTemplatesInCategory("negocio"),
  },
  {
    id: "operacion",
    category: "Operación",
    description: "Producción, calidad y servicio: cómo se entrega y cómo se atiende.",
    icon: Workflow,
    path: [],
    items: cicloTemplatesInCategory("operacion"),
  },
  {
    id: "personas",
    category: "Personas",
    description: "Rotación, clima y desarrollo: la gente que hace todo lo anterior.",
    icon: UsersRound,
    path: [],
    items: cicloTemplatesInCategory("personas"),
  },
  {
    id: "producto",
    category: "Producto y tecnología",
    description: "Adopción, disponibilidad e innovación: lo que la compañía construye y evoluciona.",
    icon: Rocket,
    path: [],
    items: cicloTemplatesInCategory("producto"),
  },
];

export const findCicloTemplate = (id: string | undefined): CicloTemplate | undefined =>
  id === undefined ? undefined : CICLO_TEMPLATES.find((template) => template.id === id);

export const findShelfOf = (template: CicloTemplate): CicloTemplateShelf | undefined =>
  CICLO_TEMPLATE_SHELVES.find((shelf) => shelf.items.some((item) => item.id === template.id));

/**
 * Qué enseñar junto a una plantilla que alguien ya está leyendo: primero el
 * resto de su propio estante —las alternativas más cercanas—, después los
 * demás estantes, con tope para que la fila siga siendo una sola.
 */
export function suggestCicloTemplates(
  current: CicloTemplate,
  limit: number
): readonly CicloTemplate[] {
  const ownShelf = findShelfOf(current);
  const siblings = ownShelf ? ownShelf.items.filter((item) => item.id !== current.id) : [];
  const others = CICLO_TEMPLATE_SHELVES.filter((shelf) => shelf !== ownShelf).flatMap(
    (shelf) => shelf.items
  );
  return [...siblings, ...others].slice(0, limit);
}

// ── Tamaño ─────────────────────────────────────────────────────────────────

export interface CicloTemplateSize {
  objectives: number;
  /** El periodo sugerido, ya escrito — "Trimestre". */
  periodLabel: string;
  /** Cuánto peso reparten sus objetivos. 100 % en todas, pero se calcula en
   *  vez de prometerse, para que una plantilla mal sumada se vea en la ficha
   *  en lugar de mentir. */
  weight: number;
}

export const measureCicloTemplate = (template: CicloTemplate): CicloTemplateSize => ({
  objectives: template.objectives.length,
  periodLabel: CICLO_PERIOD_LABELS[template.period],
  weight: template.objectives.reduce((total, objective) => total + objective.weight, 0),
});

/** "3 objetivos · Trimestre" */
export const describeCicloTemplateSize = (size: CicloTemplateSize): string =>
  `${pluralize(size.objectives, "objetivo", "objetivos")} · ${size.periodLabel}`;

// ── La destacada ───────────────────────────────────────────────────────────

/**
 * La que la galería pone en su foco.
 *
 * Una rejilla de seis piezas idénticas deja la primera decisión entera en
 * manos de quien mira, y quien abre esto por primera vez no viene con una
 * elegida.
 */
export const FEATURED_CICLO_TEMPLATE: CicloTemplate =
  CICLO_TEMPLATES.find((template) => template.featured) ?? CICLO_TEMPLATES[0];

export const FEATURED_REASON: string =
  FEATURED_CICLO_TEMPLATE.pitch ?? FEATURED_CICLO_TEMPLATE.description;

// ── Búsqueda ───────────────────────────────────────────────────────────────

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Coincidencia insensible a mayúsculas y a tildes, sobre el nombre, el para
 * qué sirve y los titulares de sus objetivos.
 *
 * Las tildes importan: quien busca "rotacion" está buscando "Reducir la
 * rotación voluntaria", y una búsqueda que exige el acento devuelve un vacío
 * que el catálogo no tiene.
 */
export function matchesCicloTemplateQuery(template: CicloTemplate, query: string): boolean {
  const term = normalize(query);
  if (term.length === 0) return true;
  const haystack = [
    template.name,
    template.label,
    template.description,
    ...template.objectives.map((objective) => objective.title),
  ].join(" ");
  return normalize(haystack).includes(term);
}

// ── Alcance ──────────────────────────────────────────────────────────────

/**
 * A quién se le ponen los objetivos de una plantilla.
 *
 * No es una elección excluyente: una plantilla se puede usar para la empresa
 * Y, a la vez, para un grupo o para personas concretas — son los mismos tres
 * objetivos, solo que puestos a más de un nivel. Reutiliza `ObjectiveSetKind`
 * para "grupal"/"individual" en vez de inventar un tipo paralelo: son
 * exactamente los dos tipos de asignación que el constructor ya sabe crear.
 */
export type CicloTemplateScope = "empresa" | ObjectiveSetKind;

export interface CicloTemplateScopeMeta {
  icon: LucideIcon;
  tone: Extract<Tone, "brand" | "positive" | "warning">;
  label: string;
  tagline: string;
}

export const CICLO_TEMPLATE_SCOPE_ORDER: readonly CicloTemplateScope[] = [
  "empresa",
  "grupal",
  "individual",
];

export const CICLO_TEMPLATE_SCOPE_META: Readonly<Record<CicloTemplateScope, CicloTemplateScopeMeta>> = {
  empresa: {
    icon: Building2,
    tone: "brand",
    label: "Objetivos de empresa",
    tagline: "Resultados de toda la compañía. No se asignan a nadie en particular.",
  },
  grupal: {
    icon: UsersRound,
    tone: "brand",
    label: "Objetivos para un grupo",
    tagline: "Objetivos propios de equipo, alineados a los de empresa, para el área que elijas.",
  },
  individual: {
    icon: UserRound,
    tone: "brand",
    label: "Objetivos individuales",
    tagline: "Objetivos propios de persona, alineados a los de empresa, para quien elijas.",
  },
};
