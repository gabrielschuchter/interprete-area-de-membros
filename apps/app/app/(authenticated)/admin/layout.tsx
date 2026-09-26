import type { ReactNode } from "react";
import { requireStaff } from "@/lib/authorization";
import { AdminNav } from "./admin-nav";

const AdminLayout = async ({ children }: { readonly children: ReactNode }) => {
  const { role } = await requireStaff();

  return (
    <div className="min-h-svh bg-background">
      <nav
        aria-label="Navegação administrativa"
        className="border-border border-b bg-muted/20"
      >
        <AdminNav isAdmin={role === "ADMIN"} />
      </nav>
      {children}
    </div>
  );
};

export default AdminLayout;
