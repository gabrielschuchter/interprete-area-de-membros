"use client";

import { useClerk } from "@repo/auth/client";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { Separator } from "@repo/design-system/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@repo/design-system/components/ui/sidebar";
import { toast } from "@repo/design-system/lib/toast";
import {
  BookOpenIcon,
  HouseIcon,
  LogOutIcon,
  MessageCircleIcon,
  SettingsIcon,
  UserRoundIcon,
  VideoIcon,
} from "lucide-react";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { BrandWordmark } from "@/components/brand/brand-mark";
import { withGestaoReturnPath } from "@/lib/gestao-navigation";
import { IntentLink } from "./intent-link";
import { isSidebarPathActive } from "./member-section";
import { MemberSidebarControl } from "./member-sidebar-control";

interface MemberAreaSidebarProperties {
  readonly avatarUrl: string | null;
  readonly canManageContent: boolean;
  readonly children: ReactNode;
  readonly chromeVisible: boolean;
  readonly displayName: string;
  readonly email: string;
  readonly gestaoV2Enabled?: boolean;
  readonly localQaAuth?: boolean;
  readonly portalMode: boolean;
}

const mainNavigation = [
  { href: "/", icon: HouseIcon, label: "Início" },
  { href: "/estudar", icon: BookOpenIcon, label: "Estudar" },
  { href: "/comunidade", icon: MessageCircleIcon, label: "Comunidade" },
] as const;

const whitespacePattern = /\s+/;
const ManagementSidebarEntry = ({
  activePath,
  enabled,
  onNavigationStart,
}: {
  readonly activePath: string;
  readonly enabled: boolean;
  readonly onNavigationStart: (href: string) => void;
}) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const serializedSearch = searchParams.toString();
  const returnPath = [pathname, serializedSearch].filter(Boolean).join("?");
  const href = enabled ? withGestaoReturnPath("/gestao", returnPath) : "/admin";
  const label = enabled ? "Gestão" : "Professor";
  const targetPath = enabled ? "/gestao" : "/admin";
  const active = isMemberSidebarPathActive(activePath, targetPath, [
    "/gestao",
    "/admin",
  ]);

  return (
    <SidebarMenu className="mt-5 border-sidebar-border border-t pt-4">
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          className="rounded-sm py-2.5 data-[active=true]:border-sidebar-primary data-[active=true]:border-l-2 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
          isActive={active}
          tooltip={label}
        >
          <IntentLink
            aria-current={active ? "page" : undefined}
            aria-label={label}
            href={href}
            onNavigationStart={onNavigationStart}
          >
            <BookOpenIcon aria-hidden="true" />
            <span className="group-data-[collapsible=icon]:hidden">
              {label}
            </span>
          </IntentLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};

const isMemberSidebarPathActive = (
  activePath: string,
  href: string,
  navigationHrefs: readonly string[]
) => {
  if (href === "/gestao") {
    return activePath === href || activePath.startsWith(`${href}/`);
  }
  if (href === "/estudar") {
    const studyAreas = [
      "/estudar",
      "/aprender",
      "/exercicios",
      "/atividades",
      "/biblioteca",
      "/planejamento",
      "/ferramentas",
      "/tarefas",
    ];
    return studyAreas.some(
      (area) => activePath === area || activePath.startsWith(`${area}/`)
    );
  }
  if (
    href === "/comunidade" &&
    activePath.startsWith("/encontros") &&
    !activePath.startsWith("/encontros/gravacoes")
  ) {
    return true;
  }
  return isSidebarPathActive(activePath, href, navigationHrefs);
};

const initialsFor = (value: string) =>
  value
    .trim()
    .split(whitespacePattern)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "M";

const MemberAreaSidebarView = ({
  avatarUrl,
  canManageContent,
  children,
  chromeVisible,
  displayName,
  email,
  gestaoV2Enabled = false,
  portalMode,
  signOut,
}: MemberAreaSidebarProperties & {
  readonly signOut?: ReturnType<typeof useClerk>["signOut"];
}) => {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [tabletDrawer, setTabletDrawer] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const previousSidebarOpen = useRef<boolean | null>(null);
  const previousPathname = useRef(pathname);
  const {
    isMobile,
    open: sidebarOpen,
    setOpen: setSidebarOpen,
    setOpenMobile,
  } = useSidebar();
  const activePath = pendingHref ?? pathname;
  const navigationHrefs = [
    ...mainNavigation.map((item) => item.href),
    "/gestao",
    "/admin",
    "/perfil",
    "/configuracoes",
    "/comunidade/meus-topicos",
    "/encontros/gravacoes",
  ];
  const isActivePath = (href: string) =>
    isMemberSidebarPathActive(activePath, href, navigationHrefs);

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

  useLayoutEffect(() => {
    const tabletViewport = window.matchMedia(
      "(min-width: 48rem) and (max-width: 78.0625rem)"
    );
    const syncSidebar = () => {
      const isTablet = tabletViewport.matches;
      const needsDrawer = isTablet || portalMode;
      setTabletDrawer(isTablet);

      if (needsDrawer) {
        // Collapse only when entering drawer mode. Opening the menu changes
        // sidebarOpen too and must not immediately close the user's menu.
        if (previousSidebarOpen.current !== null) {
          return;
        }
        previousSidebarOpen.current = sidebarOpen;
        setSidebarOpen(false);
        if (portalMode) {
          setOpenMobile(false);
        }
        return;
      }

      const previousOpen = previousSidebarOpen.current;
      previousSidebarOpen.current = null;
      if (previousOpen !== null && sidebarOpen !== previousOpen) {
        setSidebarOpen(previousOpen);
      }
    };

    syncSidebar();
    tabletViewport.addEventListener("change", syncSidebar);
    return () => tabletViewport.removeEventListener("change", syncSidebar);
  }, [portalMode, setOpenMobile, setSidebarOpen, sidebarOpen]);

  const handleSignOut = async () => {
    if (!signOut) {
      toast.info(
        "A sessão local de QA é controlada pelo servidor de desenvolvimento."
      );
      return;
    }
    setIsSigningOut(true);
    try {
      await signOut({ redirectUrl: "/sign-in" });
    } catch {
      toast.error("Não foi possível encerrar a sessão. Tente novamente.");
      setIsSigningOut(false);
    }
  };

  const collapsible =
    portalMode || tabletDrawer || isMobile ? "offcanvas" : "icon";
  const sidebarIsOffCanvas = collapsible === "offcanvas";

  return (
    <>
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:border focus:bg-background focus:px-4 focus:py-3 focus:text-foreground focus:shadow-lg focus-visible:ring-2 focus-visible:ring-brand-action focus-visible:ring-offset-2"
        href="#member-main-content"
      >
        Pular para o conteúdo principal
      </a>
      <Sidebar
        aria-hidden={
          sidebarIsOffCanvas && !sidebarOpen && !isMobile ? true : undefined
        }
        className={
          sidebarIsOffCanvas
            ? "member-area-sidebar"
            : "member-area-sidebar sticky top-0 h-svh shrink-0"
        }
        collapsible={collapsible}
        data-chrome-visible={chromeVisible}
        data-portal-mode={String(portalMode)}
        variant="sidebar"
      >
        <SidebarHeader className="border-sidebar-border border-b px-4 py-5 group-data-[collapsible=icon]:px-2">
          <div className="flex min-w-0 items-center gap-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-0">
            <SidebarMenu className="min-w-0 flex-1 group-data-[collapsible=icon]:flex-none">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className="h-11 rounded-sm px-2 hover:bg-sidebar-accent"
                  size="lg"
                  tooltip="Interprete."
                >
                  <IntentLink
                    href="/"
                    onNavigationStart={handleNavigationStart}
                  >
                    <BrandWordmark
                      className="w-[7.25rem] group-data-[collapsible=icon]:hidden"
                      tone="branco"
                    />
                    <Image
                      alt=""
                      aria-hidden="true"
                      className="hidden h-7 w-4 group-data-[collapsible=icon]:block"
                      height={896}
                      src="/brand/meta/interprete-mark.svg"
                      width={520}
                    />
                    <span className="sr-only">Interprete.</span>
                  </IntentLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            <MemberSidebarControl
              className="size-11 shrink-0 rounded-sm p-0"
              mode={sidebarIsOffCanvas ? "drawer" : "sidebar"}
            />
          </div>
          <SidebarGroup
            aria-label="Minhas gravações"
            className="px-2 pt-1 pb-0 group-data-[collapsible=icon]:px-0"
            role="group"
          >
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className="rounded-sm py-2.5 data-[active=true]:border-sidebar-primary data-[active=true]:border-l-2 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                  isActive={isActivePath("/encontros/gravacoes")}
                  tooltip="Minhas gravações"
                >
                  <IntentLink
                    aria-current={
                      isActivePath("/encontros/gravacoes") ? "page" : undefined
                    }
                    aria-label="Minhas gravações"
                    href="/encontros/gravacoes"
                    onNavigationStart={handleNavigationStart}
                  >
                    <VideoIcon aria-hidden="true" />
                    <span className="group-data-[collapsible=icon]:hidden">
                      Minhas gravações
                    </span>
                  </IntentLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarHeader>
        <Separator className="mx-4 w-auto bg-sidebar-border" />
        <SidebarContent>
          <SidebarGroup className="pt-3">
            <SidebarMenu>
              {mainNavigation.map((item) => (
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
                      aria-label={item.label}
                      href={item.href}
                      onNavigationStart={handleNavigationStart}
                    >
                      <item.icon aria-hidden="true" />
                      <span className="group-data-[collapsible=icon]:hidden">
                        {item.label}
                      </span>
                    </IntentLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
            {canManageContent ? (
              <ManagementSidebarEntry
                activePath={activePath}
                enabled={gestaoV2Enabled}
                onNavigationStart={handleNavigationStart}
              />
            ) : null}
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-sidebar-border border-t p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                aria-label={`Abrir menu da conta de ${displayName}`}
                className="h-12 rounded-sm px-2"
                isActive={
                  isActivePath("/perfil") ||
                  pathname.startsWith("/comunidade/meus-topicos")
                }
                tooltip={displayName}
              >
                <Avatar className="size-8 shrink-0">
                  {avatarUrl ? <AvatarImage alt="" src={avatarUrl} /> : null}
                  <AvatarFallback className="bg-brand-action text-primary-foreground text-xs">
                    {initialsFor(displayName)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-left text-sm group-data-[collapsible=icon]:hidden">
                  {displayName}
                </span>
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64" side="top">
              <DropdownMenuLabel className="font-normal">
                <span className="block truncate font-medium">
                  {displayName}
                </span>
                {email ? (
                  <span className="block truncate text-muted-foreground text-xs">
                    {email}
                  </span>
                ) : null}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <IntentLink
                  aria-current={isActivePath("/perfil") ? "page" : undefined}
                  href="/perfil"
                  onNavigationStart={handleNavigationStart}
                >
                  <UserRoundIcon aria-hidden="true" />
                  Meu perfil
                </IntentLink>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <IntentLink
                  aria-current={
                    isActivePath("/configuracoes") ? "page" : undefined
                  }
                  href="/configuracoes"
                  onNavigationStart={handleNavigationStart}
                >
                  <SettingsIcon aria-hidden="true" />
                  Configurações
                </IntentLink>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={isSigningOut}
                onSelect={handleSignOut}
              >
                <LogOutIcon aria-hidden="true" />
                {isSigningOut ? "Saindo..." : "Sair da conta"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>
      {portalMode && sidebarOpen && !isMobile ? (
        <button
          aria-label="Fechar menu"
          className="member-portal-menu-scrim"
          onClick={() => setSidebarOpen(false)}
          type="button"
        />
      ) : null}
      <SidebarInset asChild>
        <div className="flex min-h-svh min-w-0 flex-1 flex-col">{children}</div>
      </SidebarInset>
    </>
  );
};

const ClerkMemberAreaSidebar = (properties: MemberAreaSidebarProperties) => {
  const { signOut } = useClerk();
  return <MemberAreaSidebarView {...properties} signOut={signOut} />;
};

export const MemberAreaSidebar = (properties: MemberAreaSidebarProperties) =>
  properties.localQaAuth ? (
    <MemberAreaSidebarView {...properties} />
  ) : (
    <ClerkMemberAreaSidebar {...properties} />
  );
