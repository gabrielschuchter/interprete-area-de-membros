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
  if (role === "ADMIN") {
    return "Admin";
  }
  return null;
};

const tabs = [
  { href: "/perfil", label: "Visão geral" },
  { href: "/perfil/conquistas", label: "Conquistas" },
  { href: "/perfil/editar", label: "Editar perfil" },
] as const;

const profileMainSpacing = (pathname: string) => {
  if (pathname === "/perfil/editar") {
    return "pt-2 md:pt-0";
  }
  if (pathname === "/perfil/conquistas") {
    return "pt-6 md:pt-10";
  }
  return "pt-5 md:pt-10";
};

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
      <div
        className={`mx-auto w-full max-w-[760px] px-5 sm:px-8 md:px-12 md:pt-12 md:pb-[120px] ${isDetail ? "pt-0" : "pt-6"} ${isEditing ? "pb-14" : "pb-12"}`}
      >
        {isDetail ? (
          <div className="profile-mobile-back md:hidden">
            <Button
              asChild
              className="profile-mobile-back__button shadow-none"
              size="default"
              variant="ghost"
            >
              <IntentLink href="/perfil">
                <ArrowLeftIcon aria-hidden="true" />
                <span className="sr-only">Voltar para o perfil</span>
              </IntentLink>
            </Button>
            <h1 className="profile-mobile-back__title">
              {isAchievements ? "Conquistas" : "Editar perfil"}
            </h1>
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
                <h1 className="truncate font-display text-3xl leading-tight">
                  {name}
                </h1>
                <p className="truncate text-muted-foreground text-sm">
                  @{username}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              {headline ? (
                <p className="text-muted-foreground">{headline}</p>
              ) : null}
              {roleLabel(role) ? (
                <Badge
                  className="rounded-sm uppercase tracking-[0.1em]"
                  variant="outline"
                >
                  {roleLabel(role)}
                </Badge>
              ) : null}
            </div>
            {interests.length > 0 ? (
              <p className="mt-3 text-sm leading-6">{interests.join(" · ")}</p>
            ) : null}
            <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <div className="flex items-baseline gap-1">
                <dd className="font-semibold">{completedLessons}</dd>
                <dt className="text-muted-foreground">aulas concluídas</dt>
              </div>
              <div className="flex items-baseline gap-1">
                <dd className="font-semibold">{enrollments}</dd>
                <dt className="text-muted-foreground">cursos</dt>
              </div>
              <div className="flex items-baseline gap-1">
                <dd className="font-semibold">{topicCount}</dd>
                <dt className="text-muted-foreground">tópicos</dt>
              </div>
            </dl>
            <Button asChild className="mt-5 w-full shadow-none" size="default">
              <IntentLink href="/perfil/editar">
                <PencilIcon aria-hidden="true" /> Editar perfil
              </IntentLink>
            </Button>
          </section>
        )}

        <section aria-label="Identidade do perfil" className="hidden md:block">
          <div className="flex items-start justify-between gap-5">
            <div className="flex min-w-0 items-center gap-5">
              <Avatar className="size-20 shrink-0">
                {avatarUrl ? <AvatarImage alt="" src={avatarUrl} /> : null}
                <AvatarFallback className="bg-brand-structural text-primary-foreground">
                  {initials(name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h1 className="truncate font-display text-[2rem] leading-tight">
                  {name}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="font-data text-muted-foreground text-xs">
                    @{username}
                  </span>
                  {headline ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="text-muted-foreground"
                      >
                        ·
                      </span>
                      <span className="text-muted-foreground">{headline}</span>
                    </>
                  ) : null}
                  {roleLabel(role) ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="text-muted-foreground"
                      >
                        ·
                      </span>
                      <Badge
                        className="rounded-sm font-data text-[0.65rem] uppercase tracking-[0.1em]"
                        variant="outline"
                      >
                        {roleLabel(role)}
                      </Badge>
                    </>
                  ) : null}
                </div>
                {interests.length > 0 ? (
                  <p className="mt-2 max-w-md text-sm leading-6">
                    {interests.join(" · ")}
                  </p>
                ) : null}
              </div>
            </div>
            <Button asChild className="shrink-0 shadow-none" size="default">
              <IntentLink href="/perfil/editar">
                <PencilIcon aria-hidden="true" /> Editar perfil
              </IntentLink>
            </Button>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <div className="flex items-baseline gap-1.5">
                <dd className="font-semibold">{completedLessons}</dd>
                <dt className="text-muted-foreground">aulas concluídas</dt>
              </div>
              <div className="flex items-baseline gap-1.5">
                <dd className="font-semibold">{enrollments}</dd>
                <dt className="text-muted-foreground">cursos</dt>
              </div>
              <div className="flex items-baseline gap-1.5">
                <dd className="font-semibold">{topicCount}</dd>
                <dt className="text-muted-foreground">tópicos</dt>
              </div>
            </dl>
            <ProfileLinkButton username={username} />
          </div>
        </section>

        <nav
          aria-label="Seções do perfil"
          className="mt-7 hidden border-border border-b md:block"
        >
          <ul className="flex gap-7">
            {tabs.map((tab) => {
              const active = pathname === tab.href;
              return (
                <li key={tab.href}>
                  <IntentLink
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-12 items-center border-b-2 text-sm transition-colors ${active ? "border-brand-structural font-semibold text-brand-structural" : "border-transparent font-medium text-muted-foreground hover:text-foreground"}`}
                    href={tab.href}
                  >
                    {tab.label}
                  </IntentLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className={profileMainSpacing(pathname)}>{children}</main>
      </div>
    </div>
  );
};

export { ProfileShell };
