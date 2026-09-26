"use client";

import { Button } from "@repo/design-system/components/ui/button";

export default function AdminError({ reset }: { readonly reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-20 text-center sm:px-8">
      <p className="brand-eyebrow">Painel do professor</p>
      <h1 className="mt-4 font-display text-4xl">
        Não foi possível abrir esta área.
      </h1>
      <p className="mt-4 text-muted-foreground leading-7">
        Tente novamente. Nenhum conteúdo foi alterado por esta falha de leitura.
      </p>
      <Button className="mt-6" onClick={reset}>
        Tentar novamente
      </Button>
    </main>
  );
}
