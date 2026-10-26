import { getSafeInternalPath } from "@repo/auth/redirects";
import { database } from "@repo/database";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { clampStepIndex, onboardingStepPath } from "@/lib/onboarding/steps";

// /onboarding always lands on the step where the person stopped.
const OnboardingIndexPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<{
    redirect_url?: string;
    redirectUrl?: string;
  }>;
}) => {
  const search = await searchParams;
  const returnTo = getSafeInternalPath(
    search.redirect_url ?? search.redirectUrl ?? "/",
    "https://interprete.invalid"
  );
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }
  const member = await database.member.findUnique({
    where: { id: userId },
    select: { onboardingStatus: true, onboardingStep: true },
  });
  redirect(
    onboardingStepPath(
      member?.onboardingStatus === "IN_PROGRESS"
        ? clampStepIndex(member.onboardingStep)
        : 0,
      returnTo
    )
  );
};

export default OnboardingIndexPage;
