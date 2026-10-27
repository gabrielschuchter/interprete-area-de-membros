import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";

const MAX_AVATARS = 40;

export interface CommunityAvatarVisual {
  readonly avatarUrl: string | null;
  readonly displayName: string;
  readonly initials: string;
  readonly username: string;
}

/**
 * Opt-in faces of the community, each one opening that member's public
 * profile. The row never wraps: the container is exactly one avatar tall and
 * clips whatever does not fit, so only the people that fit are shown.
 */
export const CommunityAvatars = ({
  avatars,
}: {
  readonly avatars: readonly CommunityAvatarVisual[];
}) => (
  <ul className="community-avatars" data-testid="community-avatars">
    {avatars.slice(0, MAX_AVATARS).map((avatar) => (
      <li className="community-avatars__item" key={avatar.username}>
        <IntentLink
          aria-label={`Abrir perfil de ${avatar.displayName}`}
          className="community-avatars__link"
          href={`/membros/${encodeURIComponent(avatar.username)}?returnTo=${encodeURIComponent("/comunidade")}`}
          title={avatar.displayName}
        >
          <Avatar className="community-avatars__image">
            {avatar.avatarUrl ? (
              <AvatarImage alt="" loading="lazy" src={avatar.avatarUrl} />
            ) : null}
            <AvatarFallback className="community-avatars__fallback">
              {avatar.initials}
            </AvatarFallback>
          </Avatar>
        </IntentLink>
      </li>
    ))}
  </ul>
);
