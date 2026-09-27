export const ONBOARDING_LAST_INPUT_STEP = 5;
export const ONBOARDING_FINISH_STEP = 6;

export type OnboardingPreferenceKey =
  | "mentions"
  | "commentReplies"
  | "topicComments"
  | "followedTopicActivity"
  | "lessonAvailable"
  | "moduleAvailable"
  | "activityAssigned"
  | "feedbackReceived"
  | "activityDeadline"
  | "announcements";

export type OnboardingPreferences = Record<OnboardingPreferenceKey, boolean>;

export interface OnboardingDraft {
  readonly avatarUrl: string;
  readonly bio: string;
  readonly city: string;
  readonly country: string;
  readonly displayName: string;
  readonly headline: string;
  readonly instagram: string;
  readonly institution: string;
  readonly interests: string;
  readonly linkedin: string;
  readonly occupation: string;
  readonly preferences: OnboardingPreferences;
  readonly state: string;
  readonly username: string;
  readonly website: string;
}

export const defaultOnboardingPreferences: OnboardingPreferences = {
  activityAssigned: true,
  activityDeadline: true,
  announcements: true,
  commentReplies: true,
  feedbackReceived: true,
  followedTopicActivity: true,
  lessonAvailable: true,
  mentions: true,
  moduleAvailable: true,
  topicComments: true,
};

export interface OnboardingInitialData {
  readonly displayName: string;
  readonly email: string;
  readonly memberId: string;
  readonly preferences: OnboardingPreferences;
  readonly profile: Omit<OnboardingDraft, "preferences">;
  readonly step: number;
}
