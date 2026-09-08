import * as React from "react";
import { Button } from "@/components/ui/button";

interface InlineDeleteConfirmProps {
  message: React.ReactNode;
  ariaLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * El mismo "¿seguro?" en el sitio, usado para todo lo que está por
 * eliminarse — toma el lugar del disparador que lo abrió, en vez de un
 * modal que apaga la pantalla entera por una sola decisión.
 *
 * Mismo patrón que en el creador de encuestas (secciones, subsecciones,
 * preguntas): confirmar en línea, no en un diálogo aparte.
 */
export function InlineDeleteConfirm({
  message,
  ariaLabel,
  onCancel,
  onConfirm,
}: InlineDeleteConfirmProps) {
  return (
    <div
      role="alertdialog"
      aria-label={ariaLabel}
      className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 animate-in fade-in duration-200"
    >
      <p className="min-w-0 text-[13px] leading-relaxed text-text-secondary">{message}</p>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" variant="outline" onClick={onCancel} className="rounded-full px-4">
          Cancelar
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={onConfirm}
          className="rounded-full px-4 font-semibold"
        >
          Eliminar
        </Button>
      </div>
    </div>
  );
}
