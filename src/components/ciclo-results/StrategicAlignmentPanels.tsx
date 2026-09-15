import * as React from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatPercent, InitialsAvatar } from "@/components/ciclo-detail";
import { SummaryPanel } from "./ResumenPanels";
import { AvancePill } from "./ResultsChips";
import { BREAKDOWN_META, type BreakdownKey } from "./resultsBreakdown";
import {
  safePercent,
  type CompanyPush,
  type ContributionRow,
  type DriftingPerson,
} from "./strategicAlignment";

/**
 * Las tarjetas con las que se lee la alineación del ciclo.
 *
 * Las cuatro contestan la misma pregunta desde cuatro distancias distintas:
 * en qué apuesta la empresa (las barras), cuál de esas apuestas está pagando
 * (los cuadrantes), quién empuja cada una (la matriz) y a quién hay que
 * llamar (la lista). Ninguna repite un gráfico de otra, porque cada una es
 * una forma distinta de dato: un reparto, una relación entre dos medidas, un
 * cruce y un padrón.
 *
 * Todas se miden en peso, no en cuenta de objetivos —ver `strategicAlignment`
 * para el porqué—, y ninguna esconde un cero: una apuesta sin nadie detrás es
 * la fila más importante que puede tener esta pantalla.
 */

const BRAND = "var(--color-brand)";

/* ------------------------------------------------------------------ *
 * Dónde se juega la estrategia
 * ------------------------------------------------------------------ */

/**
 * Cada objetivo de empresa con dos cifras que hay que leer juntas: cuánto del
 * esfuerzo del ciclo se lleva y qué está devolviendo.
 *
 * Una barra sola no bastaba: el reparto del peso dice dónde se está apostando
 * y el avance dice si la apuesta va bien, y separarlos en dos tarjetas obliga
 * a cruzarlas de memoria, que es justo el cruce que importa.
 */
export function StrategyBets({
  pushes,
  breakdown,
  selectedId,
  onSelect,
}: {
  pushes: readonly CompanyPush[];
  breakdown: BreakdownKey;
  /** El objetivo de empresa aislado en el mapa de arriba, si hay alguno. */
  selectedId: string | null;
  /** Lo aísla en el mapa. No filtra: filtrar por objetivo de empresa dejaría
   *  esta misma tarjeta con una sola fila al 100 %. */
  onSelect: (companyObjectiveId: string) => void;
}) {

  return (
    <SummaryPanel
      title="Dónde se juega la estrategia"
      hint={`Qué parte del esfuerzo del ciclo cuelga de cada objetivo de empresa, y qué avance está devolviendo. Abajo, quién lo empuja por ${BREAKDOWN_META[breakdown].noun}.`}
      total={pushes.length}
    >
      {/* Las dos cifras de cada fila miden cosas distintas y se parecen
          demasiado como para distinguirse solas: este renglón las nombra una
          vez, en vez de repetir la palabra en cada fila. */}
      <div className="flex items-baseline gap-2 px-2.5 pb-0.5 text-[10.5px] font-semibold text-text-muted">
        <span className="min-w-0 flex-1">Objetivo de empresa</span>
        <span className="shrink-0">Esfuerzo</span>
        <span className="w-[68px] shrink-0 text-right">Avance</span>
      </div>

      <ul className="flex flex-col gap-1">
        {pushes.map((push) => {
          const active = selectedId === push.id;
          // El cajón de los sueltos no es una tarjeta del mapa: no hay nada
          // que aislar, así que su fila no finge ser un botón.
          const canFocus = !push.isUnaligned;
          return (
            <li key={push.id}>
              <button
                type="button"
                disabled={!canFocus}
                onClick={() => onSelect(push.id)}
                title={canFocus ? "Aislar en el mapa de arriba" : undefined}
                className={cn(
                  "flex w-full flex-col gap-1.5 rounded-xl px-2.5 py-2 text-left transition-colors",
                  canFocus &&
                    "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  active && "bg-primary/5 ring-1 ring-inset ring-primary/25",
                  selectedId !== null && !active && "opacity-55"
                )}
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-[12.5px] font-semibold",
                      push.isUnaligned ? "text-[color:var(--color-warning)]" : "text-text-primary"
                    )}
                  >
                    {push.title}
                  </span>
                  <span className="shrink-0 text-[13px] font-extrabold tabular-nums text-text-primary">
                    {safePercent(push.share)} %
                  </span>
                  <span className="w-[68px] shrink-0 text-right">
                    {push.objectives === 0 ? (
                      <span className="text-[11px] font-semibold text-text-muted">Sin avance</span>
                    ) : (
                      <AvancePill percent={push.percent} estado={push.estado} labeled={false} />
                    )}
                  </span>
                </div>

                <span className="flex h-2 overflow-hidden rounded-full bg-muted dark:bg-white/10">
                  <span
                    className="pulse-bar-grow block h-full origin-left rounded-full"
                    style={{
                      // Contra la escala completa y no contra la barra más
                      // alta, como el resto de las barras del reporte: las
                      // cuatro suman el ciclo entero, y estirarlas hasta el
                      // borde haría que un 36 % se leyera como "casi todo".
                      width: `${Math.max(1.5, push.share)}%`,
                      backgroundColor: push.isUnaligned ? "var(--color-warning)" : BRAND,
                    }}
                  />
                </span>

                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium text-text-muted">
                  <span className="tabular-nums">
                    {push.objectives} {push.objectives === 1 ? "objetivo" : "objetivos"} ·{" "}
                    {push.people} {push.people === 1 ? "persona" : "personas"}
                  </span>
                  {push.topContributors.length > 0 && (
                    <span className="min-w-0 truncate">
                      ·{" "}
                      {push.topContributors
                        .map((contributor) => `${contributor.label} ${safePercent(contributor.share)} %`)
                        .join(" · ")}
                    </span>
                  )}
                  {push.objectives === 0 && (
                    <span className="font-bold text-[color:var(--color-warning)]">
                      Nadie está trabajando en esto
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </SummaryPanel>
  );
}

/* ------------------------------------------------------------------ *
 * Esfuerzo contra resultado
 * ------------------------------------------------------------------ */

const PLOT = { width: 520, height: 260, left: 38, right: 16, top: 14, bottom: 30 };

/**
 * Cada apuesta como un punto: cuánto esfuerzo se lleva contra cómo va.
 *
 * Es la única lectura de esta pantalla que no se puede dar con una barra,
 * porque la pregunta no es cuánto de algo sino qué relación hay entre dos
 * medidas — y lo que se busca son las esquinas: la apuesta grande que va
 * atrasada es el titular del ciclo, y en una lista ordenada por cualquiera de
 * las dos columnas queda escondida a media tabla.
 *
 * La guía horizontal es el calendario corrido y no el 50 %: un 40 % en marzo
 * va bien y en noviembre va mal, así que la línea que separa "al día" de
 * "atrasado" se mueve con el ciclo. En uno cerrado no hay pronóstico que
 * hacer y la guía pasa a ser la meta.
 */
export function EffortVersusResult({
  pushes,
  elapsed,
  showsRisk,
}: {
  pushes: readonly CompanyPush[];
  elapsed: number;
  showsRisk: boolean;
}) {
  const plotted = pushes.filter((push) => !push.isUnaligned && push.objectives > 0);
  // Con aire a la derecha: la apuesta más grande pegada al borde del marco
  // se lee como un tope del eje y no como lo que es, un valor más.
  const maxShare = Math.max(10, ...plotted.map((push) => push.share)) * 1.2;
  const guide = showsRisk ? Math.max(0, Math.min(100, elapsed)) : 100;

  const innerWidth = PLOT.width - PLOT.left - PLOT.right;
  const innerHeight = PLOT.height - PLOT.top - PLOT.bottom;
  const xOf = (share: number) => PLOT.left + (share / maxShare) * innerWidth;
  const yOf = (percent: number) =>
    PLOT.top + innerHeight - (Math.max(0, Math.min(100, percent)) / 100) * innerHeight;

  // La vertical parte el eje del esfuerzo por su promedio: "grande" y
  // "pequeña" solo significan algo contra las demás apuestas de este ciclo.
  const meanShare =
    plotted.length === 0
      ? 0
      : plotted.reduce((total, push) => total + push.share, 0) / plotted.length;

  return (
    <SummaryPanel
      title="Esfuerzo contra resultado"
      hint={
        showsRisk
          ? "Arriba de la línea, la apuesta va al día con el calendario. A la derecha, es de las que más esfuerzo se llevan."
          : "Arriba de la línea, la apuesta llegó a la meta. A la derecha, es de las que más esfuerzo se llevaron."
      }
      total={plotted.length}
    >
      {plotted.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-text-muted">Sin datos todavía.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <svg
            viewBox={`0 0 ${PLOT.width} ${PLOT.height}`}
            className="h-auto w-full"
            role="img"
            aria-label="Cada objetivo de empresa situado por el esfuerzo que se lleva y el avance que devuelve"
          >
            {/* El cuadrante que hay que mirar: mucho esfuerzo, poco avance. */}
            <rect
              x={xOf(meanShare)}
              y={yOf(guide)}
              width={Math.max(0, PLOT.width - PLOT.right - xOf(meanShare))}
              height={Math.max(0, PLOT.top + innerHeight - yOf(guide))}
              fill="var(--color-warning)"
              opacity={0.07}
            />
            <line
              x1={PLOT.left}
              y1={PLOT.top + innerHeight}
              x2={PLOT.width - PLOT.right}
              y2={PLOT.top + innerHeight}
              stroke="currentColor"
              className="text-border"
            />
            <line
              x1={PLOT.left}
              y1={PLOT.top}
              x2={PLOT.left}
              y2={PLOT.top + innerHeight}
              stroke="currentColor"
              className="text-border"
            />
            <line
              x1={PLOT.left}
              y1={yOf(guide)}
              x2={PLOT.width - PLOT.right}
              y2={yOf(guide)}
              stroke="currentColor"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
              className="text-text-muted"
            />
            <line
              x1={xOf(meanShare)}
              y1={PLOT.top}
              x2={xOf(meanShare)}
              y2={PLOT.top + innerHeight}
              stroke="currentColor"
              strokeDasharray="4 4"
              strokeOpacity={0.3}
              className="text-text-muted"
            />
            {/* La guía se rotula a la izquierda, contra el eje: a la derecha
                es justo donde caen las apuestas más grandes y el texto les
                pasaba por encima. */}
            <text
              x={PLOT.left + 5}
              y={yOf(guide) - 5}
              textAnchor="start"
              className="fill-text-muted text-[9px] font-semibold"
            >
              {showsRisk ? `${Math.round(guide)} % de calendario corrido` : "Meta"}
            </text>
            {[0, 50, 100].map((tick) => (
              <text
                key={tick}
                x={PLOT.left - 6}
                y={yOf(tick) + 3}
                textAnchor="end"
                className="fill-text-muted text-[9px] font-semibold tabular-nums"
              >
                {tick}
              </text>
            ))}
            <text
              x={PLOT.width - PLOT.right}
              y={PLOT.height - 6}
              textAnchor="end"
              className="fill-text-muted text-[9px] font-semibold"
            >
              Esfuerzo del ciclo →
            </text>

            {plotted.map((push, index) => {
              const x = xOf(push.share);
              const y = yOf(push.percent);
              const behind = push.percent < guide;
              const heavy = push.share >= meanShare;
              return (
                <g key={push.id}>
                  <circle
                    cx={x}
                    cy={y}
                    r={Math.max(7, Math.min(20, 7 + push.share / 3))}
                    fill={behind && heavy ? "var(--color-warning)" : BRAND}
                    opacity={0.18}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={4.5}
                    fill={behind && heavy ? "var(--color-warning)" : BRAND}
                  />
                  <text
                    x={x}
                    y={y - 13}
                    textAnchor="middle"
                    className="fill-text-secondary text-[9.5px] font-bold"
                  >
                    {index + 1}
                  </text>
                </g>
              );
            })}
          </svg>

          <ol className="flex flex-col gap-1">
            {plotted.map((push, index) => (
              <li
                key={push.id}
                className="flex items-baseline gap-2 text-[11.5px] text-text-secondary"
              >
                <span className="w-4 shrink-0 text-[10px] font-bold tabular-nums text-text-muted">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{push.title}</span>
                <span className="shrink-0 tabular-nums text-text-muted">
                  {safePercent(push.share)} % esfuerzo
                </span>
                <span className="w-10 shrink-0 text-right font-bold tabular-nums text-text-primary">
                  {formatPercent(push.percent)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </SummaryPanel>
  );
}

/* ------------------------------------------------------------------ *
 * La matriz de contribución
 * ------------------------------------------------------------------ */

const MATRIX_ROWS = 8;

/**
 * El azul de marca con la intensidad de la celda. Una celda vacía se queda en
 * gris claro y sin cifra: el hueco es la lectura.
 *
 * La escala va contra la celda más alta de la matriz y no contra el 100 %:
 * con cuatro objetivos de empresa ninguna fila pasa de treinta y pico, así
 * que medir contra cien pinta la tabla entera del mismo azul medio y borra
 * justo la diferencia que se viene a ver.
 */
const cellStyle = (share: number, max: number, loose: boolean): React.CSSProperties => {
  if (share <= 0) {
    return { backgroundColor: "color-mix(in srgb, var(--color-text-muted) 10%, transparent)" };
  }
  // La columna de lo que no apunta a nada va en ámbar, el mismo con el que se
  // nombra en el resto de la vista: ahí una celda intensa no es un grupo
  // volcado en una apuesta, es esfuerzo que se está yendo sin norte.
  const ink = loose ? "var(--color-warning)" : BRAND;
  const intensity = share / Math.max(share, max);
  return {
    backgroundColor: `color-mix(in srgb, ${ink} ${Math.round(10 + intensity * 70)}%, transparent)`,
    color: intensity >= 0.7 ? "#fff" : undefined,
  };
};

/**
 * Qué parte del esfuerzo de cada grupo va a cada apuesta.
 *
 * Cada fila suma 100 %, así que se lee de izquierda a derecha: "esta área
 * pone el 70 % de su semana en Ingresos y no toca NPS". El hueco —la celda
 * en gris— es lo que se viene a buscar aquí, y por eso ninguna columna se
 * esconde por estar vacía.
 */
export function ContributionMatrix({
  rows,
  pushes,
  breakdown,
  onSelectRow,
  activeRowIds,
}: {
  rows: readonly ContributionRow[];
  pushes: readonly CompanyPush[];
  breakdown: BreakdownKey;
  onSelectRow?: (id: string) => void;
  activeRowIds?: ReadonlySet<string>;
}) {
  const meta = BREAKDOWN_META[breakdown];
  const visible = rows.slice(0, MATRIX_ROWS);
  const hidden = Math.max(0, rows.length - visible.length);
  const maxCell = Math.max(1, ...visible.flatMap((row) => [...row.cells]));
  const anyActive = (activeRowIds?.size ?? 0) > 0;

  return (
    <SummaryPanel
      title={`Quién empuja cada objetivo de empresa`}
      hint={`Qué parte del esfuerzo de cada ${meta.noun} va a cada objetivo de empresa. Cada fila suma 100 %; una celda vacía es una apuesta que ese grupo no toca.`}
      total={rows.length}
    >
      {visible.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-text-muted">Sin datos todavía.</p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] border-separate border-spacing-[2px] text-[11px]">
              <thead>
                <tr>
                  <th className="w-[34%] px-1 pb-1 text-left align-bottom text-[10.5px] font-bold text-text-muted">
                    {meta.label}
                  </th>
                  {pushes.map((push) => (
                    <th key={push.id} className="px-0.5 pb-1 align-bottom">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={cn(
                              "mx-auto block max-w-[7.5rem] truncate text-center text-[10.5px] font-bold",
                              push.isUnaligned
                                ? "text-[color:var(--color-warning)]"
                                : "text-text-secondary"
                            )}
                          >
                            {push.title}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{push.title}</TooltipContent>
                      </Tooltip>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const active = activeRowIds?.has(row.id) ?? false;
                  return (
                    <tr
                      key={row.id}
                      className={cn(anyActive && !active && "opacity-55")}
                    >
                      <th scope="row" className="px-1 text-left align-middle font-medium">
                        <button
                          type="button"
                          disabled={!onSelectRow}
                          onClick={() => onSelectRow?.(row.id)}
                          className={cn(
                            "flex w-full min-w-0 flex-col items-start rounded-md px-1 py-1 text-left transition-colors",
                            onSelectRow &&
                              "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                            active && "bg-primary/5"
                          )}
                        >
                          <span className="w-full truncate text-[11.5px] font-semibold text-text-primary">
                            {row.label}
                          </span>
                          <span className="text-[10px] font-medium tabular-nums text-text-muted">
                            {row.people} {row.people === 1 ? "persona" : "personas"}
                          </span>
                        </button>
                      </th>
                      {row.cells.map((share, index) => (
                        <td key={pushes[index]?.id ?? index} className="p-0">
                          <span
                            className="flex h-8 items-center justify-center rounded-[5px] text-[10.5px] font-bold tabular-nums text-text-primary"
                            style={cellStyle(share, maxCell, pushes[index]?.isUnaligned ?? false)}
                          >
                            {share < 1 ? "" : `${Math.round(share)}`}
                          </span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {hidden > 0 && (
            <p className="text-[11px] font-medium text-text-muted">
              {hidden} {hidden === 1 ? meta.noun : meta.plural} más, con menos peso en el ciclo.
            </p>
          )}
        </div>
      )}
    </SummaryPanel>
  );
}

/* ------------------------------------------------------------------ *
 * Quién está remando aparte
 * ------------------------------------------------------------------ */

const DRIFT_ROWS = 7;

/**
 * Las personas con esfuerzo fuera de la estrategia, de más a menos.
 *
 * Es la única tarjeta de esta vista que lleva a una persona concreta, y por
 * eso cada fila abre su ficha: la lectura termina en una conversación con
 * alguien, no en un número.
 */
export function DriftingPeople({
  people,
  onOpenPerson,
}: {
  people: readonly DriftingPerson[];
  onOpenPerson: (personId: string) => void;
}) {
  const visible = people.slice(0, DRIFT_ROWS);
  const hidden = Math.max(0, people.length - visible.length);

  return (
    <SummaryPanel
      title="Esfuerzo fuera de la estrategia"
      hint="Personas con objetivos que no apuntan a ningún objetivo de empresa, por cuánto de su propio ciclo se está yendo ahí."
      total={people.length}
    >
      {visible.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-text-muted">
          Todo el esfuerzo del ciclo cuelga de un objetivo de empresa.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col gap-0.5">
            {visible.map((person) => (
              <li key={person.row.person.id}>
                <button
                  type="button"
                  onClick={() => onOpenPerson(person.row.person.id)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <InitialsAvatar name={person.row.collaborator.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold text-text-primary">
                      {person.row.collaborator.name}
                    </span>
                    <span className="block truncate text-[10.5px] font-medium text-text-muted">
                      {person.row.collaborator.area} ·{" "}
                      {person.looseObjectives} de {person.totalObjectives}{" "}
                      {person.totalObjectives === 1 ? "objetivo" : "objetivos"} sin norte
                    </span>
                  </span>
                  <span className="flex w-24 shrink-0 items-center gap-1.5">
                    <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted dark:bg-white/10">
                      <span
                        className="pulse-bar-grow block h-full origin-left rounded-full"
                        style={{
                          width: `${Math.max(3, person.looseShare)}%`,
                          backgroundColor: "var(--color-warning)",
                        }}
                      />
                    </span>
                    <span className="shrink-0 text-[11.5px] font-bold tabular-nums text-[color:var(--color-warning)]">
                      {Math.round(person.looseShare)} %
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            <p className="text-[11px] font-medium text-text-muted">
              {hidden} {hidden === 1 ? "persona más" : "personas más"} con algo de su esfuerzo
              fuera de la estrategia.
            </p>
          )}
        </div>
      )}
    </SummaryPanel>
  );
}
