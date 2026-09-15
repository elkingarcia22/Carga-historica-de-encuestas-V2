import { Bell } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/status-badge";
import {
  FilterSortHeader,
  SortOnlyHeader,
  type TableColumnCells,
  type TableColumnSpec,
} from "@/components/data-display";
import { useAnimatedValue } from "@/lib/useAnimatedValue";
import { COLLABORATORS } from "@/mocks/collaborators";
import type { ParticipationRow, SegmentDefinition } from "@/mocks/surveyResults";
import { formatPercent } from "./favorabilityScale";

/**
 * Las columnas de la tabla de participación, fuera del componente que las
 * pinta.
 *
 * La tabla lee dos poblaciones distintas con el mismo esqueleto: personas —de
 * quienes interesa su líder y su área— y grupos —de quienes interesan sus
 * cuentas—. No son dos tablas: son las mismas columnas con unas disponibles y
 * otras no, y por eso `available` las enciende y las apaga en vez de haber dos
 * listas que se van separando.
 */

export function participationColumns(perPerson: boolean): readonly TableColumnSpec[] {
  return [
    { id: "seleccion", label: "Selección", fixed: true },
    { id: "label", label: "Grupo o persona" },
    { id: "leader", label: "Líder", available: perPerson },
    { id: "area", label: "Área", available: perPerson },
    { id: "estado", label: "Estado" },
    { id: "invited", label: "Respondieron", available: !perPerson },
    { id: "inProgress", label: "En progreso", available: !perPerson },
    { id: "missing", label: "Faltan", available: !perPerson },
    { id: "rate", label: "Participación", available: !perPerson },
  ];
}

const missingOf = (row: ParticipationRow): number => row.invited - row.completed - row.inProgress;

/** El estado de una fila: completada, a medias o sin empezar. */
function ParticipationStatus({ row, perPerson }: { row: ParticipationRow; perPerson: boolean }) {
  const done = perPerson ? row.completed > 0 : row.completed === row.invited;
  const started = perPerson ? row.inProgress > 0 : row.completed > 0 || row.inProgress > 0;
  if (done) return <StatusBadge state="success" labels={{ success: "Completado" }} />;
  if (started) return <StatusBadge state="pending" labels={{ pending: "En progreso" }} />;
  return <StatusBadge state="failed" labels={{ failed: "Falta" }} />;
}

/** La participación de un grupo, con su propia animación de llegada. */
function ParticipationRateCell({ rate }: { rate: number }) {
  const animated = useAnimatedValue(rate, 1000);
  return (
    <div className="flex items-center justify-end gap-3">
      <Progress
        value={animated}
        color="primary"
        className="h-1.5 w-32 shrink-0 [&>div]:transition-none"
      />
      <span className="min-w-[44px] text-right text-[12px] tabular-nums text-text-secondary">
        {formatPercent(animated)}
      </span>
    </div>
  );
}

export interface ParticipationCellsDeps {
  segment: SegmentDefinition;
  sort: { key: string; ascending?: boolean };
  toggleSort: (key: string) => void;
  groupLabels: readonly string[];
  groupFilter: ReadonlySet<string>;
  onToggleGroup: (value: string) => void;
  onClearGroup: () => void;
  leaders: readonly string[];
  leaderFilter: ReadonlySet<string>;
  onToggleLeader: (value: string) => void;
  onClearLeader: () => void;
  areas: readonly string[];
  areaFilter: ReadonlySet<string>;
  onToggleArea: (value: string) => void;
  onClearArea: () => void;
  estados: readonly string[];
  estadoFilter: ReadonlySet<string>;
  onToggleEstado: (value: string) => void;
  onClearEstado: () => void;
}

export function participationTableCells(
  deps: ParticipationCellsDeps
): TableColumnCells<ParticipationRow> {
  const perPerson = deps.segment.perPerson === true;
  const numeric = "py-3 text-right tabular-nums text-[13px] text-muted-foreground";

  return {
    label: {
      headClassName: perPerson ? "w-[34%] py-3.5 px-0" : "w-[25%] py-3.5 px-0",
      head: (
        <FilterSortHeader
          label={deps.segment.label}
          options={deps.groupLabels}
          selected={deps.groupFilter}
          onToggleFilter={deps.onToggleGroup}
          onClearFilter={deps.onClearGroup}
          sortActive={deps.sort.key === "label"}
          onSort={() => deps.toggleSort("label")}
          defaultAllSelected
        />
      ),
      cellClassName: "py-3",
      cell: (row) => {
        // El recordatorio es de esta fila y aparece al pasar por encima: en
        // cien filas, cien campanas encendidas es ruido, no un atajo.
        const pending = perPerson ? row.completed === 0 : missingOf(row) > 0;
        return (
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] text-text-secondary">{row.label}</span>
            {pending && (
              <button
                type="button"
                onClick={(event) => event.stopPropagation()}
                aria-label={`Enviar recordatorio a ${row.label}`}
                className="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-border/60 hover:text-text-primary group-hover:opacity-100"
              >
                <Bell className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      },
    },

    leader: {
      headClassName: "w-[23%] py-3.5 px-0",
      head: (
        <FilterSortHeader
          label="Líder"
          options={deps.leaders}
          selected={deps.leaderFilter}
          onToggleFilter={deps.onToggleLeader}
          onClearFilter={deps.onClearLeader}
          sortActive={deps.sort.key === "leader"}
          onSort={() => deps.toggleSort("leader")}
        />
      ),
      cellClassName: "py-3 text-[13px] text-muted-foreground",
      cell: (row) => (
        <span className="block truncate">
          {COLLABORATORS.find((person) => person.name === row.label)?.leader ?? "—"}
        </span>
      ),
    },

    area: {
      headClassName: "w-[23%] py-3.5 px-0",
      head: (
        <FilterSortHeader
          label="Área"
          options={deps.areas}
          selected={deps.areaFilter}
          onToggleFilter={deps.onToggleArea}
          onClearFilter={deps.onClearArea}
          sortActive={deps.sort.key === "area"}
          onSort={() => deps.toggleSort("area")}
        />
      ),
      cellClassName: "py-3 text-[13px] text-muted-foreground",
      cell: (row) => (
        <span className="block truncate">
          {COLLABORATORS.find((person) => person.name === row.label)?.area ?? "—"}
        </span>
      ),
    },

    estado: {
      headClassName: perPerson ? "py-3.5 pl-0 pr-6" : "w-[140px] py-3.5 px-0",
      head: (
        <FilterSortHeader
          label="Estado"
          options={deps.estados}
          selected={deps.estadoFilter}
          onToggleFilter={deps.onToggleEstado}
          onClearFilter={deps.onClearEstado}
          sortActive={deps.sort.key === "estado"}
          onSort={() => deps.toggleSort("estado")}
          align={perPerson ? "right" : "left"}
        />
      ),
      cellClassName: perPerson ? "py-3 pl-0 pr-6" : undefined,
      cell: (row) =>
        perPerson ? (
          <div className="flex justify-end">
            <ParticipationStatus row={row} perPerson />
          </div>
        ) : (
          <ParticipationStatus row={row} perPerson={false} />
        ),
    },

    invited: {
      headClassName: "w-[120px] py-3.5 px-2 text-right",
      head: (
        <SortOnlyHeader
          label="Respondieron"
          sortActive={deps.sort.key === "invited"}
          onSort={() => deps.toggleSort("invited")}
          align="right"
        />
      ),
      cellClassName: "w-[120px] py-3 text-right tabular-nums text-[13px] text-text-secondary",
      cell: (row) => (
        <>
          <span className="font-semibold text-text-primary">{row.completed}</span>
          <span> / {row.invited}</span>
        </>
      ),
    },

    inProgress: {
      headClassName: "w-[100px] py-3.5 px-2 text-right",
      head: (
        <SortOnlyHeader
          label="En progreso"
          sortActive={deps.sort.key === "inProgress"}
          onSort={() => deps.toggleSort("inProgress")}
          align="right"
        />
      ),
      cellClassName: `w-[110px] ${numeric}`,
      cell: (row) => (row.inProgress === 0 ? "—" : row.inProgress),
    },

    missing: {
      headClassName: "w-[90px] py-3.5 px-2 text-right",
      head: (
        <SortOnlyHeader
          label="Faltan"
          sortActive={deps.sort.key === "missing"}
          onSort={() => deps.toggleSort("missing")}
          align="right"
        />
      ),
      cellClassName: `w-[100px] ${numeric}`,
      cell: (row) => (missingOf(row) === 0 ? "—" : missingOf(row)),
    },

    rate: {
      headClassName: "w-[220px] py-3.5 pl-0 pr-6",
      head: (
        <SortOnlyHeader
          label="Participación"
          sortActive={deps.sort.key === "rate"}
          onSort={() => deps.toggleSort("rate")}
          align="right"
        />
      ),
      cellClassName: "w-[220px] py-3 pr-6",
      cell: (row) => <ParticipationRateCell rate={row.rate} />,
    },
  };
}
