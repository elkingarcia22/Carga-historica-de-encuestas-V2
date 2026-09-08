import * as React from "react";

export interface DraggablePosition {
  /** Top-left corner, in viewport pixels. */
  x: number;
  y: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Lets a `position: fixed` card be picked up by a grip and dropped anywhere
 * on screen, falling back to its own CSS-defined corner until the reader
 * drags it for the first time.
 *
 * Unlike the floating action rail's `useDraggableRail`, this keeps its
 * position in component-local state rather than a module-level singleton —
 * each caller gets its own independent draggable card instead of all of them
 * fighting over one shared spot.
 */
export function useDraggablePosition() {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState<DraggablePosition | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const dragOffsetRef = React.useRef<{ x: number; y: number } | null>(null);

  const clampToViewport = React.useCallback((x: number, y: number): DraggablePosition => {
    const rect = cardRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 0;
    const height = rect?.height ?? 0;
    return {
      x: clamp(x, 0, Math.max(window.innerWidth - width, 0)),
      y: clamp(y, 0, Math.max(window.innerHeight - height, 0)),
    };
  }, []);

  // Keeps a dragged card on-screen if the viewport shrinks under it.
  React.useEffect(() => {
    if (!position) return;
    const onResize = () => setPosition((current) => (current ? clampToViewport(current.x, current.y) : current));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [position, clampToViewport]);

  const onGripPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragOffsetRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onGripPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const offset = dragOffsetRef.current;
    if (!offset) return;
    setPosition(clampToViewport(event.clientX - offset.x, event.clientY - offset.y));
  };

  const endGripDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragOffsetRef.current) return;
    dragOffsetRef.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const resetPosition = React.useCallback(() => {
    dragOffsetRef.current = null;
    setPosition(null);
  }, []);

  return {
    cardRef,
    position,
    isDragging,
    resetPosition,
    gripHandlers: {
      onPointerDown: onGripPointerDown,
      onPointerMove: onGripPointerMove,
      onPointerUp: endGripDrag,
      onPointerCancel: endGripDrag,
      onDoubleClick: resetPosition,
    },
  } as const;
}
