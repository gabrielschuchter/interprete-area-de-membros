"use client";

import { PauseIcon, PlayIcon } from "lucide-react";
import { type ReactNode, useState } from "react";

/**
 * Controle da esteira. Ela sempre começa andando, e o botão pausa e retoma o
 * movimento (WCAG 2.2.2).
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
  const [playing, setPlaying] = useState(true);
  const state = playing ? "playing" : "paused";

  return (
    <>
      <div className="library-marquee__head">
        {heading}
        <div className="library-marquee__controls">
          <p className="hidden text-[#7A5A69] text-xs md:block">{caption}</p>
          <button
            aria-pressed={!playing}
            className="library-marquee__toggle"
            onClick={() => setPlaying((current) => !current)}
            type="button"
          >
            {playing ? (
              <>
                <PauseIcon aria-hidden="true" /> Pausar esteira
              </>
            ) : (
              <>
                <PlayIcon aria-hidden="true" /> Movimentar esteira
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
