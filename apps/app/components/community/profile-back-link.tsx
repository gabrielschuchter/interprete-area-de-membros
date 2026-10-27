"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { previousPathLabel, readPreviousPath } from "@/lib/previous-path";

interface ProfileBackLinkProperties {
  readonly currentPathname: string;
  readonly fallbackHref: string;
  readonly fallbackLabel: string;
}

/**
 * Leads back to the page the member really came from (feed, group, discussion,
 * members list, notification). The server-provided target is only the fallback
 * for a direct visit.
 */
export const ProfileBackLink = ({
  currentPathname,
  fallbackHref,
  fallbackLabel,
}: ProfileBackLinkProperties) => {
  const [target, setTarget] = useState({
    href: fallbackHref,
    label: fallbackLabel,
  });

  useEffect(() => {
    const previous = readPreviousPath(currentPathname);
    if (previous) {
      setTarget({ href: previous, label: previousPathLabel(previous) });
    }
  }, [currentPathname]);

  return (
    <Link className="community-back-link" href={target.href}>
      <ArrowLeftIcon aria-hidden="true" />
      {target.label}
    </Link>
  );
};
