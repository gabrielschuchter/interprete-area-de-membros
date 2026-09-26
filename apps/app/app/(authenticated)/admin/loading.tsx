export default function AdminLoading() {
  return (
    <main className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
      <output aria-label="Carregando painel" className="block space-y-4">
        <div className="h-4 w-40 animate-pulse rounded-sm bg-muted" />
        <div className="h-16 max-w-2xl animate-pulse rounded-sm bg-muted" />
        <div className="grid gap-4 md:grid-cols-3">
          {["one", "two", "three"].map((item) => (
            <div
              className="h-36 animate-pulse rounded-sm border bg-muted/30"
              key={item}
            />
          ))}
        </div>
      </output>
    </main>
  );
}
