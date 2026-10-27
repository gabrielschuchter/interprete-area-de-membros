"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { rememberNavigation } from "@/lib/previous-path";

/** Remembers the previous in-app page so profile "back" links can return to it. */
export const NavigationHistoryTracker = () => {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    rememberNavigation(search ? `${pathname}?${search}` : pathname);
  }, [pathname, search]);

  return null;
};
