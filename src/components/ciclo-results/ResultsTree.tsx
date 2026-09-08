import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SECTION_HEADER_DIVIDER,
  SIBLING_DIVIDER,
  depthTheme,
} from "@/components/survey-builder/depthTheme";
import { cascadeContainer, cascadeItem } from "@/lib/cascadeAnimation";
import { useResetOnChange } from "@/lib/useResetOnChange";
import type { ResultNode } from "./resultsModel";

/**
 * El outline de resultados: secciones y subsecciones.
 *
 * Es el mismo chrome que usa el reporte de una encuesta —raíz como tarjeta con
 * badge numérico, hijos como filas de outline colgando de un riel, hermanos
 * separados por una línea— porque las dos pantallas son el mismo producto y
 * una jerarquía que se ve distinta en cada una le enseña al lector que no son
 * la misma cosa.
 *
 * Lo que cambia entre ejes es solo el contenido de los nodos; el árbol no
 * sabe si está mirando objetivos de empresa o áreas.
 */

interface ResultsTreeProps {
  nodes: readonly ResultNode[];
  /** Lo que va al final de la fila de un nodo: su avance, su estado. */
  renderMetric: (node: ResultNode, depth: number) => React.ReactNode;
  /** Contenido propio de un nodo, antes de sus hijos. Para las hojas. */
  renderBody?: (node: ResultNode, depth: number) => React.ReactNode;
  /** Cuántos niveles de profundidad se pintan. Más allá, el nodo se cierra. */
  maxDepth?: number;
  /** Todo abierto de entrada. Para una ficha, donde se lee de corrido. */
  expandAll?: boolean;
  onSelectNode?: (node: ResultNode) => void;
}

export function ResultsTree({
  nodes,
  renderMetric,
  renderBody,
  maxDepth = 4,
  expandAll = false,
  onSelectNode,
}: ResultsTreeProps) {
  // Una raíz abierta a la vez: una sección es una pantalla, no una columna.
  const [openIds, setOpenIds] = React.useState<ReadonlySet<string>>(() =>
    expandAll ? new Set(nodes.map((node) => node.id)) : new Set([nodes[0]?.id ?? ""])
  );

  // Cambiar de eje —o de ciclo— reinicia qué está abierto.
  useResetOnChange(nodes.map((node) => node.id).join("|"), () =>
    setOpenIds(expandAll ? new Set(nodes.map((node) => node.id)) : new Set([nodes[0]?.id ?? ""]))
  );

  const toggle = (id: string) =>
    setOpenIds((current) => {
      const next = new Set(expandAll ? current : []);
      if (current.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const body = { renderMetric, renderBody, maxDepth, expandAll, onSelectNode };

  return (
    <div className="flex flex-col gap-4">
      {nodes.map((node, index) => (
        <RootNode
          key={node.id}
          node={node}
          numbering={index + 1}
          isOpen={openIds.has(node.id)}
          onToggle={() => toggle(node.id)}
          {...body}
        />
      ))}
    </div>
  );
}

type BodyProps = Pick<
  ResultsTreeProps,
  "renderMetric" | "renderBody" | "maxDepth" | "expandAll" | "onSelectNode"
>;

function RootNode({
  node,
  numbering,
  isOpen,
  onToggle,
  ...body
}: BodyProps & {
  node: ResultNode;
  numbering: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const hasChildren = node.children.length > 0;

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-label={isOpen ? `Contraer ${node.title}` : `Expandir ${node.title}`}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggle();
          }
        }}
        className={cn(
          "group flex items-start gap-3.5 bg-muted/40 px-6 py-5 transition-colors hover:bg-muted/60 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30",
          isOpen && ["border-b", SECTION_HEADER_DIVIDER]
        )}
      >
        <div className="mt-1 shrink-0 rounded-md p-0.5 text-muted-foreground/50 transition-colors group-hover:bg-border/40 group-hover:text-text-primary">
          <ChevronUp
            className={cn("h-4 w-4 transition-transform duration-300", !isOpen && "rotate-180")}
            strokeWidth={2.5}
          />
        </div>

        <span
          aria-hidden
          className="mt-0.5 flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/60 px-1 text-[10px] font-bold tabular-nums text-muted-foreground"
        >
          {numbering}
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-1 py-0.5 text-[14px] font-bold tracking-tight text-text-primary">
            {node.title}
            {node.subtitle && (
              <span className="text-[12px] font-medium tracking-normal text-muted-foreground">
                {node.subtitle}
              </span>
            )}
          </p>
        </div>

        <div
          className="flex shrink-0 items-center gap-2.5 pt-0.5"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {body.renderMetric(node, 1)}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="flex min-h-0 flex-col gap-4 px-6 py-5">
              {body.renderBody?.(node, 1)}
              {hasChildren && <ChildList nodes={node.children} depth={2} {...body} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function ChildList({
  nodes,
  depth,
  ...body
}: BodyProps & { nodes: readonly ResultNode[]; depth: number }) {
  return (
    <motion.ul
      className={cn("flex flex-col", SIBLING_DIVIDER)}
      initial="hidden"
      animate="show"
      variants={cascadeContainer}
    >
      {nodes.map((node, index) => (
        <ChildRow
          key={node.id}
          node={node}
          numbering={index + 1}
          depth={depth}
          defaultOpen={body.expandAll || (depth === 2 && index === 0)}
          {...body}
        />
      ))}
    </motion.ul>
  );
}

function ChildRow({
  node,
  numbering,
  depth,
  defaultOpen,
  ...body
}: BodyProps & {
  node: ResultNode;
  numbering: number;
  depth: number;
  defaultOpen: boolean;
}) {
  const [expanded, setExpanded] = React.useState(defaultOpen);
  const maxDepth = body.maxDepth ?? 4;
  const canOpen = node.children.length > 0 && depth < maxDepth;
  const theme = depthTheme(depth);

  const activate = () => {
    if (canOpen) {
      setExpanded((current) => !current);
      return;
    }
    body.onSelectNode?.(node);
  };

  const isInteractive = canOpen || Boolean(body.onSelectNode);

  return (
    <motion.li variants={cascadeItem}>
      <div
        role={isInteractive ? "button" : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        aria-expanded={canOpen ? expanded : undefined}
        aria-label={canOpen ? (expanded ? `Contraer ${node.title}` : `Expandir ${node.title}`) : undefined}
        onClick={isInteractive ? activate : undefined}
        onKeyDown={(event) => {
          if (!isInteractive) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            activate();
          }
        }}
        className={cn(
          "group -mx-2 flex items-start gap-2 rounded-lg p-2 transition-colors",
          isInteractive &&
            "cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
        )}
      >
        <div
          className={cn(
            "mt-1 shrink-0 rounded-md p-0.5 text-muted-foreground/60 transition-colors",
            canOpen && "group-hover:bg-border/40 group-hover:text-text-primary",
            !canOpen && "opacity-0"
          )}
        >
          <ChevronRight
            className={cn("h-3.5 w-3.5 transition-transform duration-200", expanded && canOpen && "rotate-90")}
            strokeWidth={2.5}
          />
        </div>

        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-md px-1 text-[10px] font-bold tabular-nums transition-colors group-hover:border-border",
            theme.chip
          )}
        >
          {numbering}
        </span>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "-ml-1 flex w-full flex-wrap items-baseline gap-x-2 gap-y-1 rounded-md px-1 py-0.5 font-bold tracking-tight text-text-primary",
              theme.title
            )}
          >
            {node.title}
            {node.subtitle && (
              <span className="text-[11px] font-medium tracking-normal text-muted-foreground">
                {node.subtitle}
              </span>
            )}
          </p>
        </div>

        <div
          className="mt-0.5 flex shrink-0 items-center gap-2.5"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {body.renderMetric(node, depth)}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && canOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className={cn("mt-2.5 flex flex-col gap-3 pb-1", theme.rail, theme.railOffset)}>
              {body.renderBody?.(node, depth)}
              <ChildList nodes={node.children} depth={depth + 1} {...body} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
