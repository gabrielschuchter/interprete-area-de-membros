"use client";

import {
  SidebarTrigger,
  useSidebar,
} from "@repo/design-system/components/ui/sidebar";

interface MemberSidebarControlProperties {
  readonly className?: string;
  readonly mode?: "drawer" | "sidebar";
}

const actionLabel = (
  mode: "drawer" | "sidebar",
  isMobile: boolean,
  expanded: boolean
) => {
  if (mode === "drawer" || isMobile) {
    return expanded ? "Fechar menu" : "Abrir menu";
  }
  return expanded ? "Recolher barra lateral" : "Expandir barra lateral";
};

export const MemberSidebarControl = ({
  className,
  mode = "sidebar",
}: MemberSidebarControlProperties) => {
  const { isMobile, open, openMobile } = useSidebar();
  const expanded = isMobile ? openMobile : open;
  const label = actionLabel(mode, isMobile, expanded);

  return (
    <SidebarTrigger
      aria-expanded={expanded}
      aria-label={label}
      className={className}
      title={label}
    />
  );
};
