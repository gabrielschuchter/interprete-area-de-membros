"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
  Children,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const SCROLL_SHARE = 0.9;
const EDGE_ZONE_MAX = 120;
const EDGE_ZONE_SHARE = 0.14;
const EDGE_SCROLL_SPEED = 10;

const arrowClass =
  "absolute top-1/2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-[#410230] text-[#F1EBE8] opacity-0 transition-opacity hover:bg-[#560A2A] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F7C873] group-hover/rail:opacity-100 md:flex";

/**
 * Esteira das folhas em andamento: duas por vez no desktop. O mouse perto das
 * bordas rola para o lado (como as estantes da Biblioteca), as setas rolam uma
 * página e no celular o dedo arrasta com encaixe.
 */
export const ExerciseSheetsRail = ({
  children,
  label,
}: {
  readonly children: ReactNode;
  readonly label: string;
}) => {
  const railRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef(0);
  const frameRef = useRef(0);
  const [canPrevious, setCanPrevious] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = useCallback(() => {
    const rail = railRef.current;
    if (!rail) {
      return;
    }
    setCanPrevious(rail.scrollLeft > 1);
    setCanNext(rail.scrollWidth - rail.clientWidth - rail.scrollLeft > 1);
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    update();
    if (!rail) {
      return;
    }
    rail.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      rail.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      speedRef.current = 0;
      cancelAnimationFrame(frameRef.current);
    };
  }, [update]);

  const tick = () => {
    const rail = railRef.current;
    if (!rail || speedRef.current === 0) {
      frameRef.current = 0;
      return;
    }
    rail.scrollLeft += speedRef.current;
    frameRef.current = requestAnimationFrame(tick);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rail = railRef.current;
    if (
      event.pointerType !== "mouse" ||
      !rail ||
      rail.scrollWidth <= rail.clientWidth
    ) {
      speedRef.current = 0;
      return;
    }
    const rect = rail.getBoundingClientRect();
    const zone = Math.min(EDGE_ZONE_MAX, rect.width * EDGE_ZONE_SHARE);
    const x = event.clientX - rect.left;
    let speed = 0;
    if (x < zone) {
      speed = -(1 - x / zone) * EDGE_SCROLL_SPEED;
    } else if (x > rect.width - zone) {
      speed = (1 - (rect.width - x) / zone) * EDGE_SCROLL_SPEED;
    }
    speedRef.current = speed;
    if (speed !== 0 && frameRef.current === 0) {
      frameRef.current = requestAnimationFrame(tick);
    }
  };

  const scroll = (direction: 1 | -1) => {
    const rail = railRef.current;
    if (rail) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
      rail.scrollBy({
        behavior: reduce.matches ? "auto" : "smooth",
        left: direction * rail.clientWidth * SCROLL_SHARE,
      });
    }
  };

  return (
    <div
      className="group/rail relative"
      onPointerLeave={() => {
        speedRef.current = 0;
      }}
      onPointerMove={onPointerMove}
    >
      {canPrevious && (
        <button
          aria-label={`Voltar em ${label}`}
          className={`${arrowClass} left-2`}
          onClick={() => scroll(-1)}
          type="button"
        >
          <ChevronLeftIcon aria-hidden="true" className="size-5" />
        </button>
      )}
      {canNext && (
        <button
          aria-label={`Avançar em ${label}`}
          className={`${arrowClass} right-2`}
          onClick={() => scroll(1)}
          type="button"
        >
          <ChevronRightIcon aria-hidden="true" className="size-5" />
        </button>
      )}
      <div
        className="-mx-1 flex gap-5 overflow-x-auto overscroll-x-contain px-1 py-3 [scrollbar-width:none] max-md:snap-x max-md:snap-mandatory md:gap-6 [&::-webkit-scrollbar]:hidden"
        ref={railRef}
      >
        {Children.map(children, (child) => (
          <div className="flex w-[88%] shrink-0 snap-start md:w-[calc(50%-12px)]">
            {child}
          </div>
        ))}
      </div>
    </div>
  );
};
