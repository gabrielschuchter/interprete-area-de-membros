import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { getOrCreateProfile } from "@/lib/profile";
import { profileCompletionItems } from "@/lib/profile-completion";
import { ProfileEditor } from "./profile-editor";

const ProfileEditPage = async () => {
  const { userId, memberSnapshot } = await getAuth();
  if (!(userId && memberSnapshot)) {
    redirect("/sign-in");
  }

  const profile = await getOrCreateProfile(userId);
  if (!profile) {
    redirect("/sign-in");
  }

  const completion = profileCompletionItems(profile);

  return (
    <ProfileEditor
      email={memberSnapshot.email ?? ""}
      missingLabels={completion.items
        .filter(({ complete }) => !complete)
        .map(({ label }) => label)}
      profile={profile}
    />
  );
};

export default ProfileEditPage;
