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
} from "@repo/design-system/components/ui/sidebar";
import {
  BookmarkIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  CheckSquareIcon,
  HouseIcon,
  LibraryIcon,
  MessageCircleIcon,
  SettingsIcon,
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
  { href: "/atividades", label: "Atividades", icon: CheckSquareIcon },
  {
    href: "/comunidade",
    label: "Comunidade",
    icon: MessageCircleIcon,
  },
  { href: "/biblioteca", label: "Biblioteca", icon: LibraryIcon },
  { href: "/encontros", label: "Encontros", icon: CalendarDaysIcon },
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
  const previousPathname = useRef(pathname);
  const navigation = productConfig.showLearnNavigation
    ? [baseNavigation[0], learnNavigation, ...baseNavigation.slice(1)]
    : baseNavigation;
  const activePath = pendingHref ?? pathname;
  const isActivePath = useCallback(
    (href: string) =>
      href === "/"
        ? activePath === "/"
        : activePath === href || activePath.startsWith(`${href}/`),
    [activePath]
  );
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

  return (
    <>
      <Sidebar collapsible="icon" variant="sidebar">
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
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className="rounded-sm"
                isActive={isActivePath("/comunidade/salvos")}
                tooltip="Salvos"
              >
                <IntentLink
                  href="/comunidade/salvos"
                  onNavigationStart={handleNavigationStart}
                >
                  <BookmarkIcon />
                  <span className="group-data-[collapsible=icon]:hidden">
                    Salvos
                  </span>
                </IntentLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
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
      <SidebarInset>{children}</SidebarInset>
    </>
  );
};
