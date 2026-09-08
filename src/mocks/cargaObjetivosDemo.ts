/**
 * Directorio de demostración para la carga masiva de objetivos.
 *
 * Los archivos de `demo-samples/objetivos/` nombran a estas personas por
 * username, correo, documento, nombre o teléfono, así que el match contra el
 * ciclo es real: si cambias un identificador aquí, cambia también el archivo
 * (`node scripts/generate-objetivos-samples.cjs` los regenera).
 *
 * Dos listas, porque la revisión distingue dos cosas:
 *
 *  - `DEMO_CYCLE_ROSTER`: gente que ya está asignada al ciclo. Los últimos seis
 *    traen sus objetivos escritos uno por uno, porque son contra los que la
 *    carga tiene que chocar: la regla del 100% es sobre todo lo que carga una
 *    persona, y editar o actualizar exige nombres reales contra los que buscar.
 *  - `DEMO_UBITS_DIRECTORY`: usuarios de UBITS que NO están en el ciclo. Sirven
 *    para el selector de personas y para los casos de "posible alineación": un
 *    correo personal o un documento con un dígito de más caen aquí como
 *    propuesta en vez de como match confirmado.
 */

import type { RosterUser } from "@/lib/objectivesImport";

export const DEMO_CYCLE_ROSTER: readonly RosterUser[] = [
  {
    username: "usercreadorqa@example.co",
    name: "Cursos Empresariales 3099 - Prueba QA",
    email: "usercreadorqa@example.co",
    area: "Comercial",
    leader: "Marta Forero",
    phone: "3018876540",
  },
  {
    username: "martica",
    name: "marta forero",
    email: "martica1@example.co",
    area: "People",
    leader: "Cristian Rincón",
    phone: "3122019987",
  },
  {
    username: "jlopezsincrorolesypermisos01@example.co",
    name: "Jorge Lopez",
    email: "jlopezsincrorolesypermisos01@example.co",
    area: "Operaciones",
    leader: "Marta Forero",
    phone: "3134470012",
  },
  {
    username: "surveys19",
    name: "Alejandro Ramírez",
    email: "surveys19@example.co",
    area: "Comercial",
    leader: "Marta Forero",
    phone: "3009912238",
  },
  {
    username: "crrincon@example.co",
    name: "Cristian Rincón",
    email: "crrincon@example.co",
    area: "Tecnología",
    phone: "3176654420",
  },
  {
    username: "pobjetivos",
    name: "prueba hhhhh objetivos",
    email: "pobjetivos@example.co",
    area: "QA",
    leader: "Alejandro Ramírez",
    phone: "3193328870",
  },
  /*
    Sofía ya no tiene espacio: sus tres objetivos reparten el 100% completo.
    Cualquier objetivo que le agregue un archivo la pasa del límite, así que el
    revisor tiene que decidir de dónde sale el peso.
  */
  {
    username: "svalencia",
    name: "Sofía Valencia Ortiz",
    email: "svalencia@example.co",
    area: "Comercial",
    leader: "Marta Forero",
    phone: "3143398821",
    cycleObjectives: [
      {
        id: "obj-sv-01",
        title: "Sostener la cuota mensual del canal directo",
        weightPercent: 45,
        measureType: "Dinero",
        trend: "Aumentar",
        initialValue: 180000000,
        target: 240000000,
        minProgress: 200000000,
        maxProgress: 280000000,
        description: "Facturación cerrada por el equipo directo, mes a mes.",
        currentProgress: 205000000,
      },
      {
        id: "obj-sv-02",
        title: "Elevar el ticket promedio por cliente",
        weightPercent: 35,
        measureType: "Dinero",
        trend: "Aumentar",
        initialValue: 3200000,
        target: 4100000,
        minProgress: null,
        maxProgress: null,
        description: "Valor promedio de los contratos firmados en el ciclo.",
        currentProgress: 3650000,
      },
      {
        id: "obj-sv-03",
        title: "Mantener la satisfacción posventa",
        weightPercent: 20,
        measureType: "Porcentaje",
        trend: "Aumentar",
        initialValue: 86,
        target: 93,
        minProgress: 90,
        maxProgress: 97,
        description: "CSAT de los clientes atendidos después de la firma.",
        currentProgress: 88,
      },
    ],
  },
  /*
    Mauricio va a medias: 55% repartido y 45% libre. Un archivo que le trae 60%
    se pasa por poco — el caso más común, y el que se arregla con un ajuste
    pequeño en cualquiera de los dos lados.
  */
  {
    username: "mtoro@example.co",
    name: "Mauricio Toro Gil",
    email: "mtoro@example.co",
    area: "Finanzas",
    leader: "Cristian Rincón",
    phone: "3178840217",
    cycleObjectives: [
      {
        id: "obj-mt-01",
        title: "Cerrar el presupuesto anual sin desviaciones",
        weightPercent: 30,
        measureType: "Porcentaje",
        trend: "Reducir",
        initialValue: 8.4,
        target: 3,
        minProgress: 6,
        maxProgress: 1,
        description: "Desviación entre lo presupuestado y lo ejecutado.",
        currentProgress: 6.8,
      },
      {
        id: "obj-mt-02",
        title: "Reducir los días de cartera vencida",
        weightPercent: 25,
        measureType: "Numérico",
        trend: "Reducir",
        initialValue: 62,
        target: 38,
        minProgress: 50,
        maxProgress: 30,
        description: "Promedio de días de mora de la cartera activa.",
        // Sin avance a propósito: nadie ha reportado sobre este objetivo, que
        // no es lo mismo que haber reportado 0.
      },
    ],
  },
  /*
    Ana es el contraejemplo: ya tiene un objetivo al 60% y el archivo le trae
    justo el 40% que falta. Sin este caso, "ya tiene objetivos" se leería como
    sinónimo de error.
  */
  {
    username: "apineda",
    name: "Ana Pineda Rojas",
    email: "apineda@example.co",
    area: "People",
    leader: "Marta Forero",
    phone: "3005514402",
    cycleObjectives: [
      {
        id: "obj-ap-01",
        title: "Implementar el nuevo modelo de desempeño",
        weightPercent: 60,
        measureType: "Porcentaje",
        trend: "Aumentar",
        initialValue: 0,
        target: 100,
        minProgress: 70,
        maxProgress: null,
        description: "Áreas que ya evalúan con el modelo nuevo.",
        currentProgress: 35,
      },
    ],
  },
  /*
    Los tres siguientes existen para las cargas de EDICIÓN y ACTUALIZACIÓN. Sus
    objetivos reparten exactamente 100%, y los nombres están escritos para que
    el matcher tenga trabajo real: "Reducir el costo de infraestructura mensual"
    pierde el "mensual" al retranscribirse, y los dos "embudos" de Lucía
    comparten todo menos la última palabra.
  */
  {
    username: "evargas@example.co",
    name: "Esteban Vargas Luna",
    email: "evargas@example.co",
    area: "Tecnología",
    leader: "Cristian Rincón",
    phone: "3182270099",
    cycleObjectives: [
      {
        id: "obj-ev-01",
        title: "Reducir el costo de infraestructura mensual",
        weightPercent: 30,
        measureType: "Dinero",
        trend: "Reducir",
        initialValue: 84000000,
        target: 62000000,
        minProgress: 78000000,
        maxProgress: 55000000,
        description: "Factura promedio de nube por mes.",
        currentProgress: 79000000,
      },
      {
        id: "obj-ev-02",
        title: "Subir la cobertura de pruebas automatizadas",
        weightPercent: 30,
        measureType: "Porcentaje",
        trend: "Aumentar",
        initialValue: 48,
        target: 82,
        minProgress: 65,
        maxProgress: 92,
        description: "Líneas cubiertas en el repositorio principal.",
        currentProgress: 61,
      },
      {
        id: "obj-ev-03",
        title: "Bajar el tiempo de respuesta del API",
        weightPercent: 25,
        measureType: "Numérico",
        trend: "Reducir",
        initialValue: 480,
        target: 220,
        minProgress: 400,
        maxProgress: 180,
        description: "Latencia p95 en milisegundos.",
        currentProgress: 395,
      },
      {
        id: "obj-ev-04",
        title: "Documentar los servicios críticos",
        weightPercent: 15,
        measureType: "Se cumple / No se cumple",
        trend: "Aumentar",
        initialValue: 0,
        target: 1,
        minProgress: null,
        maxProgress: null,
        description: "Se cumple con el inventario documentado y revisado.",
        currentProgress: 0,
      },
    ],
  },
  {
    username: "lcastillo",
    name: "Lucía Castillo Peña",
    email: "lucia.castillo@example.co",
    area: "Comercial",
    leader: "Marta Forero",
    phone: "3126650481",
    cycleObjectives: [
      {
        id: "obj-lc-01",
        title: "Aumentar la conversión del embudo comercial",
        weightPercent: 40,
        measureType: "Porcentaje",
        trend: "Aumentar",
        initialValue: 12,
        target: 19,
        minProgress: 15,
        maxProgress: 24,
        description: "Oportunidades cerradas sobre oportunidades creadas.",
        currentProgress: 14,
      },
      {
        id: "obj-lc-02",
        title: "Aumentar la conversión del embudo de marketing",
        weightPercent: 35,
        measureType: "Porcentaje",
        trend: "Aumentar",
        initialValue: 4.2,
        target: 7,
        minProgress: 5.5,
        maxProgress: 9,
        description: "Leads que llegan a oportunidad calificada.",
        currentProgress: 5.1,
      },
      {
        id: "obj-lc-03",
        title: "Reducir el ciclo de venta promedio",
        weightPercent: 25,
        measureType: "Numérico",
        trend: "Reducir",
        initialValue: 68,
        target: 42,
        minProgress: 58,
        maxProgress: 35,
        description: "Días entre el primer contacto y la firma.",
        currentProgress: 59,
      },
    ],
  },
  {
    username: "jromero@example.co",
    name: "Javier Romero Díaz",
    email: "jromero@example.co",
    area: "Operaciones",
    leader: "Alejandro Ramírez",
    phone: "3007719964",
    cycleObjectives: [
      {
        id: "obj-jr-01",
        title: "Ampliar la cobertura de rutas atendidas",
        weightPercent: 55,
        measureType: "Numérico",
        trend: "Aumentar",
        initialValue: 14,
        target: 28,
        minProgress: 20,
        maxProgress: 34,
        description: "Rutas con servicio en operación.",
        currentProgress: 19,
      },
      {
        id: "obj-jr-02",
        title: "Reducir las entregas fuera de tiempo",
        weightPercent: 45,
        measureType: "Porcentaje",
        trend: "Reducir",
        initialValue: 11.5,
        target: 4,
        minProgress: 8,
        maxProgress: 2,
        description: "Entregas que incumplen la promesa al cliente.",
        currentProgress: 9.2,
      },
    ],
  },
];

/**
 * Cada una de las tres formas en que UBITS acepta un username está
 * representada a propósito: un correo (`lgomez@example.co`), un documento
 * (`1032456789`) y un apodo (`nvargas`).
 */
export const DEMO_UBITS_DIRECTORY: readonly RosterUser[] = [
  {
    username: "lgomez@example.co",
    name: "Laura Gómez Ríos",
    email: "lgomez@example.co",
    documentId: "52487931",
    area: "Comercial",
    phone: "3105558842",
    leader: "Marta Forero",
  },
  {
    username: "1032456789",
    name: "Andrés Beltrán Cano",
    email: "abeltran@example.co",
    documentId: "1032456789",
    area: "Operaciones",
    phone: "3117742019",
    leader: "Cristian Rincón",
  },
  {
    username: "nvargas",
    name: "Natalia Vargas Peña",
    email: "natalia.vargas@example.co",
    documentId: "16506333",
    area: "Tecnología",
    phone: "3004419978",
    leader: "Alejandro Ramírez",
  },
  {
    username: "dcastano@example.co",
    name: "Daniel Castaño Mesa",
    email: "dcastano@example.co",
    documentId: "79845120",
    area: "Finanzas",
    phone: "3212206654",
    leader: "Marta Forero",
  },
  {
    username: "pmoreno",
    name: "Paula Moreno Silva",
    email: "paula.moreno@example.co",
    documentId: "1018273645",
    area: "People",
    phone: "3159981047",
    leader: "Cristian Rincón",
  },
  {
    username: "jhenao@example.co",
    name: "Julián Henao Ospina",
    email: "jhenao@example.co",
    documentId: "71203948",
    area: "Comercial",
    phone: "3183370265",
    leader: "Marta Forero",
  },
  {
    username: "ctorres",
    name: "Carolina Torres Duque",
    email: "carolina.torres@example.co",
    documentId: "43871209",
    area: "Marketing",
    phone: "3026648831",
    leader: "Alejandro Ramírez",
  },
  {
    username: "rmejia@example.co",
    name: "Ricardo Mejía Ríos",
    email: "rmejia@example.co",
    documentId: "80234571",
    area: "Operaciones",
    phone: "3145520973",
    leader: "Cristian Rincón",
  },
];
