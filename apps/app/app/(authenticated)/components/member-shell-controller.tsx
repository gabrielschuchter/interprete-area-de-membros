"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  SidebarProvider,
  useSidebar,
} from "@repo/design-system/components/ui/sidebar";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from "react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import { MemberAreaTabs } from "@/components/navigation/member-area-tabs";
import { isGestaoShellPath } from "@/lib/gestao-navigation";
import { ActiveTimerPill } from "./active-timer-pill";
import { MemberAreaSidebar } from "./member-area-sidebar";
import { MemberHeader } from "./member-header";
import {
  classifyMemberNavigation,
  type MemberNavigationKind,
  memberNavigationExitDuration,
  memberNavigationTotalDuration,
  type PortalSide,
  portalSideForPath,
  remainingMemberTransitionDuration,
  shouldInterceptMemberLink,
  shouldReplaceActiveMemberTransition,
} from "./member-navigation";
import {
  MemberNavigationContext,
  type PortalTransition,
} from "./member-navigation-context";
import {
  focusMemberRouteHeading,
  memberRouteAnnouncementLabel,
} from "./member-route-focus";
import { NavigationFeedback } from "./navigation-feedback";
import { PortalStageLayer } from "./portal-stage-layer";
import { RouteMotion } from "./route-motion";
import { usePortalViewport } from "./use-portal-viewport";
import { useShellNavigation } from "./use-shell-navigation";

// Loaded on demand so the skeleton set stays out of the initial bundle.
const OptimisticCover = dynamic(
  () =>
    import("@/components/loading/optimistic-route-skeleton").then(
      (module_) => module_.OptimisticCover
    ),
  { ssr: false }
);

interface MemberShellControllerProperties {
  readonly avatarUrl: string | null;
  readonly canManageContent: boolean;
  readonly children: ReactNode;
  readonly displayName: string;
  readonly email: string;
  readonly gestaoV2Enabled: boolean;
  readonly localQaAuth?: boolean;
  readonly memberId: string;
  readonly productConfig: {
    readonly showLearnNavigation: boolean;
  };
}

const NAVIGATION_TIMEOUT = 8000;
const ROUTE_SEPARATOR_PATTERN = /[?#]/;

const currentRouteKey = (pathname: string, search: string) =>
  search ? `${pathname}?${search}` : pathname;

const sameOriginUrlForAnchor = (anchor: HTMLAnchorElement) => {
  try {
    const url = new URL(anchor.href, window.location.href);
    return url.origin === window.location.origin ? url : null;
  } catch {
    return null;
  }
};

const sameOriginUrlForHref = (href: string) => {
  try {
    const url = new URL(href, window.location.href);
    return url.origin === window.location.origin ? url : null;
  } catch {
    return null;
  }
};

const pathFromRouteKey = (routeKey: string) =>
  routeKey.split(ROUTE_SEPARATOR_PATTERN, 1)[0] || "/";

const anchorForTarget = (target: EventTarget | null) =>
  target instanceof Element
    ? target.closest<HTMLAnchorElement>("a[href]")
    : null;

const modifiedClick = (event: ReactMouseEvent<HTMLDivElement>) =>
  event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

const transitionVectorFor = (
  anchor: HTMLAnchorElement | null,
  kind: MemberNavigationKind
) => {
  if (kind !== "cross" || !anchor) {
    return null;
  }
  const image = document.querySelector<HTMLElement>(
    ".portal-stage-layer__image"
  );
  if (!image) {
    return null;
  }
  const imageBounds = image.getBoundingClientRect();
  const targetBounds = anchor.getBoundingClientRect();
  const scale = 3.1;
  return {
    x:
      (imageBounds.left +
        imageBounds.width / 2 -
        (targetBounds.left + targetBounds.width / 2)) *
      scale,
    y:
      (imageBounds.top +
        imageBounds.height / 2 -
        (targetBounds.top + targetBounds.height / 2)) *
      scale,
  };
};

const corridorForTransition = (
  kind: MemberNavigationKind,
  sourcePath: string,
  destinationPath: string,
  anchor: HTMLAnchorElement | null
): PortalSide | null => {
  if (kind === "cross") {
    return (
      (anchor?.dataset.portalCorridor as PortalSide | undefined) ??
      portalSideForPath(destinationPath)
    );
  }
  if (kind === "back") {
    return portalSideForPath(sourcePath);
  }
  return null;
};

const createPortalTransition = ({
  anchor,
  destinationPath,
  href,
  id,
  kind,
  mobile,
  sourcePath,
  startedAt,
}: {
  readonly anchor: HTMLAnchorElement | null;
  readonly destinationPath: string;
  readonly href: string;
  readonly id: number;
  readonly kind: MemberNavigationKind;
  readonly mobile: boolean;
  readonly sourcePath: string;
  readonly startedAt: number;
}): PortalTransition => ({
  corridor: corridorForTransition(kind, sourcePath, destinationPath, anchor),
  direction: kind === "back" ? "return" : "enter",
  durationMs: memberNavigationTotalDuration(kind, mobile),
  exitDurationMs: memberNavigationExitDuration(kind, mobile),
  href,
  id,
  kind,
  phase: "leaving",
  startedAt,
  targetPath: destinationPath,
  vector: transitionVectorFor(anchor, kind),
});

const createCommittedTransition = ({
  active,
  currentPath,
  id: nextId,
  mobile,
  previousPath,
}: {
  readonly active: PortalTransition | null;
  readonly currentPath: string;
  readonly id: number;
  readonly mobile: boolean;
  readonly previousPath: string;
}) => {
  const matchesActive = active?.targetPath === currentPath;
  const kind = matchesActive
    ? active.kind
    : (classifyMemberNavigation({
        currentPath: previousPath,
        destinationPath: currentPath,
      }) ?? "std");
  const id = matchesActive ? active.id : nextId;
  const startedAt = matchesActive ? active.startedAt : Date.now();
  const totalDuration = memberNavigationTotalDuration(kind, mobile);
  const remainingDuration = remainingMemberTransitionDuration(
    totalDuration,
    startedAt,
    Date.now()
  );
  return {
    corridor: corridorForTransition(kind, previousPath, currentPath, null),
    direction: kind === "back" ? "return" : "enter",
    durationMs: remainingDuration,
    exitDurationMs: 0,
    href: `${currentPath}${window.location.search}${window.location.hash}`,
    id,
    kind,
    phase: "entering" as const,
    startedAt,
    targetPath: currentPath,
    vector: matchesActive ? active.vector : null,
  } satisfies PortalTransition;
};

const MemberShellView = ({
  avatarUrl,
  canManageContent,
  children,
  displayName,
  email,
  gestaoV2Enabled,
  localQaAuth,
  memberId,
  productConfig,
}: MemberShellControllerProperties) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const viewport = usePortalViewport();
  const mobile = viewport === "mobile" || viewport === "landscape";
  const { setOpen, setOpenMobile } = useSidebar();
  const routeKey = currentRouteKey(pathname, searchParams.toString());
  const [chromeVisible, setChromeVisible] = useState(pathname !== "/");
  const [transition, setTransition] = useState<PortalTransition | null>(null);
  const [navigationFailure, setNavigationFailure] = useState<string | null>(
    null
  );
  const [announcement, setAnnouncement] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const readyImages = useRef(new Set<string>());
  const { navigateShell: startShellSwitch, feedback: shellFeedback } =
    useShellNavigation();
  const transitionRef = useRef<PortalTransition | null>(null);
  const previousRouteKey = useRef(routeKey);
  const sequence = useRef(0);
  const timer = useRef<number | null>(null);
  const dispatchedTransition = useRef<number | null>(null);
  const lastViewport = useRef(viewport);

  const setActiveTransition = useCallback((next: PortalTransition | null) => {
    transitionRef.current = next;
    setTransition(next);
  }, []);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const schedule = useCallback(
    (delay: number, callback: () => void) => {
      clearTimer();
      timer.current = window.setTimeout(
        () => {
          timer.current = null;
          callback();
        },
        Math.max(0, delay)
      );
    },
    [clearTimer]
  );

  const announceAndFocusRoute = useCallback((destinationPath: string) => {
    window.requestAnimationFrame(() => {
      if (window.location.pathname !== destinationPath) {
        return;
      }
      const main = document.getElementById("member-main-content");
      const heading = focusMemberRouteHeading(main);
      const label = memberRouteAnnouncementLabel(destinationPath, heading);
      setAnnouncement("");
      window.setTimeout(() => setAnnouncement(`Você está em ${label}.`), 30);
    });
  }, []);

  const finishTransition = useCallback(
    (id: number, destinationPath: string) => {
      if (transitionRef.current?.id !== id) {
        return;
      }
      clearTimer();
      setActiveTransition(null);
      setNavigationFailure(null);
      setChromeVisible(destinationPath !== "/");
      announceAndFocusRoute(destinationPath);
    },
    [announceAndFocusRoute, clearTimer, setActiveTransition]
  );

  const commitTransition = useCallback(
    (id: number) => {
      const active = transitionRef.current;
      if (!active || active.id !== id || dispatchedTransition.current === id) {
        return;
      }
      clearTimer();
      dispatchedTransition.current = id;
      setActiveTransition({ ...active, phase: "committing" });
      router.push(active.href);
      schedule(
        Math.max(0, NAVIGATION_TIMEOUT - (Date.now() - active.startedAt)),
        () => {
          const current = transitionRef.current;
          if (current?.id === id && current.phase === "committing") {
            setNavigationFailure(current.href);
            setActiveTransition(null);
            setChromeVisible(pathname !== "/");
          }
        }
      );
    },
    [clearTimer, pathname, router, schedule, setActiveTransition]
  );

  const startNavigation = useCallback(
    (rawHref: string, anchor: HTMLAnchorElement | null, portalArc = false) => {
      const url = sameOriginUrlForHref(rawHref);
      if (!url) {
        return;
      }
      const href = `${url.pathname}${url.search}${url.hash}`;
      if (isGestaoShellPath(pathname) !== isGestaoShellPath(url.pathname)) {
        setOpenMobile(false);
        startShellSwitch(href);
        return;
      }
      const kind = classifyMemberNavigation({
        currentPath: pathname,
        destinationPath: url.pathname,
        portalArc,
      });
      if (!kind) {
        router.push(href);
        return;
      }
      if (!navigator.onLine) {
        setNavigationFailure(href);
        return;
      }

      clearTimer();
      setNavigationFailure(null);
      if (pathname === "/") {
        setOpen(false);
      }
      setOpenMobile(false);
      if (pathname === "/") {
        setChromeVisible(false);
      }
      const id = ++sequence.current;
      const next = createPortalTransition({
        anchor,
        destinationPath: url.pathname,
        href,
        id,
        kind,
        mobile,
        sourcePath: pathname,
        startedAt: Date.now(),
      });
      setActiveTransition(next);
      dispatchedTransition.current = null;
      const exitDuration = next.exitDurationMs;
      if (exitDuration === 0) {
        commitTransition(id);
      } else {
        schedule(exitDuration, () => commitTransition(id));
      }
    },
    [
      clearTimer,
      commitTransition,
      mobile,
      pathname,
      router,
      schedule,
      setActiveTransition,
      setOpen,
      setOpenMobile,
      startShellSwitch,
    ]
  );

  const navigate = useCallback(
    (href: string) => startNavigation(href, null),
    [startNavigation]
  );

  const retryNavigation = useCallback(() => {
    const failedHref = navigationFailure;
    if (!failedHref) {
      return;
    }
    setNavigationFailure(null);
    startNavigation(failedHref, null);
  }, [navigationFailure, startNavigation]);

  const handleNavigationCapture = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const anchor = anchorForTarget(event.target);
      if (!anchor) {
        return;
      }
      const url = sameOriginUrlForAnchor(anchor);
      if (!url) {
        return;
      }
      const isSameRoute =
        url.pathname === pathname && url.search === window.location.search;
      if (
        !shouldInterceptMemberLink({
          button: event.button,
          ariaDisabled: anchor.getAttribute("aria-disabled") === "true",
          defaultPrevented: event.defaultPrevented,
          download: anchor.hasAttribute("download"),
          modified: modifiedClick(event),
          relExternal: anchor.relList.contains("external"),
          sameOrigin: true,
          sameRoute: isSameRoute || url.pathname === pathname,
          target: anchor.target,
        })
      ) {
        return;
      }

      event.preventDefault();
      const transition = transitionRef.current;
      if (transition) {
        if (
          !shouldReplaceActiveMemberTransition(
            transition.targetPath,
            url.pathname
          )
        ) {
          return;
        }
        clearTimer();
        setActiveTransition(null);
        dispatchedTransition.current = null;
      }
      startNavigation(
        `${url.pathname}${url.search}${url.hash}`,
        anchor,
        anchor.dataset.portalArc === "true"
      );
    },
    [clearTimer, pathname, setActiveTransition, startNavigation]
  );

  const onPortalImageReady = useCallback((imageId: string) => {
    const next = new Set(readyImages.current);
    next.add(imageId);
    readyImages.current = next;
    if (
      imageId === "desktop" ||
      (next.has("mobile-estudar") && next.has("mobile-comunidade"))
    ) {
      setImageReady(true);
    }
  }, []);

  const onPortalImageError = useCallback(() => {
    setImageFailed(true);
    setImageReady(true);
  }, []);

  const onPopState = useCallback(() => {
    const active = transitionRef.current;
    if (active?.phase === "leaving") {
      clearTimer();
      setActiveTransition(null);
    }
  }, [clearTimer, setActiveTransition]);

  useLayoutEffect(() => {
    const previous = previousRouteKey.current;
    previousRouteKey.current = routeKey;
    if (previous === routeKey) {
      return;
    }
    const previousPath = pathFromRouteKey(previous);
    if (previousPath === pathname) {
      return;
    }

    clearTimer();
    if (isGestaoShellPath(previousPath) !== isGestaoShellPath(pathname)) {
      clearTimer();
      setActiveTransition(null);
      setChromeVisible(true);
      return;
    }
    const next = createCommittedTransition({
      active: transitionRef.current,
      currentPath: pathname,
      id:
        transitionRef.current?.targetPath === pathname
          ? transitionRef.current.id
          : ++sequence.current,
      mobile,
      previousPath,
    });
    setActiveTransition(next);
    setChromeVisible(pathname !== "/");
    setNavigationFailure(null);
    if (next.durationMs === 0) {
      finishTransition(next.id, pathname);
    } else {
      schedule(next.durationMs, () => finishTransition(next.id, pathname));
    }
  }, [
    clearTimer,
    finishTransition,
    mobile,
    pathname,
    routeKey,
    schedule,
    setActiveTransition,
  ]);

  useLayoutEffect(() => {
    const oldViewport = lastViewport.current;
    lastViewport.current = viewport;
    if (!(oldViewport && viewport) || oldViewport === viewport) {
      return;
    }
    const active = transitionRef.current;
    if (!active) {
      return;
    }
    if (active.phase === "committing") {
      return;
    }
    clearTimer();
    if (active.phase === "leaving") {
      const fallback = { ...active, kind: "fade" as const, vector: null };
      setActiveTransition(fallback);
      commitTransition(active.id);
      return;
    }
    finishTransition(active.id, active.targetPath);
  }, [
    clearTimer,
    commitTransition,
    finishTransition,
    setActiveTransition,
    viewport,
  ]);

  useLayoutEffect(() => {
    const onVisibilityChange = () => {
      if (!document.hidden) {
        return;
      }
      const active = transitionRef.current;
      if (!active) {
        return;
      }
      if (active.phase === "committing") {
        return;
      }
      clearTimer();
      if (active.phase === "leaving") {
        setActiveTransition({ ...active, kind: "fade", vector: null });
        commitTransition(active.id);
      } else if (active.phase === "entering") {
        finishTransition(active.id, active.targetPath);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("popstate", onPopState);
    };
  }, [
    clearTimer,
    commitTransition,
    finishTransition,
    onPopState,
    setActiveTransition,
  ]);

  useLayoutEffect(
    () => () => {
      clearTimer();
    },
    [clearTimer]
  );

  const contextValue = useMemo(
    () => ({
      displayName,
      imageFailed,
      imageReady,
      memberId,
      navigationFailure,
      navigate,
      navigateShell: startShellSwitch,
      onPortalImageError,
      onPortalImageReady,
      retryNavigation,
      showLearnNavigation: productConfig.showLearnNavigation,
      transition,
    }),
    [
      displayName,
      imageFailed,
      imageReady,
      memberId,
      navigationFailure,
      navigate,
      onPortalImageError,
      onPortalImageReady,
      productConfig.showLearnNavigation,
      retryNavigation,
      startShellSwitch,
      transition,
    ]
  );

  if (isGestaoShellPath(pathname)) {
    return (
      <MemberNavigationContext.Provider value={contextValue}>
        {children}
        {shellFeedback}
      </MemberNavigationContext.Provider>
    );
  }

  return (
    <MemberNavigationContext.Provider value={contextValue}>
      <div
        className="member-app-shell relative flex min-h-svh w-full min-w-0"
        data-returning-to-portal={String(
          transition?.kind === "back" && transition.targetPath === "/"
        )}
        onClickCapture={handleNavigationCapture}
      >
        <PortalStageLayer />
        <MemberAreaSidebar
          avatarUrl={avatarUrl}
          canManageContent={canManageContent}
          chromeVisible={chromeVisible}
          displayName={displayName}
          email={email}
          gestaoV2Enabled={gestaoV2Enabled}
          localQaAuth={localQaAuth}
          portalMode={
            pathname === "/" ||
            (transition?.direction === "enter" && !chromeVisible)
          }
        >
          <MemberHeader
            chromeVisible={chromeVisible}
            memberId={memberId}
            transitionActive={transition !== null}
          />
          {chromeVisible ? <MemberAreaTabs /> : null}
          <NavigationFeedback />
          <RouteMotion
            ariaHidden={false}
            chromeVisible={chromeVisible}
            overlay={
              <OptimisticCover
                failed={navigationFailure !== null}
                pathname={pathname}
                transition={transition}
              />
            }
            transition={transition}
          >
            {children}
          </RouteMotion>
        </MemberAreaSidebar>
        <ActiveTimerPill />
        {navigationFailure && pathname !== "/" ? (
          <aside className="member-navigation-error" role="alert">
            <p>
              Não foi possível abrir esse destino. Confira sua conexão e tente
              novamente.
            </p>
            <Button onClick={retryNavigation} size="sm" variant="secondary">
              Tentar novamente
            </Button>
            <IntentLink className="member-navigation-error__link" href="/">
              Início
            </IntentLink>
          </aside>
        ) : null}
        <output aria-live="polite" className="sr-only">
          {announcement}
        </output>
      </div>
      {shellFeedback}
    </MemberNavigationContext.Provider>
  );
};

export const MemberShellController = (
  properties: MemberShellControllerProperties
) => {
  const pathname = usePathname();

  return (
    <SidebarProvider
      defaultOpen={pathname !== "/"}
      style={{ "--sidebar-width": "248px" } as CSSProperties}
    >
      <MemberShellView {...properties} />
    </SidebarProvider>
  );
};
