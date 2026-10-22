"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dismissCommunityAnnouncement } from "@/app/(authenticated)/comunidade/announcements-actions";

export const CommunityAnnouncementDismissButton = ({
  announcementId,
  onDismiss,
  version,
  children = "Dispensar aviso",
}: {
  readonly announcementId: string;
  readonly onDismiss?: () => void;
  readonly version: number;
  readonly children?: string;
}) => {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  const dismiss = async () => {
    if (pending) {
      return;
    }
    setPending(true);
    setError(false);
    try {
      const result = await dismissCommunityAnnouncement(
        announcementId,
        version
      );
      if (result === "dismissed" || result === "already-dismissed") {
        onDismiss?.();
      } else {
        setError(true);
        router.refresh();
      }
    } catch {
      setError(true);
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        aria-label={children}
        disabled={pending}
        onClick={dismiss}
        size="sm"
        type="button"
        variant="outline"
      >
        {pending ? "Salvando…" : children}
      </Button>
      {error ? (
        <output className="text-destructive text-xs">
          Não foi possível dispensar. Atualize e tente novamente.
        </output>
      ) : null}
    </span>
  );
};
