"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { BookmarkIcon, ThumbsUpIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  toggleBookmark,
  togglePostVote,
} from "@/app/(authenticated)/comunidade/actions";

type PostAction = "bookmark" | "vote";

interface CommunityPostActionsProperties {
  readonly className?: string;
  readonly initialBookmarked: boolean;
  readonly initialVoted: boolean;
  readonly postId: string;
  readonly spaceSlug: string;
  readonly voteCount?: number;
}

interface PostActionState {
  readonly bookmarked: boolean;
  readonly voteCount: number;
  readonly voted: boolean;
}

const actionError =
  "Não foi possível salvar esta alteração. Tente novamente em instantes.";

export const CommunityPostActions = ({
  className = "inline-flex flex-wrap items-center gap-2",
  initialBookmarked,
  initialVoted,
  postId,
  spaceSlug,
  voteCount = 0,
}: CommunityPostActionsProperties) => {
  const router = useRouter();
  const [state, setState] = useState<PostActionState>({
    bookmarked: initialBookmarked,
    voted: initialVoted,
    voteCount,
  });
  const [pendingAction, setPendingAction] = useState<PostAction | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const inFlightRef = useRef(false);

  useEffect(() => {
    setState({
      bookmarked: initialBookmarked,
      voted: initialVoted,
      voteCount,
    });
  }, [initialBookmarked, initialVoted, voteCount]);

  const toggle = (action: PostAction) => {
    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    setPendingAction(action);
    setError("");
    const previousState = state;
    const nextValue = action === "vote" ? !state.voted : !state.bookmarked;

    setState((current) => ({
      bookmarked: action === "bookmark" ? nextValue : current.bookmarked,
      voted: action === "vote" ? nextValue : current.voted,
      voteCount:
        action === "vote"
          ? Math.max(0, current.voteCount + (nextValue ? 1 : -1))
          : current.voteCount,
    }));

    const formData = new FormData();
    formData.set("postId", postId);
    formData.set("spaceSlug", spaceSlug);
    formData.set("desired", nextValue ? "on" : "off");

    startTransition(async () => {
      try {
        if (action === "vote") {
          await togglePostVote(formData);
        } else {
          await toggleBookmark(formData);
        }
        router.refresh();
      } catch {
        setState(previousState);
        setError(actionError);
      } finally {
        inFlightRef.current = false;
        setPendingAction(null);
      }
    });
  };

  return (
    <div className={className}>
      <Button
        aria-label={state.voted ? "Remover apoio" : "Apoiar conteúdo"}
        aria-pressed={state.voted}
        disabled={isPending || pendingAction !== null}
        onClick={() => toggle("vote")}
        size="sm"
        type="button"
        variant={state.voted ? "secondary" : "ghost"}
      >
        <ThumbsUpIcon aria-hidden="true" className="size-4" />
        <span>{state.voteCount}</span>
        <span className="sr-only">apoios</span>
      </Button>
      <Button
        aria-label={
          state.bookmarked ? "Remover dos salvos" : "Salvar publicação"
        }
        aria-pressed={state.bookmarked}
        className="gap-1.5 text-sm"
        disabled={isPending || pendingAction !== null}
        onClick={() => toggle("bookmark")}
        size="sm"
        type="button"
        variant="ghost"
      >
        <BookmarkIcon
          aria-hidden="true"
          className="size-4"
          fill={state.bookmarked ? "currentColor" : "none"}
        />
        <span>{state.bookmarked ? "Salvo" : "Salvar"}</span>
      </Button>
      {error ? (
        <span className="basis-full text-destructive text-xs" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
};
