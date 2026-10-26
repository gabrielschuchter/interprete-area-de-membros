// The seven steps of the onboarding ("Direção A, Matrícula"). Member keeps the
// furthest step reached in `onboardingStep` as an index into this list, so the
// order here is a persisted contract: append, never reorder.
export const onboardingSteps = [
  { slug: "boas-vindas", name: "Boas-vindas", skippable: false },
  { slug: "identidade", name: "Identidade", skippable: false },
  { slug: "foto", name: "Seu rosto", skippable: true },
  { slug: "sobre", name: "Sobre você", skippable: true },
  { slug: "interesses", name: "Interesses", skippable: true },
  { slug: "avisos", name: "Avisos", skippable: true },
  { slug: "conclusao", name: "Conclusão", skippable: false },
] as const;

export type OnboardingStepSlug = (typeof onboardingSteps)[number]["slug"];

// Flow version written on completion. Version 1 was the previous seven-screen
// onboarding; members who completed it are not asked to repeat (D11).
export const ONBOARDING_FLOW_VERSION = 2;

export const LAST_STEP_INDEX = onboardingSteps.length - 1;

export const stepIndex = (slug: string) =>
  onboardingSteps.findIndex((step) => step.slug === slug);

export const isOnboardingStepSlug = (
  slug: string
): slug is OnboardingStepSlug => stepIndex(slug) >= 0;

export const clampStepIndex = (value: number) =>
  Math.max(0, Math.min(Number.isInteger(value) ? value : 0, LAST_STEP_INDEX));

// `returnTo` is the already-sanitized internal path the person was heading to
// before onboarding; it rides in the query so every step keeps it.
export const onboardingStepPath = (index: number, returnTo?: string) => {
  const path = `/onboarding/${onboardingSteps[clampStepIndex(index)].slug}`;
  return returnTo && returnTo !== "/"
    ? `${path}?redirect_url=${encodeURIComponent(returnTo)}`
    : path;
};
