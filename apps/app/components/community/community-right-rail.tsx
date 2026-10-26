import {
  ChevronRightIcon,
  GlobeIcon,
  LockIcon,
  MegaphoneIcon,
  PlusIcon,
  UsersIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import {
  communityMediaImageUrl,
  normalizeCommunityCoverUrl,
} from "@/lib/community-media";
import { CommunityAnnouncementDismissButton } from "./community-announcement-dismiss-button";
import type { CommunityAvatarVisual } from "./community-avatars";
import { CommunityAvatars } from "./community-avatars";
import { CommunityCoverImage } from "./community-cover-image";
import { CommunityDisclosure } from "./community-disclosure";

interface CommunitySpaceSummary {
  readonly _count: { readonly posts: number };
  readonly coverUrl?: string | null;
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly visibility?: "PUBLIC" | "PRIVATE";
}

interface CommunityAnnouncementSummary {
  readonly body: string | null;
  readonly createdAt: Date;
  readonly groupKey: string | null;
  readonly href: string | null;
  readonly id: string;
  readonly title: string;
  readonly version: number;
}

interface CommunityRightRailProperties {
  readonly announcements: readonly CommunityAnnouncementSummary[];
  readonly avatars: readonly CommunityAvatarVisual[];
  readonly goalCard: ReactNode;
  readonly spaces: readonly CommunitySpaceSummary[];
}

const formatAnnouncementDate = (value: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Sao_Paulo",
  }).format(value);

const isInternalHref = (href: string) =>
  href.startsWith("/") && !href.startsWith("//");

const isExternalHref = (href: string) =>
  href.startsWith("https://") || href.startsWith("http://");

const AnnouncementContent = ({
  announcement,
}: {
  readonly announcement: CommunityAnnouncementSummary;
}) => (
  <>
    <span className="community-notice__label">
      <MegaphoneIcon aria-hidden="true" className="size-3.5" />
      Equipe ·{" "}
      <time dateTime={announcement.createdAt.toISOString()}>
        {formatAnnouncementDate(announcement.createdAt)}
      </time>
    </span>
    <span className="community-notice__title">{announcement.title}</span>
    {announcement.body ? (
      <span className="community-notice__body">{announcement.body}</span>
    ) : null}
  </>
);

const RailHead = ({
  children,
  id,
  link,
}: {
  readonly children: string;
  readonly id: string;
  readonly link?: { readonly href: string; readonly label: string };
}) => (
  <div className="community-rail__head">
    <h2 className="community-rail__title" id={id}>
      {children}
    </h2>
    {link ? (
      <IntentLink className="community-rail__head-link" href={link.href}>
        {link.label}
      </IntentLink>
    ) : null}
  </div>
);

const SpaceThumb = ({ coverUrl }: { readonly coverUrl?: string | null }) => {
  const safe = normalizeCommunityCoverUrl(coverUrl);
  return safe ? (
    <CommunityCoverImage
      alt=""
      className="community-rail__space-thumb"
      height={40}
      src={communityMediaImageUrl(safe, "thumb")}
      width={40}
    />
  ) : (
    <span aria-hidden="true" className="community-rail__space-thumb">
      <UsersIcon className="size-4" />
    </span>
  );
};

export const CommunityRightRail = ({
  announcements,
  avatars,
  goalCard,
  spaces,
}: CommunityRightRailProperties) => (
  <aside aria-label="Contexto da comunidade" className="community-right-rail">
    {goalCard}

    <section
      aria-labelledby="community-avatars-heading"
      className="community-rail__block community-rail__avatars"
    >
      <RailHead id="community-avatars-heading">Pessoas da comunidade</RailHead>
      <CommunityAvatars avatars={avatars} />
    </section>

    <section
      aria-labelledby="community-spaces-heading"
      className="community-rail__block community-rail__spaces"
    >
      <RailHead
        id="community-spaces-heading"
        link={{ href: "/comunidade/grupos", label: "Ver todos" }}
      >
        Grupos de estudo
      </RailHead>
      {spaces.length === 0 ? (
        <p className="community-rail__empty">Nenhum grupo publicado ainda.</p>
      ) : (
        <div className="community-rail__space-list">
          {spaces.slice(0, 5).map((space) => (
            <IntentLink
              className="community-rail__space group"
              href={`/comunidade/grupos/${space.slug}`}
              key={space.id}
            >
              <SpaceThumb coverUrl={space.coverUrl} />
              <span className="community-rail__space-copy">
                <span className="community-rail__space-name">
                  {space.title}
                </span>
                <span className="community-rail__space-privacy">
                  {space.visibility === "PRIVATE" ? (
                    <LockIcon aria-hidden="true" className="size-3" />
                  ) : (
                    <GlobeIcon aria-hidden="true" className="size-3" />
                  )}
                  {space.visibility === "PRIVATE" ? "Privado" : "Público"}
                </span>
              </span>
              <ChevronRightIcon
                aria-hidden="true"
                className="community-rail__space-arrow"
              />
            </IntentLink>
          ))}
        </div>
      )}
      <IntentLink
        className="community-rail__create"
        href="/comunidade/grupos/novo"
      >
        <PlusIcon aria-hidden="true" className="size-4" /> Criar grupo de estudo
      </IntentLink>
    </section>

    {announcements.length > 0 ? (
      <CommunityDisclosure
        className="community-rail__context--notices"
        label="Avisos"
      >
        <section
          aria-labelledby="community-notices-heading"
          className="community-rail__block community-rail__notices"
        >
          <RailHead id="community-notices-heading">Avisos</RailHead>
          <div className="community-rail__notice-list">
            {announcements.map((announcement) => {
              const content = (
                <AnnouncementContent announcement={announcement} />
              );
              const className = "community-notice group";
              const key = announcement.groupKey ?? announcement.id;
              let body = <div className={className}>{content}</div>;
              if (announcement.href && isInternalHref(announcement.href)) {
                body = (
                  <IntentLink className={className} href={announcement.href}>
                    {content}
                  </IntentLink>
                );
              } else if (
                announcement.href &&
                isExternalHref(announcement.href)
              ) {
                body = (
                  <a
                    className={className}
                    href={announcement.href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {content}
                  </a>
                );
              }
              return (
                <article className="community-notice-item" key={key}>
                  {body}
                  <CommunityAnnouncementDismissButton
                    announcementId={announcement.id}
                    version={announcement.version}
                  >
                    Dispensar aviso
                  </CommunityAnnouncementDismissButton>
                </article>
              );
            })}
          </div>
        </section>
      </CommunityDisclosure>
    ) : null}

    <CommunityDisclosure
      className="community-rail__context--about"
      defaultExpanded
      label="Sobre a comunidade"
    >
      <section
        aria-labelledby="community-about-heading"
        className="community-rail__block community-rail__about"
      >
        <RailHead id="community-about-heading">Sobre a comunidade</RailHead>
        <p className="community-rail__about-lead">
          Um espaço para trocar perguntas, casos e referências sobre
          interpretação de evidências.
        </p>
        <div className="community-rail__guides">
          <div>
            <h3>Regras</h3>
            <ul>
              <li>Respeite quem pensa diferente.</li>
              <li>Cite a fonte ao compartilhar uma evidência.</li>
              <li>Pergunte com contexto: conte o que você já tentou.</li>
            </ul>
          </div>
          <div>
            <h3>Como participar</h3>
            <ul>
              <li>Faça uma pergunta ou compartilhe um artigo.</li>
              <li>Responda com uma leitura, uma dúvida ou uma referência.</li>
              <li>Entre em um grupo de estudo.</li>
            </ul>
          </div>
        </div>
      </section>
    </CommunityDisclosure>
  </aside>
);
