const MembersLoading = () => (
  <div className="mx-auto w-full max-w-[1280px] animate-pulse px-5 py-16 sm:px-8 lg:px-12">
    <div className="h-3 w-40 bg-muted" />
    <div className="mt-6 h-16 max-w-2xl bg-muted" />
    <div className="mt-10 h-12 w-full max-w-xl bg-muted" />
    <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <div className="h-48 border bg-muted/60" key={item} />
      ))}
    </div>
  </div>
);

export default MembersLoading;
