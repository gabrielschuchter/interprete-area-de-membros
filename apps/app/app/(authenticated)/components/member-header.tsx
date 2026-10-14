"use client";

import { Separator } from "@repo/design-system/components/ui/separator";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BrandWordmark } from "@/components/brand/brand-mark";
import { MemberHeaderControls } from "./member-header-controls";
import {
  memberBreadcrumbForPathname,
  memberSectionForPathname,
} from "./member-section";
import { MemberSidebarControl } from "./member-sidebar-control";

interface MemberHeaderProperties {
  readonly chromeVisible?: boolean;
  readonly memberId: string;
  readonly section?: string;
  readonly transitionActive?: boolean;
  readonly transitionMode?: "corridor" | "direct";
}

const mobileTitleForPath = (pathname: string) => {
  if (pathname === "/estudar") {
    return "Estudar";
  }
  if (pathname === "/planejamento") {
    return "Planejamento";
  }
  if (pathname === "/ferramentas") {
    return "Ferramentas";
  }
  if (pathname.startsWith("/aprender") || pathname.startsWith("/atividades")) {
    return memberSectionForPathname(pathname);
  }
  return null;
};

export const MemberHeader = ({
  chromeVisible = true,
  memberId,
  section,
  transitionActive = false,
  transitionMode,
}: MemberHeaderProperties) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mobileNoteEditorHeader =
    pathname === "/ferramentas" &&
    searchParams.get("view") === "notes" &&
    Boolean(searchParams.get("note"));
  const resolvedSection = section ?? memberBreadcrumbForPathname(pathname);
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
  const mobileShellTitle = mobileTitleForPath(pathname);

  if (pathname === "/" || !chromeVisible) {
    return null;
  }

  return (
    <header
      className={`${isProfileSubpage || mobileShellHeaderHidden ? "hidden md:flex" : "flex"} ${mobileNoteEditorHeader ? "member-note-editor-header" : ""} member-shell-header sticky top-0 z-20 h-14 min-h-14 shrink-0 items-center gap-3 border-border/80 border-b bg-background/95 px-4 backdrop-blur-sm md:px-8`}
      data-chrome-visible={String(transitionActive && chromeVisible)}
      data-note-editor={String(mobileNoteEditorHeader)}
      data-transition-mode={transitionMode}
    >
      {mobileNoteEditorHeader && (
        <div className="flex h-14 min-w-0 flex-1 items-center gap-3 md:hidden">
          <button
            aria-label="Voltar para notas"
            className="grid size-11 shrink-0 place-items-center rounded-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() =>
              window.dispatchEvent(new Event("interprete:notes-editor-back"))
            }
            type="button"
          >
            <ArrowLeftIcon aria-hidden="true" className="size-5" />
          </button>
          <p className="truncate font-display font-semibold text-lg">Nota</p>
          <MemberHeaderControls memberId={memberId} noteEditorMode />
        </div>
      )}
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
        className={`${mobileExerciseHeader || mobileShellHeaderHidden || mobileNoteEditorHeader ? "hidden md:flex" : "flex"} min-w-0 flex-1 items-center gap-3`}
      >
        <MemberSidebarControl className="-ml-2" />
        {mobileShellTitle ? (
          <p className="truncate font-display font-semibold text-lg md:hidden">
            {mobileShellTitle}
          </p>
        ) : (
          <>
            <Separator className="mr-1 h-4 lg:hidden" orientation="vertical" />
            <BrandWordmark className="w-24 md:hidden" />
          </>
        )}
        <div className="hidden min-w-0 items-center gap-3 md:flex">
          <p className="brand-eyebrow truncate text-foreground/75">
            {resolvedSection}
          </p>
        </div>
        <MemberHeaderControls memberId={memberId} />
      </div>
    </header>
  );
};
