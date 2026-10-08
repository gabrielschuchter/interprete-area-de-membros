"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { ArrowLeftIcon, PencilIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { IntentLink } from "../components/intent-link";
import { ProfileLinkButton } from "./profile-link-button";

interface ProfileShellProperties {
  readonly avatarUrl: string | null;
  readonly children: React.ReactNode;
  readonly completedLessons: number;
  readonly displayName: string;
  readonly enrollments: number;
  readonly headline: string | null;
  readonly interests: readonly string[];
  readonly role: string;
  readonly topicCount: number;
  readonly username: string;
}

const whitespacePattern = /\s+/;

const initials = (value: string) =>
  value
    .split(whitespacePattern)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "M";

const roleLabel = (role: string) => {
  if (role === "TEACHER") {
    return "Professor";
  }
  return "Membro";
};

const tabs = [
  { href: "/perfil", label: "Visão geral" },
  { href: "/perfil/conquistas", label: "Conquistas" },
  { href: "/perfil/editar", label: "Editar perfil" },
] as const;

const ProfileShell = ({
  avatarUrl,
  children,
  completedLessons,
  displayName,
  enrollments,
  headline,
  interests,
  role,
  topicCount,
  username,
}: ProfileShellProperties) => {
  const pathname = usePathname();
  const isAchievements = pathname === "/perfil/conquistas";
  const isEditing = pathname === "/perfil/editar";
  const isDetail = isAchievements || isEditing;
  const name = displayName || "Estudante";

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto w-full max-w-[856px] px-5 pt-5 pb-16 sm:px-8 md:px-12 md:pt-10">
        {isDetail ? (
          <div className="mb-7 flex min-h-11 items-center gap-4 md:hidden">
            <Button
              asChild
              className="-ml-3 shadow-none"
              size="default"
              variant="ghost"
            >
              <IntentLink href="/perfil">
                <ArrowLeftIcon aria-hidden="true" /> Voltar
              </IntentLink>
            </Button>
            <span aria-hidden="true" className="h-5 w-px bg-border" />
            <span className="font-medium">
              {isAchievements ? "Conquistas" : "Editar perfil"}
            </span>
          </div>
        ) : (
          <section aria-label="Seu perfil" className="mb-6 md:hidden">
            <div className="flex items-center gap-4">
              <Avatar className="size-16 shrink-0">
                {avatarUrl ? <AvatarImage alt="" src={avatarUrl} /> : null}
                <AvatarFallback className="bg-brand-structural text-primary-foreground">
                  {initials(name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="brand-eyebrow">{roleLabel(role)}</p>
                <h1 className="truncate font-display text-3xl leading-tight">
                  {name}
                </h1>
                <p className="truncate text-muted-foreground text-sm">
                  @{username}
                </p>
              </div>
            </div>
            {headline ? (
              <p className="mt-4 text-sm leading-6">{headline}</p>
            ) : null}
            <Button asChild className="mt-4 w-full shadow-none" size="default">
              <IntentLink href="/perfil/editar">
                <PencilIcon aria-hidden="true" /> Editar perfil
              </IntentLink>
            </Button>
          </section>
        )}

        <section
          aria-label="Identidade do perfil"
          className="hidden border-border border-b pb-6 md:block"
        >
          <div className="flex items-start justify-between gap-5">
            <div className="flex min-w-0 items-center gap-5">
              <Avatar className="size-20 shrink-0">
                {avatarUrl ? <AvatarImage alt="" src={avatarUrl} /> : null}
                <AvatarFallback className="bg-brand-structural text-primary-foreground">
                  {initials(name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="brand-eyebrow">{roleLabel(role)}</p>
                  {role === "ADMIN" ? (
                    <Badge variant="outline">Admin</Badge>
                  ) : null}
                </div>
                <h1 className="mt-1 truncate font-display text-4xl leading-tight">
                  {name}
                </h1>
                <p className="mt-1 text-muted-foreground text-sm">
                  @{username}
                </p>
                {headline ? (
                  <p className="mt-2 max-w-md text-sm">{headline}</p>
                ) : null}
              </div>
            </div>
            <ProfileLinkButton username={username} />
          </div>

          {interests.length > 0 ? (
            <ul aria-label="Interesses" className="mt-5 flex flex-wrap gap-2">
              {interests.map((interest) => (
                <li key={interest}>
                  <Badge
                    className="rounded-none font-normal"
                    variant="secondary"
                  >
                    {interest}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : null}

          <dl className="mt-6 flex flex-wrap gap-x-9 gap-y-3 border-border border-t pt-4">
            <div className="flex items-baseline gap-2">
              <dd className="font-data text-xl">{completedLessons}</dd>
              <dt className="text-muted-foreground text-sm">
                aulas concluídas
              </dt>
            </div>
            <div className="flex items-baseline gap-2">
              <dd className="font-data text-xl">{enrollments}</dd>
              <dt className="text-muted-foreground text-sm">cursos</dt>
            </div>
            <div className="flex items-baseline gap-2">
              <dd className="font-data text-xl">{topicCount}</dd>
              <dt className="text-muted-foreground text-sm">tópicos</dt>
            </div>
          </dl>
        </section>

        <nav
          aria-label="Seções do perfil"
          className="hidden border-border border-b md:block"
        >
          <ul className="flex gap-7">
            {tabs.map((tab) => {
              const active = pathname === tab.href;
              return (
                <li key={tab.href}>
                  <IntentLink
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-12 items-center border-b-2 px-1 text-sm transition-colors ${active ? "border-brand-structural font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    href={tab.href}
                  >
                    {tab.label}
                  </IntentLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="pt-5 md:pt-7">{children}</main>
      </div>
    </div>
  );
};

export { ProfileShell };
