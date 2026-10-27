"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PortalTransition } from "@/app/(authenticated)/components/member-navigation-context";
import {
  ActivitiesLoading,
  CommunityLoading,
  HomeLoading,
  LearningLoading,
  LibraryLoading,
  MeetingsLoading,
  MembersLoading,
  NotificationsLoading,
  ProfileLoading,
  RecordingsLoading,
  SettingsLoading,
} from "./member-skeletons";

const SETTLE_TIMEOUT = 8000;
// Feedback under the 100 ms budget: the sidebar, tabs and progress line react on
// the click itself; the cover appears only when the route has not committed.
const OPTIMISTIC_SKELETON_DELAY = 80;

const startsWithSegment = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

/**
 * Picks the placeholder that the destination's own loading.tsx resembles, so
 * the swap from this client-side skeleton to the streamed one is not a jump.
 */
export const skeletonForPath = (pathname: string) => {
  if (startsWithSegment(pathname, "/encontros/gravacoes")) {
    return <RecordingsLoading />;
  }
  if (
    startsWithSegment(pathname, "/encontros") ||
    pathname === "/comunidade/encontros"
  ) {
    return <MeetingsLoading />;
  }
  if (startsWithSegment(pathname, "/comunidade")) {
    return <CommunityLoading />;
  }
  if (startsWithSegment(pathname, "/membros")) {
    return <MembersLoading />;
  }
  if (startsWithSegment(pathname, "/biblioteca")) {
    return <LibraryLoading />;
  }
  if (startsWithSegment(pathname, "/atividades")) {
    return <ActivitiesLoading />;
  }
  if (
    startsWithSegment(pathname, "/cursos") ||
    startsWithSegment(pathname, "/exercicios") ||
    startsWithSegment(pathname, "/planejamento") ||
    startsWithSegment(pathname, "/ferramentas") ||
    startsWithSegment(pathname, "/salvos")
  ) {
    return <LearningLoading />;
  }
  if (startsWithSegment(pathname, "/notificacoes")) {
    return <NotificationsLoading />;
  }
  if (startsWithSegment(pathname, "/perfil")) {
    return <ProfileLoading />;
  }
  if (startsWithSegment(pathname, "/configuracoes")) {
    return <SettingsLoading />;
  }
  return <HomeLoading />;
};

interface OptimisticRouteSkeletonProperties {
  readonly onSettled: () => void;
  readonly targetPath: string;
}

/**
 * Covers the outgoing page from the moment a navigation is slow, instead of
 * waiting for the server to stream the route's own fallback. The shell removes
 * it once the destination has committed and its entry transition is over; the
 * timeout only guards against a navigation that never lands.
 */
export const OptimisticRouteSkeleton = ({
  onSettled,
  targetPath,
}: OptimisticRouteSkeletonProperties) => {
  useEffect(() => {
    const timeout = window.setTimeout(onSettled, SETTLE_TIMEOUT);
    return () => window.clearTimeout(timeout);
  }, [onSettled]);

  return (
    <div
      aria-hidden="true"
      className="member-route-optimistic absolute inset-0 z-[5] bg-background"
      data-optimistic-skeleton=""
    >
      {skeletonForPath(targetPath)}
    </div>
  );
};

interface OptimisticCoverProperties {
  readonly failed: boolean;
  readonly pathname: string;
  readonly transition: PortalTransition | null;
}

/**
 * Owns the timing of the cover so the shell only pays for it once this module
 * has loaded: it shows the destination's skeleton when a navigation has not
 * committed 80 ms after the click, and clears it once the destination owns
 * the stage.
 */
export const OptimisticCover = ({
  failed,
  pathname,
  transition,
}: OptimisticCoverProperties) => {
  const [cover, setCover] = useState<{
    readonly origin: string;
    readonly target: string;
  } | null>(null);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const transitionId = transition?.id ?? null;
  const targetPath = transition?.targetPath ?? null;
  const clear = useCallback(() => setCover(null), []);

  useEffect(() => {
    const origin = pathnameRef.current;
    if (transitionId === null || targetPath === null) {
      return;
    }
    if (origin === "/" || targetPath === "/") {
      return;
    }
    const timeout = window.setTimeout(() => {
      if (window.location.pathname === origin) {
        // The destination opens at the top, so the cover does too.
        window.scrollTo(0, 0);
        setCover({ origin, target: targetPath });
      }
    }, OPTIMISTIC_SKELETON_DELAY);
    return () => window.clearTimeout(timeout);
  }, [targetPath, transitionId]);

  // A redirect may land elsewhere, so compare with the origin.
  useEffect(() => {
    if (cover && pathname !== cover.origin && transition === null) {
      setCover(null);
    }
  }, [cover, pathname, transition]);

  useEffect(() => {
    if (failed) {
      setCover(null);
    }
  }, [failed]);

  useEffect(() => {
    window.addEventListener("popstate", clear);
    return () => window.removeEventListener("popstate", clear);
  }, [clear]);

  return cover ? (
    <OptimisticRouteSkeleton onSettled={clear} targetPath={cover.target} />
  ) : null;
};
