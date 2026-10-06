"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

const PENDING_STATE_TIMEOUT = 12_000;

interface FilterFormProperties {
  readonly action?: string;
  readonly children: ReactNode;
  readonly className?: string;
}

export const FilterForm = ({
  action,
  children,
  className,
}: FilterFormProperties) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isApplying, setIsApplying] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const previousRouteKey = useRef(routeKey);

  useEffect(() => {
    if (previousRouteKey.current === routeKey) {
      return;
    }

    previousRouteKey.current = routeKey;
    setIsApplying(false);
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [routeKey]);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    },
    []
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isApplying) {
      return;
    }

    const nextParams = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget).entries()) {
      if (typeof value === "string" && value.trim()) {
        nextParams.set(key, value);
      }
    }

    const destinationPath = action ?? pathname;
    const query = nextParams.toString();
    const destination = query ? `${destinationPath}?${query}` : destinationPath;
    const currentQuery = searchParams.toString();
    const current = currentQuery ? `${pathname}?${currentQuery}` : pathname;

    if (destination === current) {
      return;
    }

    setIsApplying(true);
    timeoutRef.current = window.setTimeout(() => {
      setIsApplying(false);
      timeoutRef.current = null;
    }, PENDING_STATE_TIMEOUT);
    router.push(destination);
  };

  return (
    <form aria-busy={isApplying} className={className} onSubmit={handleSubmit}>
      {children}
      <output
        aria-live="polite"
        className="col-span-full text-muted-foreground text-xs"
      >
        {isApplying ? "Aplicando filtros…" : ""}
      </output>
    </form>
  );
};
