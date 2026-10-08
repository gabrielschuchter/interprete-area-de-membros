"use client";

import { Separator } from "@repo/design-system/components/ui/separator";
import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar";
import { usePathname } from "next/navigation";
import { BrandWordmark } from "@/components/brand/brand-mark";
import { MemberHeaderControls } from "./member-header-controls";
import { memberSectionForPathname } from "./member-section";

interface MemberHeaderProperties {
  readonly memberId: string;
  readonly section?: string;
}

export const MemberHeader = ({ memberId, section }: MemberHeaderProperties) => {
  const pathname = usePathname();
  const resolvedSection = section ?? memberSectionForPathname(pathname);
  const isProfileSubpage =
    pathname === "/perfil/editar" || pathname === "/perfil/conquistas";

  return (
    <header
      className={`${isProfileSubpage ? "hidden md:flex" : "flex"} sticky top-0 z-20 min-h-16 shrink-0 items-center gap-3 border-border/80 border-b bg-background/95 px-4 backdrop-blur-sm md:px-8`}
    >
      <SidebarTrigger className="-ml-2" />
      <Separator className="mr-1 h-4" orientation="vertical" />
      <BrandWordmark className="w-24 md:hidden" />
      <div className="hidden min-w-0 items-center gap-3 md:flex">
        <p className="brand-eyebrow truncate text-foreground/75">
          Interprete. · {resolvedSection}
        </p>
      </div>
      <MemberHeaderControls memberId={memberId} />
    </header>
  );
};
