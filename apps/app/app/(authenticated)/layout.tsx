import { SidebarProvider } from "@repo/design-system/components/ui/sidebar";
import { secure } from "@repo/security";
import type { ReactNode } from "react";
import { env } from "@/env";
import { getAuth } from "@/lib/auth";
import { getMemberRole } from "@/lib/authorization";
import { getOrCreateProfile } from "@/lib/profile";
import { GlobalSidebar } from "./components/sidebar";

interface AppLayoutProperties {
  readonly children: ReactNode;
}

const AppLayout = async ({ children }: AppLayoutProperties) => {
  if (env.ARCJET_KEY) {
    await secure(["CATEGORY:PREVIEW"]);
  }

  const { userId, redirectToSignIn } = await getAuth();

  if (!userId) {
    return redirectToSignIn();
  }

  const [role] = await Promise.all([
    getMemberRole(userId),
    getOrCreateProfile(userId, false),
  ]);

  return (
    <SidebarProvider>
      <GlobalSidebar canManageContent={role === "TEACHER" || role === "ADMIN"}>
        {children}
      </GlobalSidebar>
    </SidebarProvider>
  );
};

export default AppLayout;
