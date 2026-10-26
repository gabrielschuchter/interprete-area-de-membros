import type { NotificationPreferenceValues } from "@/lib/notification-preference-groups";
import type { OnboardingStepSlug } from "./steps";

// Everything the flow needs, read on the server from Perfil, Configurações and
// Clerk. Generic provisioning values ("Membro", membro-xxxxxx) arrive empty.
export interface OnboardingState {
  readonly about: {
    readonly occupation: string;
    readonly institution: string;
    readonly bio: string;
    readonly website: string;
    readonly instagram: string;
    readonly linkedin: string;
  };
  readonly accountPhotoAvailable: boolean;
  readonly avatarUrl: string;
  readonly categories: readonly string[];
  readonly hasCohort: boolean;
  readonly hasPriorProfile: boolean;
  readonly identity: {
    readonly displayName: string;
    readonly displayNameFromAccount: boolean;
    readonly username: string;
    readonly usernameFromAccount: boolean;
  };
  readonly interests: readonly string[];
  readonly memberId: string;
  readonly memberSince: string;
  readonly preferences: NotificationPreferenceValues;
  // Furthest step reached (index into onboardingSteps).
  readonly reachedStep: number;
  readonly status: "NOT_STARTED" | "IN_PROGRESS";
}

export type OnboardingFailureCode =
  | "UNAUTHENTICATED"
  | "INVALID"
  | "USERNAME_TAKEN"
  | "USERNAME_RESERVED"
  | "RATE_LIMITED"
  | "INCOMPLETE_REQUIRED"
  | "NOT_SKIPPABLE"
  | "NO_ACCOUNT_PHOTO"
  | "UNAVAILABLE";

export type OnboardingResult<T = undefined> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      readonly code: OnboardingFailureCode;
      readonly field?: string;
      readonly suggestions?: readonly string[];
    };

export interface UsernameCheck {
  readonly status: "free" | "taken" | "reserved" | "invalid" | "short";
  readonly suggestions: readonly string[];
}

export type OnboardingStepPayload =
  | { readonly step: "boas-vindas" }
  | {
      readonly step: "identidade";
      readonly displayName: string;
      readonly username: string;
    }
  | { readonly step: "foto"; readonly avatarUrl: string | null }
  | {
      readonly step: "sobre";
      readonly occupation: string;
      readonly institution: string;
      readonly bio: string;
      readonly website: string;
      readonly instagram: string;
      readonly linkedin: string;
    }
  | { readonly step: "interesses"; readonly interests: readonly string[] }
  | {
      readonly step: "avisos";
      readonly preferences: NotificationPreferenceValues;
    };

export interface SavedStep {
  readonly reachedStep: number;
}

export type OnboardingSlugWithPayload = Exclude<
  OnboardingStepSlug,
  "conclusao"
>;
