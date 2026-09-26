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
  VideoIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandWordmark } from "@/components/brand/brand-mark";
import { IntentLink } from "./intent-link";

const whitespacePattern = /\s+/;

interface GlobalSidebarProperties {
  readonly avatarUrl: string | null;
  readonly canManageContent: boolean;
  readonly children: ReactNode;
  readonly displayName: string;
}

const navigation = [
  { href: "/", label: "Início", icon: HouseIcon },
  { href: "/aprender", label: "Aprender", icon: BookOpenIcon },
  { href: "/atividades", label: "Atividades", icon: CheckSquareIcon },
  {
    href: "/comunidade",
    label: "Comunidade",
    icon: MessageCircleIcon,
  },
  { href: "/biblioteca", label: "Biblioteca", icon: LibraryIcon },
  { href: "/encontros", label: "Encontros", icon: CalendarDaysIcon },
] as const;

export const GlobalSidebar = ({
  avatarUrl,
  canManageContent,
  children,
  displayName,
}: GlobalSidebarProperties) => {
  const pathname = usePathname();

  return (
    <>
      <Sidebar collapsible="icon" variant="sidebar">
        <SidebarHeader className="border-sidebar-border border-b px-4 py-5 group-data-[collapsible=icon]:px-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className="h-11 rounded-sm px-2 hover:bg-sidebar-accent"
                size="lg"
                tooltip="Interprete."
              >
                <IntentLink href="/">
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
                isActive={pathname.startsWith("/aprender/minhas-gravacoes")}
                tooltip="Minhas gravações"
              >
                <IntentLink href="/aprender/minhas-gravacoes">
                  <VideoIcon />
                  <span className="group-data-[collapsible=icon]:hidden">
                    Minhas gravações
                  </span>
                </IntentLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className="rounded-sm"
                isActive={pathname === "/comunidade/salvos"}
                tooltip="Salvos"
              >
                <IntentLink href="/comunidade/salvos">
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
                    isActive={
                      item.href === "/"
                        ? pathname === "/"
                        : pathname === item.href ||
                          pathname.startsWith(`${item.href}/`)
                    }
                    tooltip={item.label}
                  >
                    <IntentLink href={item.href}>
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
                    isActive={pathname.startsWith("/admin")}
                    tooltip="Professor"
                  >
                    <IntentLink href="/admin">
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
                isActive={pathname === "/comunidade/meus-topicos"}
                tooltip="Meus tópicos"
              >
                <IntentLink href="/comunidade/meus-topicos">
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
                isActive={
                  pathname === "/configuracoes" ||
                  pathname.startsWith("/configuracoes/")
                }
                tooltip="Configurações"
              >
                <IntentLink href="/configuracoes">
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
                isActive={
                  pathname === "/perfil" || pathname.startsWith("/perfil/")
                }
                tooltip="Perfil"
              >
                <IntentLink aria-label="Abrir meu perfil" href="/perfil">
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
