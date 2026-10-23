"use client";

import { Button } from "@repo/design-system/components/ui/button";

interface LearningErrorProperties {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

const LearningError = ({ reset }: LearningErrorProperties) => (
  <div className="flex min-h-svh flex-1 items-center justify-center bg-background p-6">
    <div className="paper-surface flex max-w-md flex-col items-center gap-4 border p-8 text-center">
      <p className="brand-eyebrow">Interprete. · pausa para revisar</p>
      <h1 className="font-display text-3xl leading-tight tracking-tight">
        Não foi possível carregar o conteúdo
      </h1>
      <p className="text-muted-foreground text-sm leading-6">
        Tente novamente. Se o problema continuar, o conteúdo pode estar
        temporariamente indisponível.
      </p>
      <Button onClick={reset} type="button">
        Tentar novamente
      </Button>
    </div>
  </div>
);

export default LearningError;
