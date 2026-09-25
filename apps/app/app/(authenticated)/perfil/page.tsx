import { database } from "@repo/database";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { CheckCircle2Icon, ExternalLinkIcon, MailIcon } from "lucide-react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getMemberRole } from "@/lib/authorization";
import { getOrCreateProfile } from "@/lib/profile";
import { MemberHeader } from "../components/member-header";
import { updateProfile } from "./actions";

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

const contextLabels = {
  occupation: "Profissão",
  institution: "Instituição",
  city: "Cidade",
  state: "Estado",
  country: "País",
} as const;

const linkLabels = {
  website: "Site",
  instagram: "Instagram",
  linkedin: "LinkedIn",
} as const;

const initials = (value: string) =>
  value
    .split(whitespacePattern)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "M";

interface ProfilePageProperties {
  readonly searchParams: Promise<{ error?: string; saved?: string }>;
}

const ProfilePage = async ({ searchParams }: ProfilePageProperties) => {
  const filters = await searchParams;
  const user = await getCurrentUser();
  const memberId = user?.id;

  if (!memberId) {
    return null;
  }

  const [profile, role, completedLessons, enrollments, topicCount] =
    await Promise.all([
      getOrCreateProfile(memberId),
      getMemberRole(memberId),
      database.lessonProgress.count({
        where: { memberId, status: "COMPLETED" },
      }),
      database.enrollment.count({ where: { memberId } }),
      database.communityPost.count({
        where: { authorId: memberId, deletedAt: null },
      }),
    ]);

  if (!profile) {
    return null;
  }

  const name = profile.displayName ?? "Estudante";
  const email = user.primaryEmailAddress?.emailAddress ?? "";
  const location = [profile.city, profile.state, profile.country]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="min-h-svh bg-background">
      <MemberHeader section="Perfil" />
      <main className="mx-auto w-full max-w-[1120px] px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
        <header className="max-w-3xl">
          <p className="brand-eyebrow">Caderno do estudante · identidade</p>
          <span aria-hidden="true" className="brand-rule mt-4" />
          <h1 className="mt-6 font-display text-5xl leading-none sm:text-6xl">
            Seu lugar no percurso.
          </h1>
          <p className="mt-5 max-w-2xl text-muted-foreground leading-7">
            Um perfil simples para que suas perguntas e contribuições tenham
            rosto, contexto e continuidade dentro da comunidade.
          </p>
        </header>

        {filters.saved === "1" && (
          <p className="mt-6 border-brand-action border-l-2 bg-brand-action/10 px-4 py-3 text-sm">
            Perfil atualizado.
          </p>
        )}
        {filters.error === "username" && (
          <p className="mt-6 border-destructive border-l-2 bg-destructive/10 px-4 py-3 text-sm">
            Escolha um username único com 3 a 30 caracteres. Use apenas letras,
            números e hífens.
          </p>
        )}

        <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section className="paper-surface border p-6 sm:p-10">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="flex min-w-0 items-center gap-4">
                <Avatar className="size-16 shrink-0">
                  {profile.avatarUrl ? (
                    <AvatarImage alt="" src={profile.avatarUrl} />
                  ) : null}
                  <AvatarFallback className="bg-brand-structural text-primary-foreground">
                    {initials(name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="brand-eyebrow">{roleLabel(role)}</p>
                  <h2 className="mt-1 truncate font-display text-3xl">
                    {name}
                  </h2>
                  <p className="mt-1 truncate text-muted-foreground text-sm">
                    @{profile.username}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/membros/${profile.username}`}>
                    Ver perfil público
                  </Link>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/membros">Explorar membros</Link>
                </Button>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-muted-foreground text-sm">
              {profile.headline && <span>{profile.headline}</span>}
              {location && <span>{location}</span>}
              <span className="inline-flex items-center gap-1.5">
                <MailIcon aria-hidden="true" className="size-3.5" /> {email}
              </span>
            </div>

            <form
              action={updateProfile}
              className="mt-10 space-y-7 border-border border-t pt-8"
            >
              <div>
                <p className="brand-eyebrow">Como você aparece</p>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <label className="block" htmlFor="profile-display-name">
                    <span className="text-sm">Nome de exibição</span>
                    <Input
                      className="mt-2"
                      defaultValue={profile.displayName ?? ""}
                      id="profile-display-name"
                      name="displayName"
                    />
                  </label>
                  <label className="block" htmlFor="profile-username">
                    <span className="text-sm">Username</span>
                    <Input
                      className="mt-2"
                      defaultValue={profile.username}
                      id="profile-username"
                      name="username"
                      required
                    />
                    <span className="mt-1 block text-muted-foreground text-xs">
                      Seu endereço: /membros/{profile.username}
                    </span>
                  </label>
                </div>
                <label className="mt-5 block" htmlFor="profile-avatar-url">
                  <span className="text-sm">Foto de perfil (URL opcional)</span>
                  <Input
                    className="mt-2"
                    defaultValue={profile.avatarUrl ?? ""}
                    id="profile-avatar-url"
                    name="avatarUrl"
                    placeholder="https://..."
                  />
                  <span className="mt-1 block text-muted-foreground text-xs">
                    Se ficar vazio, usamos a foto do Clerk ou suas iniciais.
                  </span>
                </label>
                <label className="mt-5 block" htmlFor="profile-headline">
                  <span className="text-sm">Identificação curta</span>
                  <Input
                    className="mt-2"
                    defaultValue={profile.headline ?? ""}
                    id="profile-headline"
                    name="headline"
                    placeholder="Nutricionista · Interprete"
                  />
                </label>
              </div>

              <div>
                <p className="brand-eyebrow">Seu contexto</p>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  {(
                    [
                      "occupation",
                      "institution",
                      "city",
                      "state",
                      "country",
                    ] as const
                  ).map((field) => (
                    <label
                      className="block"
                      htmlFor={`profile-${field}`}
                      key={field}
                    >
                      <span className="text-sm">{contextLabels[field]}</span>
                      <Input
                        className="mt-2"
                        defaultValue={profile[field] ?? ""}
                        id={`profile-${field}`}
                        name={field}
                      />
                    </label>
                  ))}
                </div>
                <label className="mt-5 block" htmlFor="profile-bio">
                  <span className="text-sm">Bio</span>
                  <Textarea
                    className="mt-2 min-h-32"
                    defaultValue={profile.bio ?? ""}
                    id="profile-bio"
                    name="bio"
                    placeholder="O que você estuda, pratica ou quer investigar?"
                  />
                </label>
                <label className="mt-5 block" htmlFor="profile-interests">
                  <span className="text-sm">Interesses</span>
                  <Input
                    className="mt-2"
                    defaultValue={profile.interests.join(", ")}
                    id="profile-interests"
                    name="interests"
                    placeholder="PBE, epidemiologia, leitura crítica"
                  />
                </label>
              </div>

              <div>
                <p className="brand-eyebrow">Links</p>
                <div className="mt-4 grid gap-5 sm:grid-cols-3">
                  {(["website", "instagram", "linkedin"] as const).map(
                    (field) => (
                      <label
                        className="block"
                        htmlFor={`profile-${field}`}
                        key={field}
                      >
                        <span className="text-sm">{linkLabels[field]}</span>
                        <Input
                          className="mt-2"
                          defaultValue={profile[field] ?? ""}
                          id={`profile-${field}`}
                          name={field}
                          placeholder="https://"
                        />
                      </label>
                    )
                  )}
                </div>
              </div>

              <div className="flex justify-end border-border border-t pt-6">
                <Button type="submit">Salvar perfil</Button>
              </div>
            </form>
          </section>

          <aside className="grid h-fit gap-4 sm:grid-cols-3 lg:grid-cols-1">
            <div className="paper-surface border p-6">
              <CheckCircle2Icon
                aria-hidden="true"
                className="size-5 text-brand-action"
              />
              <p className="mt-5 font-data text-3xl text-brand-structural">
                {completedLessons}
              </p>
              <p className="mt-2 text-muted-foreground text-sm">
                aulas concluídas
              </p>
            </div>
            <div className="paper-surface border p-6">
              <p className="brand-eyebrow">Percurso</p>
              <p className="mt-3 font-display text-2xl">{enrollments} cursos</p>
              <p className="mt-2 text-muted-foreground text-sm leading-6">
                Seu ponto de partida e o que já começou a ganhar forma.
              </p>
            </div>
            <div className="paper-surface border p-6">
              <p className="brand-eyebrow">Comunidade</p>
              <p className="mt-3 font-display text-2xl">{topicCount} tópicos</p>
              <p className="mt-2 text-muted-foreground text-sm leading-6">
                {profile.headline ??
                  "Compartilhe uma pergunta quando fizer sentido."}
              </p>
              <Button asChild className="mt-4" size="sm" variant="ghost">
                <Link href="/comunidade/meus-topicos">
                  Ver meus tópicos <ExternalLinkIcon aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
