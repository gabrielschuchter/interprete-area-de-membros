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
    <Reveal className="motion-route w-full" key={pathname} variant="normal">
      {children}
    </Reveal>
  );
};
