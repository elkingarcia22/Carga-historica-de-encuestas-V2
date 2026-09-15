import * as React from "react";
import { ArrowUpDown, Lock, Medal, TrendingDown, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/feedback";
import { average, formatPercent, resolveEstado, resolveNivel } from "@/components/ciclo-detail";
import { getEstadoBadgeConfig } from "@/components/objetivos/objetivosConfigStore";
import { NivelChip } from "@/components/ciclo-detail";
import { AvancePill, EstadoBar, RiskChip } from "./ResultsChips";
import { countEstados, riskFor, type CicloResults, type PersonResultRow, type ResultsConfig } from "./resultsModel";
import { CollapsibleSearchBox } from "./tableBridge";
import { BREAKDOWN_META, breakdownValueOf, type BreakdownKey } from "./resultsBreakdown";
import { ResultsDetailCard } from "./ResultsDetailCard";
import { ResultsGlobalFilters } from "./ResultsGlobalFilters";
import type { ResultsFiltersState } from "./useResultsFilters";

/**
 * El ranking.
 *
 * Comparar es una lectura distinta de analizar, y por eso vive aparte del
 * árbol. Trae dos cuidados que la referencia no tiene:
 *
 *   · **Umbral de agregación.** Un grupo con una sola persona no es un grupo:
 *     su fila diría el resultado de un individuo con el nombre de un área
 *     encima. Esas filas se muestran bloqueadas, no borradas, para que nadie
 *     crea que faltan datos.
 *   · **Quien no cuenta, no rankea.** Alguien en licencia o retirado no
 *     compite por un puesto que su situación explica.
 */

/** Debajo de esto, una fila agregada es una persona con disfraz. */
const MIN_GROUP_SIZE = 3;

interface RankingRow {
  id: string;
  label: string;
  sublabel: string;
  percent: number;
  size: number;
  masked: boolean;
  rows: readonly PersonResultRow[];
}

interface RankingTabProps {
  results: CicloResults;
  rows: readonly PersonResultRow[];
  config: ResultsConfig;
  filters: ResultsFiltersState;
  /** El corte elegido arriba, en la barra del reporte. */
  breakdown: BreakdownKey;
  onBreakdownChange: (value: BreakdownKey) => void;
  onOpenPerson: (personId: string) => void;
  /** Las fichas de lo que está filtrado, bajo la fila de controles. */
  globalChips?: React.ReactNode;
}

export function RankingTab({
  results,
  rows,
  config,
  filters,
  breakdown,
  onBreakdownChange,
  onOpenPerson,
  globalChips,
}: RankingTabProps) {
  const [search, setSearch] = React.useState("");
  const [desc, setDesc] = React.useState(true);
  const meta = BREAKDOWN_META[breakdown];

  const ranking = React.useMemo<RankingRow[]>(() => {
    const scored = rows.filter((row) => row.counts);
    if (breakdown === "persona") {
      return scored.map((row) => ({
        id: row.person.id,
        label: row.collaborator.name,
        sublabel: `${row.area} · ${row.leader}`,
        percent: row.percent,
        size: 1,
        masked: false,
        rows: [row],
      }));
    }

    const buckets = new Map<string, PersonResultRow[]>();
    scored.forEach((row) => {
      const key = breakdownValueOf(
        { collaborator: row.collaborator, groupId: row.person.groupId },
        breakdown
      );
      const bucket = buckets.get(key);
      if (bucket) bucket.push(row);
      else buckets.set(key, [row]);
    });

    return [...buckets.entries()].map(([label, members]) => ({
      id: label,
      label,
      sublabel: `${members.length} ${members.length === 1 ? "persona" : "personas"}`,
      percent: average(members.map((member) => member.percent)),
      size: members.length,
      masked: members.length < MIN_GROUP_SIZE,
      rows: members,
    }));
  }, [rows, breakdown]);

  const visible = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term === "" ? ranking : ranking.filter((row) => row.label.toLowerCase().includes(term));
    return [...filtered].sort((a, b) => (desc ? b.percent - a.percent : a.percent - b.percent));
  }, [ranking, search, desc]);

  const comparable = visible.filter((row) => !row.masked);
  const best = comparable.length > 0 ? [...comparable].sort((a, b) => b.percent - a.percent)[0] : null;
  const worst = comparable.length > 1 ? [...comparable].sort((a, b) => a.percent - b.percent)[0] : null;

  // El buscador va a la izquierda de "Filtros" y es el mismo botón que se
  // abre a un campo —el de la lista de ciclos del home— en vez de un campo
  // fijo compitiendo por espacio con "Ver por" y "Segmentación".
  const controls = (
    <ResultsGlobalFilters
      results={results}
      state={filters}
      breakdown={breakdown}
      onBreakdownChange={onBreakdownChange}
      searchSlot={
        <CollapsibleSearchBox value={search} onChange={setSearch} placeholder={`Buscar ${meta.noun}…`} />
      }
    />
  );

  return (
    <ResultsDetailCard
      title={`Ranking por ${meta.noun}`}
      count={visible.length}
      controls={controls}
      chips={globalChips}
    >
      {ranking.length === 0 ? (
        <div className="rounded-xl border border-border/60 p-8">
          <EmptyState
            title="No hay nada que comparar"
            description="Con los filtros puestos no queda nadie que cuente en los resultados."
            className="border-none bg-transparent shadow-none"
          />
        </div>
      ) : (
        <>
          {(best || worst) && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {best && (
                <PodiumCard
                  tone="positive"
                  icon={Trophy}
                  title="Mejor desempeño"
                  row={best}
                  config={config}
                  status={results.data.status}
                />
              )}
              {worst && (
                <PodiumCard
                  tone="negative"
                  icon={TrendingDown}
                  title="Menor desempeño"
                  row={worst}
                  config={config}
                  status={results.data.status}
                />
              )}
            </div>
          )}

          <div className="rounded-xl border border-border/60">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/40 px-4 py-2.5">
              <p className="text-[12px] font-semibold text-text-secondary">
                {meta.plural.charAt(0).toUpperCase() + meta.plural.slice(1)} · {visible.length}{" "}
                resultados
              </p>
              <button
                type="button"
                onClick={() => setDesc((current) => !current)}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-text-primary"
              >
                <ArrowUpDown className="size-3.5" strokeWidth={2.2} />
                {desc ? "Mayor a menor" : "Menor a mayor"}
              </button>
            </div>

            <ol className="flex flex-col px-4">
              {visible.map((row, index) => (
                <RankingRowItem
                  key={row.id}
                  row={row}
                  position={index + 1}
                  config={config}
                  status={results.data.status}
                  elapsed={results.showsRisk ? results.elapsed : -1}
                  showsRisk={results.showsRisk}
                  onOpen={
                    breakdown === "persona" && !row.masked
                      ? () => onOpenPerson(row.id)
                      : undefined
                  }
                />
              ))}
            </ol>

            {visible.some((row) => row.masked) && (
              <p className="flex items-start gap-2 border-t border-border/60 px-4 py-2.5 text-[11.5px] text-muted-foreground">
                <Lock className="mt-px size-3 shrink-0" strokeWidth={2.4} />
                Las filas bloqueadas tienen menos de {MIN_GROUP_SIZE} personas: su promedio sería el
                resultado de un individuo con el nombre de un grupo encima.
              </p>
            )}
          </div>
        </>
      )}
    </ResultsDetailCard>
  );
}

function PodiumCard({
  tone,
  icon: Icon,
  title,
  row,
  config,
  status,
}: {
  tone: "positive" | "negative";
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  row: RankingRow;
  config: ResultsConfig;
  status: CicloResults["data"]["status"];
}) {
  const estado = resolveEstado(config.estados, row.percent, status);
  const badge = estado ? getEstadoBadgeConfig(estado) : null;
  const nivel = resolveNivel(config.niveles, row.percent);

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-2xl border p-5 shadow-card",
        tone === "positive"
          ? "border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-800/40 dark:bg-emerald-500/[0.07]"
          : "border-red-200/70 bg-red-50/40 dark:border-red-800/40 dark:bg-red-500/[0.07]"
      )}
    >
      <header className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-text-secondary">
        <Icon
          className={cn("size-4", tone === "positive" ? "text-emerald-600" : "text-red-500")}
          strokeWidth={2.3}
        />
        {title}
      </header>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="truncate text-[16px] font-black tracking-tight text-text-primary">
            {row.label}
          </p>
          <p className="text-[12px] text-text-muted">{row.sublabel}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <p className={cn("text-[26px] font-black leading-none tabular-nums", badge?.iconColor)}>
            {formatPercent(row.percent)}
          </p>
          <NivelChip nivel={nivel} />
        </div>
      </div>
    </article>
  );
}

function RankingRowItem({
  row,
  position,
  config,
  status,
  elapsed,
  showsRisk,
  onOpen,
}: {
  row: RankingRow;
  position: number;
  config: ResultsConfig;
  status: CicloResults["data"]["status"];
  elapsed: number;
  showsRisk: boolean;
  onOpen?: () => void;
}) {
  const estado = resolveEstado(config.estados, row.percent, status);
  const badge = estado ? getEstadoBadgeConfig(estado) : null;
  const estadoCounts = countEstados(row.rows.flatMap((member) => member.entries));
  // El promedio de la fila contra el calendario ya corrido del ciclo.
  const risk = riskFor(row.percent, elapsed);

  return (
    <li className="border-b border-border/40 last:border-b-0">
      <div
        role={onOpen ? "button" : undefined}
        tabIndex={onOpen ? 0 : undefined}
        onClick={onOpen}
        onKeyDown={(event) => {
          if (!onOpen) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen();
          }
        }}
        className={cn(
          "-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors",
          onOpen && "cursor-pointer hover:bg-surface-muted"
        )}
      >
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg text-[11.5px] font-black tabular-nums",
            position <= 3 && !row.masked
              ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
              : "bg-surface-muted text-text-secondary"
          )}
        >
          {position <= 3 && !row.masked ? <Medal className="size-3.5" strokeWidth={2.4} /> : position}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-text-primary">{row.label}</p>
          <p className="truncate text-[11.5px] text-text-muted">{row.sublabel}</p>
        </div>

        {row.masked ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-surface-muted px-2 py-1 text-[11.5px] font-semibold text-text-muted">
            <Lock className="size-3" strokeWidth={2.4} />
            Menos de {MIN_GROUP_SIZE} personas
          </span>
        ) : (
          <>
            <EstadoBar counts={estadoCounts} estados={config.estados} width="w-16" />
            {showsRisk && <RiskChip risk={risk} withLabel={false} />}
            <span className="relative hidden h-1.5 w-40 overflow-hidden rounded-full bg-border/40 lg:block">
              <span
                className={cn("absolute inset-y-0 left-0 rounded-full", badge?.barBg ?? "bg-primary")}
                style={{ width: `${Math.max(0, Math.min(100, row.percent))}%` }}
              />
            </span>
            <AvancePill percent={row.percent} estado={estado} labeled={false} className="w-[64px] justify-end" />
          </>
        )}
      </div>
    </li>
  );
}
