"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { CommunityNavigation } from "@/components/community/community-navigation";

interface CommunityMeetingsErrorProperties {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

const CommunityMeetingsError = ({
  reset,
}: CommunityMeetingsErrorProperties) => (
  <main className="community-page min-h-svh bg-background">
    <div className="community-shell mx-auto w-full">
      <CommunityNavigation active="meetings" />
      <section
        aria-live="assertive"
        className="mx-auto mt-8 w-full max-w-5xl border border-[#E2D6D1] bg-white p-6 sm:p-8"
      >
        <p className="brand-eyebrow tracking-[.14em]">Encontros</p>
        <h1 className="mt-3 font-display font-semibold text-3xl text-[#40222F]">
          Não foi possível carregar os encontros.
        </h1>
        <p className="mt-3 max-w-2xl text-[#7A5A69] leading-7">
          Tente novamente. Seus dados e inscrições continuam preservados.
        </p>
        <Button className="mt-5" onClick={reset} type="button">
          Tentar novamente
        </Button>
      </section>
    </div>
  </main>
);

export default CommunityMeetingsError;
