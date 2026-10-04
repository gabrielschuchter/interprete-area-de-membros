"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getAuthenticatedRealtimeClient,
  refreshRealtimeAuth,
} from "@/lib/realtime-client";

const PRESENCE_CHANNEL = "community-presence";
const HEARTBEAT_INTERVAL_MS = 45_000;
const TOKEN_REFRESH_INTERVAL_MS = 240_000;
const MAX_VISIBLE_MEMBERS = 5;
const usernamePattern = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/;
const safeAvatarPattern = /^(?:https?:\/\/|\/(?!\/))/i;
const whitespacePattern = /\s+/;

export interface CommunityPresenceProfile {
  readonly avatarUrl: string | null;
  readonly displayName: string | null;
  readonly username: string;
}

export interface OnlineCommunityMember {
  readonly avatarUrl: string | null;
  readonly displayName: string;
  readonly username: string;
}

type UnknownRecord = Record<string, unknown>;
type PresenceState = Record<string, readonly UnknownRecord[]>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const cleanText = (value: unknown, maxLength: number) => {
  if (typeof value !== "string") {
    return null;
  }
  const text = value.trim().slice(0, maxLength);
  return text || null;
};

const safeAvatarUrl = (value: unknown) => {
  const url = cleanText(value, 500);
  return url && safeAvatarPattern.test(url) ? url : null;
};

const presenceMetadata = (metas: readonly UnknownRecord[]) => {
  const first = metas.find(isRecord) ?? {};
  const displayName = cleanText(first.displayName, 80);
  const avatarUrl = safeAvatarUrl(first.avatarUrl);

  return { avatarUrl, displayName };
};

export const onlineMembersFromPresenceState = (
  state: PresenceState
): OnlineCommunityMember[] =>
  Object.entries(state).flatMap(([username, metas]) => {
    if (!usernamePattern.test(username)) {
      return [];
    }

    const metadata = presenceMetadata(metas);
    return [
      {
        avatarUrl: metadata.avatarUrl,
        displayName: metadata.displayName ?? username,
        username,
      },
    ];
  });

const formatOnlineCount = (count: number) =>
  [String(count), count === 1 ? "membro" : "membros", "online"].join(" ");

const initialFor = (member: OnlineCommunityMember) =>
  member.displayName
    .split(whitespacePattern)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "M";

interface CommunityPresenceProperties {
  readonly fallbackProfiles?: readonly CommunityPresenceProfile[];
  readonly memberId: string;
  readonly profile: CommunityPresenceProfile | null;
}

type PresenceStatus = "connecting" | "online" | "unavailable";
const ignorePromise = (promise: Promise<unknown>) => {
  promise.catch(() => undefined);
};

export const CommunityPresence = ({
  fallbackProfiles,
  memberId,
  profile,
}: CommunityPresenceProperties) => {
  const [members, setMembers] = useState<OnlineCommunityMember[]>([]);
  const [status, setStatus] = useState<PresenceStatus>("connecting");
  const fallbackMembers = useMemo<OnlineCommunityMember[]>(() => {
    const seen = new Set<string>();
    return [profile, ...(fallbackProfiles ?? [])].flatMap((candidate) => {
      if (!candidate || seen.has(candidate.username)) {
        return [];
      }
      seen.add(candidate.username);
      return [
        {
          avatarUrl: safeAvatarUrl(candidate.avatarUrl),
          displayName: candidate.displayName?.trim() || candidate.username,
          username: candidate.username,
        },
      ];
    });
  }, [fallbackProfiles, profile]);
  const presencePayload = useMemo(
    () => ({
      avatarUrl: profile?.avatarUrl ?? null,
      displayName: profile?.displayName ?? null,
    }),
    [profile?.avatarUrl, profile?.displayName]
  );

  useEffect(() => {
    if (!profile) {
      setMembers([]);
      setStatus("unavailable");
      return;
    }

    let disposed = false;
    let connecting = false;
    let reconnectTimer: number | undefined;
    let reconnectAttempt = 0;
    let channel: RealtimeChannel | null = null;
    let client: SupabaseClient | null = null;

    const clearReconnect = () => {
      if (reconnectTimer !== undefined) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
      }
    };

    const removeChannel = () => {
      const previousClient = client;
      const previousChannel = channel;
      client = null;
      channel = null;
      if (previousClient && previousChannel) {
        ignorePromise(previousClient.removeChannel(previousChannel));
      }
    };

    const readState = () => {
      if (!channel) {
        return;
      }
      const state = channel.presenceState<UnknownRecord>() as PresenceState;
      if (!disposed) {
        setMembers(onlineMembersFromPresenceState(state));
      }
    };

    const track = async () => {
      if (!channel || disposed || document.visibilityState !== "visible") {
        return;
      }
      try {
        await channel.track(presencePayload);
      } catch {
        if (!disposed) {
          setStatus("unavailable");
        }
      }
    };

    const scheduleReconnect = () => {
      if (disposed || reconnectTimer !== undefined) {
        return;
      }
      const delay = Math.min(30_000, 2000 * 2 ** reconnectAttempt);
      reconnectAttempt = Math.min(reconnectAttempt + 1, 4);
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = undefined;
        ignorePromise(connect());
      }, delay);
    };

    // The connection path deliberately handles configuration, token, socket,
    // presence state and reconnect statuses in one place.
    const connect = async () => {
      if (disposed || connecting) {
        return;
      }
      connecting = true;
      setStatus("connecting");

      try {
        const authenticated = await getAuthenticatedRealtimeClient(memberId);
        if (disposed) {
          return;
        }

        removeChannel();
        const nextClient = authenticated.client;
        client = nextClient;

        const nextChannel = nextClient.channel(PRESENCE_CHANNEL, {
          config: {
            presence: { enabled: true, key: profile.username },
            private: true,
          },
        });
        channel = nextChannel;
        nextChannel
          .on("presence", { event: "sync" }, readState)
          .on("presence", { event: "join" }, readState)
          .on("presence", { event: "leave" }, readState)
          .subscribe((nextStatus) => {
            if (disposed || channel !== nextChannel) {
              return;
            }
            if (nextStatus === "SUBSCRIBED") {
              reconnectAttempt = 0;
              setStatus("online");
              ignorePromise(track());
              readState();
              return;
            }
            if (
              nextStatus === "CHANNEL_ERROR" ||
              nextStatus === "TIMED_OUT" ||
              nextStatus === "CLOSED"
            ) {
              setMembers([]);
              setStatus("unavailable");
              removeChannel();
              scheduleReconnect();
            }
          });
      } catch {
        if (!disposed) {
          setMembers([]);
          setStatus("unavailable");
          scheduleReconnect();
        }
      } finally {
        connecting = false;
      }
    };

    const refreshToken = async () => {
      if (disposed || !client) {
        return;
      }
      try {
        await refreshRealtimeAuth(memberId);
      } catch {
        // The channel can keep its current authorization while a refresh is
        // retried on the next interval or a websocket reconnect.
      }
    };

    const heartbeatTimer = window.setInterval(() => {
      ignorePromise(track());
    }, HEARTBEAT_INTERVAL_MS);
    const tokenRefreshTimer = window.setInterval(() => {
      ignorePromise(refreshToken());
    }, TOKEN_REFRESH_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        ignorePromise(track());
      } else if (channel) {
        ignorePromise(channel.untrack());
      }
    };
    const leave = () => {
      if (channel) {
        ignorePromise(channel.untrack());
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", leave);
    window.addEventListener("beforeunload", leave);
    ignorePromise(connect());

    return () => {
      disposed = true;
      clearReconnect();
      window.clearInterval(heartbeatTimer);
      window.clearInterval(tokenRefreshTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("beforeunload", leave);
      leave();
      removeChannel();
    };
  }, [memberId, presencePayload, profile]);

  const liveMembers = status === "online" ? members : [];
  const displayedMembers =
    liveMembers.length > 0 ? liveMembers : fallbackMembers;
  const visibleMembers = displayedMembers.slice(0, MAX_VISIBLE_MEMBERS);
  const remainingCount = Math.max(
    0,
    displayedMembers.length - visibleMembers.length
  );
  let countLabel = "Presença indisponível";
  if (liveMembers.length > 0) {
    countLabel = formatOnlineCount(liveMembers.length);
  } else if (fallbackMembers.length > 0) {
    countLabel = [
      String(fallbackMembers.length),
      fallbackMembers.length === 1 ? "membro" : "membros",
      "por aqui",
    ].join(" ");
  } else if (status === "connecting") {
    countLabel = "Conectando…";
  }

  return (
    <div
      className="mt-3"
      data-online-count={
        liveMembers.length > 0 ? liveMembers.length : undefined
      }
      data-presence-status={status}
      data-testid="community-presence"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="community-presence__stack">
          {visibleMembers.length === 0 ? (
            <span aria-hidden="true" className="community-presence__empty">
              —
            </span>
          ) : null}
          {visibleMembers.map((member) => (
            <Link
              aria-label={["Abrir perfil de", member.displayName].join(" ")}
              className="community-presence__avatar"
              href={"/membros/".concat(encodeURIComponent(member.username))}
              key={member.username}
              title={member.displayName}
            >
              <Avatar className="size-9 border-2 border-background">
                {member.avatarUrl ? (
                  <AvatarImage alt="" loading="lazy" src={member.avatarUrl} />
                ) : null}
                <AvatarFallback className="bg-brand-structural text-[0.65rem] text-primary-foreground">
                  {initialFor(member)}
                </AvatarFallback>
              </Avatar>
              <span className="community-presence__tooltip" role="tooltip">
                {member.displayName}
              </span>
            </Link>
          ))}
          {remainingCount > 0 ? (
            <span
              className="community-presence__more"
              title={[String(remainingCount), "outros membros"].join(" ")}
            >
              +{remainingCount}
            </span>
          ) : null}
        </div>
        <span
          aria-live="polite"
          className="min-w-0 text-muted-foreground text-xs"
        >
          {displayedMembers.length > 0 ? (
            <span aria-hidden="true" className="community-presence__signal" />
          ) : null}
          {countLabel}
        </span>
      </div>
    </div>
  );
};
