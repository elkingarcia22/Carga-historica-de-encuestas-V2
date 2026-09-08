/**
 * Groups an objective set can be handed to.
 *
 * Derived from the same directory the participants step reads rather than
 * hand-written, so the member counts shown while assigning match the people
 * who were actually added to the ciclo — a group that claims 40 members and
 * then reaches 12 would make the whole step untrustworthy.
 */

import { COLLABORATORS } from "@/mocks/collaborators";
import type { ObjectiveGroup } from "./cicloBuilderTypes";

/** Non-obvious areas get a line saying who they cover. */
const AREA_DESCRIPTIONS: Readonly<Record<string, string>> = {
  Tecnología: "Desarrollo, infraestructura y datos",
  Comercial: "Ventas, cuentas y prospección",
  Marketing: "Marca, contenidos y demanda",
  Operaciones: "Procesos, calidad y soporte interno",
  "Gente y Cultura": "Selección, desarrollo y clima",
  Finanzas: "Contabilidad, tesorería y planeación",
  "Servicio al cliente": "Soporte, retención y postventa",
  Producto: "Diseño, investigación y roadmap",
  Legal: "Contratos, cumplimiento y riesgo",
  Logística: "Abastecimiento, bodega y distribución",
};

function buildAreaGroups(): readonly ObjectiveGroup[] {
  const counts = new Map<string, number>();
  for (const person of COLLABORATORS) {
    counts.set(person.area, (counts.get(person.area) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([area, memberCount]) => ({
      id: `group-${area.toLowerCase().replace(/\s+/g, "-")}`,
      name: area,
      description: AREA_DESCRIPTIONS[area] ?? "Equipo de la compañía",
      memberCount,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const OBJECTIVE_GROUPS: readonly ObjectiveGroup[] = buildAreaGroups();
