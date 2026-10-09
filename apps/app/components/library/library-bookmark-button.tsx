"use client";

import type { LibraryBookmarkTargetType } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import { toast } from "@repo/design-system/lib/toast";
import { BookmarkIcon, LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  toggleLearningBookmark,
  toggleLibraryBookmark,
} from "@/app/(authenticated)/biblioteca/actions";

interface LibraryBookmarkButtonProperties {
  readonly initialSaved?: boolean;
  readonly onSavedChange?: (saved: boolean) => void;
  readonly targetId: string;
  readonly targetType: LibraryBookmarkTargetType;
  readonly variant?: "library" | "personal";
}

const bookmarkActions = {
  LIBRARY_ITEM: toggleLibraryBookmark,
  COURSE: toggleLearningBookmark,
  MODULE: toggleLearningBookmark,
  LESSON: toggleLearningBookmark,
  ASSET: toggleLearningBookmark,
} satisfies Record<LibraryBookmarkTargetType, typeof toggleLibraryBookmark>;

export const LibraryBookmarkButton = ({
  initialSaved = false,
  onSavedChange,
  targetId,
  targetType,
  variant = "library",
}: LibraryBookmarkButtonProperties) => {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const savedRef = useRef(initialSaved);

  const setSavedState = (nextSaved: boolean) => {
    savedRef.current = nextSaved;
    setSaved(nextSaved);
    onSavedChange?.(nextSaved);
  };

  const updateBookmark = async (
    nextSaved: boolean,
    previousSaved = savedRef.current
  ) => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setPending(true);
    setSavedState(nextSaved);

    const formData = new FormData();
    if (targetType === "LIBRARY_ITEM") {
      formData.set("itemId", targetId);
    } else {
      formData.set("targetType", targetType);
      formData.set("targetId", targetId);
    }
    formData.set("desired", nextSaved ? "on" : "off");

    try {
      const result = await bookmarkActions[targetType](formData);
      if (!result?.ok || result.saved !== nextSaved) {
        throw new Error("The bookmark update was not accepted.");
      }
      const undo = () => updateBookmark(previousSaved, nextSaved);
      toast.library(
        nextSaved ? "Salvo na biblioteca pessoal." : "Removido dos salvos.",
        nextSaved
          ? [
              { label: "Desfazer", onSelect: undo },
              {
                label: "Ver salvos",
                onSelect: () => router.push("/biblioteca/pessoal"),
              },
            ]
          : [{ label: "Desfazer", onSelect: undo }]
      );
    } catch {
      setSavedState(previousSaved);
      toast.library(
        "Não foi possível salvar. Tente novamente.",
        [
          {
            label: "Tentar de novo",
            onSelect: () => updateBookmark(nextSaved, previousSaved),
          },
        ],
        "error"
      );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return (
    <Button
      aria-label={saved ? "Remover dos salvos" : "Salvar na biblioteca"}
      aria-pressed={saved}
      className={
        variant === "personal"
          ? "h-11 min-w-20 justify-start px-2 text-brand-action-text hover:bg-transparent"
          : "h-11 gap-1.5 px-2 text-brand-action-text hover:bg-transparent"
      }
      disabled={pending}
      onClick={() => updateBookmark(!saved)}
      size="sm"
      type="button"
      variant="ghost"
    >
      {pending ? (
        <LoaderCircleIcon
          aria-hidden="true"
          className="size-[18px] animate-spin"
        />
      ) : (
        <BookmarkIcon
          aria-hidden="true"
          className="size-[18px]"
          fill={saved ? "currentColor" : "none"}
        />
      )}
      <span className={saved ? "font-semibold" : ""}>
        {saved ? "Salvo" : "Salvar"}
      </span>
    </Button>
  );
};
