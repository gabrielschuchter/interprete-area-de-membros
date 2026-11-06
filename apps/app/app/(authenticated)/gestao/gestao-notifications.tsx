"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { BellIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import "../components/notification-bell.css";

const NotificationRealtime = dynamic(
  () =>
    import("../components/notification-realtime").then(
      (module) => module.NotificationRealtime
    ),
  { ssr: false }
);

const NotificationsPopover = dynamic(
  () =>
    import("../components/notifications-popover").then(
      (module) => module.NotificationsPopover
    ),
  {
    ssr: false,
    loading: () => (
      <Button
        aria-busy="true"
        aria-label="Carregando notificações"
        className="size-10 rounded-full"
        disabled
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <BellIcon aria-hidden="true" />
      </Button>
    ),
  }
);

/**
 * O sino da Gestão é o mesmo da plataforma (mesmo painel, mesmos grupos e
 * mesmo histórico); só o link "ver todas" aponta para o histórico dentro da
 * Gestão.
 */
export const GestaoNotificationsBell = ({
  memberId,
}: {
  readonly memberId: string;
}) => {
  const [open, setOpen] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const refresh = useCallback(() => setRefreshSignal((value) => value + 1), []);

  return (
    <>
      <NotificationsPopover
        onOpenChange={setOpen}
        onUnreadCountChange={() => undefined}
        open={open}
        realtimeConnected={realtimeConnected}
        refreshSignal={refreshSignal}
      />
      <NotificationRealtime
        memberId={memberId}
        onNotification={refresh}
        onResync={refresh}
        onStatusChange={setRealtimeConnected}
      />
    </>
  );
};
