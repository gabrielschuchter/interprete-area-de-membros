"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { usePathname } from "next/navigation";
import { IntentLink } from "../components/intent-link";

const groups = [
  {
    label: "Acompanhar",
    items: [
      ["Visão geral", "/admin"],
      ["Atribuições", "/admin/atribuicoes"],
      ["Metas e tarefas", "/admin/estudo"],
      ["Atividades", "/admin/activities"],
      ["Encontros", "/admin/meetings"],
      ["Gravações", "/admin/gravacoes"],
      ["Avisos", "/admin/avisos"],
    ],
  },
  {
    label: "Construir",
    items: [
      ["Conteúdo", "/admin/learning"],
      ["Biblioteca", "/admin/library"],
      ["Exercícios", "/admin/exercicios"],
      ["Medalhas", "/admin/badges"],
      ["Coleções", "/admin/colecoes"],
      ["Comunidade", "/admin/community"],
    ],
  },
  {
    label: "Pessoas",
    items: [["Membros", "/admin/membros"]],
  },
] as const;

const isActive = (pathname: string, href: string) =>
  href === "/admin"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

export const AdminNav = ({ isAdmin }: { readonly isAdmin: boolean }) => {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação administrativa"
      className="mx-auto flex w-full max-w-[1280px] flex-wrap items-end gap-x-5 gap-y-3 px-5 py-3 sm:px-8 lg:px-12"
    >
      <div className="hidden shrink-0 self-center pr-1 sm:block">
        <p className="brand-eyebrow">Painel do professor</p>
        <p className="mt-1 text-muted-foreground text-xs">Interprete</p>
      </div>
      {groups.map((group) => {
        const items = group.items;

        return (
          <div className="min-w-0" key={group.label}>
            <p className="brand-eyebrow mb-1 whitespace-nowrap px-2">
              {group.label}
            </p>
            <div className="flex flex-wrap gap-1">
              {items.map(([label, href]) => {
                const active = isActive(pathname, href);

                return (
                  <Button
                    asChild
                    key={href}
                    size="sm"
                    variant={active ? "secondary" : "ghost"}
                  >
                    <IntentLink
                      aria-current={active ? "page" : undefined}
                      href={href}
                    >
                      {label}
                    </IntentLink>
                  </Button>
                );
              })}
            </div>
          </div>
        );
      })}
      {isAdmin && (
        <div className="min-w-0">
          <p className="brand-eyebrow mb-1 whitespace-nowrap px-2">Admin</p>
          <div className="flex flex-wrap gap-1">
            {[
              ["Acessos", "/admin/acessos"],
              ["Personalização", "/admin/personalizacao"],
            ].map(([label, href]) => {
              const active = isActive(pathname, href);

              return (
                <Button
                  asChild
                  key={href}
                  size="sm"
                  variant={active ? "secondary" : "ghost"}
                >
                  <IntentLink
                    aria-current={active ? "page" : undefined}
                    href={href}
                  >
                    {label}
                  </IntentLink>
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
};
