import { database } from "@repo/database";
import { redirect } from "next/navigation";
import { OnboardingExperience } from "@/components/onboarding/onboarding-experience";
import {
  defaultOnboardingPreferences,
  type OnboardingInitialData,
} from "@/components/onboarding/types";
import { getCurrentUser } from "@/lib/auth";
import { getOrCreateNotificationPreferences } from "@/lib/notifications";
import { getOrCreateProfile } from "@/lib/profile";

const OnboardingPage = async () => {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const profile = await getOrCreateProfile(user.id);
  if (!profile) {
    redirect("/sign-in");
  }

  const [member, preferences] = await Promise.all([
    database.member.findUnique({
      where: { id: user.id },
      select: { onboardingStep: true },
    }),
    getOrCreateNotificationPreferences(user.id),
  ]);

  const initial: OnboardingInitialData = {
    memberId: user.id,
    step: Math.max(0, Math.min(member?.onboardingStep ?? 0, 6)),
    displayName:
      profile.displayName ?? user.fullName ?? user.firstName ?? "Membro",
    email: user.primaryEmailAddress?.emailAddress ?? "",
    profile: {
      displayName:
        profile.displayName ?? user.fullName ?? user.firstName ?? "Membro",
      username: profile.username,
      avatarUrl: profile.avatarUrl ?? user.imageUrl ?? "",
      headline: profile.headline ?? "",
      bio: profile.bio ?? "",
      occupation: profile.occupation ?? "",
      institution: profile.institution ?? "",
      city: profile.city ?? "",
      state: profile.state ?? "",
      country: profile.country ?? "",
      interests: profile.interests.join(", "),
      website: profile.website ?? "",
      instagram: profile.instagram ?? "",
      linkedin: profile.linkedin ?? "",
    },
    preferences: {
      ...defaultOnboardingPreferences,
      mentions: preferences.mentions,
      commentReplies: preferences.commentReplies,
      topicComments: preferences.topicComments,
      followedTopicActivity: preferences.followedTopicActivity,
      lessonAvailable: preferences.lessonAvailable,
      moduleAvailable: preferences.moduleAvailable,
      activityAssigned: preferences.activityAssigned,
      feedbackReceived: preferences.feedbackReceived,
      activityDeadline: preferences.activityDeadline,
      announcements: preferences.announcements,
      groupInvitations: preferences.groupInvitations,
      groupPosts: preferences.groupPosts,
      contentAssignments: preferences.contentAssignments,
    },
  };

  return <OnboardingExperience initial={initial} />;
};

export default OnboardingPage;
