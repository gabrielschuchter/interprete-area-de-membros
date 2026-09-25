import { database } from "@repo/database";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  MessageCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RichDocument } from "@/components/learning/rich-document";
import { getMemberRole } from "@/lib/authorization";
import { getPublicProfile } from "@/lib/profile";
import { MemberHeader } from "../../components/member-header";

interface PublicProfilePageProperties {
  readonly params: Promise<{ username: string }>;
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

const PublicProfilePage = async ({ params }: PublicProfilePageProperties) => {
  const { username } = await params;
  const profile = await getPublicProfile(username);

  if (!profile) {
    notFound();
  }

  const [role, topics] = await Promise.all([
    getMemberRole(profile.clerkUserId),
    database.communityPost.findMany({
      where: {
        authorId: profile.clerkUserId,
        status: "PUBLISHED",
        deletedAt: null,
        space: { status: "PUBLISHED" },
      },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take: 12,
      select: {
        id: true,
        title: true,
        content: true,
        contentJson: true,
        createdAt: true,
        space: { select: { title: true, slug: true } },
        _count: {
          select: {
            comments: { where: { deletedAt: null } },
            votes: true,
          },
        },
      },
    }),
  ]);

  const name = profile.displayName ?? profile.username;
  const location = [profile.city, profile.state, profile.country]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="min-h-svh bg-background">
      <MemberHeader section="Membros" />
      <main className="mx-auto w-full max-w-[1120px] px-5 py-8 sm:px-8 lg:px-12 lg:py-14">
        <Button asChild className="-ml-3" variant="ghost">
          <Link href="/membros">
            <ArrowLeftIcon aria-hidden="true" /> Voltar para os membros
          </Link>
        </Button>

        <section className="paper-surface mt-8 border p-6 sm:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <Avatar className="size-20 shrink-0">
              {profile.avatarUrl ? (
                <AvatarImage alt="" src={profile.avatarUrl} />
              ) : null}
              <AvatarFallback className="bg-brand-structural text-primary-foreground text-xl">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-4xl sm:text-5xl">{name}</h1>
                <Badge variant="outline">
                  {roleLabel(profile.member.role ?? role)}
                </Badge>
              </div>
              <p className="mt-2 text-muted-foreground">
                @{profile.username}
                {profile.headline ? ` · ${profile.headline}` : ""}
              </p>
              {profile.bio && (
                <p className="mt-6 max-w-2xl whitespace-pre-wrap text-base leading-7">
                  {profile.bio}
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-muted-foreground text-sm">
                {profile.occupation && <span>{profile.occupation}</span>}
                {profile.institution && <span>{profile.institution}</span>}
                {location && <span>{location}</span>}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {profile.interests.map((interest) => (
                  <Badge key={interest} variant="secondary">
                    {interest}
                  </Badge>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-4 text-sm">
                {[profile.website, profile.instagram, profile.linkedin].map(
                  (url) => {
                    const hostname = hostnameFor(url);

                    if (!(url && hostname)) {
                      return null;
                    }

                    return (
                      <a
                        className="inline-flex items-center gap-1.5 text-brand-structural underline underline-offset-4"
                        href={url}
                        key={url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <ExternalLinkIcon
                          aria-hidden="true"
                          className="size-3.5"
                        />{" "}
                        {hostname}
                      </a>
                    );
                  }
                )}
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="member-topics" className="mt-12">
          <div className="flex items-end justify-between border-border border-b pb-4">
            <div>
              <p className="brand-eyebrow">Contribuições</p>
              <h2 className="mt-2 font-display text-3xl" id="member-topics">
                Tópicos publicados
              </h2>
            </div>
            <span className="font-data text-muted-foreground text-xs">
              {topics.length}
            </span>
          </div>
          {topics.length === 0 ? (
            <p className="mt-6 text-muted-foreground">
              Ainda não há tópicos publicados.
            </p>
          ) : (
            <div className="mt-6 divide-y border-border border-y">
              {topics.map((topic) => (
                <article className="py-6" key={topic.id}>
                  <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
                    <span>{topic.space.title}</span>
                    <span>·</span>
                    <span>{topic._count.comments} respostas</span>
                    <span>·</span>
                    <span>{topic._count.votes} apoios</span>
                  </div>
                  <h3 className="mt-3 font-display text-2xl">
                    <Link
                      className="hover:text-brand-structural"
                      href={`/comunidade/${topic.space.slug}/${topic.id}`}
                    >
                      {topic.title}
                    </Link>
                  </h3>
                  <div className="mt-3 line-clamp-3 text-muted-foreground leading-7">
                    {topic.contentJson ? (
                      <RichDocument value={topic.contentJson} />
                    ) : (
                      topic.content
                    )}
                  </div>
                  <Link
                    className="mt-4 inline-flex items-center gap-2 text-brand-structural text-sm underline underline-offset-4"
                    href={`/comunidade/${topic.space.slug}/${topic.id}`}
                  >
                    Ler tópico{" "}
                    <MessageCircleIcon aria-hidden="true" className="size-4" />
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default PublicProfilePage;
