"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { useEffect } from "react";
import {
  getAuthenticatedRealtimeClient,
  refreshRealtimeAuth,
} from "@/lib/realtime-client";

interface NotificationRealtimeProperties {
  readonly memberId: string;
  readonly onNotification: () => void;
  readonly onResync: () => void;
  readonly onStatusChange: (connected: boolean) => void;
}

const maximumRetryDelayMs = 120_000;
const maximumTokenRefreshDelayMs = 210_000;

export const NotificationRealtime = ({
  memberId,
  onNotification,
  onResync,
  onStatusChange,
}: NotificationRealtimeProperties) => {
  useEffect(() => {
    let disposed = false;
    let connecting = false;
    let retryCount = 0;
    let tokenExpiresAt = 0;
    let client: SupabaseClient | undefined;
    let channel: RealtimeChannel | undefined;
    let retryTimer: number | undefined;
    let tokenTimer: number | undefined;
    let notificationTimer: number | undefined;

    const clearTimer = (timer: number | undefined) => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };

    const scheduleRetry = () => {
      if (
        disposed ||
        retryTimer !== undefined ||
        document.visibilityState !== "visible"
      ) {
        return;
      }
      const exponentialDelay = Math.min(
        5000 * 2 ** Math.min(retryCount, 5),
        maximumRetryDelayMs
      );
      const jitter = Math.round(
        exponentialDelay * (Math.random() * 0.3 - 0.15)
      );
      retryCount += 1;
      retryTimer = window.setTimeout(() => {
        retryTimer = undefined;
        connect().catch(scheduleRetry);
      }, exponentialDelay + jitter);
    };

    const removeCurrentChannel = () => {
      clearTimer(tokenTimer);
      tokenTimer = undefined;
      const currentChannel = channel;
      channel = undefined;
      if (client && currentChannel) {
        client.removeChannel(currentChannel).catch(() => undefined);
      }
      onStatusChange(false);
    };

    const scheduleTokenRefresh = () => {
      clearTimer(tokenTimer);
      const untilExpiry = tokenExpiresAt - Date.now();
      if (untilExpiry <= 15_000) {
        removeCurrentChannel();
        scheduleRetry();
        return;
      }
      tokenTimer = window.setTimeout(
        refreshAccessToken,
        Math.min(untilExpiry - 15_000, maximumTokenRefreshDelayMs)
      );
    };

    const refreshAccessToken = async () => {
      try {
        const nextTokenExpiresAt = await refreshRealtimeAuth(memberId);
        if (disposed || !client || !channel) {
          return;
        }
        tokenExpiresAt = nextTokenExpiresAt;
        scheduleTokenRefresh();
      } catch {
        removeCurrentChannel();
        scheduleRetry();
      }
    };

    const handleNotificationInvalidation = () => {
      if (disposed || notificationTimer !== undefined) {
        return;
      }
      notificationTimer = window.setTimeout(() => {
        notificationTimer = undefined;
        if (!disposed) {
          onNotification();
        }
      }, 100);
    };

    const handleChannelStatus = (status: string) => {
      if (disposed) {
        return;
      }
      if (status === "SUBSCRIBED") {
        retryCount = 0;
        clearTimer(retryTimer);
        retryTimer = undefined;
        onStatusChange(true);
        onResync();
        scheduleTokenRefresh();
        return;
      }
      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        removeCurrentChannel();
        scheduleRetry();
      }
    };

    const connect = async () => {
      if (disposed || connecting || channel || !navigator.onLine) {
        return;
      }
      if (document.visibilityState !== "visible") {
        return;
      }
      connecting = true;

      try {
        const authenticated = await getAuthenticatedRealtimeClient(memberId);
        if (disposed) {
          return;
        }
        client = authenticated.client;
        tokenExpiresAt = authenticated.expiresAt;
        const nextChannel = authenticated.client
          .channel(`member-notifications:${memberId}`, {
            config: { private: true },
          })
          .on(
            "broadcast",
            { event: "notification.invalidate" },
            handleNotificationInvalidation
          );
        channel = nextChannel;
        nextChannel.subscribe(handleChannelStatus);
      } catch {
        onStatusChange(false);
        scheduleRetry();
      } finally {
        connecting = false;
      }
    };

    const reconnectWhenActive = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) {
        return;
      }
      clearTimer(retryTimer);
      retryTimer = undefined;
      if (!channel) {
        connect().catch(scheduleRetry);
      }
    };

    document.addEventListener("visibilitychange", reconnectWhenActive);
    window.addEventListener("focus", reconnectWhenActive);
    window.addEventListener("online", reconnectWhenActive);
    connect().catch(scheduleRetry);

    return () => {
      disposed = true;
      clearTimer(retryTimer);
      clearTimer(tokenTimer);
      clearTimer(notificationTimer);
      document.removeEventListener("visibilitychange", reconnectWhenActive);
      window.removeEventListener("focus", reconnectWhenActive);
      window.removeEventListener("online", reconnectWhenActive);
      if (client && channel) {
        client.removeChannel(channel).catch(() => undefined);
      }
      onStatusChange(false);
    };
  }, [memberId, onNotification, onResync, onStatusChange]);

  return null;
};
