"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useRef, useState } from "react";
import { MentionTextarea } from "./mention-textarea";

interface CommentComposerProperties {
  readonly ariaLabel?: string;
  readonly autoFocus?: boolean;
  readonly className?: string;
  readonly currentProfile?: {
    readonly avatarUrl: string | null;
    readonly displayName: string | null;
    readonly username: string;
  } | null;
  readonly helperText?: string;
  readonly onSuccess?: () => void;
  readonly parentId?: string;
  readonly placeholder?: string;
  readonly postId: string;
  readonly spaceSlug: string;
}

interface CommentResponse {
  readonly error?: string;
  readonly ok?: boolean;
  readonly retryAfterSeconds?: number;
}

const newAttemptKey = () => crypto.randomUUID();
const nameWordsPattern = /\s+/;

const parseDocument = (formData: FormData) => {
  const rawDocument = formData.get("contentDocument");
  if (typeof rawDocument !== "string") {
    return undefined;
  }
  try {
    return JSON.parse(rawDocument) as unknown;
  } catch {
    return undefined;
  }
};

const submitComment = async ({
  formData,
  idempotencyKey,
  parentId,
  postId,
  spaceSlug,
}: {
  readonly formData: FormData;
  readonly idempotencyKey: string;
  readonly parentId?: string;
  readonly postId: string;
  readonly spaceSlug: string;
}) => {
  const response = await fetch("/api/community/comments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Request-Id": idempotencyKey,
    },
    body: JSON.stringify({
      postId,
      parentId: parentId ?? null,
      spaceSlug: spaceSlug || undefined,
      content: formData.get("content"),
      contentDocument: parseDocument(formData),
      confirmGroupMention: formData.get("confirmGroupMention") === "1",
      idempotencyKey,
    }),
  });
  const payload = (await response.json()) as CommentResponse;

  if (!(response.ok && payload.ok)) {
    const fallback =
      response.status === 429
        ? "Você está fazendo muitas ações em sequência. Tente novamente em alguns segundos."
        : "Não foi possível publicar o comentário.";
    throw new Error(payload.error ?? fallback);
  }

  return payload;
};

const statusMessage = (pending: boolean, error: string, success: boolean) => {
  if (pending) {
    return "Enviando…";
  }
  if (error) {
    return "Falha ao enviar · o texto foi preservado";
  }
  if (success) {
    return "Comentário publicado";
  }
  return "";
};

const submitLabel = (pending: boolean, error: string) => {
  if (pending) {
    return "Enviando…";
  }
  return error ? "Tentar novamente" : "Comentar";
};

export const CommentComposer = ({
  ariaLabel = "Sua contribuição",
  autoFocus = false,
  className,
  helperText,
  currentProfile,
  onSuccess,
  parentId,
  placeholder = "Acrescente uma leitura, uma pergunta ou uma referência... Use @nome para mencionar alguém.",
  postId,
  spaceSlug,
}: CommentComposerProperties) => {
  const router = useRouter();
  const contentId = useId().replaceAll(":", "");
  const attemptKeyRef = useRef<string>(newAttemptKey());
  const submittingRef = useRef(false);
  const [composerVersion, setComposerVersion] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setPending(true);
    setError("");
    setSuccess(false);

    const formData = new FormData(event.currentTarget);
    try {
      await submitComment({
        formData,
        idempotencyKey: attemptKeyRef.current,
        parentId,
        postId,
        spaceSlug,
      });
      attemptKeyRef.current = newAttemptKey();
      setSuccess(true);
      setComposerVersion((current) => current + 1);
      setHasContent(false);
      onSuccess?.();
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Não foi possível publicar o comentário. Tente novamente."
      );
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  };

  return (
    <form
      aria-busy={pending}
      className={cn("community-comment-composer", className)}
      onSubmit={handleSubmit}
    >
      <input name="postId" type="hidden" value={postId} />
      <input name="spaceSlug" type="hidden" value={spaceSlug} />
      {parentId ? (
        <input name="parentId" type="hidden" value={parentId} />
      ) : null}
      <div className="community-comment-composer__row">
        <Avatar
          aria-hidden="true"
          className="community-comment-composer__avatar"
        >
          {currentProfile?.avatarUrl && (
            <AvatarImage alt="" src={currentProfile.avatarUrl} />
          )}
          <AvatarFallback>
            {(currentProfile?.displayName ?? currentProfile?.username ?? "M")
              .split(nameWordsPattern)
              .slice(0, 2)
              .map((part) => part[0])
              .join("")
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="community-comment-composer__fields">
          <label className="block" htmlFor={contentId}>
            <span className="brand-eyebrow">{ariaLabel}</span>
            <MentionTextarea
              aria-label={ariaLabel}
              autoFocus={autoFocus}
              className="community-comment-textarea"
              disabled={pending}
              id={contentId}
              key={composerVersion}
              name="content"
              onChange={(value) => {
                setHasContent(Boolean(value.trim()));
                if (error) {
                  attemptKeyRef.current = newAttemptKey();
                  setError("");
                }
              }}
              placeholder={placeholder}
              postId={postId}
              required
            />
          </label>
          {helperText ? (
            <p className="community-comment-composer__hint">{helperText}</p>
          ) : null}
          <div className="community-comment-composer__footer">
            <span aria-live="polite" className="text-muted-foreground text-xs">
              {statusMessage(pending, error, success)}
            </span>
            <Button disabled={pending || !hasContent} type="submit">
              {submitLabel(pending, error)}
            </Button>
          </div>
          {error ? (
            <p className="mt-2 text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
};
