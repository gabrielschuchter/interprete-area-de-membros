"use client";

import { useClerk } from "@repo/auth/client";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { toast } from "@repo/design-system/lib/toast";
import {
  ArrowLeftIcon,
  BookOpenIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  LayoutDashboardIcon,
  LockKeyholeIcon,
  type LucideIcon,
  MenuIcon,
  MessageCircleIcon,
  PlusIcon,
  Settings2Icon,
  UsersRoundIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  isGestaoShellPath,
  safeGestaoReturnPath,
  withGestaoReturnPath,
} from "@/lib/gestao-navigation";
import type { GestaoRole } from "@/lib/gestao-permissions";
import { MemberHeaderControls } from "../components/member-header-controls";

interface GestaoShellProperties {
  readonly avatarUrl: string | null;
  readonly children: ReactNode;
  readonly displayName: string;
  readonly email: string | null;
  readonly localQaAuth: boolean;
  readonly memberId: string;
  readonly role: GestaoRole;
}

interface GestaoShellViewProperties extends GestaoShellProperties {
  readonly signOut?: ReturnType<typeof useClerk>["signOut"];
}

interface NavigationItem {
  readonly admin: boolean;
  readonly children?: readonly {
    readonly href: string;
    readonly label: string;
  }[];
  readonly href: string;
  readonly icon: LucideIcon;
  readonly label: string;
}

const navigation: readonly NavigationItem[] = [
  {
    href: "/gestao",
    icon: LayoutDashboardIcon,
    label: "Visão geral",
    admin: false,
  },
  {
    href: "/gestao/ensino",
    icon: BookOpenIcon,
    label: "Ensino",
    admin: false,
    children: [
      { href: "/gestao/ensino/cursos", label: "Cursos e percursos" },
      { href: "/gestao/ensino/exercicios", label: "Exercícios" },
      { href: "/gestao/ensino/atividades", label: "Atividades" },
      { href: "/gestao/ensino/biblioteca", label: "Biblioteca" },
      { href: "/gestao/ensino/colecoes", label: "Coleções" },
    ],
  },
  {
    href: "/gestao/alunos",
    icon: UsersRoundIcon,
    label: "Alunos",
    admin: false,
    children: [
      { href: "/gestao/alunos/turmas", label: "Turmas" },
      { href: "/gestao/alunos/correcoes", label: "Correções" },
    ],
  },
  {
    href: "/gestao/comunidade",
    icon: MessageCircleIcon,
    label: "Comunidade",
    admin: false,
  },
  {
    href: "/gestao/administracao",
    icon: Settings2Icon,
    label: "Administração",
    admin: true,
  },
] as const;

const createActions = [
  { href: "/gestao/ensino/cursos/novo", label: "Novo curso" },
  { href: "/gestao/alunos/turmas/nova", label: "Nova turma" },
  { href: "/gestao/alunos/atribuicoes/nova", label: "Atribuir conteúdo" },
  { href: "/gestao/comunidade/avisos/novo", label: "Novo aviso" },
] as const;

const gestaoWhitespacePattern = /\s+/;

const initialsFor = (value: string) =>
  value
    .trim()
    .split(gestaoWhitespacePattern)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "I";

const isActivePath = (pathname: string, href: string) =>
  href === "/gestao"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

interface GestaoNavigationEntryProperties {
  readonly item: NavigationItem;
  readonly onNavigate: () => void;
  readonly pathname: string;
  readonly returnTo: string;
  readonly role: GestaoRole;
}

const GestaoNavigationEntry = ({
  item,
  onNavigate,
  pathname,
  returnTo,
  role,
}: GestaoNavigationEntryProperties) => {
  const active = isActivePath(pathname, item.href);
  const isLocked = item.admin && role !== "ADMIN";
  let TrailingIcon: LucideIcon | null = null;

  if (isLocked) {
    TrailingIcon = LockKeyholeIcon;
  } else if (item.children) {
    if (active) {
      TrailingIcon = ChevronDownIcon;
    } else {
      TrailingIcon = ChevronRightIcon;
    }
  } else if (item.href !== "/gestao") {
    TrailingIcon = ChevronRightIcon;
  }

  return (
    <div className="gestao-navigation-group">
      <Link
        aria-current={pathname === item.href ? "page" : undefined}
        aria-label={isLocked ? `${item.label}, acesso restrito` : item.label}
        className="gestao-navigation-link"
        data-active={String(active)}
        data-locked={String(isLocked)}
        href={withGestaoReturnPath(item.href, returnTo)}
        onClick={onNavigate}
        title={item.label}
      >
        <item.icon aria-hidden="true" className="gestao-navigation-icon" />
        <span className="gestao-navigation-label">{item.label}</span>
        {TrailingIcon ? (
          <TrailingIcon
            aria-hidden="true"
            className="gestao-navigation-trailing"
          />
        ) : null}
      </Link>
      {active && item.children ? (
        <ul
          aria-label={`Páginas de ${item.label}`}
          className="gestao-navigation-children"
        >
          {item.children.map((child) => {
            const childActive = isActivePath(pathname, child.href);
            return (
              <li key={child.href}>
                <Link
                  aria-current={childActive ? "page" : undefined}
                  className="gestao-navigation-child"
                  data-active={String(childActive)}
                  href={withGestaoReturnPath(child.href, returnTo)}
                  onClick={onNavigate}
                >
                  {child.label}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};
const GestaoShellView = ({
  avatarUrl,
  children,
  displayName,
  email,
  localQaAuth,
  memberId,
  role,
  signOut,
}: GestaoShellViewProperties) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const leaveTimer = useRef<number | null>(null);
  const rawReturnTo = searchParams.get("from");
  const returnTo = safeGestaoReturnPath(rawReturnTo);
  const heading =
    navigation.find((item) => isActivePath(pathname, item.href))?.label ??
    "Gestão";
  const isPathDetail = pathname.startsWith("/gestao/ensino/cursos/percursos/");
  const isCoursesIndex = pathname === "/gestao/ensino/cursos";

  useEffect(() => {
    try {
      if (
        window.localStorage.getItem(
          `interprete:gestao:welcome:v1:${memberId}`
        ) !== "seen"
      ) {
        setWelcomeOpen(true);
      }
    } catch {
      setWelcomeOpen(true);
    }
    return () => {
      if (leaveTimer.current !== null) {
        window.clearTimeout(leaveTimer.current);
      }
    };
  }, [memberId]);

  const dismissWelcome = useCallback(() => {
    try {
      window.localStorage.setItem(
        `interprete:gestao:welcome:v1:${memberId}`,
        "seen"
      );
    } catch {
      // The dialog still closes if browser storage is unavailable.
    }
    setWelcomeOpen(false);
  }, [memberId]);

  const leaveGestaoFor = useCallback(
    (href: string) => {
      if (leaveTimer.current !== null) {
        window.clearTimeout(leaveTimer.current);
      }
      setIsLeaving(true);
      setMobileMenuOpen(false);
      const reducedMotion = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      const duration = reducedMotion ? 0 : 160;
      leaveTimer.current = window.setTimeout(() => {
        router.push(href);
      }, duration);
    },
    [router]
  );

  const handleShellNavigation = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }
      let destination: URL;
      try {
        destination = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (
        destination.origin === window.location.origin &&
        isGestaoShellPath(pathname) &&
        !isGestaoShellPath(destination.pathname)
      ) {
        event.preventDefault();
        leaveGestaoFor(
          `${destination.pathname}${destination.search}${destination.hash}`
        );
      }
    },
    [leaveGestaoFor, pathname]
  );

  const handleSignOut = async () => {
    if (localQaAuth || !signOut) {
      return;
    }
    setIsSigningOut(true);
    try {
      await signOut({ redirectUrl: "/sign-in" });
    } catch {
      toast.error("Não foi possível encerrar a sessão. Tente novamente.");
      setIsSigningOut(false);
    }
  };
  const signedOutLabel = isSigningOut ? "Saindo…" : "Sair";
  const signOutLabel = localQaAuth ? "Sair (sessão QA fixa)" : signedOutLabel;
  const gestaoHref = (href: string) => withGestaoReturnPath(href, returnTo);

  return (
    <div
      className="gestao-shell"
      data-menu-open={String(mobileMenuOpen)}
      data-transition-out={String(isLeaving)}
      onClickCapture={handleShellNavigation}
    >
      {mobileMenuOpen ? (
        <button
          aria-label="Fechar navegação da Gestão"
          className="gestao-mobile-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          type="button"
        />
      ) : null}
      <aside className="gestao-sidebar">
        <div className="gestao-sidebar-brand">
          <Link
            aria-label="Interprete, visão geral da Gestão"
            className="gestao-brand"
            href={gestaoHref("/gestao")}
          >
            <span className="gestao-brand-word">Interprete.</span>
            <span className="gestao-brand-kicker">Gestão</span>
          </Link>
          <button
            aria-label="Fechar menu"
            className="gestao-close-menu"
            onClick={() => setMobileMenuOpen(false)}
            type="button"
          >
            <XIcon aria-hidden="true" />
          </button>
        </div>
        <nav
          aria-label="Navegação da Gestão"
          className="gestao-navigation"
          id="gestao-navigation"
        >
          {navigation.map((item) => (
            <GestaoNavigationEntry
              item={item}
              key={item.href}
              onNavigate={() => setMobileMenuOpen(false)}
              pathname={pathname}
              returnTo={returnTo}
              role={role}
            />
          ))}
        </nav>
        <div className="gestao-sidebar-spacer" />
        <Link
          className="gestao-back-link"
          href={returnTo}
          onClick={() => setMobileMenuOpen(false)}
        >
          <ArrowLeftIcon aria-hidden="true" />
          <span>Voltar à área de membros</span>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={`Abrir menu da conta de ${displayName}`}
              className="gestao-account"
              type="button"
            >
              <Avatar className="gestao-account-avatar">
                <AvatarImage alt="" src={avatarUrl ?? undefined} />
                <AvatarFallback>{initialsFor(displayName)}</AvatarFallback>
              </Avatar>
              <span className="gestao-account-copy">
                <span className="gestao-account-name">{displayName}</span>
                <span className="gestao-account-role">
                  {role === "ADMIN" ? "Administração" : "Professor"}
                </span>
              </span>
              <ChevronRightIcon
                aria-hidden="true"
                className="gestao-account-chevron"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56" side="top">
            <DropdownMenuLabel>
              {displayName}
              {email ? (
                <span className="block font-normal text-muted-foreground">
                  {email}
                </span>
              ) : null}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/perfil">Meu perfil</Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={isSigningOut || localQaAuth}
              onSelect={handleSignOut}
            >
              {signOutLabel}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </aside>
      <div
        aria-hidden={isLeaving || undefined}
        className="gestao-main-column"
        inert={isLeaving || undefined}
      >
        <header className="gestao-topbar">
          <button
            aria-controls="gestao-navigation"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            className="gestao-mobile-menu-button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            type="button"
          >
            <MenuIcon aria-hidden="true" />
          </button>
          <div className="gestao-topbar-context">
            {pathname.startsWith("/gestao/ensino/cursos") ? (
              <nav
                aria-label="Caminho da página"
                className="gestao-topbar-breadcrumb"
              >
                <Link href="/gestao">Gestão</Link>
                <span aria-hidden="true">›</span>
                <Link href="/gestao/ensino/cursos">Ensino</Link>
                {isPathDetail && (
                  <>
                    <span aria-hidden="true">›</span>
                    <Link href="/gestao/ensino/cursos">Cursos e percursos</Link>
                    <span aria-hidden="true">›</span>
                    <span aria-current="page">Percursos</span>
                  </>
                )}
                {isCoursesIndex && (
                  <>
                    <span aria-hidden="true">›</span>
                    <span aria-current="page">Cursos e percursos</span>
                  </>
                )}
              </nav>
            ) : (
              <span className="gestao-topbar-section">{heading}</span>
            )}
            {pathname.startsWith("/gestao/ensino/cursos") ? (
              <span className="gestao-topbar-mobile-section">{heading}</span>
            ) : null}
          </div>
          <div className="gestao-topbar-actions">
            <MemberHeaderControls memberId={memberId} showSaved={false} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="gestao-create-button" size="sm">
                  <PlusIcon aria-hidden="true" />
                  <span>Criar</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-52">
                <DropdownMenuLabel>Criar em Gestão</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {createActions.map((item) => (
                  <DropdownMenuItem asChild key={item.href}>
                    <Link href={withGestaoReturnPath(item.href, returnTo)}>
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <div className="gestao-page-scroll">
          <main className="gestao-page-content" id="gestao-main-content">
            {children}
          </main>
        </div>
      </div>
      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            dismissWelcome();
          }
        }}
        open={welcomeOpen}
      >
        <DialogContent className="gestao-welcome-dialog">
          <DialogHeader>
            <p className="gestao-eyebrow">Interprete · Gestão</p>
            <DialogTitle className="gestao-welcome-title">
              Seu espaço de ensino, em um só lugar.
            </DialogTitle>
            <DialogDescription>
              Aqui você acompanha turmas, organiza conteúdos e cuida da
              comunidade. As permissões da sua conta definem quais áreas
              aparecem para você.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={dismissWelcome}>Começar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ClerkGestaoShell = (
  properties: Omit<GestaoShellProperties, "localQaAuth">
) => {
  const { signOut } = useClerk();
  return (
    <GestaoShellView {...properties} localQaAuth={false} signOut={signOut} />
  );
};

export const GestaoShell = ({
  localQaAuth,
  ...properties
}: GestaoShellProperties) =>
  localQaAuth ? (
    <GestaoShellView {...properties} localQaAuth />
  ) : (
    <ClerkGestaoShell {...properties} />
  );

export const GestaoPageHeading = ({
  eyebrow,
  title,
  description,
  children,
}: {
  readonly eyebrow?: string;
  readonly title: string;
  readonly description?: string;
  readonly children?: ReactNode;
}) => (
  <div className="gestao-page-heading">
    <div>
      {eyebrow ? <p className="gestao-eyebrow">{eyebrow}</p> : null}
      <h1>{title}</h1>
      {description ? (
        <p className="gestao-page-description">{description}</p>
      ) : null}
    </div>
    {children ? (
      <div className="gestao-page-heading-actions">{children}</div>
    ) : null}
  </div>
);
