"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { CloudAlertIcon } from "lucide-react";
import { CommunityNavigation } from "@/components/community/community-navigation";

interface CommunityErrorProperties {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

const CommunityError = ({ reset }: CommunityErrorProperties) => (
  <main className="community-page min-h-svh bg-background">
    <div className="community-shell mx-auto w-full">
      <CommunityNavigation active="explore" />
      <section
        aria-live="assertive"
        className="paper-surface mx-auto mt-8 flex w-full flex-col items-center rounded-md border px-6 py-10 text-center sm:px-8 sm:py-12"
      >
        <CloudAlertIcon
          aria-hidden="true"
          className="size-14 text-[#B9395A]"
          strokeWidth={1.5}
        />
        <h1 className="mt-5 font-display font-semibold text-2xl text-[#40222F]">
          Não deu para carregar o feed
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-[#7A5A69] leading-7">
          Confira sua conexão e tente de novo. Suas publicações não foram
          afetadas.
        </p>
        <Button className="mt-5" onClick={reset} type="button">
          Tentar de novo
        </Button>
      </section>
    </div>
  </main>
);

export default CommunityError;
