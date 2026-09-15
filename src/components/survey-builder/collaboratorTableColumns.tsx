import { cn } from "@/lib/utils";
import type { TableColumnCells, TableColumnSpec } from "@/components/data-display";
import type { Collaborator } from "@/mocks/collaborators";
import { avatarColor, initials } from "./collaboratorTableShared";
import { FilterMenu, SortableHeader, type SortDir, type SortKey } from "./CollaboratorTableParts";

/**
 * Las columnas que comparten las dos tablas de personas del constructor: la
 * del directorio y la de lo que llega de un archivo.
 *
 * Son la misma tabla leyendo dos orígenes distintos, así que comparten las
 * columnas en vez de tener dos juegos que se van separando con el tiempo. Lo
 * único que cambia es de dónde sale cada fila, y para eso está `CollaboratorCellRow`:
 * las dos la producen antes de pintar.
 */

/** Una fila, ya normalizada, venga del directorio o de un archivo importado. */
export interface CollaboratorCellRow {
  id: string;
  name: string;
  username: string;
  email: string;
  area: string;
  leader: string;
  /** Falso para alguien que todavía no existe: su avatar va en gris. */
  known: boolean;
}

export const COLLABORATOR_COLUMNS: readonly TableColumnSpec[] = [
  { id: "seleccion", label: "Selección", fixed: true },
  { id: "name", label: "Colaborador" },
  { id: "username", label: "Username" },
  { id: "email", label: "Correo electrónico" },
  { id: "area", label: "Área" },
  { id: "leader", label: "Líder" },
];

export const collaboratorCellRow = (person: Collaborator): CollaboratorCellRow => ({
  id: person.id,
  name: person.name,
  username: person.username,
  email: person.email,
  area: person.area,
  leader: person.leader ?? "—",
  known: true,
});

export interface CollaboratorCellsDeps {
  sortKey: SortKey | null;
  sortDir: SortDir;
  onToggleSort: (key: SortKey) => void;
  areas: readonly string[];
  areaFilter: ReadonlySet<string>;
  onToggleArea: (value: string) => void;
  onClearArea: () => void;
  leaders: readonly string[];
  leaderFilter: ReadonlySet<string>;
  onToggleLeader: (value: string) => void;
  onClearLeader: () => void;
}

export function collaboratorTableCells(
  deps: CollaboratorCellsDeps
): TableColumnCells<CollaboratorCellRow> {
  const text = "text-[13px] text-text-secondary";

  return {
    name: {
      headClassName: "min-w-[200px] py-3",
      head: (
        <SortableHeader
          label="Colaborador"
          active={deps.sortKey === "name"}
          direction={deps.sortDir}
          onToggle={() => deps.onToggleSort("name")}
        />
      ),
      cellClassName: "min-w-[200px] py-2.5",
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
              row.known ? avatarColor(row.id) : "bg-muted text-muted-foreground"
            )}
          >
            {initials(row.name)}
          </span>
          <p className="min-w-0 truncate text-[13px] font-semibold text-text-primary">{row.name}</p>
        </div>
      ),
    },

    username: {
      // Ni se ordena ni se filtra: es el identificador, y buscarlo se hace
      // desde el buscador de arriba.
      headClassName: "py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
      head: "Username",
      cellClassName: text,
      cell: (row) => row.username,
    },

    email: {
      headClassName: "py-3",
      head: (
        <SortableHeader
          label="Correo electrónico"
          active={deps.sortKey === "email"}
          direction={deps.sortDir}
          onToggle={() => deps.onToggleSort("email")}
        />
      ),
      cellClassName: text,
      cell: (row) => row.email,
    },

    area: {
      headClassName: "py-3",
      head: (
        <FilterMenu
          label="Área"
          options={deps.areas}
          selected={deps.areaFilter}
          onToggle={deps.onToggleArea}
          onClear={deps.onClearArea}
        />
      ),
      cellClassName: text,
      cell: (row) => row.area,
    },

    leader: {
      headClassName: "py-3 pr-4",
      head: (
        <FilterMenu
          label="Líder"
          options={deps.leaders}
          selected={deps.leaderFilter}
          onToggle={deps.onToggleLeader}
          onClear={deps.onClearLeader}
        />
      ),
      cellClassName: cn("pr-4", text),
      cell: (row) => row.leader,
    },
  };
}
