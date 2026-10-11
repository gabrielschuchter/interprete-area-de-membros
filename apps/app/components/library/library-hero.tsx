"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { BookmarkIcon } from "lucide-react";
import Link from "next/link";

export const LibraryHero = () => (
  <section
    aria-labelledby="library-hero-title"
    className="relative isolate overflow-hidden rounded-lg bg-[linear-gradient(120deg,#410230_0%,#560A2A_55%,#7A1230_100%)] text-[#F1EBE8] max-md:bg-[linear-gradient(150deg,#410230_0%,#5E0E2B_60%,#7A1230_100%)] md:min-h-[340px]"
  >
    <div className="relative z-10 max-w-[62%] px-8 pt-12 pb-8 max-md:flex max-md:max-w-none max-md:flex-col max-md:gap-3 max-md:px-[22px] max-md:pt-6 max-md:pb-2 md:px-14 md:pt-14 md:pb-10 min-[1250px]:max-w-[calc(62%_+_7rem)]">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-data text-[#F1EBE8]/80 text-[10px] uppercase tracking-[.14em] max-md:tracking-[.1em] md:text-[11px]">
        Arquivo de estudo · Curadoria
        <span aria-hidden="true" className="inline-flex items-center gap-1.5">
          <span className="h-px w-6 bg-[#E9C48E]/60" />
          <span className="size-1 rotate-45 bg-[#E9C48E]/80" />
          <span className="h-px w-4 bg-[#E9C48E]/60" />
        </span>
      </p>
      <h1
        className="mt-4 max-w-full font-display font-semibold text-[#F1EBE8] text-[36px] leading-[1.05] tracking-[-.02em] max-md:mt-0 md:text-[54px] md:leading-[1.04] min-[1250px]:whitespace-nowrap min-[1250px]:text-5xl!"
        id="library-hero-title"
      >
        Biblioteca Interprete.
      </h1>
      <p className="mt-3 max-w-[400px] text-[#F1EBE8]/90 text-sm leading-[1.6] max-md:mt-0 md:text-base">
        Materiais selecionados para complementar seus estudos em Prática Baseada
        em Evidências.
      </p>
      <Button
        asChild
        className="mt-5 h-11 w-auto border-2 border-[#BFA9A3] bg-transparent px-5 font-semibold text-[#F1EBE8] shadow-none hover:bg-white/10 hover:text-white max-md:mt-1 max-md:h-12 max-md:w-full md:mt-5"
        variant="outline"
      >
        <Link href="/biblioteca/pessoal" prefetch={false}>
          <BookmarkIcon aria-hidden="true" className="size-4" />
          Minha biblioteca pessoal
        </Link>
      </Button>
    </div>
    <div
      aria-hidden="true"
      className="pointer-events-none absolute right-0 bottom-0 hidden h-full w-[44%] max-w-[470px] md:block"
    >
      {/* The approved hero artwork is one isolated static SVG document. */}
      {/* biome-ignore lint/performance/noImgElement: local SVG keeps its handoff viewBox and does not need the image optimizer. */}
      <img
        alt=""
        className="size-full object-contain object-right-bottom"
        decoding="async"
        height={340}
        src="/library/illustrations/hero-bookshelf.svg"
        width={470}
      />
    </div>
    <div
      aria-hidden="true"
      className="pointer-events-none relative mt-2 h-[120px] w-full overflow-hidden md:hidden"
    >
      {/* The approved mobile shelf is static so repeated loads stay identical. */}
      {/* biome-ignore lint/performance/noImgElement: local SVG keeps its handoff viewBox and does not need the image optimizer. */}
      <img
        alt=""
        className="size-full object-cover object-center"
        decoding="async"
        height={120}
        src="/library/illustrations/mobile-bookshelf.svg"
        width={350}
      />
    </div>
  </section>
);
