"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { ArrowUpRightIcon, MegaphoneIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CommunityAnnouncementDismissButton } from "./community-announcement-dismiss-button";

interface AnnouncementItem {
  readonly body: string;
  readonly createdAt: Date | string;
  readonly endsAt: Date | string | null;
  readonly href: string | null;
  readonly id: string;
  readonly isImportant: boolean;
  readonly isPinned: boolean;
  readonly publishedAt: Date | string | null;
  readonly startsAt: Date | string | null;
  readonly title: string;
  readonly version: number;
}

const timestamp = (value: Date | string | null) =>
  value ? new Date(value).valueOf() : null;

const signature = (items: readonly AnnouncementItem[]) =>
  JSON.stringify(items, (_key, value: unknown) =>
    value instanceof Date ? value.toISOString() : value
  );

const externalHrefPattern = /^https?:\/\//;

const announcementDate = (announcement: AnnouncementItem) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(announcement.publishedAt ?? announcement.createdAt));

const AnnouncementLink = ({ href }: { readonly href: string | null }) => {
  if (!href) {
    return null;
  }
  const internal = href.startsWith("/") && !href.startsWith("//");
  const safeHref = internal || externalHrefPattern.test(href) ? href : null;
  if (!safeHref) {
    return null;
  }
  return (
    <Button asChild className="mt-4 w-fit" size="sm" variant="outline">
      <a
        href={safeHref}
        rel={internal ? undefined : "noreferrer"}
        target={internal ? undefined : "_blank"}
      >
        Ver comunicado <ArrowUpRightIcon aria-hidden="true" />
      </a>
    </Button>
  );
};

export const CommunityAnnouncementFeed = ({
  initialAnnouncements,
}: {
  readonly initialAnnouncements: readonly AnnouncementItem[];
}) => {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const announcementsRef = useRef(initialAnnouncements);
  useEffect(() => {
    announcementsRef.current = initialAnnouncements;
    setAnnouncements(initialAnnouncements);
  }, [initialAnnouncements]);

  const poll = useCallback(async () => {
    if (document.visibilityState !== "visible") {
      return;
    }
    try {
      const response = await fetch("/api/community/announcements", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        return;
      }
      const next = (await response.json()) as AnnouncementItem[];
      if (signature(announcementsRef.current) === signature(next)) {
        return;
      }
      announcementsRef.current = next;
      setAnnouncements(next);
      router.refresh();
    } catch {
      // The next visible-tab poll recovers temporary network failures.
    }
  }, [router]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const onVisibilityChange = () => {
      if (interval) {
        clearInterval(interval);
        interval = undefined;
      }
      if (document.visibilityState === "visible") {
        poll().catch(() => undefined);
        interval = setInterval(() => {
          poll().catch(() => undefined);
        }, 30_000);
      } else if (interval) {
        clearInterval(interval);
        interval = undefined;
      }
    };
    onVisibilityChange();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      if (interval) {
        clearInterval(interval);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [poll]);

  useEffect(() => {
    const now = Date.now();
    const nextEnd = announcements
      .map(({ endsAt }) => timestamp(endsAt))
      .filter((value): value is number => value !== null && value > now)
      .sort((left, right) => left - right)[0];
    if (!nextEnd) {
      return;
    }
    const timer = setTimeout(
      () => {
        const endedAt = Date.now();
        setAnnouncements((current) =>
          current.filter((announcement) => {
            const end = timestamp(announcement.endsAt);
            return end === null || end > endedAt;
          })
        );
        announcementsRef.current = announcementsRef.current.filter(
          ({ endsAt }) => {
            const end = timestamp(endsAt);
            return end === null || end > endedAt;
          }
        );
        router.refresh();
      },
      Math.max(0, nextEnd - now)
    );
    return () => clearTimeout(timer);
  }, [announcements, router]);

  const importantAnnouncements = announcements.filter(
    ({ isImportant }) => isImportant
  );

  return (
    <section
      aria-label="Avisos importantes da comunidade"
      aria-live="polite"
      className="community-announcement-area space-y-4"
      data-community-announcements="important"
    >
      {importantAnnouncements.map((announcement) => (
        <article
          className="community-announcement-important rounded-xl border border-brand-structural/25 bg-brand-structural/5 p-5 sm:p-6"
          data-announcement-id={announcement.id}
          key={`${announcement.id}:${announcement.version}`}
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-structural/10 text-brand-structural">
              <MegaphoneIcon aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="brand-eyebrow text-brand-structural">
                Aviso importante · Professor · {announcementDate(announcement)}
              </p>
              <h2 className="mt-2 font-display text-2xl leading-tight sm:text-3xl">
                {announcement.title}
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 sm:text-base sm:leading-7">
                {announcement.body}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <CommunityAnnouncementDismissButton
                  announcementId={announcement.id}
                  onDismiss={() => {
                    announcementsRef.current = announcementsRef.current.filter(
                      ({ id }) => id !== announcement.id
                    );
                    setAnnouncements((current) =>
                      current.filter(({ id }) => id !== announcement.id)
                    );
                    router.refresh();
                  }}
                  version={announcement.version}
                >
                  Entendi
                </CommunityAnnouncementDismissButton>
                <AnnouncementLink href={announcement.href} />
              </div>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
};
