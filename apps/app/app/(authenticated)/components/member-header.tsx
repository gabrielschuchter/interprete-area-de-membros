"use client";

import { Separator } from "@repo/design-system/components/ui/separator";
import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BrandWordmark } from "@/components/brand/brand-mark";
import { MemberHeaderControls } from "./member-header-controls";
import { memberSectionForPathname } from "./member-section";

interface MemberHeaderProperties {
  readonly memberId: string;
  readonly section?: string;
}

export const MemberHeader = ({ memberId, section }: MemberHeaderProperties) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const resolvedSection = section ?? memberSectionForPathname(pathname);
  const isProfileSubpage =
    pathname === "/perfil/editar" || pathname === "/perfil/conquistas";
  const isSessionRoute = pathname.startsWith("/exercicios/sessoes/");
  const isFavoriteAttempt =
    pathname.startsWith("/exercicios/favoritas/") && searchParams.has("sessao");
  const mobileExerciseHeader = (() => {
    if (
      pathname === "/exercicios/historico" ||
      pathname === "/exercicios/favoritas" ||
      pathname.startsWith("/exercicios/listas/")
    ) {
      return {
        href: "/exercicios",
        label: "Voltar para Exercícios",
        title: "Exercícios",
      };
    }
    if (pathname.startsWith("/exercicios/favoritas/")) {
      return {
        href: "/exercicios/favoritas",
        label: "Voltar para questões salvas",
        title: "Questões salvas",
      };
    }
    return null;
  })();
  const mobileShellHeaderHidden = isSessionRoute || isFavoriteAttempt;

  return (
    <header
      className={`${isProfileSubpage || mobileShellHeaderHidden ? "hidden md:flex" : "flex"} sticky top-0 z-20 ${mobileExerciseHeader ? "h-14 min-h-14 md:h-16 md:min-h-16" : "min-h-16"} shrink-0 items-center gap-3 border-border/80 border-b bg-background/95 px-4 backdrop-blur-sm md:px-8`}
    >
      {mobileExerciseHeader && (
        <div className="flex h-14 min-w-0 items-center gap-3 md:hidden">
          <Link
            aria-label={mobileExerciseHeader.label}
            className="grid size-11 shrink-0 place-items-center rounded-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={mobileExerciseHeader.href}
          >
            <ArrowLeftIcon aria-hidden="true" className="size-5" />
          </Link>
          <p className="truncate font-display font-semibold text-lg">
            {mobileExerciseHeader.title}
          </p>
        </div>
      )}
      <div
        className={`${mobileExerciseHeader || mobileShellHeaderHidden ? "hidden md:flex" : "flex"} min-w-0 flex-1 items-center gap-3`}
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
      </div>
    </header>
  );
};
