"use client";

import { UserButton } from "@repo/auth/client";
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
  BookOpenIcon,
  CalendarDaysIcon,
  CheckSquareIcon,
  HouseIcon,
  LibraryIcon,
  MessageCircleIcon,
  UserRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandWordmark } from "@/components/brand/brand-mark";

interface GlobalSidebarProperties {
  readonly canManageContent: boolean;
  readonly children: ReactNode;
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
  { href: "/perfil", label: "Perfil", icon: UserRoundIcon },
] as const;

export const GlobalSidebar = ({
  canManageContent,
  children,
}: GlobalSidebarProperties) => {
  const sidebar = useSidebar();
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
                <Link href="/">
                  <BrandWordmark
                    className="w-[7.25rem] group-data-[collapsible=icon]:hidden"
                    tone="branco"
                  />
                  <span className="hidden font-display text-2xl text-sidebar-foreground group-data-[collapsible=icon]:inline">
                    I.
                  </span>
                </Link>
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
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
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
                    <Link href="/admin/learning">
                      <BookOpenIcon />
                      <span>Professor</span>
                    </Link>
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
                <Link href="/comunidade/meus-topicos">
                  <MessageCircleIcon />
                  <span>Meus tópicos</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <UserButton
                appearance={{
                  elements: {
                    rootBox: "flex min-w-0 flex-1 overflow-hidden",
                    userButtonBox:
                      "flex-row-reverse rounded-sm px-2 py-2 hover:bg-sidebar-accent",
                    userButtonOuterIdentifier:
                      "truncate pl-0 text-sidebar-foreground",
                  },
                }}
                showName={sidebar.open}
              />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>{children}</SidebarInset>
    </>
  );
};
