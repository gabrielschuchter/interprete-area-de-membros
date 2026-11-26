"use client";

import {
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export interface FloatingPosition {
  readonly x: number;
  readonly y: number;
}

/** Distância mínima entre a janela e as bordas da tela, em px. */
const EDGE = 8;
/** Passo das setas do teclado sobre a alça, em px. */
const KEY_STEP = 24;
/** Arrasto menor que isto é tratado como clique, em px. */
const DRAG_THRESHOLD = 4;

export const clampFloatingPosition = (
  position: FloatingPosition,
  size: { readonly height: number; readonly width: number },
  viewport: { readonly height: number; readonly width: number }
): FloatingPosition => ({
  x: Math.min(
    Math.max(EDGE, position.x),
    Math.max(EDGE, viewport.width - size.width - EDGE)
  ),
  y: Math.min(
    Math.max(EDGE, position.y),
    Math.max(EDGE, viewport.height - size.height - EDGE)
  ),
});

const readStored = (key: string): FloatingPosition | null => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<FloatingPosition>;
    return typeof parsed.x === "number" && typeof parsed.y === "number"
      ? { x: parsed.x, y: parsed.y }
      : null;
  } catch {
    return null;
  }
};

const writeStored = (key: string, position: FloatingPosition | null) => {
  try {
    if (position) {
      window.localStorage.setItem(key, JSON.stringify(position));
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Sem armazenamento (aba anônima, bloqueio): a posição vale só nesta visita.
  }
};

const measure = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  return {
    rect,
    size: { height: rect.height, width: rect.width },
    viewport: { height: window.innerHeight, width: window.innerWidth },
  };
};

/**
 * Janela que a pessoa arrasta pela alça e que lembra onde foi deixada.
 * Sem posição salva, o elemento fica onde o CSS o põe; depois do primeiro
 * arrasto passa a usar `left/top` fixos, sempre dentro da tela.
 */
export const useFloatingPosition = (
  elementRef: RefObject<HTMLElement | null>,
  storageKey: string
) => {
  const [position, setPosition] = useState<FloatingPosition | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    moved: boolean;
    offsetX: number;
    offsetY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const positionRef = useRef<FloatingPosition | null>(null);
  positionRef.current = position;

  const clampToViewport = useCallback(
    (next: FloatingPosition) => {
      const element = elementRef.current;
      if (!element) {
        return next;
      }
      const { size, viewport } = measure(element);
      return clampFloatingPosition(next, size, viewport);
    },
    [elementRef]
  );

  useEffect(() => {
    const stored = readStored(storageKey);
    if (stored) {
      setPosition(clampToViewport(stored));
    }
  }, [clampToViewport, storageKey]);

  useEffect(() => {
    const onResize = () => {
      const current = positionRef.current;
      if (current) {
        setPosition(clampToViewport(current));
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampToViewport]);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    const element = elementRef.current;
    if (!element || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }
    const { rect } = measure(element);
    dragRef.current = {
      moved: false,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    if (
      !drag.moved &&
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <
        DRAG_THRESHOLD
    ) {
      return;
    }
    drag.moved = true;
    setDragging(true);
    event.preventDefault();
    setPosition(
      clampToViewport({
        x: event.clientX - drag.offsetX,
        y: event.clientY - drag.offsetY,
      })
    );
  };

  const endDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
    if (drag?.moved) {
      writeStored(storageKey, positionRef.current);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const element = elementRef.current;
    if (!element) {
      return;
    }
    const deltas: Record<string, [number, number]> = {
      ArrowDown: [0, KEY_STEP],
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, -KEY_STEP],
    };
    if (event.key === "Home") {
      event.preventDefault();
      setPosition(null);
      writeStored(storageKey, null);
      return;
    }
    const delta = deltas[event.key];
    if (!delta) {
      return;
    }
    event.preventDefault();
    const { rect } = measure(element);
    const next = clampToViewport({
      x: rect.left + delta[0],
      y: rect.top + delta[1],
    });
    setPosition(next);
    writeStored(storageKey, next);
  };

  const reset = () => {
    setPosition(null);
    writeStored(storageKey, null);
  };

  return {
    dragging,
    handleProps: {
      onKeyDown,
      onLostPointerCapture: () => {
        dragRef.current = null;
        setDragging(false);
      },
      onPointerCancel: endDrag,
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
    },
    position,
    reset,
  };
};
