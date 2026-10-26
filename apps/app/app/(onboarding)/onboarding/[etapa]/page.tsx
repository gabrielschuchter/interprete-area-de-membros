import { getSafeInternalPath } from "@repo/auth/redirects";
import { notFound, redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { env } from "@/env";
import { auth } from "@/lib/auth";
import { getOnboardingState } from "@/lib/onboarding/state";
import { onboardingStepPath, stepIndex } from "@/lib/onboarding/steps";

export const dynamic = "force-dynamic";

const OnboardingStepPage = async ({
  params,
  searchParams,
}: {
  readonly params: Promise<{ etapa: string }>;
  readonly searchParams: Promise<{
    redirect_url?: string;
    redirectUrl?: string;
  }>;
}) => {
  const [{ etapa }, search, { userId }] = await Promise.all([
    params,
    searchParams,
    auth(),
  ]);
  const returnTo = getSafeInternalPath(
    search.redirect_url ?? search.redirectUrl ?? "/",
    "https://interprete.invalid"
  );
  const index = stepIndex(etapa);
  if (index < 0) {
    notFound();
  }
  if (!userId) {
    redirect("/sign-in");
  }

  const state = await getOnboardingState(userId);
  if (!state) {
    if (env.APP_WRITE_FREEZE === "true") {
      return (
        <main className="ob-freeze">
          <h1>Atualização temporária</h1>
          <p>
            Estamos concluindo uma atualização segura. Seu cadastro não foi
            alterado. Tente novamente em alguns minutos.
          </p>
        </main>
      );
    }
    redirect("/sign-in");
  }

  // Steps ahead of the furthest one reached are not open yet.
  if (index > state.reachedStep) {
    redirect(onboardingStepPath(state.reachedStep, returnTo));
  }

  return (
    <OnboardingFlow initialStep={index} returnTo={returnTo} state={state} />
  );
};

export default OnboardingStepPage;
