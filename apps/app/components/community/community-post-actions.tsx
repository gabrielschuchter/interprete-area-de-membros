"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { BookmarkIcon, ThumbsUpIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  toggleBookmark,
  togglePostVote,
} from "@/app/(authenticated)/comunidade/actions";
import { CommunityPostShareButton } from "./community-post-share-button";

type PostAction = "bookmark" | "vote";

interface CommunityPostActionsProperties {
  readonly className?: string;
  readonly detailed?: boolean;
  readonly initialBookmarked: boolean;
  readonly initialVoted: boolean;
  readonly postId: string;
  readonly sharePath: string;
  readonly spaceSlug: string;
  readonly voteCount?: number;
}

const actionError =
  "Não foi possível salvar esta alteração. Tente novamente em instantes.";

const ensureActionSucceeded = (result: unknown) => {
  if (
    result &&
    typeof result === "object" &&
    "ok" in result &&
    result.ok === false
  ) {
    const error = "error" in result ? result.error : undefined;
    throw new Error(typeof error === "string" ? error : actionError);
  }
};

/**
 * Apoiar e salvar são independentes: cada botão tem o próprio envio em curso,
 * e um não desabilita, não pisca e não desfaz o outro. Um segundo toque no
 * mesmo botão durante o envio é ignorado.
 */
export const CommunityPostActions = ({
  className = "inline-flex flex-wrap items-center gap-2",
  detailed = false,
  initialBookmarked,
  initialVoted,
  postId,
  sharePath,
  spaceSlug,
  voteCount = 0,
}: CommunityPostActionsProperties) => {
  const [voted, setVoted] = useState(initialVoted);
  const [votes, setVotes] = useState(voteCount);
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [pending, setPending] = useState<Record<PostAction, boolean>>({
    bookmark: false,
    vote: false,
  });
  const [error, setError] = useState("");
  const inFlightRef = useRef<Record<PostAction, boolean>>({
    bookmark: false,
    vote: false,
  });

  // Dados novos do servidor só substituem o que não está sendo enviado agora.
  useEffect(() => {
    if (!inFlightRef.current.vote) {
      setVoted(initialVoted);
      setVotes(voteCount);
    }
  }, [initialVoted, voteCount]);
  useEffect(() => {
    if (!inFlightRef.current.bookmark) {
      setBookmarked(initialBookmarked);
    }
  }, [initialBookmarked]);

  const run = async (action: PostAction, nextValue: boolean) => {
    const formData = new FormData();
    formData.set("postId", postId);
    formData.set("spaceSlug", spaceSlug);
    formData.set("desired", nextValue ? "on" : "off");
    ensureActionSucceeded(
      action === "vote"
        ? await togglePostVote(formData)
        : await toggleBookmark(formData)
    );
  };

  const toggle = async (action: PostAction) => {
    if (inFlightRef.current[action]) {
      return;
    }
    inFlightRef.current[action] = true;
    setPending((current) => ({ ...current, [action]: true }));
    setError("");

    const previousVoted = voted;
    const previousVotes = votes;
    const previousBookmarked = bookmarked;
    const nextValue = action === "vote" ? !voted : !bookmarked;
    if (action === "vote") {
      setVoted(nextValue);
      setVotes(Math.max(0, votes + (nextValue ? 1 : -1)));
    } else {
      setBookmarked(nextValue);
    }

    try {
      await run(action, nextValue);
    } catch {
      if (action === "vote") {
        setVoted(previousVoted);
        setVotes(previousVotes);
      } else {
        setBookmarked(previousBookmarked);
      }
      setError(actionError);
    } finally {
      inFlightRef.current[action] = false;
      setPending((current) => ({ ...current, [action]: false }));
    }
  };

  return (
    <div className={className}>
      <Button
        aria-busy={pending.vote || undefined}
        aria-label={voted ? "Remover apoio" : "Apoiar conteúdo"}
        aria-pressed={voted}
        className="min-h-11"
        onClick={() => toggle("vote")}
        size="sm"
        type="button"
        variant={voted ? "secondary" : "ghost"}
      >
        <ThumbsUpIcon aria-hidden="true" className="size-4" />
        {detailed ? (
          <>
            <span className="cp-action-label">Apoiar</span>
            <span className="cp-action-count">{votes}</span>
          </>
        ) : (
          <span>{votes}</span>
        )}
        <span className="sr-only">apoios</span>
      </Button>
      <Button
        aria-busy={pending.bookmark || undefined}
        aria-label={bookmarked ? "Remover dos salvos" : "Salvar publicação"}
        aria-pressed={bookmarked}
        className="min-h-11 gap-1.5 text-sm"
        onClick={() => toggle("bookmark")}
        size="sm"
        type="button"
        variant="ghost"
      >
        <BookmarkIcon
          aria-hidden="true"
          className="size-4"
          fill={bookmarked ? "currentColor" : "none"}
        />
        <span className="cp-action-label">
          {bookmarked ? "Salvo" : "Salvar"}
        </span>
      </Button>
      <CommunityPostShareButton path={sharePath} />
      {error ? (
        <span className="basis-full text-destructive text-xs" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
};
