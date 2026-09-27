import { database } from "@repo/database";
import { SidebarProvider } from "@repo/design-system/components/ui/sidebar";
import { secure } from "@repo/security";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { env } from "@/env";
import { getAuth, getCurrentUser } from "@/lib/auth";
import { getMemberRole } from "@/lib/authorization";
import { getMemberProductConfig } from "@/lib/product-config";
import { getOrCreateProfile } from "@/lib/profile";
import { MemberHeader } from "./components/member-header";
import { NavigationFeedback } from "./components/navigation-feedback";
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

  const profile = await getOrCreateProfile(userId);
  const member = await database.member.findUnique({
    where: { id: userId },
    select: { onboardingStatus: true },
  });

  if (member?.onboardingStatus !== "COMPLETED") {
    redirect("/onboarding");
  }

  const [role, user, productConfig] = await Promise.all([
    getMemberRole(userId),
    getCurrentUser(),
    getMemberProductConfig(userId),
  ]);

  return (
    <SidebarProvider>
      <GlobalSidebar
        avatarUrl={profile?.avatarUrl ?? user?.imageUrl ?? null}
        canManageContent={role === "TEACHER" || role === "ADMIN"}
        displayName={profile?.displayName ?? user?.firstName ?? "Membro"}
        productConfig={productConfig}
      >
        <MemberHeader memberId={userId} />
        <NavigationFeedback />
        <RouteMotion>{children}</RouteMotion>
      </GlobalSidebar>
    </SidebarProvider>
  );
};

export default AppLayout;
