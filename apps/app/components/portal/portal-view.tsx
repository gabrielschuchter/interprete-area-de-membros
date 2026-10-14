"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  LibraryBig,
  ListChecks,
  type LucideIcon,
  MessageCircle,
  Settings,
  Target,
  UserRound,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import { type ReactNode, useEffect, useState } from "react";
import { IntentLink } from "@/app/(authenticated)/components/intent-link";
import { MemberHeaderControls } from "@/app/(authenticated)/components/member-header-controls";
import { useMemberNavigation } from "@/app/(authenticated)/components/member-navigation-context";
import { MemberSidebarControl } from "@/app/(authenticated)/components/member-sidebar-control";
import { usePortalViewport } from "@/app/(authenticated)/components/use-portal-viewport";

interface PortalShortcut {
  readonly href: string;
  readonly icon: LucideIcon;
  readonly label: string;
}

const studyShortcuts: readonly PortalShortcut[] = [
  { href: "/aprender", icon: BookOpen, label: "Cursos" },
  { href: "/exercicios", icon: ListChecks, label: "Exercícios" },
  { href: "/atividades", icon: ClipboardCheck, label: "Atividades" },
  { href: "/biblioteca", icon: LibraryBig, label: "Biblioteca" },
  { href: "/planejamento", icon: Target, label: "Planejamento" },
  { href: "/ferramentas", icon: Settings, label: "Ferramentas" },
];

const communityShortcuts: readonly PortalShortcut[] = [
  { href: "/comunidade", icon: MessageCircle, label: "Discussões" },
  { href: "/encontros", icon: CalendarDays, label: "Encontros" },
  { href: "/comunidade/grupos", icon: UsersRound, label: "Grupos de estudo" },
  { href: "/comunidade/meus-topicos", icon: UserRound, label: "Meus tópicos" },
];

const whitespacePattern = /\s+/;
const ignoreImageError = () => undefined;
const ignoreImageReady = (_imageId: string) => undefined;

const firstNameOf = (name: string) =>
  name.trim().split(whitespacePattern).filter(Boolean)[0] ?? "Membro";

const PortalArc = ({
  children,
  community = false,
}: {
  readonly children: ReactNode;
  readonly community?: boolean;
}) => {
  const href = community ? "/comunidade" : "/estudar";
  const label = community ? "Comunidade" : "Estudar";

  return (
    <IntentLink
      aria-label={label}
      className={`portal-arc portal-arc--${community ? "community" : "study"}`}
      data-portal-arc="true"
      data-portal-corridor={community ? "comunidade" : "estudar"}
      href={href}
    >
      {children}
    </IntentLink>
  );
};

const PortalArcLabel = ({ label }: { readonly label: string }) => (
  <span className="portal-arc__content">
    <span className="portal-arc__title">{label}</span>
    <span aria-hidden="true" className="portal-arc__rule" />
  </span>
);

const ShortcutGroup = ({
  card = false,
  items,
  label,
}: {
  readonly card?: boolean;
  readonly items: readonly PortalShortcut[];
  readonly label: string;
}) => (
  <nav
    aria-label={card ? `Atalhos para ${label}` : label}
    className="portal-shortcut-group"
  >
    <ul className="portal-shortcut-group__list">
      {items.map(({ href, icon: Icon, label: itemLabel }) => (
        <li key={href}>
          <IntentLink
            className="portal-shortcut"
            data-portal-shortcut="true"
            href={href}
          >
            <Icon aria-hidden="true" className="portal-shortcut__icon" />
            <span>{itemLabel}</span>
          </IntentLink>
        </li>
      ))}
    </ul>
  </nav>
);

const MobilePortalCard = ({
  community = false,
  imageFailed,
  onImageError,
  onImageReady,
  showImage,
}: {
  readonly community?: boolean;
  readonly imageFailed: boolean;
  readonly onImageError: () => void;
  readonly onImageReady: (imageId: string) => void;
  readonly showImage: boolean;
}) => {
  const label = community ? "Comunidade" : "Estudar";
  const image = community
    ? {
        height: 432,
        id: "mobile-comunidade",
        src: "/portal/mobile-comunidade-fc58e6afaa.webp",
        width: 838,
      }
    : {
        height: 424,
        id: "mobile-estudar",
        src: "/portal/mobile-estudar-3979b5ac.webp",
        width: 838,
      };

  return (
    <article className="portal-mobile-card">
      <PortalArc community={community}>
        {imageFailed || !showImage ? null : (
          <Image
            alt=""
            className="portal-arc__mobile-art"
            decoding="async"
            fetchPriority="high"
            height={image.height}
            onError={onImageError}
            onLoad={() => onImageReady(image.id)}
            priority
            sizes="(max-width: 699px) calc(100vw - 40px), (max-height: 520px) calc((100vw - 60px) / 2)"
            src={image.src}
            unoptimized
            width={image.width}
          />
        )}
        <PortalArcLabel label={label} />
      </PortalArc>
      <ShortcutGroup
        card
        items={community ? communityShortcuts : studyShortcuts}
        label={label}
      />
    </article>
  );
};

const ShortcutRail = ({
  items,
  label,
  side,
}: {
  readonly items: readonly PortalShortcut[];
  readonly label: string;
  readonly side: "left" | "right";
}) => (
  <nav
    aria-label={`Atalhos para ${label}`}
    className={`portal-shortcut-rail portal-shortcut-rail--${side}`}
  >
    <ul>
      {items.map(({ href, icon: Icon, label: itemLabel }) => (
        <li key={href}>
          <IntentLink
            className="portal-shortcut"
            data-portal-shortcut="true"
            href={href}
          >
            <Icon aria-hidden="true" className="portal-shortcut__icon" />
            <span>{itemLabel}</span>
          </IntentLink>
        </li>
      ))}
    </ul>
  </nav>
);

export const PortalView = () => {
  const navigation = useMemberNavigation();
  const viewport = usePortalViewport();
  const [online, setOnline] = useState(true);
  const [intro, setIntro] = useState(false);
  const imageFailed = navigation?.imageFailed ?? false;
  const imageReady = navigation?.imageReady ?? false;

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useEffect(() => {
    if (!(imageReady || imageFailed)) {
      return;
    }
    try {
      const key = "interprete:portal-b2:intro:v1";
      if (!window.sessionStorage.getItem(key)) {
        setIntro(true);
        window.sessionStorage.setItem(key, "1");
      }
    } catch {
      setIntro(true);
    }
  }, [imageFailed, imageReady]);

  const firstName = firstNameOf(navigation?.displayName ?? "Membro");
  const activeTransition = navigation?.transition ?? null;
  const mobileCards = viewport === "mobile" || viewport === "landscape";

  return (
    <div
      className="portal"
      data-art-failed={String(imageFailed)}
      data-intro={String(intro)}
      data-transition-kind={activeTransition?.kind}
      data-transition-phase={activeTransition?.phase}
      data-transition-side={activeTransition?.corridor ?? undefined}
      data-viewport={viewport ?? "pending"}
    >
      <header className="portal-header">
        <div className="portal-header__brand">
          <MemberSidebarControl className="portal-header__menu" mode="drawer" />
          <span className="portal-header__wordmark">Interprete.</span>
        </div>
        {navigation?.memberId ? (
          <MemberHeaderControls memberId={navigation.memberId} showSaved />
        ) : null}
      </header>

      <main className="portal-main">
        <div className="portal-intro">
          <p className="portal-greeting">Olá, {firstName}.</p>
          <h1>
            Por qual <span className="portal-title-accent">caminho</span> você
            quer seguir hoje?
          </h1>
        </div>

        {online ? null : (
          <output className="portal-status">
            Você está sem conexão. Os atalhos seguem disponíveis e a página de
            destino será aberta quando a rede responder.
          </output>
        )}

        {navigation?.navigationFailure ? (
          <div className="portal-error" role="alert">
            <p>
              Não foi possível abrir esse destino. Confira sua conexão e tente
              novamente.
            </p>
            <div className="portal-error__actions">
              <Button
                onClick={navigation.retryNavigation}
                size="sm"
                variant="secondary"
              >
                Tentar novamente
              </Button>
              <IntentLink className="portal-error__home" href="/">
                Início
              </IntentLink>
            </div>
          </div>
        ) : null}

        <section aria-label="Escolha um caminho" className="portal-discovery">
          <div className="portal-stage" data-art-failed={String(imageFailed)}>
            <PortalArc>
              <PortalArcLabel label="Estudar" />
            </PortalArc>
            <PortalArc community>
              <PortalArcLabel label="Comunidade" />
            </PortalArc>
          </div>
          <ShortcutRail items={studyShortcuts} label="Estudar" side="left" />
          <div
            className="portal-mobile-cards"
            data-art-failed={String(imageFailed)}
          >
            <MobilePortalCard
              imageFailed={imageFailed}
              onImageError={navigation?.onPortalImageError ?? ignoreImageError}
              onImageReady={navigation?.onPortalImageReady ?? ignoreImageReady}
              showImage={mobileCards}
            />
            <MobilePortalCard
              community
              imageFailed={imageFailed}
              onImageError={navigation?.onPortalImageError ?? ignoreImageError}
              onImageReady={navigation?.onPortalImageReady ?? ignoreImageReady}
              showImage={mobileCards}
            />
          </div>
          <div className="portal-shortcut-groups">
            <ShortcutGroup items={studyShortcuts} label="Estudar" />
            <ShortcutGroup items={communityShortcuts} label="Comunidade" />
          </div>
          <ShortcutRail
            items={communityShortcuts}
            label="Comunidade"
            side="right"
          />
          {imageFailed ? (
            <p className="portal-art-fallback">
              A arte não carregou. Os caminhos continuam disponíveis.
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
};
