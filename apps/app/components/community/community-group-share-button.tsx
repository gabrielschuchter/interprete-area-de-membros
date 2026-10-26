"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Share2Icon } from "lucide-react";
import { useEffect, useState } from "react";

/** Copies the address of a public group. The link opens the group page; it never grants access to a private one. */
export const CommunityGroupShareButton = ({
  className,
  path,
}: {
  readonly className?: string;
  readonly path: string;
}) => {
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!status) {
      return;
    }
    const timer = window.setTimeout(() => setStatus(""), 3000);
    return () => window.clearTimeout(timer);
  }, [status]);

  const share = async () => {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copiado.");
    } catch {
      setStatus(
        "Não foi possível copiar. Copie o endereço da barra do navegador."
      );
    }
  };

  return (
    <>
      <Button
        className={className}
        onClick={share}
        type="button"
        variant="outline"
      >
        <Share2Icon aria-hidden="true" /> Compartilhar
      </Button>
      <output aria-live="polite" className="sr-only">
        {status}
      </output>
      {status ? (
        <span aria-hidden="true" className="community-group-header__status">
          {status}
        </span>
      ) : null}
    </>
  );
};
