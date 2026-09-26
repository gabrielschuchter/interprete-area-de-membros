"use client";

import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  ["Visão geral", "/admin"],
  ["Conteúdo", "/admin/learning"],
  ["Atividades", "/admin/activities"],
  ["Comunidade", "/admin/community"],
  ["Encontros", "/admin/meetings"],
  ["Biblioteca", "/admin/library"],
  ["Membros", "/admin/membros"],
  ["Acessos", "/admin/acessos"],
] as const;

const isActive = (pathname: string, href: string) =>
  href === "/admin"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

export const AdminNav = () => {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex w-full max-w-[1280px] gap-1 overflow-x-auto px-5 py-2 sm:px-8 lg:px-12">
      {items.map(([label, href]) => {
        const active = isActive(pathname, href);

        return (
          <Button
            asChild
            key={href}
            size="sm"
            variant={active ? "secondary" : "ghost"}
          >
            <Link aria-current={active ? "page" : undefined} href={href}>
              {label}
            </Link>
          </Button>
        );
      })}
    </div>
  );
};
