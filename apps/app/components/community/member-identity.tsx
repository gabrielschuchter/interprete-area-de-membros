import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import Link from "next/link";

const whitespacePattern = /\s+/;

interface MemberIdentityProperties {
  readonly authorId: string;
  readonly compact?: boolean;
  readonly profile?: {
    avatarUrl: string | null;
    displayName: string | null;
    headline: string | null;
    username: string;
    member?: { role: "MEMBER" | "TEACHER" | "ADMIN" };
  };
  readonly showHeadline?: boolean;
}

const initials = (displayName: string | null, username: string) =>
  (displayName ?? username)
    .split(whitespacePattern)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "M";

const roleLabel = (role?: "MEMBER" | "TEACHER" | "ADMIN") => {
  if (role === "TEACHER") {
    return "Professor";
  }
  if (role === "ADMIN") {
    return "Admin";
  }
  return null;
};

export const MemberIdentity = ({
  authorId,
  profile,
  showHeadline = true,
  compact = false,
}: MemberIdentityProperties) => {
  const username = profile?.username ?? authorId;
  const displayName = profile?.displayName ?? "Membro";
  const size = compact ? "size-8" : "size-10";
  const content = (
    <>
      <Avatar className={size}>
        {profile?.avatarUrl ? (
          <AvatarImage alt="" src={profile.avatarUrl} />
        ) : null}
        <AvatarFallback className="bg-brand-structural text-primary-foreground text-xs">
          {initials(profile?.displayName ?? null, username)}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span className="block truncate font-medium group-hover:text-brand-structural">
          {displayName}
        </span>
        {showHeadline && (
          <span className="block truncate text-muted-foreground text-xs">
            {profile?.headline ??
              roleLabel(profile?.member?.role) ??
              `@${username}`}
          </span>
        )}
      </span>
    </>
  );

  if (!profile) {
    return <div className="flex min-w-0 items-center gap-3">{content}</div>;
  }

  return (
    <Link
      className="group flex min-w-0 items-center gap-3"
      href={`/membros/${profile.username}`}
    >
      {content}
    </Link>
  );
};
