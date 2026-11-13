"use client";

import { PauseIcon, PlayIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

/**
 * Controle da esteira. Por padrão ela anda; em aparelhos com "reduzir
 * movimento" começa parada, e o botão liga o movimento mesmo assim. Atende ao
 * critério de pausar conteúdo que se move sozinho (WCAG 2.2.2).
 */
export const LibraryMarqueeFrame = ({
  caption,
  children,
  heading,
}: {
  readonly caption: string;
  readonly children: ReactNode;
  readonly heading: ReactNode;
}) => {
  const [playing, setPlaying] = useState<boolean | null>(null);

  useEffect(() => {
    setPlaying(
      (current) => current ?? !window.matchMedia(reducedMotionQuery).matches
    );
  }, []);

  let state: "paused" | "playing" | undefined;
  if (playing !== null) {
    state = playing ? "playing" : "paused";
  }

  return (
    <>
      <div className="library-marquee__head">
        {heading}
        <div className="library-marquee__controls">
          <p className="hidden text-[#7A5A69] text-xs md:block">{caption}</p>
          <button
            aria-pressed={playing === false}
            className="library-marquee__toggle"
            onClick={() => setPlaying((current) => !(current ?? true))}
            type="button"
          >
            {playing === false ? (
              <>
                <PlayIcon aria-hidden="true" /> Movimentar esteira
              </>
            ) : (
              <>
                <PauseIcon aria-hidden="true" /> Pausar esteira
              </>
            )}
          </button>
        </div>
      </div>
      <div className="library-marquee__viewport" data-state={state}>
        {children}
      </div>
    </>
  );
};
