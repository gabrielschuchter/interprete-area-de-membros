import "server-only";

import {
  CohortMemberStatus,
  database,
  EnrollmentStatus,
  libraryCatalogCategories,
} from "@repo/database";
import { getCurrentUser } from "@/lib/auth";
import {
  type NotificationPreferenceValues,
  notificationPreferenceKeys,
} from "@/lib/notification-preference-groups";
import { getOrCreateNotificationPreferences } from "@/lib/notifications";
import { getOrCreateProfile } from "@/lib/profile";
import { isGenericDisplayName, isGenericUsername } from "./identity";
import { clampStepIndex } from "./steps";
import type { OnboardingState } from "./types";

const memberSinceFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "America/Sao_Paulo",
  year: "numeric",
});

// "11 OUT 2026" (D15: the date the member was created).
export const formatMemberSince = (date: Date) => {
  const parts = memberSinceFormat.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("day")} ${part("month").replace(".", "")} ${part("year")}`.toUpperCase();
};

// Memberships and grants are read only to choose a sentence on the last
// step. Finishing the onboarding never depends on them.
const hasCohortOrContent = async (memberId: string) => {
  const now = new Date();
  const [memberships, enrollments, grants] = await Promise.all([
    database.cohortMembership.count({
      where: { memberId, status: CohortMemberStatus.ACTIVE, leftAt: null },
    }),
    database.enrollment.count({
      where: { memberId, status: EnrollmentStatus.ACTIVE },
    }),
    database.accessGrant.count({
      where: {
        memberId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    }),
  ]);
  return memberships + enrollments + grants > 0;
};

const pickPreferences = (
  source: Record<string, unknown>
): NotificationPreferenceValues =>
  Object.fromEntries(
    notificationPreferenceKeys.map((key) => [key, source[key] !== false])
  ) as NotificationPreferenceValues;

export const getOnboardingState = async (
  memberId: string
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this unit deliberately keeps one step workflow (validation, saving state, offline and session handling) together.
): Promise<OnboardingState | null> => {
  const profile = await getOrCreateProfile(memberId);
  if (!profile) {
    return null;
  }

  const [member, preferences, user, hasCohort] = await Promise.all([
    database.member.findUnique({
      where: { id: memberId },
      select: { createdAt: true, onboardingStatus: true, onboardingStep: true },
    }),
    getOrCreateNotificationPreferences(memberId),
    getCurrentUser().catch(() => null),
    hasCohortOrContent(memberId),
  ]);
  if (!member) {
    return null;
  }

  const accountName =
    user?.fullName ??
    ([user?.firstName, user?.lastName].filter(Boolean).join(" ") || "");
  const fallbackName = isGenericDisplayName(accountName)
    ? ""
    : accountName.trim();
  const displayName = isGenericDisplayName(profile.displayName)
    ? fallbackName
    : (profile.displayName ?? "").trim();
  const username = isGenericUsername(profile.username) ? "" : profile.username;
  const categories = new Set<string>(libraryCatalogCategories);

  return {
    memberId,
    status:
      member.onboardingStatus === "IN_PROGRESS" ? "IN_PROGRESS" : "NOT_STARTED",
    reachedStep:
      member.onboardingStatus === "IN_PROGRESS"
        ? clampStepIndex(member.onboardingStep)
        : 0,
    memberSince: formatMemberSince(member.createdAt),
    hasPriorProfile: Boolean(
      profile.bio ||
        profile.occupation ||
        profile.institution ||
        profile.website ||
        profile.instagram ||
        profile.linkedin ||
        profile.interests.length > 0
    ),
    hasCohort,
    accountPhotoAvailable: Boolean(user?.hasImage && user.imageUrl),
    categories: [...libraryCatalogCategories],
    identity: {
      displayName,
      displayNameFromAccount: displayName.length > 0,
      username,
      usernameFromAccount: username.length > 0,
    },
    // Provisioning copies Clerk's image even when it is Clerk's generic
    // placeholder; that one is not a photo the person chose.
    avatarUrl:
      profile.avatarUrl &&
      !(user && !user.hasImage && profile.avatarUrl === user.imageUrl)
        ? profile.avatarUrl
        : "",
    about: {
      occupation: profile.occupation ?? "",
      institution: profile.institution ?? "",
      bio: profile.bio ?? "",
      website: profile.website ?? "",
      instagram: profile.instagram ?? "",
      linkedin: profile.linkedin ?? "",
    },
    // Only the Library's categories are offered as chips; any other interest
    // already in the Perfil is kept untouched when the step is saved.
    interests: profile.interests.filter((interest) => categories.has(interest)),
    preferences: pickPreferences(preferences),
  };
};
