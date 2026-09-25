import { SidebarProvider } from "@repo/design-system/components/ui/sidebar";
import { secure } from "@repo/security";
import type { ReactNode } from "react";
import { env } from "@/env";
import { getAuth } from "@/lib/auth";
import { getMemberRole } from "@/lib/authorization";
import { getOrCreateProfile } from "@/lib/profile";
import { MemberHeader } from "./components/member-header";
import { GlobalSidebar } from "./components/sidebar";

interface AppLayoutProperties {
  readonly children: ReactNode;
}

const AppLayout = async ({ children }: AppLayoutProperties) => {
  const startedAt = performance.now();
  const secureStartedAt = performance.now();
  if (env.ARCJET_KEY) {
    await secure(["CATEGORY:PREVIEW"]);
  }
  const secureElapsed = performance.now() - secureStartedAt;

  const authStartedAt = performance.now();
  const { userId, redirectToSignIn } = await getAuth();
  const authElapsed = performance.now() - authStartedAt;

  if (!userId) {
    return redirectToSignIn();
  }

  const memberDataStartedAt = performance.now();
  const [role] = await Promise.all([
    getMemberRole(userId),
    getOrCreateProfile(userId, false),
  ]);
  console.info(
    `[PERF_LAYOUT] secure=${secureElapsed.toFixed(1)}ms auth=${authElapsed.toFixed(1)}ms member=${(performance.now() - memberDataStartedAt).toFixed(1)}ms total=${(performance.now() - startedAt).toFixed(1)}ms`,
  );

  return (
    <SidebarProvider>
      <GlobalSidebar canManageContent={role === "TEACHER" || role === "ADMIN"}>
        <MemberHeader />
        {children}
      </GlobalSidebar>
    </SidebarProvider>
  );
};

export default AppLayout;
