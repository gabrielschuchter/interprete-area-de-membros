import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireStaff } from "@/lib/authorization";
import { MemberHeader } from "../components/member-header";

const AdminLayout = async ({ children }: { readonly children: ReactNode }) => {
  await requireStaff();

  return (
    <div className="min-h-svh bg-background">
      <MemberHeader section="Professor" />
      <nav
        aria-label="Navegação administrativa"
        className="border-border border-b bg-muted/20"
      >
        <div className="mx-auto flex w-full max-w-[1280px] gap-1 overflow-x-auto px-5 py-2 sm:px-8 lg:px-12">
          {[
            ["Visão geral", "/admin"],
            ["Conteúdo", "/admin/learning"],
            ["Atividades", "/admin/activities"],
            ["Comunidade", "/admin/community"],
            ["Encontros", "/admin/meetings"],
            ["Biblioteca", "/admin/library"],
            ["Membros", "/admin/membros"],
          ].map(([label, href]) => (
            <Button asChild key={href} size="sm" variant="ghost">
              <Link href={href}>{label}</Link>
            </Button>
          ))}
        </div>
      </nav>
      {children}
    </div>
  );
};

export default AdminLayout;
