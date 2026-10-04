"use client";

import { useEffect, useState } from "react";

const AUTH_LOAD_TIMEOUT_MS = 15_000;

interface AuthLoadingStateProperties {
  readonly loadingLabel: string;
}

export const AuthLoadingState = ({
  loadingLabel,
}: AuthLoadingStateProperties) => {
  const [didTimeout, setDidTimeout] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDidTimeout(true),
      AUTH_LOAD_TIMEOUT_MS
    );
    return () => window.clearTimeout(timeout);
  }, []);

  if (didTimeout) {
    return (
      <div
        aria-live="assertive"
        className="interprete-login__loading-error"
        role="alert"
      >
        <p>
          O serviço de autenticação demorou para responder. Verifique sua
          conexão e tente novamente.
        </p>
        <button
          className="interprete-login__retry"
          onClick={() => window.location.reload()}
          type="button"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <output aria-live="polite" className="interprete-login__loading">
      <span aria-hidden="true" className="interprete-login__loading-dot" />
      {loadingLabel}
    </output>
  );
};
