import { Separator } from "@repo/design-system/components/ui/separator";
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
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@repo/design-system/components/ui/sidebar";
import type { Meta, StoryObj } from "@storybook/react";
import {
  Bookmark,
  BookOpen,
  CalendarDays,
  CheckSquare,
  House,
  Library,
  MessageCircle,
  UserRound,
  Video,
} from "lucide-react";

const meta: Meta<typeof Sidebar> = {
  title: "ui/Sidebar",
  component: Sidebar,
  tags: ["autodocs"],
};
export default meta;

type Story = StoryObj<typeof Sidebar>;

const navigation = [
  { label: "Início", icon: House },
  { label: "Aprender", icon: BookOpen },
  { label: "Atividades", icon: CheckSquare },
  { label: "Comunidade", icon: MessageCircle },
  { label: "Biblioteca", icon: Library },
  { label: "Encontros", icon: CalendarDays },
  { label: "Perfil", icon: UserRound },
];

export const MemberArea: Story = {
  render: () => (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" tooltip="Interprete">
                <BookOpen className="size-4" />
                <span className="font-semibold">Interprete</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarGroup
            aria-label="Conteúdo pessoal"
            className="px-2 pt-0 pb-3"
            role="group"
          >
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Minhas gravações">
                  <Video />
                  <span>Minhas gravações</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Salvos">
                  <Bookmark />
                  <span>Salvos</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Área de membros</SidebarGroupLabel>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton tooltip={item.label}>
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Conta">
                <UserRound />
                <span>Conta</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset asChild>
        <div>
          <header className="flex h-16 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator className="mr-2 h-4" orientation="vertical" />
            <h1 className="font-medium text-sm">Início</h1>
          </header>
          <main className="p-6">
            <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground text-sm">
              Nenhum conteúdo disponível ainda.
            </div>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  ),
};
