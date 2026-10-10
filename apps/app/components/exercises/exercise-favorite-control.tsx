"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { toast } from "@repo/design-system/lib/toast";
import { BookmarkIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  getExerciseFavoriteStatus,
  undoExerciseFavorite,
  updateExerciseFavorite,
} from "@/app/(authenticated)/exercicios/actions";

interface ExerciseFavoriteControlProperties {
  readonly className?: string;
  readonly initialBookmarked: boolean;
  readonly questionId: string;
  readonly sessionId?: string;
}

type FavoriteOperation = "removed" | "saved";

export const ExerciseFavoriteControl = ({
  className,
  initialBookmarked,
  questionId,
  sessionId,
}: ExerciseFavoriteControlProperties) => {
  const router = useRouter();
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [pending, setPending] = useState(false);
  const queuedOperations = useRef(0);
  const operationQueue = useRef<Promise<void>>(Promise.resolve());
  const bookmarkedRef = useRef(initialBookmarked);
  const commitBookmarked = (next: boolean) => {
    bookmarkedRef.current = next;
    setBookmarked(next);
  };

  const reconcile = async (fallback: boolean) => {
    try {
      const current = await getExerciseFavoriteStatus(questionId);
      commitBookmarked(current.bookmarked);
    } catch {
      commitBookmarked(fallback);
    }
  };

  const enqueueOperation = async (operation: () => Promise<void>) => {
    queuedOperations.current += 1;
    setPending(true);
    const next = operationQueue.current.then(async () => {
      try {
        await operation();
      } catch {
        toast.exercise(
          "Não foi possível atualizar seus favoritos. Tente novamente.",
          [],
          "error"
        );
      } finally {
        queuedOperations.current -= 1;
        setPending(queuedOperations.current > 0);
      }
    });
    operationQueue.current = next.then(
      () => undefined,
      () => undefined
    );
    await next;
  };

  const undoFavorite = async (
    operation: FavoriteOperation,
    createdAt: string
  ) => {
    const wasSaved = operation === "saved";
    const optimistic = queuedOperations.current === 0;
    const stateBeforeUndo = bookmarkedRef.current;
    if (optimistic) {
      commitBookmarked(!wasSaved);
    }

    await enqueueOperation(async () => {
      const previous = bookmarkedRef.current;
      if (!optimistic) {
        commitBookmarked(!wasSaved);
      }
      try {
        const result = await undoExerciseFavorite({
          createdAt,
          operation,
          questionId,
        });
        commitBookmarked(result.bookmarked);
        if (result.ok) {
          toast.exercise(
            wasSaved
              ? "Questão removida dos favoritos."
              : "Questão salva novamente.",
            [],
            "info"
          );
        } else {
          toast.exercise(
            "Não foi possível desfazer esta alteração.",
            [],
            "error"
          );
        }
      } catch {
        await reconcile(optimistic ? stateBeforeUndo : previous);
        toast.exercise(
          "Não foi possível desfazer esta alteração.",
          [],
          "error"
        );
      }
      router.refresh();
    });
  };

  const notifyRetryableError = (message: string) =>
    toast.exercise(
      message,
      [
        {
          label: "Tentar de novo",
          onSelect: toggle,
        },
      ],
      "error"
    );

  const notifyFavoriteResult = (
    operation: FavoriteOperation | null | undefined,
    createdAt: string | undefined,
    desired: boolean
  ) => {
    if (!(operation && createdAt)) {
      toast.exercise(
        desired ? "Questão já estava salva." : "Questão removida dos favoritos."
      );
      return;
    }
    const wasSaved = operation === "saved";
    toast.exercise(
      wasSaved ? "Questão salva." : "Questão removida dos favoritos.",
      [
        ...(wasSaved
          ? [
              {
                label: "Ver salvas",
                onSelect: () => router.push("/exercicios/favoritas"),
              },
            ]
          : []),
        {
          label: "Desfazer",
          onSelect: () => undoFavorite(operation, createdAt),
        },
      ]
    );
  };

  async function toggle() {
    if (queuedOperations.current > 0) {
      return;
    }
    const previous = bookmarkedRef.current;
    const desired = !previous;
    commitBookmarked(desired);

    await enqueueOperation(async () => {
      try {
        const result = await updateExerciseFavorite({
          desired,
          questionId,
          sessionId,
        });
        if (!result.ok) {
          commitBookmarked(result.bookmarked);
          notifyRetryableError(
            "Não foi possível atualizar seus favoritos. Tente novamente."
          );
          return;
        }

        commitBookmarked(result.bookmarked);
        notifyFavoriteResult(result.operation, result.createdAt, desired);
        router.refresh();
      } catch {
        await reconcile(previous);
        notifyRetryableError(
          "Não foi possível atualizar seus favoritos. Verifique a conexão e tente novamente."
        );
        router.refresh();
      }
    });
  }

  return (
    <Button
      aria-busy={pending}
      aria-pressed={bookmarked}
      className={className}
      disabled={pending}
      onClick={toggle}
      type="button"
      variant="ghost"
    >
      <BookmarkIcon
        aria-hidden="true"
        className="size-4"
        fill={bookmarked ? "currentColor" : "none"}
      />
      {bookmarked ? "Remover dos favoritos" : "Salvar questão"}
    </Button>
  );
};
