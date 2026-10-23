import { getSafeInternalPath, getSignInPath } from "@repo/auth/redirects";
import { Button } from "@repo/design-system/components/ui/button";
import { ArrowRightIcon, LockKeyholeIcon } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cache, type ReactNode } from "react";
import { getAuth } from "@/lib/auth";
import { getCommunityPostSharePreview } from "@/lib/community-post-shares";
import { memberAssetPathFromUrl } from "@/lib/member-storage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const genericTitle = "Publicação da Comunidade | Interprete";
const genericDescription = "Acesse o Interprete para continuar a conversa.";
const genericImage = "/brand/meta/interprete-social-v2.png";
const loopbackHostPattern = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/;
const httpProtocolPrefixPattern = /^https?:\/\//;

const resolvePreview = cache(async (token: string) => {
  try {
    const session = await getAuth();
    const memberId =
      session.userId &&
      !session.memberDeactivated &&
      session.memberSnapshot?.onboardingStatus === "COMPLETED"
        ? session.userId
        : null;
    return {
      memberId,
      preview: await getCommunityPostSharePreview(token, memberId),
      session,
    };
  } catch {
    return { memberId: null, preview: null, session: null };
  }
});

const isLoopbackHost = (host: string) => loopbackHostPattern.test(host);

const metadataBaseForHost = (incomingHost: string | null) => {
  const host = incomingHost?.split(",")[0]?.trim().toLowerCase() ?? "";
  if (isLoopbackHost(host)) {
    return new URL(`http://${host}`);
  }

  const trustedHosts = new Set(
    [
      process.env.VERCEL_URL,
      process.env.VERCEL_PROJECT_PRODUCTION_URL,
      "interprete-area-de-membros.vercel.app",
      "interprete-area-de-membros-app.vercel.app",
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) =>
        value.replace(httpProtocolPrefixPattern, "").toLowerCase()
      )
  );
  const trustedHost = trustedHosts.has(host)
    ? host
    : (process.env.VERCEL_URL ??
      process.env.VERCEL_PROJECT_PRODUCTION_URL ??
      "interprete-area-de-membros.vercel.app");
  return new URL(
    `https://${trustedHost.replace(httpProtocolPrefixPattern, "")}`
  );
};

const makeMetadata = (
  title: string,
  description: string,
  image: string,
  base: URL,
  pageUrl = "/"
): Metadata => ({
  title,
  description,
  metadataBase: base,
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
  openGraph: {
    title,
    description,
    url: pageUrl,
    type: "article",
    siteName: "Interprete",
    locale: "pt_BR",
    images: [{ url: image, width: 1200, height: 630, alt: title }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [image],
  },
});

export const generateMetadata = async ({
  params,
}: {
  readonly params: Promise<{ token: string }>;
}): Promise<Metadata> => {
  const [{ token }, requestHeaders] = await Promise.all([params, headers()]);
  const { preview } = await resolvePreview(token);
  const base = metadataBaseForHost(
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host")
  );
  if (!preview) {
    return makeMetadata(genericTitle, genericDescription, genericImage, base);
  }

  const title = `${preview.title} | Comunidade do Interprete`;
  const description = preview.metaDescription || genericDescription;
  return makeMetadata(
    title,
    description,
    `/comunidade/compartilhar/${token}/opengraph-image`,
    base,
    `/comunidade/compartilhar/${token}`
  );
};

const ShareFrame = ({ children }: { readonly children: ReactNode }) => (
  <main className="community-share-landing">
    <div className="community-share-landing__frame">
      <header className="community-share-landing__header">
        <Link aria-label="Interprete, início" href="/">
          Interprete.
        </Link>
        <span>COMUNIDADE</span>
      </header>
      {children}
    </div>
    <footer className="community-share-landing__footer">
      Um espaço para aprender e conversar no Interprete.
    </footer>
  </main>
);

const GenericShareLanding = ({
  returnPath,
  onboarding,
}: {
  readonly returnPath: string;
  readonly onboarding: boolean;
}) => {
  const signInUrl = getSignInPath(returnPath);
  const signUpQuery = new URLSearchParams({ redirect_url: returnPath });
  return (
    <ShareFrame>
      <section className="community-share-landing__card">
        <div aria-hidden="true" className="community-share-landing__art">
          <div className="community-share-landing__art-mark">i.</div>
          <span>IDEIAS QUE SE ENCONTRAM</span>
        </div>
        <div className="community-share-landing__copy">
          <span className="community-share-landing__eyebrow">
            UMA PUBLICAÇÃO FOI COMPARTILHADA
          </span>
          <h1>Acesse o Interprete para continuar a conversa.</h1>
          <p>
            Entre na Comunidade para conferir esta publicação. O link não altera
            as permissões de acesso.
          </p>
          <div className="community-share-landing__actions">
            {onboarding ? (
              <Button asChild>
                <Link href={`/onboarding?${signUpQuery.toString()}`}>
                  Finalizar cadastro <ArrowRightIcon aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild>
                  <Link href={signInUrl}>
                    Entrar para continuar <ArrowRightIcon aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/sign-up?${signUpQuery.toString()}`}>
                    Criar conta
                  </Link>
                </Button>
              </>
            )}
          </div>
          <p className="community-share-landing__hint">
            <LockKeyholeIcon aria-hidden="true" />A publicação continua
            protegida pelas permissões do Interprete.
          </p>
        </div>
      </section>
    </ShareFrame>
  );
};

const PublicShareLanding = ({
  authorName,
  bodyExcerpt,
  commentCount,
  coverAltText,
  coverUrl,
  description,
  publishedAt,
  returnPath,
  subtitle,
  tags,
  title,
}: {
  readonly authorName: string;
  readonly bodyExcerpt: string;
  readonly commentCount: number;
  readonly coverAltText: string;
  readonly coverUrl: string | null;
  readonly description: string;
  readonly publishedAt: Date | null;
  readonly returnPath: string;
  readonly subtitle: string;
  readonly tags: readonly string[];
  readonly title: string;
}) => {
  const signUpQuery = new URLSearchParams({ redirect_url: returnPath });
  const publishedDate = publishedAt
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "long",
        timeZone: "America/Sao_Paulo",
        year: "numeric",
      }).format(publishedAt)
    : null;
  return (
    <ShareFrame>
      <article className="community-share-landing__public-card">
        <div
          aria-hidden={!coverUrl}
          className="community-share-landing__public-art"
          data-cover-image={coverUrl ? "true" : undefined}
        >
          {coverUrl ? (
            <Image
              alt={coverAltText || `Capa da publicação: ${title}`}
              decoding="async"
              fetchPriority="high"
              height={900}
              src={coverUrl}
              unoptimized
              width={1600}
            />
          ) : (
            <>
              <span>Interprete.</span>
              <span
                aria-hidden="true"
                className="community-share-landing__public-quote"
              >
                “
              </span>
              <span
                aria-hidden="true"
                className="community-share-landing__public-lines"
              >
                <span />
                <span />
                <span />
                <span />
              </span>
              <span>PUBLICAÇÃO</span>
            </>
          )}
        </div>
        <div className="community-share-landing__public-copy">
          <div className="community-share-landing__public-meta">
            {tags.map((tag) => (
              <span className="community-share-landing__tag" key={tag}>
                {tag}
              </span>
            ))}
            {publishedAt && publishedDate ? (
              <time dateTime={publishedAt.toISOString()}>{publishedDate}</time>
            ) : null}
            {commentCount > 0 ? (
              <span>
                {commentCount} {commentCount === 1 ? "resposta" : "respostas"}
              </span>
            ) : null}
          </div>
          <p className="community-share-landing__author">
            Por <strong>{authorName}</strong>
          </p>
          <h1>{title}</h1>
          {subtitle ? (
            <p className="community-share-landing__subtitle">{subtitle}</p>
          ) : null}
          {description &&
          description !== subtitle &&
          description !== bodyExcerpt ? (
            <p className="community-share-landing__excerpt">{description}</p>
          ) : null}
          {bodyExcerpt ? (
            <div className="community-share-landing__body-excerpt">
              <p>{bodyExcerpt}</p>
            </div>
          ) : null}
          <div className="community-share-landing__public-cta">
            <p>Entre para ler a publicação completa e continuar a conversa.</p>
            <div className="community-share-landing__actions">
              <Button asChild>
                <Link href={getSignInPath(returnPath)}>
                  Entrar <ArrowRightIcon aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/sign-up?${signUpQuery.toString()}`}>
                  Criar conta
                </Link>
              </Button>
            </div>
          </div>
          <p className="community-share-landing__hint">
            <LockKeyholeIcon aria-hidden="true" />O acesso completo segue as
            permissões da publicação.
          </p>
        </div>
      </article>
    </ShareFrame>
  );
};

const CommunityPostSharePage = async ({
  params,
}: {
  readonly params: Promise<{ token: string }>;
}) => {
  const { token } = await params;
  const { memberId, preview, session } = await resolvePreview(token);
  const returnPath = getSafeInternalPath(
    `/comunidade/compartilhar/${token}`,
    "https://interprete.invalid"
  );

  if (memberId && preview) {
    redirect(preview.href);
  }

  if (preview && !preview.isPrivate) {
    const coverPath = memberAssetPathFromUrl(preview.coverUrl);
    const coverUrl = coverPath?.startsWith("community-assets/covers/")
      ? `/comunidade/compartilhar/${encodeURIComponent(token)}/cover`
      : null;
    return (
      <PublicShareLanding
        authorName={preview.authorName}
        bodyExcerpt={preview.bodyExcerpt}
        commentCount={preview.commentCount}
        coverAltText={preview.coverAltText}
        coverUrl={coverUrl}
        description={preview.description}
        publishedAt={preview.publishedAt}
        returnPath={returnPath}
        subtitle={preview.subtitle}
        tags={preview.tags}
        title={preview.title}
      />
    );
  }

  const onboarding =
    Boolean(session?.userId) &&
    !session?.memberDeactivated &&
    session?.memberSnapshot?.onboardingStatus !== "COMPLETED";
  return (
    <GenericShareLanding onboarding={onboarding} returnPath={returnPath} />
  );
};

export default CommunityPostSharePage;
