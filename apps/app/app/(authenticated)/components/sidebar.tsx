"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@repo/design-system/components/ui/sidebar";
import {
  BookmarkIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  CheckSquareIcon,
  HouseIcon,
  LibraryIcon,
  ListChecksIcon,
  MessageCircleIcon,
  SettingsIcon,
  TargetIcon,
  VideoIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { BrandWordmark } from "@/components/brand/brand-mark";
import { IntentLink } from "./intent-link";
import {
  isSidebarPathActive,
  personalContentNavigation,
} from "./member-section";

const whitespacePattern = /\s+/;

interface GlobalSidebarProperties {
  readonly avatarUrl: string | null;
  readonly canManageContent: boolean;
  readonly children: ReactNode;
  readonly displayName: string;
  readonly productConfig: {
    readonly showLearnNavigation: boolean;
  };
}

const baseNavigation = [
  { href: "/", label: "Início", icon: HouseIcon },
  { href: "/tarefas", label: "Metas e tarefas", icon: TargetIcon },
  { href: "/encontros", label: "Encontros", icon: CalendarDaysIcon },
  { href: "/atividades", label: "Atividades", icon: CheckSquareIcon },
  { href: "/exercicios", label: "Exercícios", icon: ListChecksIcon },
  {
    href: "/comunidade",
    label: "Comunidade",
    icon: MessageCircleIcon,
  },
  { href: "/biblioteca", label: "Biblioteca", icon: LibraryIcon },
] as const;

const learnNavigation = {
  href: "/aprender",
  label: "Aprender",
  icon: BookOpenIcon,
} as const;

export const GlobalSidebar = ({
  avatarUrl,
  canManageContent,
  children,
  displayName,
  productConfig,
}: GlobalSidebarProperties) => {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [exerciseTablet, setExerciseTablet] = useState(false);
  const previousSidebarOpen = useRef<boolean | null>(null);
  const { open: sidebarOpen, setOpen: setSidebarOpen } = useSidebar();
  const previousPathname = useRef(pathname);
  const isExercisesRoute =
    pathname === "/exercicios" || pathname.startsWith("/exercicios/");
  const navigation = [
    baseNavigation[0],
    ...(productConfig.showLearnNavigation ? [learnNavigation] : []),
    ...baseNavigation.slice(1),
  ];
  const activePath = pendingHref ?? pathname;
  const knownHrefs = [
    ...navigation.map((item) => item.href),
    ...personalContentNavigation.map((item) => item.href),
    "/comunidade/meus-topicos",
    "/configuracoes",
    "/perfil",
    ...(canManageContent ? ["/admin"] : []),
  ];
  const isActivePath = (href: string) =>
    isSidebarPathActive(activePath, href, knownHrefs);
  const handleNavigationStart = useCallback(
    (href: string) => {
      if (href !== pathname) {
        setPendingHref(href);
      }
    },
    [pathname]
  );

  useEffect(() => {
    if (previousPathname.current === pathname) {
      return;
    }

    previousPathname.current = pathname;
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    const tabletViewport = window.matchMedia(
      "(min-width: 48rem) and (max-width: 63.999rem)"
    );
    const syncExerciseSidebar = () => {
      const shouldUseOffcanvas = isExercisesRoute && tabletViewport.matches;
      setExerciseTablet(shouldUseOffcanvas);

      if (shouldUseOffcanvas) {
        if (previousSidebarOpen.current === null) {
          previousSidebarOpen.current = sidebarOpen;
          if (sidebarOpen) {
            setSidebarOpen(false);
          }
        }
        return;
      }

      if (previousSidebarOpen.current !== null) {
        const previousOpen = previousSidebarOpen.current;
        previousSidebarOpen.current = null;
        if (sidebarOpen !== previousOpen) {
          setSidebarOpen(previousOpen);
        }
      }
    };

    syncExerciseSidebar();
    tabletViewport.addEventListener("change", syncExerciseSidebar);
    return () =>
      tabletViewport.removeEventListener("change", syncExerciseSidebar);
  }, [isExercisesRoute, setSidebarOpen, sidebarOpen]);

  return (
    <>
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:border focus:bg-background focus:px-4 focus:py-3 focus:text-foreground focus:shadow-lg focus-visible:ring-2 focus-visible:ring-brand-action focus-visible:ring-offset-2"
        href="#member-main-content"
      >
        Pular para o conteúdo principal
      </a>
      <Sidebar
        collapsible={exerciseTablet ? "offcanvas" : "icon"}
        variant="sidebar"
      >
        <SidebarHeader className="border-sidebar-border border-b px-4 py-5 group-data-[collapsible=icon]:px-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className="h-11 rounded-sm px-2 hover:bg-sidebar-accent group-data-[collapsible=icon]:p-2!"
                size="lg"
                tooltip="Interprete."
              >
                <IntentLink href="/" onNavigationStart={handleNavigationStart}>
                  <BrandWordmark
                    className="w-[7.25rem] group-data-[collapsible=icon]:hidden"
                    tone="branco"
                  />
                  <span className="hidden font-display text-2xl text-sidebar-foreground group-data-[collapsible=icon]:inline">
                    I.
                  </span>
                </IntentLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarGroup
            aria-label="Conteúdo pessoal"
            className="px-2 pt-0 pb-3"
            role="group"
          >
            <SidebarMenu>
              {personalContentNavigation.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    className="rounded-sm py-2.5 data-[active=true]:border-sidebar-primary data-[active=true]:border-l-2 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                    isActive={isActivePath(item.href)}
                    tooltip={item.label}
                  >
                    <IntentLink
                      aria-current={
                        isActivePath(item.href) ? "page" : undefined
                      }
                      href={item.href}
                      onNavigationStart={handleNavigationStart}
                    >
                      {item.icon === "recordings" ? (
                        <VideoIcon />
                      ) : (
                        <BookmarkIcon />
                      )}
                      <span className="group-data-[collapsible=icon]:hidden">
                        {item.label}
                      </span>
                    </IntentLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup className="pt-0">
            <SidebarGroupLabel className="brand-eyebrow text-sidebar-foreground/60">
              Área de membros
            </SidebarGroupLabel>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    className="rounded-sm py-2.5 data-[active=true]:border-sidebar-primary data-[active=true]:border-l-2 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                    isActive={isActivePath(item.href)}
                    tooltip={item.label}
                  >
                    <IntentLink
                      aria-current={
                        isActivePath(item.href) ? "page" : undefined
                      }
                      href={item.href}
                      onNavigationStart={handleNavigationStart}
                    >
                      <item.icon />
                      <span className="group-data-[collapsible=icon]:hidden">
                        {item.label}
                      </span>
                    </IntentLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {canManageContent && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    className="mt-5 rounded-sm border-sidebar-border border-t pt-4 data-[active=true]:border-sidebar-primary data-[active=true]:border-l-2 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                    isActive={isActivePath("/admin")}
                    tooltip="Professor"
                  >
                    <IntentLink
                      aria-current={isActivePath("/admin") ? "page" : undefined}
                      href="/admin"
                      onNavigationStart={handleNavigationStart}
                    >
                      <BookOpenIcon />
                      <span className="group-data-[collapsible=icon]:hidden">
                        Professor
                      </span>
                    </IntentLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className="rounded-sm"
                isActive={isActivePath("/comunidade/meus-topicos")}
                tooltip="Meus tópicos"
              >
                <IntentLink
                  aria-current={
                    isActivePath("/comunidade/meus-topicos")
                      ? "page"
                      : undefined
                  }
                  href="/comunidade/meus-topicos"
                  onNavigationStart={handleNavigationStart}
                >
                  <MessageCircleIcon />
                  <span className="group-data-[collapsible=icon]:hidden">
                    Meus tópicos
                  </span>
                </IntentLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className="rounded-sm data-[active=true]:border-sidebar-primary data-[active=true]:border-l-2 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                isActive={isActivePath("/configuracoes")}
                tooltip="Configurações"
              >
                <IntentLink
                  aria-current={
                    isActivePath("/configuracoes") ? "page" : undefined
                  }
                  href="/configuracoes"
                  onNavigationStart={handleNavigationStart}
                >
                  <SettingsIcon />
                  <span className="group-data-[collapsible=icon]:hidden">
                    Configurações
                  </span>
                </IntentLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className="rounded-sm data-[active=true]:border-sidebar-primary data-[active=true]:border-l-2 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                isActive={isActivePath("/perfil")}
                tooltip="Perfil"
              >
                <IntentLink
                  aria-current={isActivePath("/perfil") ? "page" : undefined}
                  aria-label="Abrir meu perfil"
                  href="/perfil"
                  onNavigationStart={handleNavigationStart}
                >
                  <Avatar className="size-7 shrink-0">
                    {avatarUrl ? <AvatarImage alt="" src={avatarUrl} /> : null}
                    <AvatarFallback className="bg-brand-action text-primary-foreground text-xs">
                      {displayName
                        .split(whitespacePattern)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")
                        .toUpperCase() || "M"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm group-data-[collapsible=icon]:hidden">
                    {displayName}
                  </span>
                </IntentLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset asChild>
        <div>{children}</div>
      </SidebarInset>
    </>
  );
};
