import { database } from "@repo/database";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { env } from "@/env";
import { auth } from "@/lib/auth";
import { getOrCreateProfile } from "@/lib/profile";

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
    return <div data-onboarding-shell="true">{children}</div>;
  }

  if (member?.onboardingStatus === "COMPLETED") {
    redirect("/");
  }

  return <div data-onboarding-shell="true">{children}</div>;
};

export default OnboardingLayout;
