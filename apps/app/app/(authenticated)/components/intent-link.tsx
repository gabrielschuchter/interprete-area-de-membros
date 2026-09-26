"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { useCallback, useRef } from "react";

type IntentLinkProperties = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
> & {
  readonly children: ReactNode;
  readonly href: string;
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

  return (
    <Link
      {...props}
      href={href}
      onFocus={(event) => {
        onFocus?.(event);
        prefetch();
      }}
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
