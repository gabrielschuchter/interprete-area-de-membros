"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { AlertCircleIcon } from "lucide-react";
import Link from "next/link";

export default function ExercisesError({
  reset,
}: {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[55svh] w-full max-w-2xl flex-col items-center justify-center px-5 py-16 text-center md:px-8">
      <AlertCircleIcon aria-hidden="true" className="size-7 text-destructive" />
      <h1 className="mt-4 font-display text-3xl leading-tight md:text-4xl">
        Não foi possível carregar Exercícios.
      </h1>
      <p className="mt-4 max-w-xl text-muted-foreground text-sm leading-6">
        Verifique a conexão e tente novamente. Suas respostas confirmadas
        continuam salvas.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={reset} type="button">
          Tentar novamente
        </Button>
        <Button asChild variant="outline">
          <Link href="/exercicios">Voltar para Exercícios</Link>
        </Button>
      </div>
    </main>
  );
}
