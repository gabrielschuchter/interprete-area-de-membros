"use client";

import "./library-rail.css";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef } from "react";

/** Velocidade da esteira parada em cena, em px/s. */
const DRIFT_SPEED = 32;
/** Quanto a velocidade persegue o alvo por segundo (aceleração e freada). */
const VELOCITY_EASING = 4;
/** Duração de um avanço ou recuo pelas setas, em ms. */
const NUDGE_DURATION = 820;
/** Quanto do visível cada seta passa. */
const NUDGE_SHARE = 0.72;
/** Limite de quadro, para a aba que volta do segundo plano não dar salto. */
const MAX_FRAME_SECONDS = 0.05;
/** Atrito do arrasto solto no toque, por segundo. */
const FLING_DECAY = 3.2;

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

interface Nudge {
  readonly distance: number;
  readonly start: number;
}

interface RailMotion {
  drag: {
    readonly id: number;
    lastTime: number;
    lastX: number;
    speed: number;
  } | null;
  fling: number;
  held: boolean;
  nudge: Nudge | null;
  nudgeDone: number;
  offset: number;
  velocity: number;
}

/** Deriva sozinha, acelerando ou freando até o alvo, e solta a inércia. */
const stepDrift = (motion: RailMotion, dt: number) => {
  const target = motion.held ? 0 : DRIFT_SPEED;
  motion.velocity +=
    (target - motion.velocity) * Math.min(1, VELOCITY_EASING * dt);
  motion.offset += (motion.velocity + motion.fling) * dt;
  motion.fling *= Math.exp(-FLING_DECAY * dt);
  if (Math.abs(motion.fling) < 4) {
    motion.fling = 0;
  }
};

/** Avanço das setas: curva com aceleração na saída e freada na chegada. */
const stepNudge = (motion: RailMotion, now: number) => {
  const active = motion.nudge;
  if (!active) {
    return;
  }
  const progress = Math.min(1, (now - active.start) / NUDGE_DURATION);
  const travelled = easeInOutCubic(progress) * active.distance;
  motion.offset += travelled - motion.nudgeDone;
  motion.nudgeDone = travelled;
  if (progress >= 1) {
    motion.nudge = null;
    motion.nudgeDone = 0;
  }
};

/**
 * Esteira dos materiais mais acessados. Anda sozinha, freia sob o mouse ou o
 * foco e volta a andar ao sair. As setas laterais passam ou voltam a faixa com
 * aceleração e freada; cliques seguidos somam distância. No toque, a faixa
 * pode ser arrastada e segue com inércia. O laço usa duas faixas iguais: a
 * posição volta uma faixa inteira sem que se veja o salto.
 */
export const LibraryRail = ({
  caption,
  children,
  heading,
}: {
  readonly caption: string;
  readonly children: ReactNode;
  readonly heading: ReactNode;
}) => {
  const railRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const motion = useRef<RailMotion>({
    drag: null,
    fling: 0,
    held: false,
    nudge: null,
    nudgeDone: 0,
    offset: 0,
    velocity: 0,
  });

  const laneWidth = useCallback(() => {
    const lane = trackRef.current?.firstElementChild;
    return lane instanceof HTMLElement ? lane.offsetWidth : 0;
  }, []);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, MAX_FRAME_SECONDS);
      last = now;

      const state = motion.current;
      if (!state.drag) {
        stepDrift(state, dt);
      }
      stepNudge(state, now);

      const width = laneWidth();
      if (width > 0) {
        state.offset = ((state.offset % width) + width) % width;
      }
      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(${-state.offset}px, 0, 0)`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [laneWidth]);

  // Mouse em cima ou foco de teclado seguram a faixa; no toque, arrastar
  // move a faixa e soltar a deixa seguir com inércia.
  useEffect(() => {
    const rail = railRef.current;
    const viewport = viewportRef.current;
    if (!(rail && viewport)) {
      return;
    }
    const onEnter = (event: PointerEvent) => {
      if (event.pointerType === "mouse") {
        motion.current.held = true;
      }
    };
    const onLeave = (event: PointerEvent) => {
      if (event.pointerType === "mouse") {
        motion.current.held = false;
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (
        event.target instanceof Element &&
        event.target.matches(":focus-visible")
      ) {
        motion.current.held = true;
      }
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!rail.contains(event.relatedTarget as Node | null)) {
        motion.current.held = false;
      }
    };
    const onDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse") {
        return;
      }
      motion.current.drag = {
        id: event.pointerId,
        lastTime: event.timeStamp,
        lastX: event.clientX,
        speed: 0,
      };
      motion.current.nudge = null;
      motion.current.nudgeDone = 0;
      motion.current.fling = 0;
      motion.current.velocity = 0;
    };
    const onMove = (event: PointerEvent) => {
      const current = motion.current.drag;
      if (!current || current.id !== event.pointerId) {
        return;
      }
      const dx = event.clientX - current.lastX;
      const dt = Math.max(1, event.timeStamp - current.lastTime) / 1000;
      motion.current.offset -= dx;
      current.speed = -dx / dt;
      current.lastX = event.clientX;
      current.lastTime = event.timeStamp;
    };
    const onUp = (event: PointerEvent) => {
      const current = motion.current.drag;
      if (!current || current.id !== event.pointerId) {
        return;
      }
      motion.current.fling = Math.max(-2400, Math.min(2400, current.speed));
      motion.current.drag = null;
    };
    const onCancel = () => {
      motion.current.drag = null;
    };
    rail.addEventListener("pointerenter", onEnter);
    rail.addEventListener("pointerleave", onLeave);
    rail.addEventListener("focusin", onFocusIn);
    rail.addEventListener("focusout", onFocusOut);
    viewport.addEventListener("pointerdown", onDown);
    viewport.addEventListener("pointermove", onMove);
    viewport.addEventListener("pointerup", onUp);
    viewport.addEventListener("pointercancel", onCancel);
    return () => {
      rail.removeEventListener("pointerenter", onEnter);
      rail.removeEventListener("pointerleave", onLeave);
      rail.removeEventListener("focusin", onFocusIn);
      rail.removeEventListener("focusout", onFocusOut);
      viewport.removeEventListener("pointerdown", onDown);
      viewport.removeEventListener("pointermove", onMove);
      viewport.removeEventListener("pointerup", onUp);
      viewport.removeEventListener("pointercancel", onCancel);
    };
  }, []);

  const move = (direction: 1 | -1) => {
    const visible = viewportRef.current?.clientWidth ?? 0;
    const step = Math.max(160, visible * NUDGE_SHARE) * direction;
    const now = performance.now();
    const active = motion.current.nudge;
    // Clique durante um avanço: soma o que falta ao novo passo e recomeça a
    // curva a partir daí, sem tranco.
    const remaining = active ? active.distance - motion.current.nudgeDone : 0;
    motion.current.nudge = { distance: remaining + step, start: now };
    motion.current.nudgeDone = 0;
    motion.current.fling = 0;
  };

  return (
    <>
      <div className="library-rail__head">
        {heading}
        <p className="library-rail__caption">{caption}</p>
      </div>
      <div className="library-rail" ref={railRef}>
        <div className="library-rail__viewport" ref={viewportRef}>
          <div className="library-rail__track" ref={trackRef}>
            {children}
          </div>
        </div>
        <button
          aria-label="Voltar materiais"
          className="library-rail__arrow library-rail__arrow--prev"
          onClick={() => move(-1)}
          type="button"
        >
          <ChevronLeftIcon aria-hidden="true" />
        </button>
        <button
          aria-label="Avançar materiais"
          className="library-rail__arrow library-rail__arrow--next"
          onClick={() => move(1)}
          type="button"
        >
          <ChevronRightIcon aria-hidden="true" />
        </button>
      </div>
    </>
  );
};
