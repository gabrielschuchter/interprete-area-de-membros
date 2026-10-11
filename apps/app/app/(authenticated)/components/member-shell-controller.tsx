"use client";

import {
  SidebarProvider,
  useSidebar,
} from "@repo/design-system/components/ui/sidebar";
import { usePathname, useRouter } from "next/navigation";
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from "react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MemberAreaTabs } from "@/components/navigation/member-area-tabs";
import { ActiveTimerPill } from "./active-timer-pill";
import { MemberAreaSidebar } from "./member-area-sidebar";
import { MemberHeader } from "./member-header";
import type {
  MemberRouteTransitionPhase,
  PortalTransition,
  PortalTransitionGeometry,
} from "./member-navigation-context";
import { MemberNavigationContext } from "./member-navigation-context";
import {
  focusMemberRouteHeading,
  memberRouteAnnouncementLabel,
} from "./member-route-focus";
import { NavigationFeedback } from "./navigation-feedback";
import { RouteMotion, type RouteMotionSnapshot } from "./route-motion";

interface MemberShellControllerProperties {
  readonly avatarUrl: string | null;
  readonly canManageContent: boolean;
  readonly children: ReactNode;
  readonly displayName: string;
  readonly email: string;
  readonly memberId: string;
  readonly productConfig: {
    readonly showLearnNavigation: boolean;
  };
}

interface MemberRouteTransition {
  readonly id: number;
  readonly phase: MemberRouteTransitionPhase;
  readonly targetPath: string;
}

const pathnameSuffixPattern = /[?#]/;
const memberRouteTransitionTimeout = 12_000;

const studyPathPrefixes = [
  "/estudar",
  "/aprender",
  "/tarefas",
  "/planejamento",
  "/ferramentas",
  "/atividades",
  "/exercicios",
  "/biblioteca",
] as const;

const returnCorridorForPath = (
  pathname: string
): PortalTransition["corridor"] => {
  if (pathname === "/comunidade" || pathname.startsWith("/comunidade/")) {
    return "comunidade";
  }
  if (
    studyPathPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    )
  ) {
    return "estudar";
  }
  return null;
};

const transitionGeometry = (
  anchor: HTMLAnchorElement | null,
  corridor: PortalTransition["corridor"]
): PortalTransitionGeometry | null => {
  if (!(anchor && corridor) || typeof window === "undefined") {
    return null;
  }

  const corridorElement = anchor.matches(`.corr-${corridor}`)
    ? anchor
    : (anchor.closest<HTMLElement>(`.corr-${corridor}`) ??
      document.querySelector<HTMLElement>(`.portal .corr-${corridor}`));
  const design = corridorElement?.closest<HTMLElement>(".p-d, .p-t, .p-m");

  if (!(corridorElement && design)) {
    return null;
  }

  const bounds = corridorElement.getBoundingClientRect();
  const scale = Number.parseFloat(design.dataset.s ?? "1") || 1;

  return {
    dx: (window.innerWidth / 2 - (bounds.left + bounds.width / 2)) / scale,
    dy:
      (window.innerHeight * 0.46 - (bounds.top + bounds.height * 0.63)) / scale,
    offsetX: corridor === "estudar" ? 80 : -80,
    scale: window.innerWidth < 768 ? 3.4 : 3.1,
  };
};

const normalizedPath = (href: string) => {
  try {
    return new URL(href, window.location.href).pathname;
  } catch {
    return href.split(pathnameSuffixPattern, 1)[0] || "/";
  }
};

const portalChildrenForNavigation = (
  latestPortalChildren: ReactNode | null,
  pathname: string,
  children: ReactNode
) => latestPortalChildren ?? (pathname === "/" ? children : null);

const corridorForPortalShortcut = (
  mode: "corridor" | "direct",
  anchor: HTMLAnchorElement | null
): PortalTransition["corridor"] => {
  if (
    mode === "corridor" &&
    (anchor?.dataset.go === "estudar" || anchor?.dataset.go === "comunidade")
  ) {
    return anchor.dataset.go;
  }
  return null;
};

const createPortalEntryTransition = (
  id: number,
  targetPath: string,
  corridor: PortalTransition["corridor"],
  geometry: PortalTransitionGeometry | null
): PortalTransition => {
  return {
    corridor,
    direction: "enter",
    geometry,
    id,
    minimumElapsed: false,
    mode: corridor ? "corridor" : "direct",
    phase: corridor ? "camera" : "direct",
    targetPath,
  };
};

const createPortalReturnTransition = (
  id: number,
  corridor: PortalTransition["corridor"]
): PortalTransition => {
  return {
    corridor,
    direction: "return",
    geometry: null,
    id,
    minimumElapsed: false,
    mode: corridor ? "corridor" : "direct",
    phase: corridor ? "return-prep" : "return-direct",
    targetPath: "/",
  };
};

const schedulePortalEntryTransition = ({
  corridor,
  destinationPath,
  finishTransition,
  getActiveTransition,
  id,
  schedule,
  setActiveTransition,
  setChromeVisible,
}: {
  readonly corridor: PortalTransition["corridor"];
  readonly destinationPath: string;
  readonly finishTransition: (id: number, path: string) => void;
  readonly getActiveTransition: () => PortalTransition | null;
  readonly id: number;
  readonly schedule: (delay: number, callback: () => void) => number;
  readonly setActiveTransition: (next: PortalTransition | null) => void;
  readonly setChromeVisible: (visible: boolean) => void;
}) => {
  if (corridor) {
    schedule(560, () => setChromeVisible(true));
    schedule(600, () => {
      const current = getActiveTransition();
      if (current?.id === id) {
        setActiveTransition({ ...current, phase: "fade" });
      }
    });
    schedule(910, () => finishTransition(id, destinationPath));
    return;
  }

  schedule(100, () => setChromeVisible(true));
  schedule(350, () => finishTransition(id, destinationPath));
};

const schedulePortalReturnTransition = (
  corridor: PortalTransition["corridor"],
  id: number,
  schedule: (delay: number, callback: () => void) => number,
  finishTransition: (id: number, path: string) => void
) => {
  if (!corridor) {
    schedule(320, () => finishTransition(id, "/"));
  }
};

const isPrimaryUnmodifiedClick = (event: ReactMouseEvent<HTMLDivElement>) =>
  !event.defaultPrevented &&
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;

const anchorForEventTarget = (target: EventTarget | null) =>
  target instanceof Element
    ? target.closest<HTMLAnchorElement>("a[href]")
    : null;

const sameOriginUrlForAnchor = (anchor: HTMLAnchorElement) => {
  try {
    const url = new URL(anchor.href, window.location.href);
    return url.origin === window.location.origin ? url : null;
  } catch {
    return null;
  }
};

type MemberNavigationIntent = "internal" | "portal-enter" | "portal-return";

const navigationIntentForPaths = (
  currentPath: string,
  destinationPath: string
): MemberNavigationIntent | null => {
  if (currentPath === "/") {
    return destinationPath === "/" ? null : "portal-enter";
  }
  if (destinationPath === "/") {
    return "portal-return";
  }
  return destinationPath === currentPath ? null : "internal";
};

const navigationForAnchor = (
  anchor: HTMLAnchorElement | null,
  currentPath: string
) => {
  if (
    !anchor ||
    anchor.target === "_blank" ||
    anchor.hasAttribute("download") ||
    anchor.relList.contains("external")
  ) {
    return null;
  }
  const url = sameOriginUrlForAnchor(anchor);
  if (!url) {
    return null;
  }
  const intent = navigationIntentForPaths(currentPath, url.pathname);
  return intent
    ? { anchor, href: `${url.pathname}${url.search}${url.hash}`, intent }
    : null;
};

const MemberShellView = ({
  avatarUrl,
  canManageContent,
  children,
  displayName,
  email,
  memberId,
  productConfig,
}: MemberShellControllerProperties) => {
  const pathname = usePathname();
  const router = useRouter();
  const { setOpen, setOpenMobile } = useSidebar();
  const [chromeVisible, setChromeVisible] = useState(pathname !== "/");
  const [portalSnapshot, setPortalSnapshot] = useState<ReactNode | null>(null);
  const [transition, setTransition] = useState<PortalTransition | null>(null);
  const [routeTransition, setRouteTransition] =
    useState<MemberRouteTransition | null>(null);
  const [outgoingRoute, setOutgoingRoute] =
    useState<RouteMotionSnapshot | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const latestPortalChildren = useRef<ReactNode | null>(null);
  const transitionRef = useRef<PortalTransition | null>(null);
  const routeTransitionRef = useRef<MemberRouteTransition | null>(null);
  const previousRouteSnapshot = useRef<RouteMotionSnapshot>({
    children,
    pathname,
  });
  const previousPathname = useRef(pathname);
  const sequence = useRef(0);
  const timers = useRef<number[]>([]);

  const setActiveTransition = useCallback((next: PortalTransition | null) => {
    transitionRef.current = next;
    setTransition(next);
  }, []);

  const setActiveRouteTransition = useCallback(
    (next: MemberRouteTransition | null) => {
      routeTransitionRef.current = next;
      setRouteTransition(next);
    },
    []
  );

  const clearTimers = useCallback(() => {
    for (const timer of timers.current) {
      window.clearTimeout(timer);
    }
    timers.current = [];
  }, []);

  const schedule = useCallback((delay: number, callback: () => void) => {
    let timer = 0;
    timer = window.setTimeout(() => {
      timers.current = timers.current.filter((pending) => pending !== timer);
      callback();
    }, delay);
    timers.current.push(timer);
    return timer;
  }, []);

  const announceAndFocusRoute = useCallback(
    (destinationPath: string) => {
      window.requestAnimationFrame(() => {
        if (window.location.pathname !== destinationPath) {
          return;
        }

        const main = document.getElementById("member-main-content");
        const heading = focusMemberRouteHeading(main);
        const label = memberRouteAnnouncementLabel(destinationPath, heading);
        window.scrollTo(0, 0);
        setAnnouncement("");
        schedule(30, () => setAnnouncement(`Você está em ${label}.`));
      });
    },
    [schedule]
  );

  const startInternalRouteTransition = useCallback(
    (href: string, shouldNavigate: boolean) => {
      if (transitionRef.current || routeTransitionRef.current) {
        return;
      }

      const targetPath = normalizedPath(href);
      if (targetPath === pathname) {
        if (shouldNavigate) {
          router.push(href);
        }
        return;
      }

      clearTimers();
      const id = ++sequence.current;
      setActiveRouteTransition({ id, phase: "leaving", targetPath });

      if (shouldNavigate) {
        schedule(memberRouteTransitionTimeout, () => {
          const current = routeTransitionRef.current;
          if (current?.id === id && current.phase === "leaving") {
            setActiveRouteTransition(null);
          }
        });
        router.push(href);
      }
    },
    [clearTimers, pathname, router, schedule, setActiveRouteTransition]
  );

  const finishRouteTransition = useCallback(
    (id: number, destinationPath: string) => {
      if (routeTransitionRef.current?.id === id) {
        clearTimers();
        setActiveRouteTransition(null);
        setOutgoingRoute(null);
        announceAndFocusRoute(destinationPath);
      }
    },
    [announceAndFocusRoute, clearTimers, setActiveRouteTransition]
  );

  const enterInternalRoute = useCallback(
    (targetPath: string, previousRoute: RouteMotionSnapshot) => {
      clearTimers();
      const active = routeTransitionRef.current;
      const id = active?.phase === "leaving" ? active.id : ++sequence.current;
      setActiveRouteTransition({ id, phase: "entering", targetPath });
      setOutgoingRoute(previousRoute);
      schedule(300, () => finishRouteTransition(id, targetPath));
    },
    [clearTimers, finishRouteTransition, schedule, setActiveRouteTransition]
  );

  const finishTransition = useCallback(
    (transitionId: number, destinationPath: string) => {
      if (transitionRef.current?.id !== transitionId) {
        return;
      }

      if (window.location.pathname !== destinationPath) {
        setActiveTransition({
          ...transitionRef.current,
          minimumElapsed: true,
          phase: "waiting",
        });
        return;
      }

      setPortalSnapshot(null);
      setActiveTransition(null);
      setChromeVisible(destinationPath !== "/");
      announceAndFocusRoute(destinationPath);
    },
    [announceAndFocusRoute, setActiveTransition]
  );

  const startPortalEnter = useCallback(
    (
      href: string,
      mode: "corridor" | "direct",
      anchor: HTMLAnchorElement | null,
      shouldNavigate: boolean
    ) => {
      if (transitionRef.current) {
        return;
      }

      const portalContent = portalChildrenForNavigation(
        latestPortalChildren.current,
        pathname,
        children
      );

      if (!portalContent) {
        if (shouldNavigate) {
          router.push(href);
        }
        return;
      }

      clearTimers();
      const destinationPath = normalizedPath(href);
      const corridor = corridorForPortalShortcut(mode, anchor);
      const id = ++sequence.current;
      const next = createPortalEntryTransition(
        id,
        destinationPath,
        corridor,
        transitionGeometry(anchor, corridor)
      );

      setPortalSnapshot(portalContent);
      setActiveTransition(next);
      setChromeVisible(false);
      setOpen(false);
      setOpenMobile(false);

      if (shouldNavigate) {
        router.push(href);
      }

      schedulePortalEntryTransition({
        corridor,
        destinationPath,
        finishTransition,
        getActiveTransition: () => transitionRef.current,
        id,
        schedule,
        setActiveTransition,
        setChromeVisible,
      });
    },
    [
      children,
      clearTimers,
      finishTransition,
      pathname,
      router,
      schedule,
      setActiveTransition,
      setOpen,
      setOpenMobile,
    ]
  );

  const startPortalReturn = useCallback(
    (fromPath: string, href: string, shouldNavigate: boolean) => {
      if (transitionRef.current) {
        return;
      }

      const portalContent = portalChildrenForNavigation(
        latestPortalChildren.current,
        pathname,
        children
      );

      if (!portalContent) {
        if (shouldNavigate) {
          router.push(href);
        }
        return;
      }

      clearTimers();
      const id = ++sequence.current;
      const corridor = returnCorridorForPath(fromPath);
      const next = createPortalReturnTransition(id, corridor);

      setPortalSnapshot(portalContent);
      setActiveTransition(next);
      setChromeVisible(false);
      setOpen(false);
      setOpenMobile(false);

      if (shouldNavigate) {
        router.push(href);
      }

      schedulePortalReturnTransition(corridor, id, schedule, finishTransition);
    },
    [
      children,
      clearTimers,
      finishTransition,
      pathname,
      router,
      schedule,
      setActiveTransition,
      setOpen,
      setOpenMobile,
    ]
  );

  const onPortalReady = useCallback(
    (transitionId: number, geometry: PortalTransitionGeometry) => {
      const current = transitionRef.current;
      if (
        !current ||
        current.id !== transitionId ||
        current.direction !== "return" ||
        current.phase !== "return-prep"
      ) {
        return;
      }

      const next = { ...current, geometry, phase: "returning" as const };
      setActiveTransition(next);
      schedule(660, () => finishTransition(transitionId, "/"));
    },
    [finishTransition, schedule, setActiveTransition]
  );

  const navigate = useCallback(
    (href: string) => {
      if (routeTransitionRef.current) {
        return;
      }
      const destinationPath = normalizedPath(href);
      if (pathname === "/" && destinationPath !== "/") {
        startPortalEnter(href, "direct", null, true);
      } else if (pathname !== "/" && destinationPath === "/") {
        startPortalReturn(pathname, href, true);
      } else if (!transitionRef.current) {
        startInternalRouteTransition(href, true);
      }
    },
    [
      pathname,
      startInternalRouteTransition,
      startPortalEnter,
      startPortalReturn,
    ]
  );

  const handleNavigationCapture = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!isPrimaryUnmodifiedClick(event)) {
        return;
      }

      if (transitionRef.current || routeTransitionRef.current) {
        event.preventDefault();
        return;
      }

      const navigation = navigationForAnchor(
        anchorForEventTarget(event.target),
        pathname
      );
      if (!navigation) {
        return;
      }

      event.preventDefault();
      if (navigation.intent === "portal-enter") {
        startPortalEnter(
          navigation.href,
          navigation.anchor.hasAttribute("data-corridor")
            ? "corridor"
            : "direct",
          navigation.anchor,
          true
        );
      } else if (navigation.intent === "portal-return") {
        startPortalReturn(pathname, navigation.href, true);
      } else {
        startInternalRouteTransition(navigation.href, true);
      }
    },
    [
      pathname,
      startInternalRouteTransition,
      startPortalEnter,
      startPortalReturn,
    ]
  );

  const reconcilePathTransition = useCallback(
    (previous: string, current: string, previousRoute: RouteMotionSnapshot) => {
      const active = transitionRef.current;
      if (active?.targetPath === current && active.minimumElapsed) {
        finishTransition(active.id, current);
        return;
      }

      if (active) {
        return;
      }

      if (previous === "/") {
        startPortalEnter(current, "direct", null, false);
        return;
      }

      if (current === "/") {
        if (routeTransitionRef.current) {
          clearTimers();
          setActiveRouteTransition(null);
        }
        setOutgoingRoute(null);
        startPortalReturn(previous, "/", false);
        return;
      }

      enterInternalRoute(current, previousRoute);
    },
    [
      clearTimers,
      enterInternalRoute,
      finishTransition,
      setActiveRouteTransition,
      startPortalEnter,
      startPortalReturn,
    ]
  );

  useLayoutEffect(() => {
    if (pathname === "/") {
      latestPortalChildren.current = children;
    }

    const previous = previousPathname.current;
    const previousRoute = previousRouteSnapshot.current;
    previousPathname.current = pathname;

    if (previous !== pathname) {
      reconcilePathTransition(previous, pathname, previousRoute);
    }

    previousRouteSnapshot.current = { children, pathname };
  }, [children, pathname, reconcilePathTransition]);

  useLayoutEffect(
    () => () => {
      clearTimers();
    },
    [clearTimers]
  );

  const contextValue = useMemo(
    () => ({
      displayName,
      memberId,
      navigate,
      onPortalReady,
      showLearnNavigation: productConfig.showLearnNavigation,
      transition,
    }),
    [
      displayName,
      memberId,
      navigate,
      onPortalReady,
      productConfig.showLearnNavigation,
      transition,
    ]
  );
  const transitionActive = portalSnapshot !== null && transition !== null;
  const portalLayer =
    transitionActive && portalSnapshot ? (
      <div
        aria-hidden="true"
        className="member-portal-transition-layer"
        data-corridor={transition?.corridor ?? undefined}
        data-direction={transition?.direction}
        data-mode={transition?.mode}
        data-phase={transition?.phase}
        inert
        style={
          {
            "--portal-dx": `${transition?.geometry?.dx ?? 0}px`,
            "--portal-dy": `${transition?.geometry?.dy ?? 0}px`,
            "--portal-offset-x": `${transition?.geometry?.offsetX ?? 0}px`,
            "--portal-scale": transition?.geometry?.scale ?? 3.1,
          } as CSSProperties
        }
      >
        {portalSnapshot}
      </div>
    ) : null;

  return (
    <MemberNavigationContext.Provider value={contextValue}>
      <div
        className="member-app-shell flex min-h-svh w-full min-w-0"
        onClickCapture={handleNavigationCapture}
      >
        <MemberAreaSidebar
          avatarUrl={avatarUrl}
          canManageContent={canManageContent}
          chromeVisible={transitionActive && chromeVisible}
          displayName={displayName}
          email={email}
          portalMode={
            pathname === "/" ||
            (transition?.direction === "enter" && !chromeVisible)
          }
        >
          <MemberHeader
            chromeVisible={chromeVisible}
            memberId={memberId}
            transitionActive={transitionActive}
            transitionMode={transition?.mode}
          />
          {chromeVisible ? <MemberAreaTabs /> : null}
          <NavigationFeedback />
          <RouteMotion
            ariaHidden={transitionActive && !chromeVisible}
            chromeVisible={chromeVisible}
            outgoingRoute={outgoingRoute}
            routeTransitionPhase={routeTransition?.phase ?? null}
            transition={transition}
          >
            {children}
          </RouteMotion>
        </MemberAreaSidebar>
        <ActiveTimerPill />
        {portalLayer}
        <output aria-live="polite" className="sr-only">
          {announcement}
        </output>
      </div>
    </MemberNavigationContext.Provider>
  );
};

export const MemberShellController = (
  properties: MemberShellControllerProperties
) => {
  return (
    <SidebarProvider
      defaultOpen
      style={{ "--sidebar-width": "248px" } as CSSProperties}
    >
      <MemberShellView {...properties} />
    </SidebarProvider>
  );
};
