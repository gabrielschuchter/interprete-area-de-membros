"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AnchorHTMLAttributes, PointerEvent, ReactNode } from "react";
import { useCallback, useRef } from "react";

type IntentLinkProperties = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
> & {
  readonly children: ReactNode;
  readonly href: string;
  readonly onNavigationStart?: (href: string) => void;
};

/**
 * Keep the authenticated shell quiet until navigation is intentional.
 * Next's viewport prefetch is useful for short link lists, but a persistent
 * sidebar is present on every route and otherwise creates a request fan-out
 * on first load. Prefetch once on pointer/focus intent instead.
 */
export const IntentLink = ({
  children,
  href,
  onFocus,
  onClick,
  onNavigationStart,
  onPointerDown,
  onPointerEnter,
  ...props
}: IntentLinkProperties) => {
  const router = useRouter();
  const hasPrefetched = useRef(false);

  const prefetch = useCallback(() => {
    if (hasPrefetched.current) {
      return;
    }

    hasPrefetched.current = true;
    router.prefetch(href);
  }, [href, router]);

  const startNavigation = useCallback(
    (event: PointerEvent<HTMLAnchorElement>) => {
      onPointerDown?.(event);
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      onNavigationStart?.(href);
      prefetch();
    },
    [href, onNavigationStart, onPointerDown, prefetch]
  );

  return (
    <Link
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || event.metaKey || event.ctrlKey) {
          return;
        }

        onNavigationStart?.(href);
        prefetch();
      }}
      onFocus={(event) => {
        onFocus?.(event);
        prefetch();
      }}
      onPointerDown={startNavigation}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        prefetch();
      }}
      prefetch={false}
    >
      {children}
    </Link>
  );
};
