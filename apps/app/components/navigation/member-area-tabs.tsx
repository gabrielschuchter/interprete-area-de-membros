"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/design-system/components/ui/sheet";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  LayoutGridIcon,
} from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";

const studyAreas = [
  { href: "/estudar", label: "Visão geral" },
  { href: "/cursos", label: "Cursos" },
  { href: "/exercicios", label: "Exercícios" },
  { href: "/atividades", label: "Atividades" },
  { href: "/biblioteca", label: "Biblioteca" },
  { href: "/planejamento", label: "Planejamento" },
  { href: "/ferramentas", label: "Ferramentas" },
] as const;

const communityAreas = [
  { href: "/comunidade", label: "Publicações" },
  { href: "/encontros", label: "Encontros" },
] as const;

const matchesPath = (pathname: string, href: string) =>
  href === "/estudar"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

const navigationAreasForPath = (
  isStudyPath: boolean,
  isCommunityPath: boolean
) => {
  if (isStudyPath) {
    return studyAreas;
  }
  if (isCommunityPath) {
    return communityAreas;
  }
  return [];
};

const AreaSheet = ({
  activeLabel,
  areas,
  label,
}: {
  readonly activeLabel: string;
  readonly areas: ReadonlyArray<{
    readonly href: string;
    readonly label: string;
  }>;
  readonly label: string;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger asChild>
        {label === "Estudar" ? (
          <Button
            aria-label="Trocar área"
            className="h-10 shrink-0 gap-2 px-0 font-semibold text-[#8C1535]"
            variant="ghost"
          >
            <LayoutGridIcon aria-hidden="true" className="size-4" />
            Trocar área
          </Button>
        ) : (
          <Button
            aria-label={`Trocar ${label.toLowerCase()}`}
            className="h-11 w-full justify-between rounded-sm border-border bg-background px-3"
            variant="outline"
          >
            <span className="min-w-0 truncate">
              <span className="text-muted-foreground">{label} · </span>
              <span className="font-medium text-foreground">{activeLabel}</span>
            </span>
            <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0" />
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-[min(88vw,360px)] bg-background" side="left">
        <SheetHeader className="border-b px-5 py-5 text-left">
          <SheetTitle className="font-display text-2xl">
            Trocar {label.toLowerCase()}
          </SheetTitle>
          <SheetDescription>Escolha uma área para continuar.</SheetDescription>
        </SheetHeader>
        <nav aria-label={label} className="grid gap-1 px-3 py-4">
          {areas.map((area) => (
            <IntentLink
              aria-current={area.label === activeLabel ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-sm px-3 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${area.label === activeLabel ? "bg-accent font-semibold text-foreground" : "text-muted-foreground"}`}
              href={area.href}
              key={area.href}
              onClick={() => setOpen(false)}
            >
              {area.label}
            </IntentLink>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
};

export const MemberAreaTabs = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const noteEditorOpen =
    pathname === "/ferramentas" &&
    searchParams.get("view") === "notes" &&
    Boolean(searchParams.get("note"));
  const isStudyPath = studyAreas.some((area) =>
    matchesPath(pathname, area.href)
  );
  const isCommunityPath =
    (pathname === "/comunidade" ||
      pathname.startsWith("/comunidade/") ||
      pathname === "/encontros" ||
      pathname.startsWith("/encontros/")) &&
    pathname !== "/comunidade/salvos" &&
    pathname !== "/comunidade/meus-topicos" &&
    !pathname.startsWith("/encontros/gravacoes");
  const areas = navigationAreasForPath(isStudyPath, isCommunityPath);

  if (areas.length === 0) {
    return null;
  }

  const activeArea =
    areas.find((area) => matchesPath(pathname, area.href)) ?? areas[0];
  const sectionLabel = isStudyPath ? "Estudar" : "Comunidade";

  return (
    <div
      className="member-area-tabs-shell"
      data-hide-mobile-for-note={String(noteEditorOpen)}
    >
      {!noteEditorOpen &&
        (isStudyPath ? (
          <div className="member-area-tabs-mobile member-area-tabs-mobile--study md:hidden">
            <IntentLink
              className="flex min-h-10 min-w-0 items-center gap-2 text-sm"
              href="/estudar"
            >
              <span className="text-[#7A5A69]">Estudar</span>
              <ChevronRightIcon
                aria-hidden="true"
                className="size-3.5 shrink-0 text-[#947A83]"
              />
              <span
                aria-current="page"
                className="truncate font-semibold text-[#40222F]"
              >
                {activeArea.label}
              </span>
            </IntentLink>
            <AreaSheet
              activeLabel={activeArea.label}
              areas={areas}
              label={sectionLabel}
            />
          </div>
        ) : (
          <div className="member-area-tabs-mobile md:hidden">
            <AreaSheet
              activeLabel={activeArea.label}
              areas={areas}
              label={sectionLabel}
            />
          </div>
        ))}
      <nav
        aria-label={`${sectionLabel} · áreas`}
        className="member-area-tabs-desktop"
      >
        {isStudyPath ? (
          <span aria-hidden="true" className="member-area-tabs-section">
            Estudar
          </span>
        ) : null}
        <div className="member-area-tabs-links">
          {areas.map((area) => (
            <IntentLink
              aria-current={
                area.label === activeArea.label ? "page" : undefined
              }
              className={
                area.label === activeArea.label
                  ? "member-area-tab member-area-tab--active"
                  : "member-area-tab"
              }
              href={area.href}
              key={area.href}
            >
              {area.label}
            </IntentLink>
          ))}
        </div>
      </nav>
    </div>
  );
};
