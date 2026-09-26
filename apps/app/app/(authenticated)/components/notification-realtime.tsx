"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect } from "react";

interface NotificationRealtimeProperties {
  readonly memberId: string;
  readonly onNotification: () => void;
}

export const NotificationRealtime = ({
  memberId,
  onNotification,
}: NotificationRealtimeProperties) => {
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    const connect = async () => {
      try {
        const configResponse = await fetch(
          "/api/notifications/realtime-config",
          {
            headers: { Accept: "application/json" },
          }
        );
        if (!configResponse.ok || disposed) {
          return;
        }
        const config = (await configResponse.json()) as {
          anonKey?: string;
          url?: string;
        };
        if (!(config.url && config.anonKey)) {
          return;
        }
        const tokenResponse = await fetch("/api/notifications/realtime-token", {
          headers: { Accept: "application/json" },
        });
        if (!tokenResponse.ok || disposed) {
          return;
        }
        const tokenPayload = (await tokenResponse.json()) as { token?: string };
        if (!tokenPayload.token) {
          return;
        }
        const client = createClient(config.url, config.anonKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        await client.realtime.setAuth(tokenPayload.token);
        const channel = client
          .channel(`member-notifications:${memberId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              filter: `memberId=eq.${memberId}`,
              schema: "public",
              table: "Notification",
            },
            () => onNotification()
          )
          .subscribe();
        cleanup = () => {
          client.removeChannel(channel);
        };
      } catch {
        // The header still polls the compact summary when Realtime is not
        // available in a local or preview environment.
      }
    };

    connect().catch(() => undefined);
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [memberId, onNotification]);

  return null;
};
