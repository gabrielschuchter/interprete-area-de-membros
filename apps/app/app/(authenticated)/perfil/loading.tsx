const ProfileLoading = () => (
  <section
    aria-busy="true"
    aria-label="Carregando perfil"
    className="mx-auto w-full max-w-[856px] animate-pulse px-5 pt-5 pb-16 sm:px-8 md:px-12 md:pt-10"
    data-route-loading
  >
    <div className="flex items-center gap-4 md:hidden">
      <div className="size-16 rounded-full bg-muted" />
      <div className="space-y-2">
        <div className="h-3 w-20 bg-muted" />
        <div className="h-7 w-44 bg-muted" />
        <div className="h-4 w-28 bg-muted" />
      </div>
    </div>
    <div className="hidden items-center gap-5 border-border border-b pb-6 md:flex">
      <div className="size-20 rounded-full bg-muted" />
      <div className="space-y-2">
        <div className="h-3 w-20 bg-muted" />
        <div className="h-9 w-60 bg-muted" />
        <div className="h-4 w-32 bg-muted" />
      </div>
    </div>
    <div className="mt-7 space-y-4">
      <div className="h-7 w-52 bg-muted" />
      <div className="h-2 w-full bg-muted" />
      <div className="h-60 w-full bg-muted md:h-40" />
    </div>
  </section>
);

export default ProfileLoading;
