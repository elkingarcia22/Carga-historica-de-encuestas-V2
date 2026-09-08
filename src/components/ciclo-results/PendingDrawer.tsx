import * as React from "react";
import { Plus, Send } from "lucide-react";
import { DrawerShell } from "@/components/overlays";
import { Button } from "@/components/ui/button";
import { SheetFooter } from "@/components/ui/sheet";
import { InitialsAvatar, formatRelativeDate } from "@/components/ciclo-detail";
import { LifecycleChip } from "./ResultsChips";
import { SearchBox } from "./tableBridge";
import type { CicloResults } from "./resultsModel";

/**
 * Lo pendiente, en una lista sobre la que se puede actuar.
 *
 * Las tres franjas del resumen abren aquí. Cada una es una lista distinta pero
 * el mismo trato: quién, de qué área, desde cuándo, y un solo botón al pie que
 * hace lo único que hay que hacer con esa lista.
 */

export type PendingKind = "sin-objetivos" | "por-aprobar" | "por-ajustar";

const COPY: Readonly<
  Record<PendingKind, { title: string; description: string; action: string; noun: string }>
> = {
  "sin-objetivos": {
    title: "Colaboradores sin objetivos",
    description:
      "Pertenecen a un grupo que sí recibió objetivos en este ciclo, pero a ellos no les asignaron ninguno. Mientras sigan así no aparecen en ningún promedio.",
    action: "Crear objetivos para los seleccionados",
    noun: "colaboradores",
  },
  "por-aprobar": {
    title: "Objetivos por aprobar",
    description:
      "Escritos y enviados, esperando el visto bueno de su líder. Hasta que lo tengan no pueden reportar avance.",
    action: "Recordar aprobación a los líderes",
    noun: "objetivos",
  },
  "por-ajustar": {
    title: "Objetivos por ajustar",
    description:
      "Su líder pidió cambios y volvieron a quien los escribió. Tampoco cuentan hasta que se reenvíen y se aprueben.",
    action: "Recordar los ajustes pendientes",
    noun: "objetivos",
  },
};

/**
 * La pantalla lo monta con `key={kind}` y solo mientras está abierto, así que
 * la búsqueda arranca vacía en cada apertura sin un efecto que la limpie.
 */
export function PendingDrawer({
  kind,
  results,
  open,
  onOpenChange,
  onAct,
}: {
  kind: PendingKind;
  results: CicloResults;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAct: (kind: PendingKind, count: number) => void;
}) {
  const [search, setSearch] = React.useState("");
  const copy = COPY[kind];

  const items = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (kind === "sin-objetivos") {
      return results.withoutObjectives
        .filter(
          (collaborator) =>
            term === "" ||
            `${collaborator.name} ${collaborator.area} ${collaborator.leader ?? ""}`
              .toLowerCase()
              .includes(term)
        )
        .map((collaborator) => ({
          id: collaborator.id,
          name: collaborator.name,
          meta: `${collaborator.area} · ${collaborator.leader ?? "Sin líder"}`,
          detail: "",
          lifecycle: null,
        }));
    }

    const target = kind === "por-aprobar" ? "por-aprobar" : "por-ajustar";
    return results.scoredEntries
      .filter((entry) => entry.lifecycle === target)
      .filter(
        (entry) =>
          term === "" ||
          `${entry.person.collaborator.name} ${entry.objective.title} ${entry.person.collaborator.area}`
            .toLowerCase()
            .includes(term)
      )
      .map((entry) => ({
        id: `${entry.personId}::${entry.objective.id}`,
        name: entry.objective.title || "Objetivo sin nombre",
        meta: `${entry.person.collaborator.name} · ${entry.person.collaborator.area}`,
        detail:
          entry.tracked.review?.date !== null && entry.tracked.review?.date !== undefined
            ? `Desde ${formatRelativeDate(entry.tracked.review.date)}`
            : "",
        lifecycle: entry.lifecycle,
      }));
  }, [kind, results, search]);

  return (
    <DrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title={copy.title}
      description={copy.description}
      size="xl"
      className="!w-[32vw] !max-w-[40rem] !min-w-[30rem] gap-0 !bg-background"
      disablePadding
      footer={
        <SheetFooter className="border-t border-border/60 bg-surface px-4 py-3">
          <Button
            className="w-full gap-2 font-semibold"
            disabled={items.length === 0}
            onClick={() => onAct(kind, items.length)}
          >
            {kind === "sin-objetivos" ? <Plus className="size-4" /> : <Send className="size-4" />}
            {copy.action} ({items.length})
          </Button>
        </SheetFooter>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 bg-background px-4 py-4">
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder={`Buscar en ${copy.noun}…`}
          className="w-full"
        />

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-[12.5px] text-text-muted">
            Nada pendiente por aquí.
          </p>
        ) : (
          <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-border/50 bg-surface px-3 py-2.5"
              >
                <InitialsAvatar name={item.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-text-primary">{item.name}</p>
                  <p className="truncate text-[11.5px] text-text-muted">
                    {item.meta}
                    {item.detail && ` · ${item.detail}`}
                  </p>
                </div>
                {item.lifecycle && <LifecycleChip lifecycle={item.lifecycle} size="sm" />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </DrawerShell>
  );
}
