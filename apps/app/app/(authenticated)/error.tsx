"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { IntentLink } from "./components/intent-link";

const MemberAreaError = ({
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) => (
  <main className="member-area-error" role="alert">
    <h1>Não foi possível carregar esta página</h1>
    <p>
      Tente novamente. Se o problema continuar, volte à Início e abra o destino
      outra vez.
    </p>
    <div className="member-area-error__actions">
      <Button onClick={reset} type="button">
        Tentar de novo
      </Button>
      <IntentLink className="member-area-error__link" href="/">
        Início
      </IntentLink>
    </div>
  </main>
);

export default MemberAreaError;
