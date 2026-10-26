import { database } from "@repo/database";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { LearningFonts } from "@/components/learning/learning-fonts";
import { HandwritingFont } from "@/components/onboarding/handwriting-font";
import { env } from "@/env";
import { auth } from "@/lib/auth";
import { getOrCreateProfile } from "@/lib/profile";
import "./onboarding/onboarding.css";

// The onboarding is its own room: no sidebar, top bar or app footer.
const Shell = ({ children }: { readonly children: ReactNode }) => (
  <LearningFonts>
    <HandwritingFont>
      <div data-onboarding-shell="true">{children}</div>
    </HandwritingFont>
  </LearningFonts>
);

const OnboardingLayout = async ({
  children,
}: {
  readonly children: ReactNode;
}) => {
  const { userId, memberDeactivated } = await auth();
  if (memberDeactivated) {
    redirect("/conta-desativada");
  }
  if (!userId) {
    redirect("/sign-in");
  }

  await getOrCreateProfile(userId);
  const member = await database.member.findUnique({
    where: { id: userId },
    select: { onboardingStatus: true },
  });

  if (!member && env.APP_WRITE_FREEZE === "true") {
    return <Shell>{children}</Shell>;
  }

  if (member?.onboardingStatus === "COMPLETED") {
    redirect("/");
  }

  return <Shell>{children}</Shell>;
};

export default OnboardingLayout;
