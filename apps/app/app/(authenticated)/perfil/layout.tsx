import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getAuth } from "@/lib/auth";
import { getOrCreateProfile, getProfileSummaryStats } from "@/lib/profile";
import { ProfileShell } from "./profile-shell";

const ProfileLayout = async ({
  children,
}: {
  readonly children: ReactNode;
}) => {
  const { userId, memberSnapshot } = await getAuth();
  if (!(userId && memberSnapshot)) {
    redirect("/sign-in");
  }

  const [profile, stats] = await Promise.all([
    getOrCreateProfile(userId),
    getProfileSummaryStats(userId),
  ]);

  if (!profile) {
    redirect("/sign-in");
  }

  return (
    <ProfileShell
      avatarUrl={profile.avatarUrl ?? memberSnapshot.avatarUrl}
      completedLessons={stats.completedLessons}
      displayName={
        profile.displayName ?? memberSnapshot.displayName ?? "Estudante"
      }
      enrollments={stats.enrollments}
      headline={profile.headline}
      interests={profile.interests}
      role={memberSnapshot.role}
      topicCount={stats.topicCount}
      username={profile.username}
    >
      {children}
    </ProfileShell>
  );
};

export default ProfileLayout;
