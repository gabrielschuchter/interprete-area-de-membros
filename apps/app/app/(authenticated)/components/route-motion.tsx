"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type {
  MemberRouteTransitionPhase,
  PortalTransition,
} from "./member-navigation-context";

interface RouteMotionProperties {
  readonly ariaHidden?: boolean;
  readonly children: ReactNode;
  readonly chromeVisible?: boolean;
  readonly outgoingRoute?: RouteMotionSnapshot | null;
  readonly routeTransitionPhase?: MemberRouteTransitionPhase | null;
  readonly transition?: PortalTransition | null;
}

export interface RouteMotionSnapshot {
  readonly children: ReactNode;
  readonly pathname: string;
}

export const RouteMotion = ({
  ariaHidden = false,
  children,
  chromeVisible = true,
  outgoingRoute = null,
  routeTransitionPhase = null,
  transition = null,
}: RouteMotionProperties) => {
  const pathname = usePathname();

  return (
    <section
      aria-hidden={ariaHidden || undefined}
      aria-label="Conteúdo principal"
      className="w-full min-w-0 flex-1 focus-visible:ring-2 focus-visible:ring-brand-action focus-visible:ring-offset-2"
      data-chrome-visible={String(chromeVisible)}
      data-portal-page={String(pathname === "/")}
      data-transition-direction={transition?.direction}
      data-transition-mode={transition?.mode}
      id="member-main-content"
      tabIndex={-1}
    >
      <div className="member-route-stage w-full">
        {outgoingRoute ? (
          <div
            aria-hidden="true"
            className="member-route-page member-route-page--outgoing w-full"
            inert
            key={`outgoing-${outgoingRoute.pathname}`}
          >
            {outgoingRoute.children}
          </div>
        ) : null}
        <div
          className={`member-route-page w-full ${outgoingRoute ? "member-route-page--incoming" : ""}`}
          key={pathname}
        >
          <div
            className="member-route-page__content"
            data-route-transition-phase={routeTransitionPhase ?? undefined}
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  );
};
