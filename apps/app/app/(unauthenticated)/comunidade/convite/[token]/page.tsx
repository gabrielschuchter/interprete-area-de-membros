import { getSafeInternalPath, getSignInPath } from "@repo/auth/redirects";
import { Button } from "@repo/design-system/components/ui/button";
import type { Metadata } from "next";
import Link from "next/link";
import { getAuth } from "@/lib/auth";
import { getCommunityInviteLinkPreview } from "@/lib/community-invitations";
import { AcceptCommunityGroupInvite } from "./accept-invite";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const genericTitle = "Convite para grupo de estudo | Interprete";
const genericDescription = "Acesse o Interprete para responder a um convite.";

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

const InviteUnavailable = () => (
  <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col justify-center px-5 py-12">
    <p className="brand-eyebrow">Comunidade · convite</p>
    <h1 className="mt-3 font-display text-3xl">
      Este convite não está disponível.
    </h1>
    <p className="mt-3 text-muted-foreground leading-6">
      O link pode ter sido revogado ou o grupo pode não estar disponível.
    </p>
    <Button asChild className="mt-6 w-fit" variant="outline">
      <Link href="/comunidade/grupos">Explorar grupos</Link>
    </Button>
  </main>
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
      <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col justify-center px-5 py-12">
        <p className="brand-eyebrow">Comunidade · convite</p>
        <h1 className="mt-3 font-display text-3xl">Você recebeu um convite.</h1>
        <p className="mt-3 text-muted-foreground leading-6">
          Entre ou crie uma conta para conferir o convite. Os detalhes do grupo
          aparecem depois da autenticação.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link href={getSignInPath(returnPath)}>Entrar</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/sign-up?${signUpQuery.toString()}`}>Criar conta</Link>
          </Button>
        </div>
      </main>
    );
  }

  if (session.memberDeactivated) {
    return <InviteUnavailable />;
  }

  if (!session.memberSnapshot) {
    const onboardingQuery = new URLSearchParams({ redirect_url: returnPath });
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col justify-center px-5 py-12">
        <p className="brand-eyebrow">Comunidade · convite</p>
        <h1 className="mt-3 font-display text-3xl">
          Finalize seu acesso para continuar.
        </h1>
        <p className="mt-3 text-muted-foreground leading-6">
          Depois de concluir o cadastro, você voltará a este convite.
        </p>
        <Button asChild className="mt-6 w-fit">
          <Link href={`/onboarding?${onboardingQuery.toString()}`}>
            Continuar cadastro
          </Link>
        </Button>
      </main>
    );
  }

  if (session.memberSnapshot.onboardingStatus !== "COMPLETED") {
    const onboardingQuery = new URLSearchParams({ redirect_url: returnPath });
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col justify-center px-5 py-12">
        <p className="brand-eyebrow">Comunidade · convite</p>
        <h1 className="mt-3 font-display text-3xl">
          Finalize seu cadastro para continuar.
        </h1>
        <p className="mt-3 text-muted-foreground leading-6">
          Você voltará a este convite depois de concluir o cadastro.
        </p>
        <Button asChild className="mt-6 w-fit">
          <Link href={`/onboarding?${onboardingQuery.toString()}`}>
            Continuar cadastro
          </Link>
        </Button>
      </main>
    );
  }

  const preview = await getCommunityInviteLinkPreview(token, session.userId);
  if (!preview) {
    return <InviteUnavailable />;
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col justify-center px-5 py-12">
      <p className="brand-eyebrow">Comunidade · convite</p>
      <h1 className="mt-3 font-display text-3xl">{preview.group.title}</h1>
      <p className="mt-3 whitespace-pre-wrap text-muted-foreground leading-6">
        {preview.group.description ||
          "Você foi convidado para participar deste grupo de estudo."}
      </p>
      <p className="mt-4 text-muted-foreground text-sm">
        Abrir o convite não adiciona você ao grupo. Você precisa aceitar para
        entrar.
      </p>
      <div className="mt-6">
        {preview.alreadyMember ? (
          <Button asChild>
            <Link href={`/comunidade/grupos/${preview.group.slug}`}>
              Abrir grupo
            </Link>
          </Button>
        ) : (
          <AcceptCommunityGroupInvite token={token} />
        )}
      </div>
    </main>
  );
};

export default CommunityInviteLinkPage;
