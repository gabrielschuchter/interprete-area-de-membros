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
  withGestaoReturnPath,
} from "@/lib/gestao-navigation";
import type { GestaoRole } from "@/lib/gestao-permissions";
import { MemberHeaderControls } from "../components/member-header-controls";
import { useMemberNavigation } from "../components/member-navigation-context";
import { GestaoSearch } from "./gestao-search";
import { useGestaoReturnPath } from "./use-gestao-return-path";

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
      { href: "/gestao/alunos/acompanhamento", label: "Acompanhamento" },
      { href: "/gestao/alunos/correcoes", label: "Correções" },
      { href: "/gestao/alunos/atribuicoes", label: "Atribuições" },
      { href: "/gestao/alunos/tarefas", label: "Tarefas e metas" },
      { href: "/gestao/alunos/reconhecimento", label: "Reconhecimento" },
    ],
  },
  {
    href: "/gestao/comunidade",
    icon: MessageCircleIcon,
    label: "Comunidade",
    admin: false,
    children: [
      { href: "/gestao/comunidade/publicacoes", label: "Publicações" },
      { href: "/gestao/comunidade/avisos", label: "Avisos" },
      { href: "/gestao/comunidade/encontros", label: "Encontros" },
    ],
  },
  {
    href: "/gestao/administracao",
    icon: Settings2Icon,
    label: "Administração",
    admin: true,
    children: [
      { href: "/gestao/administracao/membros", label: "Membros e papéis" },
      { href: "/gestao/administracao/acessos", label: "Acessos" },
      {
        href: "/gestao/administracao/gravacoes-historicas",
        label: "Gravações históricas",
      },
      {
        href: "/gestao/administracao/personalizacao",
        label: "Personalização",
      },
      { href: "/gestao/administracao/medalhas", label: "Medalhas" },
    ],
  },
] as const;

const createActions = [
  { href: "/gestao/ensino/cursos/novo", label: "Curso" },
  { href: "/gestao/ensino/exercicios", label: "Lista de exercícios" },
  { href: "/gestao/ensino/atividades/nova", label: "Atividade" },
  { href: "/gestao/ensino/biblioteca/novo", label: "Material" },
  { href: "/gestao/ensino/colecoes/novo", label: "Coleção" },
  { href: "/gestao/alunos/turmas/nova", label: "Turma" },
  { href: "/gestao/alunos/atribuicoes", label: "Atribuição" },
  { href: "/gestao/comunidade/avisos", label: "Aviso" },
  { href: "/gestao/comunidade/encontros", label: "Encontro" },
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

interface GestaoBreadcrumbItem {
  readonly current: boolean;
  readonly href: string;
  readonly label: string;
}

const gestaoBreadcrumb = (pathname: string): GestaoBreadcrumbItem[] => {
  const area = navigation.find(
    (item) => item.href !== "/gestao" && isActivePath(pathname, item.href)
  );
  if (!area) {
    return [];
  }
  const section = area.children?.find((child) =>
    isActivePath(pathname, child.href)
  );
  if (!section) {
    return [
      { current: pathname === area.href, href: area.href, label: area.label },
    ];
  }
  const crumbs: GestaoBreadcrumbItem[] = [
    { current: false, href: area.href, label: area.label },
    {
      current: pathname === section.href,
      href: section.href,
      label: section.label,
    },
  ];
  if (pathname.startsWith("/gestao/ensino/cursos/percursos/")) {
    crumbs.push({ current: true, href: pathname, label: "Percursos" });
  }
  return crumbs;
};

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
  const [railOpen, setRailOpen] = useState(false);
  const hoverOpened = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = () => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    if (!hoverOpened.current) {
      return;
    }
    cancelClose();
    closeTimer.current = setTimeout(() => setRailOpen(false), 150);
  };
  useEffect(() => {
    const rail = window.matchMedia(
      "(min-width: 1024px) and (max-width: 1279px)"
    );
    const closeOutsideRail = () => {
      if (!rail.matches) {
        setRailOpen(false);
      }
    };
    rail.addEventListener("change", closeOutsideRail);
    return () => {
      rail.removeEventListener("change", closeOutsideRail);
      if (closeTimer.current !== null) {
        clearTimeout(closeTimer.current);
      }
    };
  }, []);
  const isLocked = item.admin && role !== "ADMIN";
  const childItems = isLocked ? undefined : item.children;
  let TrailingIcon: LucideIcon | null = null;

  if (isLocked) {
    TrailingIcon = LockKeyholeIcon;
  } else if (childItems) {
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
        data-has-children={Boolean(childItems)}
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
      {childItems ? (
        <DropdownMenu modal={false} onOpenChange={setRailOpen} open={railOpen}>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={`Abrir páginas de ${item.label}`}
              className="gestao-navigation-link gestao-rail-trigger"
              data-active={String(active)}
              onKeyDown={() => {
                cancelClose();
                hoverOpened.current = false;
              }}
              onPointerDown={() => {
                cancelClose();
                hoverOpened.current = false;
              }}
              onPointerEnter={(event) => {
                if (event.pointerType === "mouse") {
                  cancelClose();
                  hoverOpened.current = true;
                  setRailOpen(true);
                }
              }}
              onPointerLeave={scheduleClose}
              type="button"
            >
              <item.icon
                aria-hidden="true"
                className="gestao-navigation-icon"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="gestao-rail-submenu"
            onCloseAutoFocus={(event) => {
              if (hoverOpened.current) {
                event.preventDefault();
              }
            }}
            onPointerEnter={cancelClose}
            onPointerLeave={scheduleClose}
            side="right"
            sideOffset={10}
          >
            <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
            {childItems.map((child) => (
              <DropdownMenuItem asChild key={child.href}>
                <Link
                  aria-current={
                    isActivePath(pathname, child.href) ? "page" : undefined
                  }
                  href={withGestaoReturnPath(child.href, returnTo)}
                  onClick={() => {
                    setRailOpen(false);
                    onNavigate();
                  }}
                  prefetch={false}
                >
                  {child.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {active && childItems ? (
        <ul
          aria-label={`Páginas de ${item.label}`}
          className="gestao-navigation-children"
        >
          {childItems.map((child) => {
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
  const [isSigningOut, setIsSigningOut] = useState(false);
  const mobileMenuTrigger = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const rawReturnTo = searchParams.get("from");
  const returnTo = useGestaoReturnPath(memberId, rawReturnTo);
  const memberNavigation = useMemberNavigation();
  const heading =
    navigation.find((item) => isActivePath(pathname, item.href))?.label ??
    "Gestão";
  const breadcrumb = gestaoBreadcrumb(pathname);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) {
        setMobileMenuOpen(false);
      }
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

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
      setMobileMenuOpen(false);
      if (memberNavigation?.navigateShell) {
        memberNavigation.navigateShell(href);
      } else {
        router.push(href);
      }
    },
    [memberNavigation, router]
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

  const sidebarContent = (
    <>
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
      <nav aria-label="Navegação da Gestão" className="gestao-navigation">
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
        aria-label="Voltar à área de membros"
        className="gestao-back-link"
        href={returnTo}
        onClick={() => setMobileMenuOpen(false)}
        title="Voltar à área de membros"
      >
        <ArrowLeftIcon aria-hidden="true" />
        <span>Voltar à área de membros</span>
      </Link>
      <DropdownMenu modal={false}>
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
        <DropdownMenuContent
          align="end"
          className="min-w-56"
          onEscapeKeyDown={(event) => event.stopPropagation()}
          side="top"
        >
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
    </>
  );

  return (
    <div className="gestao-shell" onClickCapture={handleShellNavigation}>
      <aside className="gestao-sidebar" ref={sidebar}>
        {sidebarContent}
      </aside>
      <Dialog onOpenChange={setMobileMenuOpen} open={mobileMenuOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="gestao-drawer translate-x-0 translate-y-0"
          id="gestao-mobile-navigation"
          onClickCapture={handleShellNavigation}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (window.matchMedia("(max-width: 1023px)").matches) {
              mobileMenuTrigger.current?.focus();
            } else {
              sidebar.current
                ?.querySelector<HTMLElement>(
                  "[aria-current='page'], .gestao-navigation-link"
                )
                ?.focus();
            }
          }}
          overlayClassName="gestao-drawer-overlay"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Menu da Gestão</DialogTitle>
          {sidebarContent}
        </DialogContent>
      </Dialog>
      <div className="gestao-main-column">
        <header className="gestao-topbar">
          <button
            aria-controls="gestao-mobile-navigation"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            className="gestao-mobile-menu-button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            ref={mobileMenuTrigger}
            type="button"
          >
            <MenuIcon aria-hidden="true" />
          </button>
          <div className="gestao-topbar-context">
            {breadcrumb.length > 0 ? (
              <nav
                aria-label="Caminho da página"
                className="gestao-topbar-breadcrumb"
              >
                <Link href="/gestao">Gestão</Link>
                {breadcrumb.map((crumb) => (
                  <span className="contents" key={crumb.href}>
                    <span aria-hidden="true">›</span>
                    {crumb.current ? (
                      <span aria-current="page">{crumb.label}</span>
                    ) : (
                      <Link href={crumb.href}>{crumb.label}</Link>
                    )}
                  </span>
                ))}
              </nav>
            ) : (
              <span className="gestao-topbar-section">{heading}</span>
            )}
            {breadcrumb.length > 0 ? (
              <span className="gestao-topbar-mobile-section">{heading}</span>
            ) : null}
          </div>
          <div className="gestao-topbar-actions">
            <GestaoSearch memberId={memberId} />
            <MemberHeaderControls
              memberId={memberId}
              showSaved={false}
              showSearch={false}
            />
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
        <DialogContent
          className="gestao-welcome-dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const heading = document.querySelector<HTMLElement>(
              "#gestao-main-content h1"
            );
            heading?.setAttribute("tabindex", "-1");
            heading?.focus({ preventScroll: true });
          }}
        >
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
