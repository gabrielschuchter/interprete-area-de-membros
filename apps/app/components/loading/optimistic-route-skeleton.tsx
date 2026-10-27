"use client";

import { useEffect } from "react";
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
