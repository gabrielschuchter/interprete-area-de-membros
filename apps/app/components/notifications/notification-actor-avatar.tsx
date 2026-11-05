"use client";

import { cn } from "@repo/design-system/lib/utils";
import { useState } from "react";

/**
 * Foto de quem gerou a notificação. Se a imagem não carregar (arquivo
 * removido, link expirado), mostra a inicial em vez do ícone de imagem
 * quebrada do navegador.
 */
export const NotificationActorAvatar = ({
  className,
  name,
  src,
}: {
  readonly className?: string;
  readonly name: string;
  readonly src: string | null;
}) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const initial = name.trim().slice(0, 1).toUpperCase() || "I";
  if (!src || failedSrc === src) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-[#F1EBE8] font-medium text-[#8C1535] text-xs",
          className
        )}
      >
        {initial}
      </span>
    );
  }
  return (
    // biome-ignore lint/performance/noImgElement: member assets resolve through an authenticated route.
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: onError só troca a imagem quebrada pela inicial.
    <img
      alt=""
      className={cn(
        "shrink-0 rounded-full object-cover object-center",
        className
      )}
      decoding="async"
      height={36}
      onError={() => setFailedSrc(src)}
      src={src}
      width={36}
    />
  );
};
