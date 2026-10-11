const skeletonRows = ["row-1", "row-2", "row-3", "row-4", "row-5"];

const SavedLoading = () => (
  <main
    aria-busy="true"
    aria-label="Carregando itens salvos"
    className="mx-auto min-h-[calc(100svh-56px)] w-full max-w-[1040px] animate-pulse px-5 pt-8 pb-16 sm:px-8 lg:px-12"
  >
    <div className="h-3 w-24 rounded bg-[#E2D6D1]" />
    <div className="mt-8 h-14 w-48 rounded bg-[#E2D6D1]" />
    <div className="mt-4 h-4 w-full max-w-[420px] rounded bg-[#E2D6D1]" />
    <div className="mt-8 h-11 rounded border border-[#E2D6D1] bg-white" />
    <div className="mt-5 space-y-2">
      {skeletonRows.map((row) => (
        <div
          aria-hidden="true"
          className="h-20 border-[#E2D6D1] border-b"
          key={row}
        />
      ))}
    </div>
  </main>
);

export default SavedLoading;
