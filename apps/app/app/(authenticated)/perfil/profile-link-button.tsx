"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { CheckIcon, CopyIcon, ExternalLinkIcon } from "lucide-react";
import { useState } from "react";
import { IntentLink } from "../components/intent-link";

export const ProfileLinkButton = ({
  compact = false,
  username,
}: {
  readonly compact?: boolean;
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
    <div className="flex flex-wrap gap-2">
      {compact ? null : (
        <Button asChild className="shadow-none" size="sm" variant="outline">
          <IntentLink href={`/membros/${username}`}>
            Perfil público <ExternalLinkIcon aria-hidden="true" />
          </IntentLink>
        </Button>
      )}
      <Button
        className="shadow-none"
        onClick={copy}
        size={compact ? "default" : "sm"}
        type="button"
        variant={compact ? "ghost" : "outline"}
      >
        {status === "Link copiado." ? (
          <CheckIcon aria-hidden="true" />
        ) : (
          <CopyIcon aria-hidden="true" />
        )}
        {compact ? "Copiar" : "Copiar link"}
      </Button>
      <span aria-live="polite" className="sr-only">
        {status}
      </span>
    </div>
  );
};
