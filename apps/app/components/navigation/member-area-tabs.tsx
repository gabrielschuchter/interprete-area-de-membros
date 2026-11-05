"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { ChevronRightIcon, LayoutGridIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import { useMemberNavigation } from "@/app/(authenticated)/components/member-navigation-context";
import { memberActivitiesEnabled } from "@/lib/member-features";

const loadAreaPickerSheet = () =>
  import("./member-area-picker-sheet").then(
    (module) => module.MemberAreaPickerSheet
  );

const AreaPickerSheet = dynamic(loadAreaPickerSheet, {
  ssr: false,
  loading: () => null,
});

const studyAreas = [
  { href: "/cursos", label: "Cursos" },
  { href: "/exercicios", label: "Exercícios" },
  ...(memberActivitiesEnabled
    ? [{ href: "/atividades", label: "Atividades" } as const]
    : []),
  { href: "/biblioteca", label: "Biblioteca" },
  { href: "/ferramentas", label: "Ferramentas" },
] as const;

const communityAreas = [
  { href: "/comunidade", label: "Explorar" },
  { href: "/comunidade/grupos", label: "Grupos de estudo" },
  { href: "/comunidade/encontros", label: "Encontros" },
  { href: "/comunidade/minhas-publicacoes", label: "Minhas publicações" },
] as const;

// Telas da Comunidade que ocupam a tela inteira ou têm cabeçalho próprio.
const communityPathsWithoutTabs = [
  "/comunidade/novo",
  "/comunidade/editor",
  "/comunidade/meus-topicos",
] as const;

const communityAreaHrefs: readonly string[] = communityAreas.map(
  (area) => area.href
);

/** Área da Comunidade de cada rota; páginas de grupo contam como Grupos. */
const communityActiveArea = (pathname: string) => {
  if (pathname.startsWith("/encontros")) {
    return communityAreas[2];
  }
  const direct = communityAreas
    .filter((area) => matchesPath(pathname, area.href))
    .sort((left, right) => right.href.length - left.href.length)[0];
  if (direct && direct.href !== "/comunidade") {
    return direct;
  }
  const [, , segment] = pathname.split("/");
  if (
    segment &&
    segment !== "publicacoes" &&
    segment !== "meta" &&
    !communityAreaHrefs.includes(`/comunidade/${segment}`)
  ) {
    return communityAreas[1];
  }
  return communityAreas[0];
};

const matchesPath = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

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
  const isCommunityPath =
    (pathname === "/comunidade" ||
      pathname.startsWith("/comunidade/") ||
      pathname === "/encontros" ||
      pathname.startsWith("/encontros/") ||
      pathname.startsWith("/membros/")) &&
    !communityPathsWithoutTabs.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    );
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

  const activeArea = isStudyPath
    ? (areas
        .filter((area) => matchesPath(pathname, area.href))
        .sort((left, right) => right.href.length - left.href.length)[0] ??
      areas[0])
    : communityActiveArea(pathname);
  const sectionHref = isStudyPath ? "/cursos" : "/comunidade";

  return (
    <div
      className="member-area-tabs-shell"
      data-area={isStudyPath ? "study" : "community"}
      data-hide-mobile-for-note={String(noteEditorOpen)}
    >
      {noteEditorOpen ? null : (
        <div className="member-area-tabs-mobile member-area-tabs-mobile--study md:hidden">
          <IntentLink
            className="flex min-h-10 min-w-0 items-center gap-2 text-sm"
            href={sectionHref}
          >
            <span className="shrink-0 text-[#7A5A69]">{sectionLabel}</span>
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
            className="h-10 shrink-0 gap-2 px-0 font-semibold text-[#8C1535] max-[359px]:w-10"
            onClick={openAreaPicker}
            onFocus={preloadAreaPicker}
            onPointerEnter={preloadAreaPicker}
            variant="ghost"
          >
            <LayoutGridIcon aria-hidden="true" className="size-4" />
            <span className="max-[359px]:sr-only">
              {areaPickerOpen && !areaPickerReady
                ? "Abrindo áreas…"
                : "Trocar área"}
            </span>
          </Button>
        </div>
      )}
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
