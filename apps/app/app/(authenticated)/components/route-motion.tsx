"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/motion";

interface RouteMotionProperties {
  readonly children: ReactNode;
}

export const RouteMotion = ({ children }: RouteMotionProperties) => {
  const pathname = usePathname();

  return (
    <section
      aria-label="Conteúdo principal"
      className="w-full min-w-0 flex-1 focus-visible:ring-2 focus-visible:ring-brand-action focus-visible:ring-offset-2"
      id="member-main-content"
      tabIndex={-1}
    >
      <Reveal className="motion-route w-full" key={pathname} variant="normal">
        {children}
      </Reveal>
    </section>
  );
};
