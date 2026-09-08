import * as React from "react";
import { createPortal } from "react-dom";

/**
 * The Agente IA panel's anchor, sitting beside the shell's main content
 * column rather than above it. A screen's chat trigger renders the panel
 * wherever it happens to live in the tree, but the panel itself needs to be a
 * flex sibling of the content column so opening it narrows that column
 * instead of floating over it — the same reason the floating rail has its
 * own anchor (`shellRailSlot`) instead of rendering in place.
 */
const ShellAgentPanelSlotContext = React.createContext<HTMLElement | null>(null);

export const ShellAgentPanelSlotProvider = ShellAgentPanelSlotContext.Provider;

/** Renders its children into the shell's side anchor, next to the content column. */
export function ShellAgentPanelSlot({ children }: { children: React.ReactNode }) {
  const host = React.useContext(ShellAgentPanelSlotContext);
  if (!host) return null;
  return createPortal(children, host);
}
