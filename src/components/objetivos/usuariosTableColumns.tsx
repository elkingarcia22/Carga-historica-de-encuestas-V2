import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilterSortHeader, SortOnlyHeader } from "@/components/data-display/TableHeaderControls";
import type { TableColumnCells, TableColumnSpec } from "@/components/data-display/table-config";
import type { UsuarioSinObjetivosRow } from "@/mocks/ciclos";

/**
 * Las columnas de "Usuarios sin objetivos", fuera de la pantalla del home por
 * la misma razón que las de la lista de ciclos: dos tablas completas escritas
 * dentro de una sola pantalla no se leen.
 */

/** Las áreas que ofrece el embudo de la columna. */
export const USUARIO_AREAS: readonly string[] = ["Ventas", "Servicio", "Almacen", "Pruebas"];

export const USUARIOS_COLUMNS: readonly TableColumnSpec[] = [
  { id: "seleccion", label: "Selección", fixed: true },
  { id: "username", label: "Username" },
  { id: "nombre", label: "Nombre" },
  { id: "correo", label: "Correo" },
  { id: "area", label: "Área" },
  { id: "lider", label: "Líder" },
  { id: "acciones", label: "Acciones" },
];

export interface UsuariosCellsDeps {
  sortKey: string;
  onSort: (key: string) => void;
  areaFilter: ReadonlySet<string>;
  onToggleArea: (value: string) => void;
  onClearArea: () => void;
}

export function usuariosTableCells({
  sortKey,
  onSort,
  areaFilter,
  onToggleArea,
  onClearArea,
}: UsuariosCellsDeps): TableColumnCells<UsuarioSinObjetivosRow> {
  const textCell = "py-3 px-4 text-text-secondary text-[13px]";

  return {
    username: {
      head: (
        <SortOnlyHeader
          label="Username"
          sortActive={sortKey === "username"}
          onSort={() => onSort("username")}
        />
      ),
      cellClassName: textCell,
      cell: (user) => user.username,
    },
    nombre: {
      head: (
        <SortOnlyHeader
          label="Nombre"
          sortActive={sortKey === "nombre"}
          onSort={() => onSort("nombre")}
        />
      ),
      cellClassName: "py-3 px-4 font-bold text-text-primary text-[13px]",
      cell: (user) => user.nombre,
    },
    correo: {
      head: (
        <SortOnlyHeader
          label="Correo"
          sortActive={sortKey === "correo"}
          onSort={() => onSort("correo")}
        />
      ),
      cellClassName: textCell,
      cell: (user) => user.correo,
    },
    area: {
      head: (
        <FilterSortHeader
          label="Área"
          options={USUARIO_AREAS}
          selected={areaFilter}
          onToggleFilter={onToggleArea}
          onClearFilter={onClearArea}
          sortActive={sortKey === "area"}
          onSort={() => onSort("area")}
        />
      ),
      cellClassName: "py-3 px-4",
      cell: (user) => (
        <Badge variant="neutral" className="h-6 px-2.5 text-[11px]">
          {user.area}
        </Badge>
      ),
    },
    lider: {
      head: (
        <SortOnlyHeader
          label="Líder"
          sortActive={sortKey === "lider"}
          onSort={() => onSort("lider")}
        />
      ),
      cellClassName: textCell,
      cell: (user) => user.lider,
    },
    acciones: {
      headClassName: "px-5 text-right",
      head: (
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Acciones
        </span>
      ),
      cellClassName: "py-3 px-5 text-right",
      cell: () => (
        // El menú se abre sobre la fila sin marcarla: `stopPropagation` en la
        // celda, no en cada ítem, para que ninguna acción futura se olvide.
        <span onClick={(event) => event.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-2 rounded-lg px-3 text-[12px] font-semibold text-text-secondary hover:text-text-primary"
              >
                Acciones <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/50 p-1 shadow-lg">
              <DropdownMenuItem className="cursor-pointer gap-2 rounded-lg p-2 text-[13px] text-text-secondary hover:bg-surface-muted hover:text-text-primary">
                Ver detalle
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer gap-2 rounded-lg p-2 text-[13px] text-text-secondary hover:bg-surface-muted hover:text-text-primary">
                Asignar líder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      ),
    },
  };
}
