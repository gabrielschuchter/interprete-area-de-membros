import { getSafeInternalPath, getSignInPath } from "@repo/auth/redirects";
import { Button } from "@repo/design-system/components/ui/button";
import { ArrowRightIcon, LockKeyholeIcon } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cache, type ReactNode } from "react";
import { getAuth } from "@/lib/auth";
import { getCommunityPostSharePreview } from "@/lib/community-post-shares";

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
  const description = preview.description || genericDescription;
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
  description,
  returnPath,
  title,
}: {
  readonly authorName: string;
  readonly description: string;
  readonly returnPath: string;
  readonly title: string;
}) => {
  const signUpQuery = new URLSearchParams({ redirect_url: returnPath });
  return (
    <ShareFrame>
      <article className="community-share-landing__public-card">
        <div aria-hidden="true" className="community-share-landing__public-art">
          <span>Interprete.</span>
          <span>PUBLICAÇÃO</span>
        </div>
        <div className="community-share-landing__public-copy">
          <p className="community-share-landing__author">
            Publicado por <strong>{authorName}</strong>
          </p>
          <h1>{title}</h1>
          {description ? (
            <p className="community-share-landing__excerpt">{description}</p>
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
    return (
      <PublicShareLanding
        authorName={preview.authorName}
        description={preview.description}
        returnPath={returnPath}
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
