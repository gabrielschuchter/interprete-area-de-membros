export const ToolsHero = ({ subtitle }: { readonly subtitle: string }) => (
  <section
    aria-labelledby="tools-hero-title"
    className="relative isolate overflow-hidden rounded-lg bg-[linear-gradient(120deg,#410230_0%,#560A2A_55%,#7A1230_100%)] text-[#F1EBE8] max-md:bg-[linear-gradient(150deg,#410230_0%,#5E0E2B_60%,#7A1230_100%)] md:min-h-[300px]"
    data-tools-page-heading
  >
    <div className="relative z-10 max-w-[62%] px-8 pt-12 pb-8 max-md:flex max-md:max-w-none max-md:flex-col max-md:gap-3 max-md:px-[22px] max-md:pt-6 max-md:pb-2 md:px-14 md:pt-14 md:pb-10">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-data text-[#F1EBE8]/80 text-[10px] uppercase tracking-[.14em] max-md:tracking-[.1em] md:text-[11px]">
        Gabinete · Instrumentos de estudo
        <span aria-hidden="true" className="inline-flex items-center gap-1.5">
          <span className="h-px w-6 bg-[#E9C48E]/60" />
          <span className="size-1 rotate-45 bg-[#E9C48E]/80" />
          <span className="h-px w-4 bg-[#E9C48E]/60" />
        </span>
      </p>
      <h1
        className="mt-4 max-w-full font-display font-semibold text-[#F1EBE8] text-[36px] leading-[1.05] tracking-[-.02em] max-md:mt-0 max-[359px]:text-[30px] md:text-[54px] md:leading-[1.04]"
        id="tools-hero-title"
      >
        Sua bancada.
      </h1>
      <p className="mt-3 max-w-[400px] text-[#F1EBE8]/90 text-sm leading-[1.6] max-md:mt-0 md:text-base">
        {subtitle}
      </p>
    </div>
    <div
      aria-hidden="true"
      className="pointer-events-none absolute right-10 bottom-0 hidden h-[calc(100%-1rem)] md:block lg:right-14"
    >
      {/* biome-ignore lint/performance/noImgElement: static local artwork with a fixed aspect ratio. */}
      <img
        alt=""
        className="h-full w-auto"
        decoding="async"
        height={825}
        src="/tools/bancada.webp"
        width={600}
      />
    </div>
    <div
      aria-hidden="true"
      className="pointer-events-none relative mt-2 h-[120px] w-full overflow-hidden max-[359px]:h-[80px] md:hidden"
    >
      {/* biome-ignore lint/performance/noImgElement: static local artwork with a fixed aspect ratio. */}
      <img
        alt=""
        className="mx-auto h-[300px] w-auto max-w-none"
        decoding="async"
        height={825}
        src="/tools/bancada.webp"
        width={600}
      />
    </div>
  </section>
);
