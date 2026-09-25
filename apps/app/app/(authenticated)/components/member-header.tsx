"use client";

import { Separator } from "@repo/design-system/components/ui/separator";
import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar";
import { usePathname } from "next/navigation";
import { BrandWordmark } from "@/components/brand/brand-mark";
import { MemberHeaderControls } from "./member-header-controls";

interface MemberHeaderProperties {
  readonly section?: string;
}

const sectionForPathname = (pathname: string) => {
  if (pathname.startsWith("/admin")) {
    return "Professor";
  }
  if (pathname.startsWith("/aprender")) {
    return "Aprender";
  }
  if (pathname.startsWith("/atividades")) {
    return "Atividades";
  }
  if (pathname.startsWith("/comunidade")) {
    return "Comunidade";
  }
  if (pathname.startsWith("/biblioteca")) {
    return "Biblioteca";
  }
  if (pathname.startsWith("/encontros")) {
    return "Encontros";
  }
  if (pathname.startsWith("/membros")) {
    return "Membros";
  }
  if (pathname === "/perfil") {
    return "Perfil";
  }
  return "Início";
};

export const MemberHeader = ({ section }: MemberHeaderProperties) => {
  const pathname = usePathname();
  const resolvedSection = section ?? sectionForPathname(pathname);

  return (
    <header className="sticky top-0 z-20 flex min-h-16 shrink-0 items-center gap-3 border-border/80 border-b bg-background/95 px-4 backdrop-blur-sm md:px-8">
      <SidebarTrigger className="-ml-2" />
      <Separator className="mr-1 h-4" orientation="vertical" />
      <BrandWordmark className="w-24 md:hidden" />
      <div className="hidden min-w-0 items-center gap-3 md:flex">
        <p className="brand-eyebrow truncate text-foreground/75">
          Interprete. · {resolvedSection}
        </p>
      </div>
      <MemberHeaderControls />
    </header>
  );
};
