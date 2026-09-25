const CommunityLoading = () => (
  <div className="mx-auto w-full max-w-[1280px] animate-pulse px-5 py-16 sm:px-8 lg:px-12">
    <div className="h-3 w-48 bg-muted" />
    <div className="mt-6 h-20 max-w-3xl bg-muted" />
    <div className="mt-10 h-10 w-full bg-muted" />
    <div className="mt-6 space-y-5">
      {[1, 2, 3].map((item) => (
        <div className="h-36 border-b bg-muted/60" key={item} />
      ))}
    </div>
  </div>
);

export default CommunityLoading;
