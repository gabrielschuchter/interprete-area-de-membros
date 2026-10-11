// biome-ignore-all lint/security/noDangerouslySetInnerHtml: reviewed build-time prototype markup; personalized text is escaped and links map through a fixed allowlist.
"use client";

import { useSidebar } from "@repo/design-system/components/ui/sidebar";
import { MenuIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useMemo, useRef } from "react";
import { MemberHeaderControls } from "@/app/(authenticated)/components/member-header-controls";
import type {
  PortalTransition,
  PortalTransitionGeometry,
} from "@/app/(authenticated)/components/member-navigation-context";
import { useMemberNavigation } from "@/app/(authenticated)/components/member-navigation-context";

interface PortalViewProperties {
  readonly markup: string;
  readonly notice: {
    readonly kind: "meeting" | "task";
    readonly title: string;
    readonly startsAt: string | null;
    readonly href: string;
    readonly timezone: string;
  } | null;
}

const routeByShortcut: Record<string, string> = {
  atividades: "/atividades",
  aprender: "/aprender",
  biblioteca: "/biblioteca",
  comunidade: "/comunidade",
  encontros: "/encontros",
  estudar: "/estudar",
  exercicios: "/exercicios",
  ferramentas: "/ferramentas",
  planejamento: "/planejamento",
  topicos: "/comunidade/meus-topicos",
};

const whitespacePattern = /\s+/;
const svgMarkupPattern = /<svg\b[\s\S]*?<\/svg>/gi;
const htmlTagPattern = /<[^>]+>/g;
const htmlNbspPattern = /&nbsp;/g;
const htmlAmpersandPattern = /&amp;/g;
const portalLinkPattern =
  /<a\b([^>]*\bdata-go="([^"]+)"[^>]*)>([\s\S]*?)<\/a>/gi;

const htmlEscape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const anchorText = (value: string) =>
  value
    .replace(svgMarkupPattern, " ")
    .replace(htmlTagPattern, " ")
    .replace(htmlNbspPattern, " ")
    .replace(htmlAmpersandPattern, "&")
    .replace(whitespacePattern, " ")
    .trim();

const mapPortalLinks = (source: string) =>
  source.replace(
    portalLinkPattern,
    (anchor, _attributes: string, shortcut: string, body: string) => {
      const href =
        shortcut === "comunidade" && anchorText(body) === "Grupos de estudo"
          ? "/comunidade/grupos"
          : (routeByShortcut[shortcut] ?? "/");
      return anchor.replace('href="#"', `href="${href}"`);
    }
  );

const portalNoticeText = (
  notice: NonNullable<PortalViewProperties["notice"]>
) => {
  if (!notice.startsAt) {
    return notice.kind === "meeting" ? "encontro próximo" : "tarefa próxima";
  }
  const date = new Date(notice.startsAt);
  const dayKey = (value: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: notice.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(value);
  const now = new Date();
  const today = dayKey(now);
  const todayParts = new Intl.DateTimeFormat("en-US", {
    timeZone: notice.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const readDatePart = (name: string) =>
    Number(todayParts.find((part) => part.type === name)?.value ?? 0);
  const tomorrowDate = new Date(
    Date.UTC(
      readDatePart("year"),
      readDatePart("month") - 1,
      readDatePart("day") + 1
    )
  );
  const tomorrow = `${tomorrowDate.getUTCFullYear()}-${String(tomorrowDate.getUTCMonth() + 1).padStart(2, "0")}-${String(tomorrowDate.getUTCDate()).padStart(2, "0")}`;
  const day = dayKey(date);
  let relativeDay = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: notice.timezone,
  })
    .format(date)
    .replaceAll(".", "");
  if (day === today) {
    relativeDay = "hoje";
  } else if (day === tomorrow) {
    relativeDay = "amanhã";
  }
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: notice.timezone,
  }).format(date);
  if (notice.kind === "meeting") {
    return `encontro ${relativeDay}, ${time}`;
  }
  const shortTitle =
    notice.title.length > 22
      ? `${notice.title.slice(0, 21).trimEnd()}…`
      : notice.title;
  return `tarefa ${relativeDay}, ${shortTitle}`;
};

const insertPortalNotice = (
  source: string,
  variant: "desktop" | "tablet" | "mobile",
  noticeMarkup: string
) => {
  const marker = {
    desktop: '<div class="p-d"',
    mobile: '<div class="p-m"',
    tablet: '<div class="p-t"',
  }[variant];
  const start = source.indexOf(marker);
  if (start < 0) {
    return source;
  }
  const insertion =
    variant === "desktop" || variant === "mobile"
      ? source.lastIndexOf(
          "</div>",
          source.indexOf('<div class="pchrome"', start)
        )
      : source.indexOf('</div></div><div class="p-m"', start);
  if (insertion < start) {
    return source;
  }
  const designEnd = variant === "tablet" ? insertion : insertion;
  return `${source.slice(0, designEnd)}${noticeMarkup}${source.slice(designEnd)}`;
};

const withPortalNotice = (
  source: string,
  notice: PortalViewProperties["notice"]
) => {
  if (!notice) {
    return source;
  }
  const text = htmlEscape(portalNoticeText(notice));
  const href = htmlEscape(notice.href);
  const label = htmlEscape(
    notice.kind === "meeting"
      ? `Próximo encontro: ${notice.title}`
      : `Tarefa próxima do prazo: ${notice.title}`
  );
  const link = (variant: "desktop" | "tablet" | "mobile") =>
    `<a aria-label="${label}" class="hand portal-note portal-note--${variant}" href="${href}" title="${label}">${text}</a>`;
  let markup = insertPortalNotice(source, "desktop", link("desktop"));
  markup = insertPortalNotice(markup, "tablet", link("tablet"));
  markup = insertPortalNotice(markup, "mobile", link("mobile"));
  if (notice.kind === "meeting") {
    const arrow =
      '<svg aria-hidden="true" class="sc portal-note-arrow portal-note-arrow--desktop" fill="none" stroke="#D62839" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 1040 740"><path d="M926 148 C 913.3 176.4, 882.5 197.3, 864 214" pathLength="1" stroke-width="2.2"/><path d="M867.6 203.6 L864 214 L874.7 211.4" pathLength="1" stroke-width="2.2"/></svg>';
    const marker = '<a aria-label="Próximo encontro:';
    const start = markup.indexOf(marker);
    const nextBreak = markup.indexOf("</a>", start) + 4;
    if (start >= 0 && nextBreak >= 4) {
      markup = `${markup.slice(0, nextBreak)}${arrow}${markup.slice(nextBreak)}`;
    }
  }
  return markup;
};

const fitPortal = (portal: HTMLElement) => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const wrappers = portal.querySelectorAll<HTMLElement>(".p-d, .p-t, .p-m");

  for (const wrapper of wrappers) {
    const design = wrapper.querySelector<HTMLElement>(".design");
    if (!design) {
      continue;
    }

    const width = Number(wrapper.dataset.dw);
    const height = Number(wrapper.dataset.dh);
    let scale: number;
    let top: number;

    if (wrapper.classList.contains("p-d")) {
      scale = Math.min(
        viewportWidth / 1100,
        viewportHeight / (height + 70),
        1.18
      );
      top = (viewportHeight - height * scale) / 2 + 22;
    } else if (wrapper.classList.contains("p-t")) {
      scale = Math.min(viewportWidth / 800, 1.1);
      top = Math.max(60, (viewportHeight - height * scale) / 2);
    } else {
      scale = Math.min(viewportWidth / 390, 1.05);
      top = 64;
    }

    design.style.transform = `scale(${scale})`;
    design.style.left = `${(viewportWidth - width * scale) / 2}px`;
    design.style.top = `${top}px`;
    wrapper.dataset.s = String(scale);

    if (wrapper.classList.contains("p-m")) {
      wrapper.style.height = `${Math.max(viewportHeight, top + height * scale)}px`;
    } else {
      wrapper.style.height = "";
    }
  }

  const mobile = portal.querySelector<HTMLElement>(".p-m");
  const mobileScale = Number.parseFloat(mobile?.dataset.s ?? "1") || 1;
  const mobileDesign = mobile?.querySelector<HTMLElement>(".design");
  const mobileBottom =
    Number.parseFloat(mobileDesign?.style.top ?? "0") +
    Number(mobile?.dataset.dh ?? 0) * mobileScale;
  const mobileVisible =
    mobile !== null && getComputedStyle(mobile).display !== "none";
  portal.classList.toggle(
    "scroll",
    mobileVisible && mobileBottom > viewportHeight
  );
};

const portalGeometry = (
  portal: HTMLElement,
  corridor: "estudar" | "comunidade"
) => {
  const element = portal.querySelector<HTMLElement>(`.corr-${corridor}`);
  const design = element?.closest<HTMLElement>(".p-d, .p-t, .p-m");
  if (!(element && design)) {
    return null;
  }

  const bounds = element.getBoundingClientRect();
  const scale = Number.parseFloat(design.dataset.s ?? "1") || 1;
  return {
    dx: (window.innerWidth / 2 - (bounds.left + bounds.width / 2)) / scale,
    dy:
      (window.innerHeight * 0.46 - (bounds.top + bounds.height * 0.63)) / scale,
    offsetX: corridor === "estudar" ? 80 : -80,
    scale: window.innerWidth < 768 ? 3.4 : 3.1,
  };
};

const applyCorridorGeometry = (
  portal: HTMLElement,
  element: HTMLElement,
  geometry: PortalTransitionGeometry
) => {
  element.classList.add("chosen");
  element.style.transformOrigin = "50% 63%";
  portal.style.setProperty("--dx", `${geometry.dx}px`);
  portal.style.setProperty("--dy", `${geometry.dy}px`);
  portal.style.setProperty("--zs", String(geometry.scale));
  portal.style.setProperty("--ox", `${geometry.offsetX}px`);
};

const startPortalEntry = (
  portal: HTMLElement,
  transition: PortalTransition
) => {
  const corridor = transition.corridor;
  const element = corridor
    ? portal.querySelector<HTMLElement>(`.corr-${corridor}`)
    : null;
  const geometry = transition.geometry;

  if (transition.mode !== "corridor" || !(element && geometry)) {
    portal.classList.add("is-fast");
    return;
  }

  applyCorridorGeometry(portal, element, geometry);
  portal.classList.add("is-entering");
};

const startDirectPortalReturn = (portal: HTMLElement) => {
  portal.classList.add("is-fast");
  window.requestAnimationFrame(() => portal.classList.add("in"));
};

const startCorridorPortalReturn = (
  portal: HTMLElement,
  transition: PortalTransition,
  onPortalReady: (
    transitionId: number,
    geometry: PortalTransitionGeometry
  ) => void
) => {
  const corridor = transition.corridor;
  if (!corridor) {
    return false;
  }

  const geometry = portalGeometry(portal, corridor);
  const element = portal.querySelector<HTMLElement>(`.corr-${corridor}`);
  if (!(geometry && element)) {
    onPortalReady(transition.id, {
      dx: 0,
      dy: 0,
      offsetX: corridor === "estudar" ? 80 : -80,
      scale: window.innerWidth < 768 ? 3.4 : 3.1,
    });
    return true;
  }

  applyCorridorGeometry(portal, element, geometry);
  portal.style.opacity = "0";
  portal.classList.add("no-tr", "is-entering");
  portal.getBoundingClientRect();
  portal.classList.remove("no-tr");
  portal.classList.add("is-leaving");
  window.requestAnimationFrame(() => {
    portal.classList.add("fade-in");
    portal.style.opacity = "1";
  });
  window.setTimeout(() => portal.classList.remove("is-entering"), 100);
  onPortalReady(transition.id, geometry);
  return true;
};

const startPortalReturn = (
  portal: HTMLElement,
  transition: PortalTransition,
  onPortalReady: (
    transitionId: number,
    geometry: PortalTransitionGeometry
  ) => void
) => {
  if (
    transition.mode === "corridor" &&
    transition.phase === "return-prep" &&
    startCorridorPortalReturn(portal, transition, onPortalReady)
  ) {
    return;
  }

  startDirectPortalReturn(portal);
};

export const PortalView = ({ markup, notice }: PortalViewProperties) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const startedTransition = useRef<number | null>(null);
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();
  const navigation = useMemberNavigation();

  if (!navigation) {
    throw new Error(
      "PortalView must be rendered inside MemberShellController."
    );
  }

  const firstName =
    navigation.displayName.trim().split(whitespacePattern)[0] ?? "";
  const mappedMarkup = useMemo(() => {
    const greeting = firstName ? `Olá, ${htmlEscape(firstName)}.` : "Olá.";
    return withPortalNotice(
      mapPortalLinks(markup.replaceAll("Olá, Gabriel.", greeting)),
      notice
    );
  }, [firstName, markup, notice]);
  const transition = navigation.transition;
  const showChrome = pathname === "/" && transition === null;

  useLayoutEffect(() => {
    const host = hostRef.current;
    const portal = host?.querySelector<HTMLElement>(".portal");
    if (!(host && portal)) {
      return;
    }

    fitPortal(portal);
    portal.classList.add("drawn");

    const currentTransition = navigation.transition;
    if (
      !currentTransition ||
      startedTransition.current === currentTransition.id
    ) {
      return;
    }

    startedTransition.current = currentTransition.id;
    if (currentTransition.direction === "enter") {
      startPortalEntry(portal, currentTransition);
      return;
    }

    startPortalReturn(portal, currentTransition, navigation.onPortalReady);
  }, [navigation]);

  useLayoutEffect(() => {
    if (transition?.direction !== "enter" || transition.phase !== "fade") {
      return;
    }
    hostRef.current
      ?.querySelector<HTMLElement>(".portal")
      ?.classList.add("is-fade-out");
  }, [transition?.direction, transition?.phase]);

  useLayoutEffect(() => {
    const lockPortalScroll = pathname === "/" || transition !== null;
    document.documentElement.classList.toggle(
      "member-portal-lock",
      lockPortalScroll
    );
  }, [pathname, transition]);

  useLayoutEffect(
    () => () => {
      document.documentElement.classList.remove("member-portal-lock");
    },
    []
  );

  useLayoutEffect(() => {
    const portal = hostRef.current?.querySelector<HTMLElement>(".portal");
    if (!portal) {
      return;
    }

    let frame = 0;
    const handleResize = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => fitPortal(portal));
    };
    window.addEventListener("resize", handleResize, { passive: true });
    return () => {
      window.removeEventListener("resize", handleResize);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const setHotCorridor = (target: EventTarget | null) => {
    if (!(target instanceof Element)) {
      return;
    }
    const corridor = target.closest<HTMLElement>(
      ".corr-estudar, .corr-comunidade"
    );
    const portal = hostRef.current?.querySelector<HTMLElement>(".portal");
    if (portal) {
      if (corridor?.classList.contains("corr-comunidade")) {
        portal.dataset.hot = "comunidade";
      } else if (corridor) {
        portal.dataset.hot = "estudar";
      } else {
        portal.dataset.hot = "";
      }
    }
  };

  return (
    <div
      className="member-portal-host"
      onFocusCapture={(event) => setHotCorridor(event.target)}
      onPointerLeave={() => {
        const portal = hostRef.current?.querySelector<HTMLElement>(".portal");
        if (portal) {
          delete portal.dataset.hot;
        }
      }}
      onPointerMove={(event) => setHotCorridor(event.target)}
      onPointerOut={(event) => {
        const target = event.target;
        const related = event.relatedTarget;
        if (!(target instanceof Element)) {
          return;
        }
        const leaving = target.closest(".corr-estudar, .corr-comunidade");
        const next =
          related instanceof Element
            ? related.closest(".corr-estudar, .corr-comunidade")
            : null;
        if (leaving && leaving !== next) {
          const portal = hostRef.current?.querySelector<HTMLElement>(".portal");
          if (portal) {
            delete portal.dataset.hot;
          }
        }
      }}
      ref={hostRef}
    >
      <div
        dangerouslySetInnerHTML={{ __html: mappedMarkup }}
        suppressHydrationWarning
      />
      {showChrome ? (
        <header className="member-portal-header">
          <nav
            aria-label="Navegação principal"
            className="member-portal-header__nav"
          >
            <div className="member-portal-header__brand">
              <button
                aria-label="Abrir menu"
                className="member-portal-header__menu"
                onClick={toggleSidebar}
                type="button"
              >
                <MenuIcon aria-hidden="true" />
                <span>Menu</span>
              </button>
              <span className="member-portal-header__wordmark">
                Interprete.
              </span>
            </div>
            <MemberHeaderControls memberId={navigation.memberId} />
          </nav>
        </header>
      ) : null}
    </div>
  );
};
