"use client";

import { useEffect, useState } from "react";

export type PortalViewport = "landscape" | "mobile" | "tablet" | "wide";

export const usePortalViewport = () => {
  const [viewport, setViewport] = useState<PortalViewport | null>(null);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 699px)");
    const landscape = window.matchMedia(
      "(max-height: 520px) and (min-width: 700px)"
    );
    const desktop = window.matchMedia("(min-width: 1360px)");
    const update = () => {
      if (mobile.matches) {
        setViewport("mobile");
        return;
      }
      if (landscape.matches) {
        setViewport("landscape");
        return;
      }
      setViewport(desktop.matches ? "wide" : "tablet");
    };
    update();
    mobile.addEventListener("change", update);
    landscape.addEventListener("change", update);
    desktop.addEventListener("change", update);
    return () => {
      mobile.removeEventListener("change", update);
      landscape.removeEventListener("change", update);
      desktop.removeEventListener("change", update);
    };
  }, []);

  return viewport;
};
