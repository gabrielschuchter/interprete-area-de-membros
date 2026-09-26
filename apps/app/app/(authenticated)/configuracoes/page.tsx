import { Button } from "@repo/design-system/components/ui/button";
import { MailIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getOrCreateProfile } from "@/lib/profile";
import { ManageAccountButton, SignOutButton } from "./account-actions";
import { NotificationPreferences } from "./notification-preferences";

const SettingsPage = async () => {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const profile = await getOrCreateProfile(user.id, false);
  const email =
    user.primaryEmailAddress?.emailAddress ?? "E-mail não informado";
  const publicProfileHref = profile?.username
    ? `/membros/${profile.username}`
    : "/perfil";

  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto w-full max-w-[960px] px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
        <header className="max-w-2xl">
          <p className="brand-eyebrow text-muted-foreground">
            Conta · Interprete
          </p>
          <div className="mt-4 h-px w-10 bg-brand-action" />
          <h1 className="mt-6 font-display text-4xl text-foreground leading-tight sm:text-5xl">
            Configurações gerais
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground leading-7">
            Gerencie o acesso à sua conta e encontre os atalhos do seu perfil no
            Interprete.
          </p>
        </header>

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section
            aria-labelledby="account-access-heading"
            className="paper-surface border p-6 shadow-[var(--shadow-paper)] sm:p-8"
          >
            <p className="brand-eyebrow text-muted-foreground">Conta</p>
            <h2
              className="mt-3 font-display text-2xl text-foreground"
              id="account-access-heading"
            >
              Conta e acesso
            </h2>
            <p className="mt-3 text-muted-foreground text-sm leading-6">
              O Clerk cuida do seu login, segurança e sessões. O e-mail abaixo é
              o endereço principal da conta.
            </p>

            <div className="mt-7 flex items-start gap-3 border-border border-t pt-5">
              <MailIcon
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-brand-action"
              />
              <div className="min-w-0">
                <p className="text-muted-foreground text-xs uppercase tracking-[0.16em]">
                  E-mail da conta
                </p>
                <p className="mt-1 break-words text-foreground text-sm">
                  {email}
                </p>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <ManageAccountButton />
              <SignOutButton />
            </div>
          </section>

          <section
            aria-labelledby="profile-settings-heading"
            className="paper-surface border p-6 shadow-[var(--shadow-paper)] sm:p-8"
          >
            <p className="brand-eyebrow text-muted-foreground">Identidade</p>
            <h2
              className="mt-3 font-display text-2xl text-foreground"
              id="profile-settings-heading"
            >
              Perfil no Interprete
            </h2>
            <p className="mt-3 text-muted-foreground text-sm leading-6">
              Seu perfil reúne a identidade que aparece na escola, na comunidade
              e para outros membros. Ele é separado das credenciais da conta.
            </p>

            <div className="mt-7 flex items-start gap-3 border-border border-t pt-5">
              <UserRoundIcon
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-brand-action"
              />
              <p className="text-muted-foreground text-sm leading-6">
                Atualize sua foto, nome, bio, profissão, interesses e links no
                seu perfil.
              </p>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/perfil">Editar meu perfil</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={publicProfileHref}>Ver meu perfil público</Link>
              </Button>
            </div>
          </section>
        </div>
        <div className="mt-6">
          <NotificationPreferences />
        </div>
      </div>
    </main>
  );
};

export default SettingsPage;
