"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const NAVIGATION_TIMEOUT = 12_000;

const getInternalDestination = (target: EventTarget | null) => {
  if (!(target instanceof Element)) {
    return null;
  }

  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) {
    return null;
  }

  if (
    anchor.target === "_blank" ||
    anchor.hasAttribute("download") ||
    anchor.getAttribute("aria-disabled") === "true"
  ) {
    return null;
  }

  let destination: URL;
  try {
    destination = new URL(anchor.href, window.location.href);
  } catch {
    return null;
  }
  if (destination.origin !== window.location.origin) {
    return null;
  }

  if (
    destination.pathname === window.location.pathname &&
    destination.search === window.location.search
  ) {
    return null;
  }

  return destination;
};

/**
 * Gives every client-side route transition an immediate, non-layout-shifting
 * acknowledgement. Route-specific loading.tsx files remain the real
 * fallback; this line only answers the tap/click before the server responds.
 */
export const NavigationFeedback = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const [pending, setPending] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const previousRouteKey = useRef(routeKey);

  useEffect(() => {
    if (previousRouteKey.current === routeKey) {
      return;
    }

    previousRouteKey.current = routeKey;
    setPending(false);
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [routeKey]);

  useEffect(() => {
    const begin = (event: Event) => {
      if (!getInternalDestination(event.target)) {
        return;
      }

      setPending(true);
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => {
        setPending(false);
        timeoutRef.current = null;
      }, NAVIGATION_TIMEOUT);
    };

    document.addEventListener("pointerdown", begin, true);
    document.addEventListener("click", begin, true);

    return () => {
      document.removeEventListener("pointerdown", begin, true);
      document.removeEventListener("click", begin, true);
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 bg-brand-action transition-opacity duration-[var(--motion-duration-fast)] ${pending ? "opacity-100" : "opacity-0"}`}
      >
        <div className="h-full w-1/3 bg-brand-classic-crimson opacity-80" />
      </div>
      <output aria-live="polite" className="sr-only">
        {pending ? "Abrindo conteúdo" : ""}
      </output>
    </>
  );
};
