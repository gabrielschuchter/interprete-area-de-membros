import { SidebarProvider } from "@repo/design-system/components/ui/sidebar";
import { secure } from "@repo/security";
import type { ReactNode } from "react";
import { env } from "@/env";
import { getAuth, getCurrentUser } from "@/lib/auth";
import { getMemberRole } from "@/lib/authorization";
import { getOrCreateProfile } from "@/lib/profile";
import { MemberHeader } from "./components/member-header";
import { RouteMotion } from "./components/route-motion";
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

  const [role, profile, user] = await Promise.all([
    getMemberRole(userId),
    getOrCreateProfile(userId),
    getCurrentUser(),
  ]);

  return (
    <SidebarProvider>
      <GlobalSidebar
        avatarUrl={profile?.avatarUrl ?? user?.imageUrl ?? null}
        canManageContent={role === "TEACHER" || role === "ADMIN"}
        displayName={profile?.displayName ?? user?.firstName ?? "Membro"}
      >
        <MemberHeader memberId={userId} />
        <RouteMotion>{children}</RouteMotion>
      </GlobalSidebar>
    </SidebarProvider>
  );
};

export default AppLayout;
