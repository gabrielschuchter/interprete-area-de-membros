import type { ReactNode } from "react";
import { requireStaff } from "@/lib/authorization";
import { MemberHeader } from "../components/member-header";

const AdminLayout = async ({ children }: { readonly children: ReactNode }) => {
  await requireStaff();

  return (
    <div className="min-h-svh bg-background">
      <MemberHeader section="Professor" />
      {children}
    </div>
  );
};

export default AdminLayout;
