"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { CheckIcon, Link2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const copiedMessage = "Link copiado";
const failedMessage = "Não foi possível copiar o link";

const copyText = async (text: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Navegadores sem a API assíncrona (WebView antiga, contexto inseguro).
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.append(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  if (!copied) {
    throw new Error("copy failed");
  }
};

/**
 * Compartilhar uma publicação é só copiar o endereço dela. O link abre a
 * publicação dentro da área de membros; quem não tiver sessão passa pelo login
 * e volta para ela.
 */
export const CommunityPostShareButton = ({
  path,
}: {
  readonly path: string;
}) => {
  const [status, setStatus] = useState<"" | "copied" | "failed">("");
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    },
    []
  );

  const share = async () => {
    const url = new URL(path, window.location.origin).toString();
    let next: "copied" | "failed" = "copied";
    try {
      await copyText(url);
    } catch {
      next = "failed";
    }
    setStatus(next);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => setStatus(""), 2400);
  };

  const message = status === "failed" ? failedMessage : copiedMessage;

  return (
    <span className="community-post-share">
      <Button
        className="min-h-11 gap-1.5 text-sm"
        data-state={status || undefined}
        onClick={share}
        size="sm"
        type="button"
        variant="ghost"
      >
        {status === "copied" ? (
          <CheckIcon aria-hidden="true" className="size-4" />
        ) : (
          <Link2Icon aria-hidden="true" className="size-4" />
        )}
        <span className="cp-action-label">Compartilhar</span>
      </Button>
      <output aria-live="polite" className="sr-only">
        {status ? message : ""}
      </output>
      {status ? (
        <span
          aria-hidden="true"
          className="community-post-share__toast"
          data-tone={status}
        >
          {message}
        </span>
      ) : null}
    </span>
  );
};
