import { getSafeInternalPath, getSignInPath } from "@repo/auth/redirects";
import { Button } from "@repo/design-system/components/ui/button";
import { GlobeIcon, LockKeyholeIcon, UsersRoundIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { CommunityCoverImage } from "@/components/community/community-cover-image";
import { getAuth } from "@/lib/auth";
import { getCommunityInviteLinkPreview } from "@/lib/community-invitations";
import { AcceptCommunityGroupInvite } from "./accept-invite";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const genericTitle = "Convite para grupo de estudo | Interprete";
const genericDescription = "Acesse o Interprete para responder a um convite.";
const whitespacePattern = /\s+/;

export const metadata: Metadata = {
  title: genericTitle,
  description: genericDescription,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  openGraph: {
    title: genericTitle,
    description: genericDescription,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: genericTitle,
    description: genericDescription,
  },
};

const InviteFrame = ({
  children,
  contentClassName = "flex min-h-[420px] items-center justify-center p-6 sm:p-8",
}: {
  readonly children: ReactNode;
  readonly contentClassName?: string;
}) => (
  <main className="mx-auto flex min-h-svh w-full max-w-[620px] items-center justify-center px-4 py-8 sm:px-0">
    <div className="w-full overflow-hidden rounded-lg border border-border bg-background">
      <header className="flex h-14 items-center justify-between border-border border-b px-6">
        <span className="font-display text-brand-structural text-xl leading-none">
          Interprete.
        </span>
        <span className="font-data text-[11px] text-muted-foreground uppercase tracking-[0.12em]">
          Convite
        </span>
      </header>
      <div className={contentClassName}>{children}</div>
    </div>
  </main>
);

const InviteUnavailable = () => (
  <InviteFrame>
    <div className="flex max-w-md flex-col items-center gap-4 text-center">
      <LockKeyholeIcon
        aria-hidden="true"
        className="size-16 text-brand-structural"
      />
      <h1 className="font-display text-2xl">Este convite não vale mais.</h1>
      <p className="text-muted-foreground text-sm leading-6">
        O link foi redefinido, expirou ou foi revogado, ou o grupo não está mais
        publicado. Peça um novo link a quem convidou.
      </p>
      <Button asChild className="mt-1" variant="outline">
        <Link href="/comunidade/grupos">Ir para a Comunidade</Link>
      </Button>
    </div>
  </InviteFrame>
);

const CommunityInviteLinkPage = async ({
  params,
}: {
  readonly params: Promise<{ token: string }>;
}) => {
  const [{ token }, session] = await Promise.all([params, getAuth()]);
  const returnPath = getSafeInternalPath(
    `/comunidade/convite/${token}`,
    "https://interprete.invalid"
  );

  if (!session.userId) {
    const signUpQuery = new URLSearchParams({ redirect_url: returnPath });
    return (
      <InviteFrame contentClassName="flex min-h-[620px] items-center justify-center p-5 sm:p-7">
        <section className="w-full max-w-[480px] overflow-hidden rounded-lg border border-border bg-background">
          <div
            aria-label="Prévia do convite"
            className="flex aspect-[16/6] items-center justify-center bg-[radial-gradient(circle_at_72%_35%,rgba(143,19,57,0.24),transparent_34%),linear-gradient(125deg,rgba(143,19,57,0.12),rgba(74,0,46,0.04))] text-brand-structural"
            role="img"
          >
            <UsersRoundIcon aria-hidden="true" className="size-12 opacity-70" />
          </div>
          <div className="flex flex-col gap-3 p-5 sm:p-6">
            <p className="brand-eyebrow">Você recebeu um convite</p>
            <h1 className="font-display text-2xl leading-tight">
              Entre para conferir o convite.
            </h1>
            <p className="text-muted-foreground text-sm leading-6">
              Os detalhes do grupo aparecem depois da autenticação. Abrir este
              link não adiciona você ao grupo.
            </p>
            <div className="mt-1 flex flex-col gap-2">
              <Button asChild>
                <Link href={getSignInPath(returnPath)}>
                  Entrar para aceitar
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/sign-up?${signUpQuery.toString()}`}>
                  Criar conta
                </Link>
              </Button>
            </div>
            <p className="text-muted-foreground text-xs leading-5">
              Depois de entrar, você volta aqui e termina dentro do grupo.
            </p>
          </div>
        </section>
      </InviteFrame>
    );
  }

  if (session.memberDeactivated) {
    return <InviteUnavailable />;
  }

  if (!session.memberSnapshot) {
    const onboardingQuery = new URLSearchParams({ redirect_url: returnPath });
    return (
      <InviteFrame>
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <p className="brand-eyebrow">Comunidade · convite</p>
          <h1 className="font-display text-2xl">
            Finalize seu acesso para continuar.
          </h1>
          <p className="text-muted-foreground text-sm leading-6">
            Depois de concluir o cadastro, você voltará a este convite.
          </p>
          <Button asChild className="mt-1">
            <Link href={`/onboarding?${onboardingQuery.toString()}`}>
              Continuar cadastro
            </Link>
          </Button>
        </div>
      </InviteFrame>
    );
  }

  if (session.memberSnapshot.onboardingStatus !== "COMPLETED") {
    const onboardingQuery = new URLSearchParams({ redirect_url: returnPath });
    return (
      <InviteFrame>
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <p className="brand-eyebrow">Comunidade · convite</p>
          <h1 className="font-display text-2xl">
            Finalize seu cadastro para continuar.
          </h1>
          <p className="text-muted-foreground text-sm leading-6">
            Você voltará a este convite depois de concluir o cadastro.
          </p>
          <Button asChild className="mt-1">
            <Link href={`/onboarding?${onboardingQuery.toString()}`}>
              Continuar cadastro
            </Link>
          </Button>
        </div>
      </InviteFrame>
    );
  }

  const preview = await getCommunityInviteLinkPreview(token, session.userId);
  if (!preview) {
    return <InviteUnavailable />;
  }

  if (preview.alreadyMember) {
    return (
      <InviteFrame>
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <UsersRoundIcon
            aria-hidden="true"
            className="size-16 text-brand-structural"
          />
          <h1 className="font-display text-2xl">Você já está neste grupo</h1>
          <p className="text-muted-foreground text-sm leading-6">
            Nada a fazer por aqui. É só abrir o grupo e continuar a conversa.
          </p>
          <Button asChild className="mt-1">
            <Link href={`/comunidade/grupos/${preview.group.slug}`}>
              Abrir grupo
            </Link>
          </Button>
        </div>
      </InviteFrame>
    );
  }

  const inviterInitials = preview.inviterName
    .trim()
    .split(whitespacePattern)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <InviteFrame contentClassName="flex min-h-[620px] items-center justify-center p-5 sm:p-7">
      <article
        aria-label="Prévia do convite para grupo"
        className="w-full max-w-[480px] overflow-hidden rounded-lg border border-border bg-background"
      >
        {preview.group.coverUrl ? (
          <CommunityCoverImage
            alt={`Capa do grupo ${preview.group.title}`}
            className="aspect-[16/6] w-full bg-muted object-cover"
            height={600}
            loading="eager"
            src={preview.group.coverUrl}
            width={1600}
          />
        ) : (
          <div
            aria-label="Capa do grupo"
            className="flex aspect-[16/6] items-center justify-center bg-[radial-gradient(circle_at_72%_35%,rgba(143,19,57,0.24),transparent_34%),linear-gradient(125deg,rgba(143,19,57,0.12),rgba(74,0,46,0.04))] text-brand-structural"
            role="img"
          >
            <UsersRoundIcon aria-hidden="true" className="size-12 opacity-70" />
          </div>
        )}
        <div className="flex flex-col gap-3 p-5 sm:p-6">
          <div className="flex items-center gap-2.5 text-muted-foreground text-sm">
            <span
              aria-hidden="true"
              className="inline-flex size-7 flex-none items-center justify-center rounded-full bg-muted font-semibold text-brand-structural text-xs"
            >
              {inviterInitials || "I"}
            </span>
            <span>
              <strong className="font-semibold text-foreground">
                {preview.inviterName}
              </strong>{" "}
              convidou você para um grupo
            </span>
          </div>
          <h1 className="font-display text-2xl leading-tight">
            {preview.group.title}
          </h1>
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex h-6 items-center gap-1.5 rounded-sm border border-border bg-background px-2 text-foreground text-xs">
              {preview.group.visibility === "PRIVATE" ? (
                <LockKeyholeIcon aria-hidden="true" className="size-3" />
              ) : (
                <GlobeIcon aria-hidden="true" className="size-3" />
              )}
              {preview.group.visibility === "PRIVATE" ? "Privado" : "Público"}
            </span>
            <span className="inline-flex h-6 items-center gap-1.5 rounded-sm border border-border bg-background px-2 text-foreground text-xs">
              <UsersRoundIcon aria-hidden="true" className="size-3" />
              {preview.group.memberCount}{" "}
              {preview.group.memberCount === 1 ? "membro" : "membros"}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-muted-foreground text-sm leading-6">
            {preview.group.description ||
              "Você foi convidado para participar deste grupo de estudo."}
          </p>
          <p className="mt-1 text-muted-foreground text-sm leading-6">
            Você entra como membro e passa a ver as publicações do grupo.
          </p>
          <div className="flex flex-col gap-2">
            <AcceptCommunityGroupInvite token={token} />
            <Button asChild className="w-full" variant="outline">
              <Link href="/comunidade/grupos">Agora não</Link>
            </Button>
          </div>
        </div>
      </article>
    </InviteFrame>
  );
};

export default CommunityInviteLinkPage;
