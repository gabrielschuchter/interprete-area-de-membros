"use client";

import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";

const CommunityError = () => (
  <div className="mx-auto flex min-h-[60svh] w-full max-w-2xl flex-col justify-center px-5 py-16 sm:px-8">
    <p className="brand-eyebrow">A comunidade precisa de um minuto</p>
    <h1 className="mt-4 font-display text-4xl">
      Não foi possível carregar as conversas.
    </h1>
    <p className="mt-4 text-muted-foreground leading-7">
      Tente novamente. Se o problema continuar, volte ao início para seguir
      estudando.
    </p>
    <div className="mt-6 flex gap-3">
      <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
      <Button asChild variant="outline">
        <Link href="/">Voltar ao início</Link>
      </Button>
    </div>
  </div>
);

export default CommunityError;
