"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  LayoutGridIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import { useMemberNavigation } from "@/app/(authenticated)/components/member-navigation-context";

const loadAreaPickerSheet = () =>
  import("./member-area-picker-sheet").then(
    (module) => module.MemberAreaPickerSheet
  );

const AreaPickerSheet = dynamic(loadAreaPickerSheet, {
  ssr: false,
  loading: () => null,
});

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
  { href: "/comunidade", label: "Explorar" },
  { href: "/comunidade/grupos", label: "Grupos" },
  { href: "/comunidade/encontros", label: "Encontros" },
  { href: "/comunidade/salvos", label: "Salvos" },
  { href: "/comunidade/minhas-publicacoes", label: "Minhas publicações" },
] as const;

const communityLocalNavigationPaths = [
  "/comunidade/grupos",
  "/comunidade/encontros",
  "/comunidade/salvos",
  "/comunidade/minhas-publicacoes",
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

export const MemberAreaTabs = () => {
  const committedPathname = usePathname();
  const searchParams = useSearchParams();
  const transition = useMemberNavigation()?.transition;
  // The active tab follows the click instead of waiting for the server.
  const pathname =
    transition &&
    transition.phase !== "entering" &&
    transition.targetPath !== "/"
      ? transition.targetPath
      : committedPathname;
  const noteEditorOpen =
    pathname === "/ferramentas" &&
    searchParams.get("view") === "notes" &&
    Boolean(searchParams.get("note"));
  const isStudyPath = studyAreas.some((area) =>
    matchesPath(pathname, area.href)
  );
  const hasCommunityLocalNavigation =
    communityLocalNavigationPaths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    ) || pathname === "/comunidade";
  const isCommunityPath =
    (pathname === "/comunidade" ||
      pathname.startsWith("/comunidade/") ||
      pathname === "/encontros" ||
      pathname.startsWith("/encontros/")) &&
    !hasCommunityLocalNavigation &&
    pathname !== "/comunidade/meus-topicos" &&
    !pathname.startsWith("/encontros/gravacoes");
  const areas = navigationAreasForPath(isStudyPath, isCommunityPath);
  const sectionLabel = isStudyPath ? "Estudar" : "Comunidade";
  const [areaPickerOpen, setAreaPickerOpen] = useState(false);
  const [areaPickerReady, setAreaPickerReady] = useState(false);
  const preloadAreaPicker = useCallback(() => {
    return loadAreaPickerSheet().then(() => setAreaPickerReady(true));
  }, []);
  const openAreaPicker = useCallback(() => {
    setAreaPickerOpen(true);
    return preloadAreaPicker();
  }, [preloadAreaPicker]);

  if (areas.length === 0) {
    return null;
  }

  const activeArea = pathname.startsWith("/encontros/")
    ? communityAreas[2]
    : (areas
        .filter((area) => matchesPath(pathname, area.href))
        .sort((left, right) => right.href.length - left.href.length)[0] ??
      areas[0]);

  return (
    <div
      className="member-area-tabs-shell"
      data-area={isStudyPath ? "study" : "community"}
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
            <Button
              aria-busy={areaPickerOpen && !areaPickerReady}
              aria-label="Trocar área"
              className="h-10 shrink-0 gap-2 px-0 font-semibold text-[#8C1535]"
              onClick={openAreaPicker}
              onFocus={preloadAreaPicker}
              onPointerEnter={preloadAreaPicker}
              variant="ghost"
            >
              <LayoutGridIcon aria-hidden="true" className="size-4" />
              {areaPickerOpen && !areaPickerReady
                ? "Abrindo áreas…"
                : "Trocar área"}
            </Button>
          </div>
        ) : (
          <div className="member-area-tabs-mobile md:hidden">
            <Button
              aria-busy={areaPickerOpen && !areaPickerReady}
              aria-label={`Trocar ${sectionLabel.toLowerCase()}`}
              className="h-11 w-full justify-between rounded-sm border-border bg-background px-3"
              onClick={openAreaPicker}
              onFocus={preloadAreaPicker}
              onPointerEnter={preloadAreaPicker}
              variant="outline"
            >
              <span className="min-w-0 truncate">
                <span className="text-muted-foreground">{sectionLabel} · </span>
                <span className="font-medium text-foreground">
                  {activeArea.label}
                </span>
              </span>
              <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0" />
            </Button>
          </div>
        ))}
      <nav
        aria-label={`${sectionLabel} · áreas`}
        className="member-area-tabs-desktop"
      >
        <span aria-hidden="true" className="member-area-tabs-section">
          {sectionLabel}
        </span>
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
      {areaPickerOpen ? (
        <AreaPickerSheet
          activeLabel={activeArea.label}
          areas={areas}
          label={sectionLabel}
          onOpenChange={(open: boolean) => {
            setAreaPickerOpen(open);
            if (!open) {
              setAreaPickerReady(false);
            }
          }}
          open
        />
      ) : null}
    </div>
  );
};
