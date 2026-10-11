import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { PencilLineIcon } from "lucide-react";
import { getOrCreateProfile } from "@/lib/profile";
import { CommunityDraftStarter } from "./community-draft-starter";

const whitespacePattern = /\s+/;

export const CommunityComposerPrompt = async ({
  memberId,
}: {
  readonly memberId: string;
}) => {
  const profile = await getOrCreateProfile(memberId);
  const composerInitials = (profile?.displayName ?? "Você")
    .split(whitespacePattern)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <section
      aria-labelledby="community-composer-heading"
      className="community-composer"
    >
      <h2 className="sr-only" id="community-composer-heading">
        Criar uma publicação
      </h2>
      <CommunityDraftStarter
        className="community-composer__prompt group"
        variant="ghost"
      >
        <Avatar className="size-8 shrink-0">
          {profile?.avatarUrl ? (
            <AvatarImage alt="" src={profile.avatarUrl} />
          ) : null}
          <AvatarFallback className="bg-brand-structural text-primary-foreground text-xs">
            {composerInitials || "V"}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1 truncate text-muted-foreground text-sm group-hover:text-foreground">
          Escreva uma publicação…
        </span>
        <PencilLineIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
      </CommunityDraftStarter>
    </section>
  );
};
