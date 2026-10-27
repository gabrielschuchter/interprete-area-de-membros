import { database } from "@repo/database";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { ChevronRightIcon, ExternalLinkIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommunityCoverImage } from "@/components/community/community-cover-image";
import { CommunityFeedCard } from "@/components/community/community-feed-card";
import { CommunityNavigation } from "@/components/community/community-navigation";
import { ProfileBackLink } from "@/components/community/profile-back-link";
import { PublicProfileBadges } from "@/components/profile/profile-badges";
import { getMemberRole } from "@/lib/authorization";
import {
  getCommonCommunitySpaces,
  getMemberCommunityPublications,
} from "@/lib/community";
import {
  communityMediaImageUrl,
  normalizeCommunityCoverUrl,
} from "@/lib/community-media";
import { safeCommunityReturnPath } from "@/lib/community-return-path";
import { requireMemberId } from "@/lib/learning";
import { getPublicProfile } from "@/lib/profile";
import { splitProfileBadges } from "@/lib/profile-badge-catalog";
import "./public-profile.css";

interface PublicProfilePageProperties {
  readonly params: Promise<{ username: string }>;
  readonly searchParams: Promise<{ returnTo?: string | string[] }>;
}

const whitespacePattern = /\s+/;

const roleLabel = (role: string) => {
  if (role === "TEACHER") {
    return "Professor";
  }
  if (role === "ADMIN") {
    return "Admin";
  }
  return "Membro";
};

const initials = (value: string) =>
  value
    .split(whitespacePattern)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "M";

const hostnameFor = (value: string | null) => {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
};

const memberSince = (date: Date) =>
  date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });

type PublicProfile = NonNullable<Awaited<ReturnType<typeof getPublicProfile>>>;

const ProfileAbout = ({ profile }: { readonly profile: PublicProfile }) => {
  const location = [profile.city, profile.state, profile.country]
    .filter(Boolean)
    .join(", ");
  const links = [profile.website, profile.instagram, profile.linkedin].flatMap(
    (url) => {
      const hostname = hostnameFor(url);
      return url && hostname ? [{ hostname, url }] : [];
    }
  );
  const hasAbout = Boolean(
    profile.bio ||
      profile.headline ||
      profile.occupation ||
      profile.institution ||
      location ||
      profile.interests.length > 0 ||
      links.length > 0
  );

  if (!hasAbout) {
    return null;
  }

  return (
    <section className="public-profile__panel">
      <h2 className="public-profile__eyebrow">Sobre</h2>
      {profile.headline ? (
        <p className="public-profile__headline">{profile.headline}</p>
      ) : null}
      {profile.bio ? (
        <p className="public-profile__bio">{profile.bio}</p>
      ) : null}
      {profile.occupation || profile.institution || location ? (
        <p className="public-profile__facts">
          {[profile.occupation, profile.institution, location]
            .filter(Boolean)
            .map((fact) => (
              <span key={fact}>{fact}</span>
            ))}
        </p>
      ) : null}
      {profile.interests.length > 0 ? (
        <ul className="public-profile__tags">
          {profile.interests.map((interest) => (
            <li key={interest}>{interest}</li>
          ))}
        </ul>
      ) : null}
      {links.length > 0 ? (
        <p className="public-profile__links">
          {links.map(({ hostname, url }) => (
            <a href={url} key={url} rel="noreferrer" target="_blank">
              <ExternalLinkIcon aria-hidden="true" />
              {hostname}
            </a>
          ))}
        </p>
      ) : null}
    </section>
  );
};

const CommonGroups = ({
  spaces,
}: {
  readonly spaces: Awaited<ReturnType<typeof getCommonCommunitySpaces>>;
}) => {
  if (spaces.length === 0) {
    return null;
  }

  return (
    <section className="public-profile__panel">
      <h2 className="public-profile__eyebrow">Grupos em comum</h2>
      <ul className="public-profile__groups">
        {spaces.map((space) => {
          const cover = normalizeCommunityCoverUrl(space.coverUrl);

          return (
            <li key={space.id}>
              <Link href={`/comunidade/grupos/${space.slug}`}>
                {cover ? (
                  <CommunityCoverImage
                    alt=""
                    className="public-profile__group-thumb"
                    height={80}
                    src={communityMediaImageUrl(cover, "thumb")}
                    width={80}
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="public-profile__group-thumb"
                  />
                )}
                <strong>{space.title}</strong>
                <ChevronRightIcon aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

const PublicProfilePage = async ({
  params,
  searchParams,
}: PublicProfilePageProperties) => {
  const { username } = await params;
  const resolvedSearchParams = await searchParams;
  const returnTo = safeCommunityReturnPath(resolvedSearchParams.returnTo);
  const profile = await getPublicProfile(username);

  if (!profile) {
    notFound();
  }

  const viewerId = await requireMemberId();
  const isOwner = viewerId === profile.clerkUserId;
  const [role, earnedBadges, topics, commonSpaces] = await Promise.all([
    getMemberRole(profile.clerkUserId),
    database.badgeAward.findMany({
      where: {
        memberId: profile.clerkUserId,
        badge: { is: { status: { in: ["PUBLISHED", "ARCHIVED"] } } },
      },
      orderBy: { awardedAt: "desc" },
      take: 100,
      select: {
        id: true,
        badgeId: true,
        awardedAt: true,
        definitionRevision: {
          select: { title: true, description: true, criterion: true },
        },
      },
    }),
    getMemberCommunityPublications(viewerId, profile.clerkUserId),
    isOwner
      ? Promise.resolve([])
      : getCommonCommunitySpaces(viewerId, profile.clerkUserId),
  ]);
  const badgeCollections = splitProfileBadges(earnedBadges, []);

  const name = profile.displayName ?? profile.username;
  const firstName = name.split(whitespacePattern)[0] ?? name;
  return (
    <div className="community-page public-profile-page min-h-svh bg-background">
      <main className="community-shell mx-auto w-full">
        <CommunityNavigation active="explore" />
        <div className="public-profile">
          <ProfileBackLink
            currentPathname={`/membros/${username}`}
            fallbackHref={returnTo ?? "/comunidade"}
            fallbackLabel={
              returnTo ? "Voltar para a discussão" : "Voltar para a comunidade"
            }
          />

          <section
            aria-label={`Perfil público de ${name}`}
            className="public-profile__card"
          >
            <div aria-hidden="true" className="public-profile__banner" />
            <Avatar className="public-profile__avatar">
              {profile.avatarUrl ? (
                <AvatarImage alt="" src={profile.avatarUrl} />
              ) : null}
              <AvatarFallback className="bg-brand-structural text-2xl text-primary-foreground">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <div className="public-profile__identity">
              <div className="min-w-0">
                <h1 className="public-profile__name">{name}</h1>
                <p className="public-profile__meta">
                  <span className="community-chip">
                    {roleLabel(profile.member.role ?? role)}
                  </span>
                  <span>@{profile.username}</span>
                  <span aria-hidden="true" className="public-profile__sep">
                    ·
                  </span>
                  <span>
                    Na comunidade desde {memberSince(profile.createdAt)}
                  </span>
                </p>
              </div>
              {isOwner ? (
                <Link className="public-profile__action" href="/perfil/editar">
                  <PencilIcon aria-hidden="true" />
                  Editar perfil
                </Link>
              ) : null}
            </div>
          </section>

          {isOwner ? (
            <p className="public-profile__owner-note">
              É assim que os outros membros veem você. Seu perfil pessoal, com
              estudo, metas e configurações, continua só seu em{" "}
              <Link href="/perfil">Perfil</Link>.
            </p>
          ) : null}

          <ProfileAbout profile={profile} />

          <CommonGroups spaces={commonSpaces} />

          <PublicProfileBadges earnedBadges={badgeCollections.earned} />

          <section
            aria-labelledby="member-publications"
            className="public-profile__publications"
          >
            <h2 id="member-publications">Publicações</h2>
            <p>O que {firstName} publicou na Comunidade.</p>
            {topics.length === 0 ? (
              <p className="public-profile__empty">
                Ainda não há publicações visíveis para você.
              </p>
            ) : (
              <div className="public-profile__posts">
                {topics.map((post) => (
                  <CommunityFeedCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default PublicProfilePage;
