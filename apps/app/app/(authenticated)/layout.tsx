import { database } from "@repo/database";
import { SidebarProvider } from "@repo/design-system/components/ui/sidebar";
import { tracePerformance } from "@repo/observability/performance";
import { secure } from "@repo/security";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { env } from "@/env";
import { getAuth } from "@/lib/auth";
import { getMemberProductConfig } from "@/lib/product-config";
import { getOrCreateProfile } from "@/lib/profile";
import { MemberHeader } from "./components/member-header";
import { NavigationFeedback } from "./components/navigation-feedback";
import { RouteMotion } from "./components/route-motion";
import { GlobalSidebar } from "./components/sidebar";

export const dynamic = "force-dynamic";

interface AppLayoutProperties {
  readonly children: ReactNode;
}

const AppLayout = async ({ children }: AppLayoutProperties) => {
  if (env.ARCJET_KEY) {
    await tracePerformance("member.security.arcjet", () =>
      secure(["CATEGORY:PREVIEW"])
    );
  }

  const { userId, memberDeactivated, memberSnapshot, redirectToSignIn } =
    await getAuth();

  if (memberDeactivated) {
    redirect("/conta-desativada");
  }

  if (!userId) {
    return redirectToSignIn();
  }

  let member = memberSnapshot;
  let profile: Awaited<ReturnType<typeof getOrCreateProfile>>;
  let productConfig: Awaited<ReturnType<typeof getMemberProductConfig>>;

  if (memberSnapshot?.onboardingStatus === "COMPLETED") {
    // The profile projection and navigation config are independent for an
    // established member. Resolve them together instead of adding a database
    // round trip to every authenticated route transition.
    [profile, productConfig] = await Promise.all([
      getOrCreateProfile(userId),
      getMemberProductConfig(userId),
    ]);
  } else {
    // First access may provision a missing member/profile; onboarding status
    // must be re-read after that flow before exposing the member area.
    profile = await getOrCreateProfile(userId);
    member ??= await database.member.findUnique({
      where: { id: userId },
      select: {
        deactivatedAt: true,
        onboardingStatus: true,
        role: true,
        displayName: true,
        email: true,
        avatarUrl: true,
      },
    });

    if (member?.deactivatedAt) {
      redirect("/conta-desativada");
    }

    if (member?.onboardingStatus !== "COMPLETED") {
      redirect("/onboarding");
    }

    productConfig = await getMemberProductConfig(userId);
  }

  if (!member) {
    redirect("/onboarding");
  }

  return (
    <SidebarProvider>
      <GlobalSidebar
        avatarUrl={profile?.avatarUrl ?? member?.avatarUrl ?? null}
        canManageContent={member.role === "TEACHER" || member.role === "ADMIN"}
        displayName={profile?.displayName ?? member.displayName ?? "Membro"}
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
