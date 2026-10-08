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

  const completionCount = profileCompletionItems(profile).completedCount;

  return (
    <div>
      <header className="mb-2">
        <p className="brand-eyebrow">Seu espaço na comunidade</p>
        <h2 className="mt-1 font-display text-3xl md:text-4xl">
          Editar perfil
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground text-sm leading-6">
          Escolha o que quer compartilhar com as pessoas da comunidade.
        </p>
      </header>
      <ProfileEditor
        completionCount={completionCount}
        email={memberSnapshot.email ?? ""}
        profile={profile}
      />
    </div>
  );
};

export default ProfileEditPage;
