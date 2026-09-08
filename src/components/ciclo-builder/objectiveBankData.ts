import type { MeasureType, ObjectiveDirection } from "./cicloBuilderTypes";
import {
  BANK_AREA_VISUAL,
  type ObjectiveBankArea,
  type ObjectiveBankItem,
  type ObjectiveScope,
} from "./objectiveBankTypes";

/**
 * El contenido del banco de objetivos.
 *
 * Seis áreas, tres temas cada una, y dentro de cada tema los objetivos ya
 * escritos en los tres alcances: los de la compañía, los que se le entregan a
 * un área, y los que puede cargar una sola persona. El mismo tema visto desde
 * tres alturas —"la facturación del negocio", "la facturación de mi área",
 * "los negocios que yo cierro"— porque eso es exactamente lo que cambia entre
 * un paso del constructor y el siguiente.
 *
 * Las cifras son las del nivel retador; `bankItemValues` deriva de ahí las
 * conservadoras y las agresivas. Son cifras de referencia, no promesas: quien
 * use el banco va a tener que poner las suyas, y para eso están al lado del
 * texto y no escondidas.
 */

/**
 * Una entrada, en una línea.
 *
 * Ciento y pico objetivos escritos como objetos completos serían mil líneas
 * de llaves donde lo único que se quiere leer es la frase. Con la fábrica, un
 * tema entero cabe en pantalla y se puede revisar de un vistazo — que es la
 * única forma de detectar que dos objetivos dicen lo mismo.
 *
 * @param id      único en todo el banco
 * @param scope   a quién se le pone
 * @param title   el objetivo, como lo leería quien lo va a cumplir
 * @param description qué se está midiendo exactamente
 * @param measure cómo se expresa el resultado
 * @param direction hacia dónde tiene que moverse — null en los de hito
 * @param initial dónde arranca
 * @param target  a dónde llega en el nivel retador
 */
const item = (
  id: string,
  scope: ObjectiveScope,
  title: string,
  description: string,
  measure: MeasureType,
  direction: ObjectiveDirection | null,
  initial = 0,
  target = 0
): ObjectiveBankItem => ({ id, scope, title, description, measure, direction, initial, target });

const COMERCIAL: ObjectiveBankArea = {
  id: "comercial",
  name: "Comercial",
  ...BANK_AREA_VISUAL.comercial,
  themes: [
    {
      id: "comercial-ventas",
      name: "Ventas",
      description: "Cuánto se factura y a qué ritmo",
      items: [
        item("com-ven-e1", "empresa", "Aumentar la facturación de la compañía", "Ventas cerradas en todo el negocio dentro de la ventana del ciclo.", "money", "increase", 500_000_000, 650_000_000),
        item("com-ven-e2", "empresa", "Subir el ticket promedio de venta", "Valor medio de cada negocio cerrado en el periodo.", "money", "increase", 4_200_000, 5_500_000),
        item("com-ven-e3", "empresa", "Mejorar la tasa de conversión del pipeline", "Oportunidades que terminan en venta sobre el total trabajado.", "percentage", "increase", 18, 28),
        item("com-ven-g1", "grupo", "Aumentar las ventas del área", "Facturación cerrada por este equipo dentro de la ventana del ciclo.", "money", "increase", 120_000_000, 160_000_000),
        item("com-ven-g2", "grupo", "Acortar el ciclo de venta del equipo", "Días promedio entre el primer contacto y la firma.", "numeric", "decrease", 45, 30),
        item("com-ven-i1", "individual", "Cerrar mi cuota del periodo", "Facturación firmada a mi nombre dentro del ciclo.", "money", "increase", 25_000_000, 35_000_000),
        item("com-ven-i2", "individual", "Sostener mi pipeline mínimo", "Oportunidades abiertas y con fecha de cierre en mi cartera.", "numeric", "increase", 8, 14),
      ],
    },
    {
      id: "comercial-clientes",
      name: "Clientes nuevos",
      description: "Cuentas que entran por primera vez",
      items: [
        item("com-cli-e1", "empresa", "Sumar clientes nuevos", "Cuentas que firman por primera vez, sin contar renovaciones.", "numeric", "increase", 18, 30),
        item("com-cli-e2", "empresa", "Abrir una nueva línea de negocio", "Hito: se cumple cuando la primera venta de esa línea está firmada.", "boolean", null),
        item("com-cli-e3", "empresa", "Crecer la facturación de cuentas nuevas", "Ingresos aportados solo por clientes de primer año.", "money", "increase", 90_000_000, 140_000_000),
        item("com-cli-g1", "grupo", "Abrir cuentas nuevas en el territorio", "Clientes de primera vez conseguidos por este equipo.", "numeric", "increase", 6, 12),
        item("com-cli-g2", "grupo", "Subir las reuniones con prospectos nuevos", "Primeras reuniones agendadas y realizadas por el equipo.", "numeric", "increase", 30, 50),
        item("com-cli-i1", "individual", "Traer clientes nuevos a mi cartera", "Cuentas que firmo por primera vez en el periodo.", "numeric", "increase", 2, 5),
        item("com-cli-i2", "individual", "Hacer prospección todas las semanas", "Contactos nuevos trabajados por mí durante el ciclo.", "numeric", "increase", 40, 80),
      ],
    },
    {
      id: "comercial-retencion",
      name: "Retención",
      description: "Cuentas que se quedan y crecen",
      items: [
        item("com-ret-e1", "empresa", "Bajar la pérdida de cuentas", "Porcentaje de clientes activos que no renuevan en el periodo.", "percentage", "decrease", 12, 6),
        item("com-ret-e2", "empresa", "Subir la renovación de contratos", "Contratos renovados sobre los que vencían en el ciclo.", "percentage", "increase", 78, 90),
        item("com-ret-e3", "empresa", "Crecer la facturación de la base actual", "Ingresos adicionales vendidos a clientes que ya estaban.", "money", "increase", 60_000_000, 95_000_000),
        item("com-ret-g1", "grupo", "Retener las cuentas del área", "Clientes del equipo que siguen activos al cierre del ciclo.", "percentage", "increase", 82, 92),
        item("com-ret-g2", "grupo", "Recuperar cuentas en riesgo", "Clientes marcados en riesgo que el equipo devuelve a estado sano.", "numeric", "increase", 3, 8),
        item("com-ret-i1", "individual", "Renovar mis contratos del periodo", "Contratos a mi nombre que vencen y quedan firmados de nuevo.", "percentage", "increase", 80, 95),
        item("com-ret-i2", "individual", "Visitar a mis cuentas clave", "Reuniones de seguimiento hechas con mis cuentas principales.", "numeric", "increase", 6, 12),
      ],
    },
  ],
};

const MARKETING: ObjectiveBankArea = {
  id: "marketing",
  name: "Marketing",
  ...BANK_AREA_VISUAL.marketing,
  themes: [
    {
      id: "marketing-demanda",
      name: "Demanda",
      description: "Oportunidades que llegan al comercial",
      items: [
        item("mkt-dem-e1", "empresa", "Generar oportunidades calificadas", "Contactos que el equipo comercial acepta como oportunidad real.", "numeric", "increase", 120, 200),
        item("mkt-dem-e2", "empresa", "Subir el tráfico a los canales propios", "Visitas únicas al sitio y a las páginas de producto.", "numeric", "increase", 25_000, 40_000),
        item("mkt-dem-e3", "empresa", "Mejorar la conversión del sitio", "Visitantes que dejan sus datos sobre el total que llega.", "percentage", "increase", 2, 4),
        item("mkt-dem-g1", "grupo", "Aportar oportunidades desde el equipo", "Oportunidades calificadas atribuidas a las campañas del área.", "numeric", "increase", 45, 75),
        item("mkt-dem-g2", "grupo", "Sostener el calendario de contenidos", "Piezas publicadas por el equipo dentro del periodo.", "numeric", "increase", 12, 20),
        item("mkt-dem-i1", "individual", "Publicar mis piezas del periodo", "Contenidos que salgo a producir y publicar yo.", "numeric", "increase", 4, 8),
        item("mkt-dem-i2", "individual", "Mejorar el desempeño de mis campañas", "Clics sobre impresiones de las campañas que gestiono.", "percentage", "increase", 1, 3),
      ],
    },
    {
      id: "marketing-adquisicion",
      name: "Costo de adquisición",
      description: "Cuánto cuesta cada cliente que entra",
      items: [
        item("mkt-cac-e1", "empresa", "Reducir el costo por oportunidad", "Inversión en pauta y contenidos dividida entre las oportunidades logradas.", "money", "decrease", 180_000, 120_000),
        item("mkt-cac-e2", "empresa", "Bajar el costo de adquirir un cliente", "Todo lo invertido en marketing y ventas por cada cliente nuevo.", "money", "decrease", 2_400_000, 1_700_000),
        item("mkt-cac-e3", "empresa", "Subir el peso de los canales orgánicos", "Oportunidades que llegan sin pauta sobre el total.", "percentage", "increase", 30, 45),
        item("mkt-cac-g1", "grupo", "Optimizar el gasto de pauta del área", "Inversión ejecutada por el equipo frente a la aprobada.", "percentage", "decrease", 108, 100),
        item("mkt-cac-g2", "grupo", "Bajar el costo por clic del equipo", "Costo medio de cada clic en las campañas gestionadas.", "money", "decrease", 1_800, 1_200),
        item("mkt-cac-i1", "individual", "Bajar el costo por lead de mis campañas", "Inversión dividida entre los contactos que consigo.", "money", "decrease", 95_000, 65_000),
        item("mkt-cac-i2", "individual", "Cerrar el reporte de inversión a tiempo", "Hito: se cumple cuando el reporte del periodo queda entregado.", "boolean", null),
      ],
    },
    {
      id: "marketing-marca",
      name: "Marca y lanzamientos",
      description: "Qué tanto se conoce y qué sale al mercado",
      items: [
        item("mkt-mar-e1", "empresa", "Lanzar la nueva marca de producto", "Hito de lanzamiento: se cumple cuando la marca sale al mercado.", "boolean", null),
        item("mkt-mar-e2", "empresa", "Subir el reconocimiento de marca", "Resultado del estudio de recordación aplicado en el periodo.", "percentage", "increase", 34, 45),
        item("mkt-mar-e3", "empresa", "Crecer la comunidad propia", "Suscriptores y seguidores sumados en los canales de la marca.", "numeric", "increase", 12_000, 20_000),
        item("mkt-mar-g1", "grupo", "Ejecutar los lanzamientos del periodo", "Lanzamientos del área entregados dentro de la fecha comprometida.", "percentage", "increase", 70, 90),
        item("mkt-mar-g2", "grupo", "Subir la interacción en los canales", "Interacciones sobre alcance en las publicaciones del equipo.", "percentage", "increase", 3, 6),
        item("mkt-mar-i1", "individual", "Entregar mi lanzamiento a tiempo", "Hito: se cumple cuando la pieza de la que respondo sale publicada.", "boolean", null),
        item("mkt-mar-i2", "individual", "Sumar menciones de marca", "Menciones conseguidas en medios o aliados gestionadas por mí.", "numeric", "increase", 3, 8),
      ],
    },
  ],
};

const SERVICIO: ObjectiveBankArea = {
  id: "servicio",
  name: "Servicio al cliente",
  ...BANK_AREA_VISUAL.servicio,
  themes: [
    {
      id: "servicio-satisfaccion",
      name: "Satisfacción",
      description: "Qué tan bien queda el cliente",
      items: [
        item("srv-sat-e1", "empresa", "Subir la satisfacción del cliente", "Promedio de la encuesta de satisfacción posterior a cada caso atendido.", "percentage", "increase", 78, 90),
        item("srv-sat-e2", "empresa", "Mejorar el NPS de la compañía", "Recomendadores menos detractores en la medición del periodo.", "numeric", "increase", 22, 40),
        item("srv-sat-e3", "empresa", "Bajar las quejas formales", "Reclamos escalados a instancia formal en el periodo.", "numeric", "decrease", 60, 30),
        item("srv-sat-g1", "grupo", "Subir la satisfacción de los casos del área", "Calificación media de los casos atendidos por este equipo.", "percentage", "increase", 80, 92),
        item("srv-sat-g2", "grupo", "Bajar los casos reabiertos", "Casos que el cliente vuelve a abrir tras darlos por cerrados.", "percentage", "decrease", 14, 6),
        item("srv-sat-i1", "individual", "Mantener alta la calificación de mis casos", "Promedio de las encuestas de los casos que atiendo yo.", "percentage", "increase", 82, 93),
        item("srv-sat-i2", "individual", "Reducir mis casos reabiertos", "Casos míos que el cliente vuelve a abrir.", "numeric", "decrease", 8, 3),
      ],
    },
    {
      id: "servicio-tiempos",
      name: "Tiempos de respuesta",
      description: "Cuánto espera el cliente",
      items: [
        item("srv-tie-e1", "empresa", "Reducir el tiempo de primera respuesta", "Horas promedio entre la llegada de un caso y la primera respuesta real.", "numeric", "decrease", 8, 3),
        item("srv-tie-e2", "empresa", "Bajar el tiempo total de solución", "Horas promedio entre la apertura y el cierre de un caso.", "numeric", "decrease", 48, 24),
        item("srv-tie-e3", "empresa", "Cumplir los acuerdos de servicio", "Casos atendidos dentro del tiempo comprometido con el cliente.", "percentage", "increase", 82, 95),
        item("srv-tie-g1", "grupo", "Responder más rápido en el área", "Horas promedio de primera respuesta de los casos del equipo.", "numeric", "decrease", 6, 2),
        item("srv-tie-g2", "grupo", "Bajar la cola de casos pendientes", "Casos abiertos sin atender al cierre de cada semana.", "numeric", "decrease", 40, 15),
        item("srv-tie-i1", "individual", "Responder mis casos el mismo día", "Casos míos con primera respuesta dentro de la jornada.", "percentage", "increase", 75, 92),
        item("srv-tie-i2", "individual", "Cerrar mis casos pendientes", "Casos abiertos a mi nombre al final del periodo.", "numeric", "decrease", 20, 6),
      ],
    },
    {
      id: "servicio-resolucion",
      name: "Resolución",
      description: "Cuántas veces hace falta volver",
      items: [
        item("srv-res-e1", "empresa", "Resolver en el primer contacto", "Casos cerrados sin necesidad de una segunda interacción.", "percentage", "increase", 55, 75),
        item("srv-res-e2", "empresa", "Bajar los casos escalados", "Casos que hay que subir a un segundo nivel para resolverlos.", "percentage", "decrease", 25, 12),
        item("srv-res-e3", "empresa", "Publicar la base de autoservicio", "Hito: se cumple cuando el centro de ayuda queda abierto al cliente.", "boolean", null),
        item("srv-res-g1", "grupo", "Subir la resolución del área", "Casos que el equipo cierra sin escalar a nadie más.", "percentage", "increase", 60, 80),
        item("srv-res-g2", "grupo", "Documentar las soluciones frecuentes", "Artículos de ayuda publicados por el equipo en el periodo.", "numeric", "increase", 10, 25),
        item("srv-res-i1", "individual", "Resolver sin escalar", "Casos míos cerrados sin pasar a otro nivel.", "percentage", "increase", 65, 85),
        item("srv-res-i2", "individual", "Aportar a la base de conocimiento", "Artículos de ayuda que escribo durante el ciclo.", "numeric", "increase", 2, 6),
      ],
    },
  ],
};

const OPERACIONES: ObjectiveBankArea = {
  id: "operaciones",
  name: "Operaciones",
  ...BANK_AREA_VISUAL.operaciones,
  themes: [
    {
      id: "operaciones-productividad",
      name: "Productividad",
      description: "Cuánto sale con lo que hay",
      items: [
        item("ope-pro-e1", "empresa", "Subir la producción del periodo", "Unidades terminadas y aceptadas al cierre del ciclo.", "numeric", "increase", 12_000, 16_000),
        item("ope-pro-e2", "empresa", "Mejorar el uso de la capacidad instalada", "Capacidad realmente utilizada sobre la disponible.", "percentage", "increase", 68, 82),
        item("ope-pro-e3", "empresa", "Reducir los tiempos muertos", "Horas de planta detenida sobre las horas programadas.", "percentage", "decrease", 15, 7),
        item("ope-pro-g1", "grupo", "Subir la producción del turno", "Unidades terminadas por este equipo dentro del ciclo.", "numeric", "increase", 2_400, 3_200),
        item("ope-pro-g2", "grupo", "Bajar los paros del área", "Horas de parada no programada del equipo.", "numeric", "decrease", 40, 18),
        item("ope-pro-i1", "individual", "Cumplir mi meta de producción", "Unidades terminadas por mí dentro del periodo.", "numeric", "increase", 400, 550),
        item("ope-pro-i2", "individual", "Completar mi certificación de proceso", "Hito: se cumple cuando la certificación queda aprobada.", "boolean", null),
      ],
    },
    {
      id: "operaciones-costos",
      name: "Costos",
      description: "Cuánto cuesta cada unidad que sale",
      items: [
        item("ope-cos-e1", "empresa", "Reducir el costo por unidad producida", "Costo directo promedio de cada unidad que sale del proceso.", "money", "decrease", 12_000, 9_500),
        item("ope-cos-e2", "empresa", "Bajar el desperdicio de material", "Material perdido sobre el material consumido.", "percentage", "decrease", 8, 4),
        item("ope-cos-e3", "empresa", "Reducir el gasto de mantenimiento correctivo", "Gasto en reparaciones no planeadas del periodo.", "money", "decrease", 85_000_000, 55_000_000),
        item("ope-cos-g1", "grupo", "Bajar el desperdicio del área", "Material perdido en el proceso de este equipo.", "percentage", "decrease", 9, 5),
        item("ope-cos-g2", "grupo", "Cumplir el presupuesto del área", "Gasto ejecutado por el equipo frente al aprobado.", "percentage", "decrease", 110, 100),
        item("ope-cos-i1", "individual", "Reducir mi desperdicio", "Material perdido en las unidades que yo proceso.", "percentage", "decrease", 7, 3),
        item("ope-cos-i2", "individual", "Reportar mis consumos a tiempo", "Registros de consumo cargados dentro de la fecha.", "percentage", "increase", 80, 98),
      ],
    },
    {
      id: "operaciones-calidad",
      name: "Calidad y entregas",
      description: "Qué tan bien y qué tan a tiempo",
      items: [
        item("ope-cal-e1", "empresa", "Bajar la tasa de reprocesos", "Órdenes que hay que rehacer sobre el total producido.", "percentage", "decrease", 9, 4),
        item("ope-cal-e2", "empresa", "Cumplir las entregas a tiempo", "Órdenes despachadas dentro de la fecha prometida al cliente.", "percentage", "increase", 82, 95),
        item("ope-cal-e3", "empresa", "Obtener la certificación de calidad", "Hito: se cumple cuando la auditoría externa queda aprobada.", "boolean", null),
        item("ope-cal-g1", "grupo", "Bajar los rechazos del área", "Unidades rechazadas en control de calidad sobre las entregadas.", "percentage", "decrease", 6, 2),
        item("ope-cal-g2", "grupo", "Entregar a tiempo desde el equipo", "Órdenes del equipo despachadas dentro de la fecha.", "percentage", "increase", 85, 96),
        item("ope-cal-i1", "individual", "Reducir mis unidades rechazadas", "Unidades mías devueltas por control de calidad.", "numeric", "decrease", 15, 5),
        item("ope-cal-i2", "individual", "Cerrar mis órdenes dentro de la fecha", "Órdenes a mi cargo terminadas antes del vencimiento.", "percentage", "increase", 85, 97),
      ],
    },
  ],
};

const FINANZAS: ObjectiveBankArea = {
  id: "finanzas",
  name: "Finanzas",
  ...BANK_AREA_VISUAL.finanzas,
  themes: [
    {
      id: "finanzas-rentabilidad",
      name: "Rentabilidad",
      description: "Cuánto queda de lo que entra",
      items: [
        item("fin-ren-e1", "empresa", "Subir el margen bruto", "Margen sobre ventas del periodo, después de costo directo.", "percentage", "increase", 34, 42),
        item("fin-ren-e2", "empresa", "Mejorar el resultado operativo", "Utilidad operativa del negocio en la ventana del ciclo.", "money", "increase", 180_000_000, 260_000_000),
        item("fin-ren-e3", "empresa", "Subir el margen de la línea principal", "Margen del producto o servicio que más pesa en la venta.", "percentage", "increase", 28, 36),
        item("fin-ren-g1", "grupo", "Mejorar el margen del área", "Margen de los negocios cerrados por este equipo.", "percentage", "increase", 30, 38),
        item("fin-ren-g2", "grupo", "Bajar los descuentos otorgados", "Descuento promedio concedido sobre el precio de lista.", "percentage", "decrease", 12, 6),
        item("fin-ren-i1", "individual", "Cuidar el margen de mis negocios", "Margen promedio de los negocios que cierro yo.", "percentage", "increase", 29, 37),
        item("fin-ren-i2", "individual", "Bajar mis descuentos", "Descuento promedio que concedo sobre el precio de lista.", "percentage", "decrease", 14, 7),
      ],
    },
    {
      id: "finanzas-cartera",
      name: "Cartera",
      description: "Lo que está por cobrar",
      items: [
        item("fin-car-e1", "empresa", "Reducir la cartera vencida", "Saldo por cobrar con más de 60 días de mora.", "money", "decrease", 320_000_000, 150_000_000),
        item("fin-car-e2", "empresa", "Bajar los días de recaudo", "Días promedio entre la factura y el pago recibido.", "numeric", "decrease", 62, 40),
        item("fin-car-e3", "empresa", "Subir el recaudo del periodo", "Dinero efectivamente cobrado dentro del ciclo.", "money", "increase", 400_000_000, 520_000_000),
        item("fin-car-g1", "grupo", "Bajar la mora de las cuentas del área", "Cartera vencida de los clientes que atiende este equipo.", "money", "decrease", 80_000_000, 40_000_000),
        item("fin-car-g2", "grupo", "Cerrar los acuerdos de pago pendientes", "Acuerdos formalizados con clientes en mora.", "numeric", "increase", 5, 12),
        item("fin-car-i1", "individual", "Recaudar mi cartera del periodo", "Dinero cobrado de los clientes a mi cargo.", "money", "increase", 60_000_000, 85_000_000),
        item("fin-car-i2", "individual", "Bajar la mora de mis clientes", "Saldo vencido de las cuentas que gestiono.", "money", "decrease", 18_000_000, 8_000_000),
      ],
    },
    {
      id: "finanzas-gasto",
      name: "Gasto",
      description: "Qué tanto se ejecuta de lo aprobado",
      items: [
        item("fin-gas-e1", "empresa", "Cumplir el presupuesto de gasto", "Gasto ejecutado frente al aprobado para el periodo.", "percentage", "decrease", 108, 100),
        item("fin-gas-e2", "empresa", "Reducir el gasto administrativo", "Gasto de estructura del periodo, sin contar el costo directo.", "money", "decrease", 240_000_000, 190_000_000),
        item("fin-gas-e3", "empresa", "Implantar el nuevo control de gasto", "Hito: se cumple cuando el flujo de aprobación queda en operación.", "boolean", null),
        item("fin-gas-g1", "grupo", "Ejecutar el presupuesto del área sin desviarse", "Gasto del equipo frente al presupuesto que le fue asignado.", "percentage", "decrease", 112, 100),
        item("fin-gas-g2", "grupo", "Bajar el gasto en proveedores externos", "Contratación externa del área durante el ciclo.", "money", "decrease", 45_000_000, 30_000_000),
        item("fin-gas-i1", "individual", "Legalizar mis gastos a tiempo", "Gastos reportados dentro del plazo establecido.", "percentage", "increase", 70, 95),
        item("fin-gas-i2", "individual", "Cerrar mi presupuesto sin sobregiro", "Hito: se cumple si termino el ciclo dentro de lo aprobado.", "boolean", null),
      ],
    },
  ],
};

const GENTE: ObjectiveBankArea = {
  id: "gente",
  name: "Gente y cultura",
  ...BANK_AREA_VISUAL.gente,
  themes: [
    {
      id: "gente-rotacion",
      name: "Rotación",
      description: "Quién se queda y quién se va",
      items: [
        item("gen-rot-e1", "empresa", "Reducir la rotación voluntaria", "Personas que renuncian sobre la planta promedio del periodo.", "percentage", "decrease", 18, 10),
        item("gen-rot-e2", "empresa", "Bajar la rotación del primer año", "Salidas de personas con menos de doce meses en la compañía.", "percentage", "decrease", 26, 15),
        item("gen-rot-e3", "empresa", "Cubrir las vacantes abiertas", "Posiciones cerradas dentro del tiempo objetivo de selección.", "percentage", "increase", 60, 85),
        item("gen-rot-g1", "grupo", "Retener al equipo del área", "Personas del equipo que siguen al cierre del ciclo.", "percentage", "increase", 85, 95),
        item("gen-rot-g2", "grupo", "Acortar el tiempo de cubrimiento", "Días promedio para llenar una vacante del área.", "numeric", "decrease", 55, 35),
        item("gen-rot-i1", "individual", "Cerrar mis procesos de selección", "Vacantes a mi cargo cubiertas dentro del periodo.", "numeric", "increase", 4, 8),
        item("gen-rot-i2", "individual", "Terminar mi plan de sucesión", "Hito: se cumple cuando el plan queda documentado y aprobado.", "boolean", null),
      ],
    },
    {
      id: "gente-clima",
      name: "Clima y compromiso",
      description: "Cómo se siente la gente trabajando",
      items: [
        item("gen-cli-e1", "empresa", "Subir la favorabilidad de clima", "Resultado de la medición de clima organizacional del periodo.", "percentage", "increase", 72, 85),
        item("gen-cli-e2", "empresa", "Mejorar el eNPS de la compañía", "Qué tanto recomiendan los colaboradores a la empresa como lugar de trabajo.", "numeric", "increase", 18, 35),
        item("gen-cli-e3", "empresa", "Subir la participación en la encuesta", "Colaboradores que responden la medición sobre los convocados.", "percentage", "increase", 65, 85),
        item("gen-cli-g1", "grupo", "Subir el clima del área", "Favorabilidad de la medición dentro de este equipo.", "percentage", "increase", 70, 84),
        item("gen-cli-g2", "grupo", "Cerrar los planes de acción del área", "Compromisos del plan de clima ejecutados por el equipo.", "percentage", "increase", 40, 80),
        item("gen-cli-i1", "individual", "Hacer mis conversaciones de seguimiento", "Reuniones uno a uno sostenidas con cada persona a mi cargo.", "numeric", "increase", 6, 12),
        item("gen-cli-i2", "individual", "Cerrar el plan de acción de mi equipo", "Hito: se cumple cuando los compromisos quedan ejecutados.", "boolean", null),
      ],
    },
    {
      id: "gente-formacion",
      name: "Formación",
      description: "Qué aprende la gente en el ciclo",
      items: [
        item("gen-for-e1", "empresa", "Cerrar los planes de formación", "Colaboradores que completan la ruta de formación asignada.", "percentage", "increase", 45, 80),
        item("gen-for-e2", "empresa", "Subir las horas de formación por persona", "Horas de aprendizaje promedio por colaborador en el periodo.", "numeric", "increase", 8, 16),
        item("gen-for-e3", "empresa", "Lanzar la escuela de líderes", "Hito: se cumple cuando la primera cohorte arranca.", "boolean", null),
        item("gen-for-g1", "grupo", "Completar la ruta del área", "Personas del equipo que terminan la formación asignada.", "percentage", "increase", 50, 85),
        item("gen-for-g2", "grupo", "Certificar al equipo en la nueva herramienta", "Miembros del equipo con la certificación aprobada.", "percentage", "increase", 30, 80),
        item("gen-for-i1", "individual", "Completar mi ruta de formación", "Cursos de mi plan terminados dentro del ciclo.", "percentage", "increase", 40, 100),
        item("gen-for-i2", "individual", "Obtener mi certificación", "Hito: se cumple cuando apruebo la certificación acordada.", "boolean", null),
      ],
    },
  ],
};

export const OBJECTIVE_BANK: readonly ObjectiveBankArea[] = [
  COMERCIAL,
  MARKETING,
  SERVICIO,
  OPERACIONES,
  FINANZAS,
  GENTE,
];

/** Cuántos objetivos hay escritos para este alcance — la cifra que el banco
 *  promete en su cabecera, contada y no prometida. */
export const bankItemCount = (scope: ObjectiveScope): number =>
  OBJECTIVE_BANK.reduce(
    (total, area) =>
      total +
      area.themes.reduce(
        (areaTotal, theme) =>
          areaTotal + theme.items.filter((entry) => entry.scope === scope).length,
        0
      ),
    0
  );

/** Todas las entradas de un alcance, planas — para buscar sin recorrer el
 *  árbol tres veces en cada tecla. */
export const bankItemsForScope = (
  scope: ObjectiveScope
): readonly (ObjectiveBankItem & { areaName: string; themeName: string })[] =>
  OBJECTIVE_BANK.flatMap((area) =>
    area.themes.flatMap((theme) =>
      theme.items
        .filter((entry) => entry.scope === scope)
        .map((entry) => ({ ...entry, areaName: area.name, themeName: theme.name }))
    )
  );
