import { auth, currentUser } from "@repo/auth/server";
import { SidebarProvider } from "@repo/design-system/components/ui/sidebar";
import { secure } from "@repo/security";
import type { ReactNode } from "react";
import { env } from "@/env";
import { getMemberRole } from "@/lib/authorization";
import { GlobalSidebar } from "./components/sidebar";

interface AppLayoutProperties {
  readonly children: ReactNode;
}

const AppLayout = async ({ children }: AppLayoutProperties) => {
  if (env.ARCJET_KEY) {
    await secure(["CATEGORY:PREVIEW"]);
  }

  const user = await currentUser();
  const { redirectToSignIn } = await auth();

  if (!user) {
    return redirectToSignIn();
  }

  const role = await getMemberRole(user.id);

  return (
    <SidebarProvider>
      <GlobalSidebar canManageContent={role === "TEACHER" || role === "ADMIN"}>
        {children}
      </GlobalSidebar>
    </SidebarProvider>
  );
};

export default AppLayout;
