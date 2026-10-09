import { Button } from "@repo/design-system/components/ui/button";
import { ArrowRightIcon, PlusIcon, SearchIcon } from "lucide-react";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import { FilterForm } from "@/components/navigation/filter-form";
import type { CommunitySort } from "@/lib/community-query";
import { CommunityDisclosure } from "./community-disclosure";
import {
  CommunityPresence,
  type CommunityPresenceProfile,
} from "./community-presence";

interface CommunitySpaceSummary {
  readonly _count: { readonly posts: number };
  readonly id: string;
  readonly slug: string;
  readonly title: string;
}

interface CommunityAnnouncementSummary {
  readonly body: string | null;
  readonly createdAt: Date;
  readonly groupKey: string | null;
  readonly href: string | null;
  readonly id: string;
  readonly title: string;
}

interface CommunityRightRailProperties {
  readonly announcements: readonly CommunityAnnouncementSummary[];
  readonly memberId: string;
  readonly presenceProfiles?: readonly CommunityPresenceProfile[];
  readonly profile: CommunityPresenceProfile | null;
  readonly query?: string;
  readonly sort?: CommunitySort;
  readonly spaceSlug?: string;
  readonly spaces: readonly CommunitySpaceSummary[];
}

const formatAnnouncementDate = (value: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
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
    <h3 className="font-medium text-sm leading-5">{announcement.title}</h3>
    {announcement.body ? (
      <p className="mt-1 line-clamp-3 text-muted-foreground text-xs leading-5">
        {announcement.body}
      </p>
    ) : null}
    <time
      className="mt-2 block font-data text-[0.68rem] text-muted-foreground"
      dateTime={announcement.createdAt.toISOString()}
    >
      {formatAnnouncementDate(announcement.createdAt)}
    </time>
  </>
);

export const CommunityRightRail = ({
  announcements,
  memberId,
  profile,
  presenceProfiles,
  query,
  sort = "recent",
  spaceSlug,
  spaces,
}: CommunityRightRailProperties) => (
  <aside aria-label="Contexto da comunidade" className="community-right-rail">
    <section
      aria-label="Buscar na comunidade"
      className="community-rail__search"
    >
      <FilterForm action="/comunidade" className="community-search">
        <label className="community-search__field">
          <span className="sr-only">Buscar na comunidade</span>
          <SearchIcon aria-hidden="true" className="community-search__icon" />
          <input
            aria-label="Buscar na comunidade"
            defaultValue={query ?? ""}
            name="q"
            placeholder="Buscar na comunidade"
          />
        </label>
        <input name="sort" type="hidden" value={sort} />
        {spaceSlug ? (
          <input name="space" type="hidden" value={spaceSlug} />
        ) : null}
        <Button
          aria-label="Buscar"
          className="community-search__submit"
          size="icon"
          type="submit"
          variant="ghost"
        >
          <SearchIcon aria-hidden="true" />
        </Button>
      </FilterForm>
    </section>

    <CommunityDisclosure
      className="community-rail__context--about"
      label="Sobre a comunidade"
    >
      <section
        aria-labelledby="community-about-heading"
        className="community-rail__block community-rail__about"
      >
        <h2 className="brand-eyebrow" id="community-about-heading">
          Sobre a comunidade
        </h2>
        <p className="mt-3 max-w-[30ch] text-muted-foreground text-sm leading-6">
          Um espaço para trocar perguntas, casos e referências sobre
          interpretação.
        </p>
      </section>
    </CommunityDisclosure>

    <section
      aria-labelledby="community-presence-heading"
      className="community-rail__block community-rail__presence"
    >
      <h2 className="brand-eyebrow" id="community-presence-heading">
        Ativo agora
      </h2>
      <CommunityPresence
        fallbackProfiles={presenceProfiles}
        memberId={memberId}
        profile={profile}
      />
    </section>

    <section
      aria-labelledby="community-spaces-heading"
      className="community-rail__block community-rail__spaces"
    >
      <h2 className="brand-eyebrow" id="community-spaces-heading">
        Grupos de estudo
      </h2>
      {spaces.length === 0 ? (
        <p className="mt-3 text-muted-foreground text-sm leading-6">
          Nenhum grupo publicado ainda.
        </p>
      ) : (
        <div className="mt-2 divide-y border-border border-y">
          {spaces.map((space) => (
            <IntentLink
              className="community-rail__space group"
              href={`/comunidade/${space.slug}`}
              key={space.id}
            >
              <span className="min-w-0 truncate font-medium text-sm group-hover:text-brand-structural">
                {space.title}
              </span>
              <span className="flex shrink-0 items-center gap-2 text-muted-foreground text-xs">
                <span
                  className="font-data"
                  title={[String(space._count.posts), "conteúdos"].join(" ")}
                >
                  {space._count.posts}
                </span>
                <ArrowRightIcon
                  aria-hidden="true"
                  className="size-3.5 transition-transform group-hover:translate-x-1"
                />
              </span>
            </IntentLink>
          ))}
        </div>
      )}
      <Button asChild className="mt-4 w-full" size="sm" variant="outline">
        <IntentLink href="/comunidade/grupos/novo">
          <PlusIcon aria-hidden="true" /> Criar grupo de estudo
        </IntentLink>
      </Button>
    </section>

    <CommunityDisclosure
      className="community-rail__context--notices"
      label="Avisos"
    >
      <section
        aria-labelledby="community-notices-heading"
        className="community-rail__block community-rail__notices"
      >
        <h2 className="brand-eyebrow" id="community-notices-heading">
          Avisos
        </h2>
        {announcements.length === 0 ? (
          <p className="mt-3 text-muted-foreground text-sm leading-6">
            Nenhum aviso recente.
          </p>
        ) : (
          <div className="mt-2 divide-y border-border border-y">
            {announcements.map((announcement) => {
              const content = (
                <AnnouncementContent announcement={announcement} />
              );
              const className = "community-rail__announcement group";

              if (announcement.href && isInternalHref(announcement.href)) {
                return (
                  <IntentLink
                    className={className}
                    href={announcement.href}
                    key={announcement.groupKey ?? announcement.id}
                  >
                    {content}
                  </IntentLink>
                );
              }

              if (announcement.href && isExternalHref(announcement.href)) {
                return (
                  <a
                    className={className}
                    href={announcement.href}
                    key={announcement.groupKey ?? announcement.id}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {content}
                  </a>
                );
              }

              return (
                <article
                  className={className}
                  key={announcement.groupKey ?? announcement.id}
                >
                  {content}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </CommunityDisclosure>
  </aside>
);
