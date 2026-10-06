export default function AdminLibraryLoading() {
  return (
    <main
      className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14"
      data-route-loading
    >
      <output
        aria-busy="true"
        aria-label="Carregando catálogo da biblioteca"
        className="block"
      >
        <span className="sr-only">Carregando catálogo da biblioteca</span>
        <div className="h-4 w-40 animate-pulse rounded-sm bg-muted" />
        <div className="mt-10 h-12 max-w-2xl animate-pulse rounded-sm bg-muted/70" />
        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section aria-hidden="true" className="space-y-4">
            {["one", "two", "three", "four", "five"].map((item) => (
              <div
                className="h-24 animate-pulse rounded-sm border bg-muted/30"
                key={item}
              />
            ))}
          </section>
          <aside
            aria-hidden="true"
            className="h-96 animate-pulse rounded-sm border bg-muted/30"
          />
        </div>
      </output>
    </main>
  );
}
