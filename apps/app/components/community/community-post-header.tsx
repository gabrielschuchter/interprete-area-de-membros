import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import type { CommunityCoverFraming } from "@/lib/community-cover";
import { communityMediaImageSrcSet } from "@/lib/community-media";
import { CommunityCoverImage } from "./community-cover-image";

const whitespacePattern = /\s+/;

interface CommunityPostAuthor {
  readonly avatarUrl: string | null;
  readonly displayName: string | null;
  readonly username: string;
}

interface CommunityPostHeaderProperties {
  readonly author?: CommunityPostAuthor | null;
  readonly authorId: string;
  readonly backHref: string;
  readonly backLabel: string;
  readonly coverAlt: string;
  readonly coverFraming?: CommunityCoverFraming;
  readonly coverUrl?: string | null;
  readonly date: Date;
  readonly edited?: boolean;
  /** Menu da publicação (editar, fixar...), no canto da faixa. */
  readonly menu?: ReactNode;
  readonly returnTo?: string;
  readonly subtitle?: string | null;
  readonly title: string;
}

const initials = (displayName: string | null, username: string) =>
  (displayName ?? username)
    .split(whitespacePattern)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "M";

const BackLink = ({
  href,
  label,
}: {
  readonly href: string;
  readonly label: string;
}) => (
  <Link className="cp-back" href={href}>
    <ArrowLeftIcon aria-hidden="true" />
    <span>{label}</span>
  </Link>
);

const AuthorLine = ({
  author,
  authorId,
  date,
  edited,
  returnTo,
}: Pick<
  CommunityPostHeaderProperties,
  "author" | "authorId" | "date" | "edited" | "returnTo"
>) => {
  const username = author?.username ?? authorId;
  const name = author?.displayName ?? "Membro";
  const identity = (
    <>
      <Avatar className="cp-author__avatar">
        {author?.avatarUrl ? (
          <AvatarImage alt="" src={author.avatarUrl} />
        ) : null}
        <AvatarFallback>
          {initials(author?.displayName ?? null, username)}
        </AvatarFallback>
      </Avatar>
      <span className="cp-author__name">{name}</span>
    </>
  );
  return (
    <div className="cp-author">
      {author ? (
        <IntentLink
          className="cp-author__identity"
          href={`/membros/${encodeURIComponent(author.username)}${
            returnTo ? `?${new URLSearchParams({ returnTo }).toString()}` : ""
          }`}
        >
          {identity}
        </IntentLink>
      ) : (
        <span className="cp-author__identity">{identity}</span>
      )}
      <span className="cp-author__date">
        <time dateTime={date.toISOString()}>
          {date.toLocaleDateString("pt-BR")}
        </time>
        {edited ? " · Editado" : ""}
      </span>
    </div>
  );
};

/**
 * Faixa vinho da publicação: voltar, título, subtítulo e autoria. A capa 16:9
 * cruza a divisa entre a faixa e o fundo claro. Sem capa, a faixa fecha com o
 * respiro do quadro. As medidas ficam em `community-post.css`.
 */
export const CommunityPostHeader = ({
  author,
  authorId,
  backHref,
  backLabel,
  coverAlt,
  coverFraming,
  coverUrl,
  date,
  edited,
  menu,
  returnTo,
  subtitle,
  title,
}: CommunityPostHeaderProperties) => (
  <>
    <header className="cp-hero" data-cover={coverUrl ? "true" : "false"}>
      <div className="cp-hero__inner">
        <div className="cp-hero__top">
          <BackLink href={backHref} label={backLabel} />
          {menu ? <div className="cp-hero__menu">{menu}</div> : null}
        </div>
        <h1 className="cp-title">{title}</h1>
        {subtitle ? <p className="cp-subtitle">{subtitle}</p> : null}
        <AuthorLine
          author={author}
          authorId={authorId}
          date={date}
          edited={edited}
          returnTo={returnTo}
        />
      </div>
    </header>
    {coverUrl ? (
      <div className="cp-cover">
        <CommunityCoverImage
          alt={coverAlt}
          className="cp-cover__image"
          framing={coverFraming}
          height={495}
          loading="eager"
          sizes="(max-width: 767px) calc(100vw - 40px), 880px"
          src={coverUrl}
          srcSet={communityMediaImageSrcSet(coverUrl)}
          width={880}
        />
      </div>
    ) : null}
  </>
);

/** Publicação removida ou sem acesso: só a faixa, no mesmo cabeçalho. */
export const CommunityPostUnavailable = ({
  action,
  backHref = "/comunidade",
  backLabel = "Comunidade",
  message = "Ela foi removida ou você não tem acesso a ela.",
  title = "Publicação indisponível",
}: {
  readonly action?: ReactNode;
  readonly backHref?: string;
  readonly backLabel?: string;
  readonly message?: string;
  readonly title?: string;
}) => (
  <div className="cp-page">
    <main>
      <header className="cp-hero" data-cover="false" data-state="unavailable">
        <div className="cp-hero__inner">
          <div className="cp-hero__top">
            <BackLink href={backHref} label={backLabel} />
          </div>
          <h1 className="cp-title">{title}</h1>
          <p className="cp-subtitle">{message}</p>
          {action ? <div className="cp-hero__action">{action}</div> : null}
        </div>
      </header>
    </main>
  </div>
);
