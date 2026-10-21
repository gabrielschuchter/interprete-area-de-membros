"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { MessageCircleIcon, XIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { CommentComposer } from "./comment-composer";

interface ReplyContext {
  readonly authorName: string;
  readonly content: string;
  readonly deleted: boolean;
  readonly parentId: string;
}

interface CommunityCommentDialogProperties {
  readonly currentProfile?: {
    readonly avatarUrl: string | null;
    readonly displayName: string | null;
    readonly username: string;
  } | null;
  readonly postId: string;
  readonly replyContext?: ReplyContext;
  readonly spaceSlug: string;
}

export function CommunityCommentDialog({
  currentProfile,
  postId,
  replyContext,
  spaceSlug,
}: CommunityCommentDialogProperties) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const isReply = Boolean(replyContext);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <>
      {isReply ? (
        <button
          aria-haspopup="dialog"
          className="community-comment__reply-toggle"
          onClick={() => setOpen(true)}
          type="button"
        >
          <MessageCircleIcon aria-hidden="true" /> Responder
        </button>
      ) : (
        <button
          aria-haspopup="dialog"
          className="community-comment-launcher"
          onClick={() => setOpen(true)}
          type="button"
        >
          <MessageCircleIcon aria-hidden="true" />
          <span>Escreva um comentário…</span>
        </button>
      )}
      <dialog
        aria-labelledby={titleId}
        className="community-comment-dialog"
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
        ref={dialogRef}
      >
        {open && (
          <div className="community-comment-dialog__content">
            <header className="community-comment-dialog__header">
              <div>
                <p className="community-comment-dialog__eyebrow">
                  {isReply ? "RESPOSTA" : "DISCUSSÃO"}
                </p>
                <h2 className="community-comment-dialog__title" id={titleId}>
                  {isReply ? "Responder" : "Comentar publicação"}
                </h2>
              </div>
              <Button
                aria-label="Fechar composição"
                onClick={() => setOpen(false)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <XIcon aria-hidden="true" />
              </Button>
            </header>
            {replyContext && (
              <div className="community-comment-dialog__context">
                <span className="community-comment-dialog__context-label">
                  Respondendo a {replyContext.authorName}
                </span>
                <p>
                  {replyContext.deleted
                    ? "Comentário removido"
                    : replyContext.content || "Comentário"}
                </p>
              </div>
            )}
            <CommentComposer
              ariaLabel={isReply ? "Sua resposta" : "Sua contribuição"}
              autoFocus
              className="community-comment-composer community-comment-composer--dialog"
              currentProfile={currentProfile}
              helperText="Use @ para mencionar alguém."
              onSuccess={() => setOpen(false)}
              parentId={replyContext?.parentId}
              placeholder={
                isReply
                  ? "Escreva uma resposta… Use @nome para mencionar alguém."
                  : "Acrescente uma leitura, uma pergunta ou uma referência…"
              }
              postId={postId}
              spaceSlug={spaceSlug}
            />
          </div>
        )}
      </dialog>
    </>
  );
}
