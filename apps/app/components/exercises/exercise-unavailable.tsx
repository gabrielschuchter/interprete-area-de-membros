import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";

export const ExerciseUnavailable = ({
  description,
  title,
}: {
  readonly description: string;
  readonly title: string;
}) => (
  <main className="mx-auto flex min-h-[55svh] w-full max-w-2xl flex-col items-center justify-center px-5 py-16 text-center md:px-8">
    <p className="brand-eyebrow">Interprete. · Exercícios</p>
    <h1 className="mt-4 font-display text-3xl leading-tight md:text-4xl">
      {title}
    </h1>
    <p className="mt-4 max-w-xl text-muted-foreground text-sm leading-6">
      {description}
    </p>
    <Button asChild className="mt-6" variant="outline">
      <Link href="/exercicios">Voltar para Exercícios</Link>
    </Button>
  </main>
);
