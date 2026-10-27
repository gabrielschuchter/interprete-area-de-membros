"use client";

import { usePathname } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import type { PortalTransition } from "./member-navigation-context";

interface RouteMotionProperties {
  readonly ariaHidden?: boolean;
  readonly children: ReactNode;
  readonly chromeVisible?: boolean;
  readonly overlay?: ReactNode;
  readonly transition?: PortalTransition | null;
}

export const RouteMotion = ({
  ariaHidden = false,
  children,
  chromeVisible = true,
  overlay = null,
  transition = null,
}: RouteMotionProperties) => {
  const pathname = usePathname();
  const transitionDuration =
    transition?.phase === "leaving"
      ? transition.exitDurationMs
      : (transition?.durationMs ?? 220);

  return (
    <section
      aria-hidden={ariaHidden || undefined}
      aria-label="Conteúdo principal"
      className="relative w-full min-w-0 flex-1 focus-visible:ring-2 focus-visible:ring-brand-action focus-visible:ring-offset-2"
      data-chrome-visible={String(chromeVisible)}
      data-portal-page={String(pathname === "/")}
      id="member-main-content"
      tabIndex={-1}
    >
      <div className="member-route-stage w-full">
        <div
          className="member-route-page w-full"
          data-route-transition-kind={transition?.kind}
          data-route-transition-phase={transition?.phase}
          key={pathname}
          style={
            {
              "--member-transition-duration": `${transitionDuration}ms`,
            } as CSSProperties
          }
        >
          <div className="member-route-page__content">{children}</div>
        </div>
      </div>
      {overlay}
    </section>
  );
};
