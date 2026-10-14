"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import { useMemberNavigation } from "./member-navigation-context";
import { usePortalViewport } from "./use-portal-viewport";

export const PortalStageLayer = () => {
  const pathname = usePathname();
  const viewport = usePortalViewport();
  const navigation = useMemberNavigation();
  const transition = navigation?.transition ?? null;
  const visible =
    pathname === "/" ||
    transition?.kind === "cross" ||
    transition?.kind === "back" ||
    transition?.kind === "short" ||
    transition?.kind === "fade";

  if (
    (viewport !== "wide" && viewport !== "tablet") ||
    !visible ||
    navigation?.imageFailed
  ) {
    return null;
  }

  const style = {
    "--portal-dx": `${transition?.vector?.x ?? 0}px`,
    "--portal-dy": `${transition?.vector?.y ?? 0}px`,
  } as CSSProperties;

  return (
    <div
      aria-hidden="true"
      className="portal-stage-layer"
      data-active-transition={String(Boolean(transition))}
      data-kind={transition?.kind}
      data-phase={transition?.phase}
      data-portal-stage="true"
      style={style}
    >
      <div className="portal-stage-layer__art">
        <Image
          alt=""
          className="portal-stage-layer__image"
          decoding="async"
          fetchPriority="high"
          height={742}
          onError={navigation?.onPortalImageError}
          onLoad={() => navigation?.onPortalImageReady("desktop")}
          priority
          sizes="(min-width: 1360px) min(1120px, calc(100vw - 400px)), min(940px, calc(100vw - 48px))"
          src="/portal/art-1250-e5b2e48dfe.webp"
          unoptimized
          width={1250}
        />
      </div>
    </div>
  );
};
