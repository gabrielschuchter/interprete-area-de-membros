"use client";

import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { IntentLink } from "../components/intent-link";

export const ProfileLinkButton = ({
  username,
}: {
  readonly username: string;
}) => {
  const [status, setStatus] = useState("");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/membros/${username}`
      );
      setStatus("Link copiado.");
    } catch {
      setStatus("Não foi possível copiar o link do perfil.");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      <IntentLink
        className="inline-flex min-h-11 items-center font-semibold text-brand-structural underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href={`/membros/${username}`}
      >
        Ver perfil público
      </IntentLink>
      <button
        className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand-structural underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={copy}
        type="button"
      >
        {status === "Link copiado." ? (
          <CheckIcon aria-hidden="true" className="size-4" />
        ) : null}
        {status === "Link copiado." ? "Link copiado" : "Copiar link"}
      </button>
      <span aria-live="polite" className="sr-only">
        {status}
      </span>
    </div>
  );
};
