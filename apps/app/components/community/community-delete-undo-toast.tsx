"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { undoSoftDeletedPost } from "@/app/(authenticated)/comunidade/actions";

interface CommunityDeleteUndoToastProperties {
  readonly deletedAt: string;
  readonly postId: string;
  readonly undoUntil: number;
}

export function CommunityDeleteUndoToast({
  deletedAt,
  postId,
  undoUntil,
}: CommunityDeleteUndoToastProperties) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [visible, setVisible] = useState(undoUntil > Date.now());
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setVisible(false),
      Math.max(0, undoUntil - Date.now())
    );
    return () => window.clearTimeout(timeout);
  }, [undoUntil]);

  if (!visible) {
    return null;
  }

  const handleUndo = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("postId", postId);
      formData.set("deletedAt", deletedAt);
      const result = await undoSoftDeletedPost(formData);
      if (result.ok) {
        setVisible(false);
        router.refresh();
      } else {
        setMessage("O prazo para desfazer terminou.");
        setVisible(false);
        router.refresh();
      }
    });
  };

  return (
    <output aria-live="polite" className="community-delete-undo-toast">
      <span>{message || "Publicação excluída."}</span>
      {message ? null : (
        <Button
          disabled={isPending}
          onClick={handleUndo}
          size="sm"
          type="button"
          variant="outline"
        >
          {isPending ? "Desfazendo…" : "Desfazer"}
        </Button>
      )}
    </output>
  );
}
