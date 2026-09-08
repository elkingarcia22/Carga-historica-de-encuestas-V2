import * as React from "react";
import { AlertTriangle, ArrowRight, Scale, Sparkles, TrendingDown, MessageSquareOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { average, formatPercent } from "@/components/ciclo-detail";
import { EmptyState } from "@/components/feedback";
import type { CicloResults, PersonResultRow, ResultEntry } from "./resultsModel";
import type { FilterKey, ResultsFiltersState } from "./useResultsFilters";

/**
 * El análisis.
 *
 * Mismo formato que el reporte de una encuesta: primero la afirmación, después
 * la evidencia sobre la que se apoya. Y una regla que la hace utilizable —cada
 * hallazgo termina en un gesto que lleva al lector a la vista donde puede
 * hacer algo, con los filtros ya puestos. Un insight que obliga a reconstruir
 * a mano el filtro que lo produjo es una nota al margen, no un hallazgo.
 *
 * Todo lo de aquí se deriva de los mismos números de las otras pestañas: no
 * hay una segunda fuente de verdad que pueda contradecir a la tabla.
 */

interface Finding {
  id: string;
  tone: "negative" | "warning" | "info";
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  claim: string;
  evidence: string;
  actionLabel: string;
  apply: () => void;
}

interface AnalisisIaTabProps {
  results: CicloResults;
  rows: readonly PersonResultRow[];
  entries: readonly ResultEntry[];
  filters: ResultsFiltersState;
  onGoTo: (tab: "cumplimiento" | "colaboradores" | "ranking") => void;
}

export function AnalisisIaTab({ results, rows, entries, filters, onGoTo }: AnalisisIaTabProps) {
  const findings = React.useMemo<Finding[]>(() => {
    const list: Finding[] = [];
    /*
     * Un ciclo cerrado cambia el tiempo verbal de todo lo que sigue. "Va
     * atrasada", "está en riesgo" y "no puede pasar de" son pronósticos, y
     * sobre algo que ya terminó son falsos aunque los números que los
     * produjeron sean los mismos: ahí no hay atraso, hay resultado.
     */
    const isClosed = !results.showsRisk;
    const focus = (key: FilterKey, value: string, tab: "cumplimiento" | "colaboradores" | "ranking") => () => {
      filters.clearAll();
      filters.toggle(key, value);
      onGoTo(tab);
    };

    // 1. El área más atrasada frente al calendario.
    const byArea = new Map<string, PersonResultRow[]>();
    rows
      .filter((row) => row.counts)
      .forEach((row) => {
        const bucket = byArea.get(row.area);
        if (bucket) bucket.push(row);
        else byArea.set(row.area, [row]);
      });
    const areaScores = [...byArea.entries()]
      .filter(([, members]) => members.length >= 3)
      .map(([area, members]) => ({ area, percent: average(members.map((m) => m.percent)), size: members.length }))
      .sort((a, b) => a.percent - b.percent);

    if (areaScores.length > 1) {
      const worst = areaScores[0];
      const best = areaScores[areaScores.length - 1];
      const gap = Math.round(results.elapsed - worst.percent);
      const spread = Math.round(best.percent - worst.percent);

      if (isClosed && spread >= 5) {
        list.push({
          id: "area-ultima",
          tone: "negative",
          icon: TrendingDown,
          claim: `${worst.area} cerró como el área de menor cumplimiento.`,
          evidence: `Cerró en ${formatPercent(worst.percent)} sobre ${worst.size} personas, ${spread} puntos por debajo de ${best.area}, que fue la más alta con ${formatPercent(best.percent)}. El promedio del ciclo quedó en ${formatPercent(results.overallPercent)}.`,
          actionLabel: `Ver ${worst.area}`,
          apply: focus("areas", worst.area, "cumplimiento"),
        });
      } else if (!isClosed && gap > 10) {
        list.push({
          id: "area-atrasada",
          tone: "negative",
          icon: TrendingDown,
          claim: `${worst.area} es el área más atrasada del ciclo.`,
          evidence: `Va en ${formatPercent(worst.percent)} con ${Math.round(
            results.elapsed
          )} % del calendario corrido — ${gap} puntos por debajo de lo esperado, sobre ${worst.size} personas. El promedio del ciclo es ${formatPercent(results.overallPercent)}.`,
          actionLabel: `Ver ${worst.area}`,
          apply: focus("areas", worst.area, "cumplimiento"),
        });
      }
    }

    // 2. Cuello de botella de aprobación.
    const porAprobar = results.lifecycleCounts.get("por-aprobar") ?? 0;
    const porAjustar = results.lifecycleCounts.get("por-ajustar") ?? 0;
    const blocked = porAprobar + porAjustar;
    if (blocked > 0) {
      const share = Math.round((blocked / Math.max(1, results.objectiveCount)) * 100);
      list.push({
        id: "aprobacion",
        tone: share >= 15 ? "negative" : "warning",
        icon: AlertTriangle,
        claim:
          share >= 15
            ? `El ${share} % de los objetivos todavía no puede arrancar.`
            : `${blocked} objetivos siguen esperando el flujo de aprobación.`,
        evidence: isClosed
          ? `${porAprobar} nunca recibieron el visto bueno de su líder y ${porAjustar} se quedaron con cambios pedidos. El ciclo cerró contándolos en cero sin que nadie hubiera podido moverlos.`
          : `${porAprobar} esperan el visto bueno de su líder y ${porAjustar} volvieron con cambios pedidos. Ninguno de ellos suma avance, así que el ${formatPercent(
              results.overallPercent
            )} general se está calculando con objetivos que nadie puede mover todavía.`,
        actionLabel: "Ver los bloqueados",
        apply: focus("lifecycles", "por-aprobar", "cumplimiento"),
      });
    }

    // 3. Objetivos que avanzan sin conversación.
    const silent = entries.filter((entry) => entry.hasProgress && entry.commentCount === 0);
    if (silent.length > 0 && entries.length > 0) {
      const share = Math.round((silent.length / entries.length) * 100);
      if (share >= 30) {
        list.push({
          id: "sin-conversacion",
          tone: "info",
          icon: MessageSquareOff,
          claim: `${share} % de los objetivos con avance no tienen un solo comentario.`,
          evidence: `${silent.length} objetivos registran cifras pero ninguna explicación. ${
            isClosed
              ? "El ciclo cerró sin que quede por escrito por qué subieron o bajaron"
              : "Al cierre nadie va a poder decir por qué subieron o bajaron"
          }, y esa es justo la conversación que un ciclo de objetivos debería dejar.`,
          actionLabel: "Ver colaboradores",
          apply: () => {
            filters.clearAll();
            onGoTo("colaboradores");
          },
        });
      }
    }

    // 4. Desbalance de peso: mucho peso en objetivos que no arrancan.
    const stalledWeight = entries
      .filter((entry) => !entry.hasProgress)
      .reduce((sum, entry) => sum + entry.objective.weight, 0);
    const totalWeight = entries.reduce((sum, entry) => sum + entry.objective.weight, 0);
    if (totalWeight > 0) {
      const share = Math.round((stalledWeight / totalWeight) * 100);
      if (share >= 25) {
        list.push({
          id: "peso-detenido",
          tone: "warning",
          icon: Scale,
          claim: isClosed
            ? `El ${share} % del peso del ciclo cerró sin ningún avance reportado.`
            : `El ${share} % del peso del ciclo está en objetivos sin ningún avance.`,
          evidence: isClosed
            ? `No es lo mismo cerrar con muchos objetivos quietos que cerrar quietos los que más pesan. Ese peso por sí solo le puso techo al resultado en ${100 - share} %, sin importar cómo le fue al resto.`
            : `No es lo mismo tener muchos objetivos quietos que tener quietos los que más pesan. Aquí el peso detenido supera un cuarto del total: aunque todo lo demás llegue al 100 %, el ciclo no puede pasar de ${100 - share} %.`,
          actionLabel: "Ver los detenidos",
          apply: focus("lifecycles", "por-iniciar", "cumplimiento"),
        });
      }
    }

    // 5. Riesgo concentrado. Solo mientras el ciclo siga vivo: en uno cerrado
    // el riesgo ya se resolvió, para bien o para mal, y decirlo ahora sería
    // repetir la banda de resultado con otra palabra.
    const alto = results.riskCounts.get("alto") ?? 0;
    if (!isClosed && alto > 0) {
      list.push({
        id: "riesgo-alto",
        tone: "negative",
        icon: AlertTriangle,
        claim: `${alto} ${alto === 1 ? "persona está" : "personas están"} en riesgo alto de no cumplir.`,
        evidence: `Su avance va 25 puntos o más por debajo del calendario ya corrido. Con ${results.daysLeft} ${
          Math.abs(results.daysLeft) === 1 ? "día" : "días"
        } ${results.daysLeft >= 0 ? "por delante" : "de cerrado el ciclo"}, es el grupo donde una conversación cambia el resultado.`,
        actionLabel: "Ver en riesgo alto",
        apply: focus("risks", "alto", "colaboradores"),
      });
    }

    return list;
  }, [results, rows, entries, filters, onGoTo]);

  return (
    <div className="flex flex-col gap-4">
      <section className="flex items-start gap-3.5 rounded-2xl border border-ai-border bg-ai-bg p-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface shadow-card">
          <Sparkles className="size-4 text-ai-gradient" strokeWidth={2.3} />
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-bold text-text-primary">
            {findings.length === 0
              ? "Sin hallazgos que reportar"
              : `${findings.length} ${findings.length === 1 ? "hallazgo" : "hallazgos"} sobre este ciclo`}
          </p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-text-secondary">
            Cada afirmación viene con la evidencia que la sostiene y con el atajo a la vista donde
            se puede hacer algo al respecto. Todo sale de los mismos números de las demás pestañas.
          </p>
        </div>
      </section>

      {findings.length === 0 ? (
        <EmptyState
          title="Nada preocupante por ahora"
          description="Ni el calendario, ni las aprobaciones, ni el reparto de pesos muestran algo fuera de lugar en este ciclo."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {findings.map((finding, index) => (
            <FindingCard key={finding.id} finding={finding} numbering={index + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

const TONE_STYLES = {
  negative: {
    border: "border-red-200/70 dark:border-red-800/40",
    chip: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  },
  warning: {
    border: "border-amber-200/70 dark:border-amber-800/40",
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  },
  info: {
    border: "border-blue-200/70 dark:border-blue-800/40",
    chip: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  },
} as const;

function FindingCard({ finding, numbering }: { finding: Finding; numbering: number }) {
  const tone = TONE_STYLES[finding.tone];
  return (
    <article className={cn("flex flex-col gap-3 rounded-2xl border bg-surface p-5 shadow-card", tone.border)}>
      <header className="flex items-start gap-3">
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl", tone.chip)}>
          <finding.icon className="size-4" strokeWidth={2.3} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-bold uppercase tracking-wide text-text-muted">
            Hallazgo {numbering}
          </p>
          <p className="mt-0.5 text-[14.5px] font-bold leading-snug tracking-tight text-text-primary">
            {finding.claim}
          </p>
        </div>
      </header>

      <p className="border-l-2 border-border pl-3.5 text-[12.5px] leading-relaxed text-text-secondary">
        {finding.evidence}
      </p>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={finding.apply} className="gap-1.5 text-[12.5px]">
          {finding.actionLabel}
          <ArrowRight className="size-3.5" strokeWidth={2.4} />
        </Button>
      </div>
    </article>
  );
}
