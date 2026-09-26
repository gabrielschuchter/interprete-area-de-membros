"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import { MentionTextarea } from "./mention-textarea";

interface CommentComposerProperties {
  readonly ariaLabel?: string;
  readonly className?: string;
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
  className,
  parentId,
  placeholder = "Acrescente uma leitura, uma pergunta ou uma referência... Use @nome para mencionar alguém.",
  postId,
  spaceSlug,
}: CommentComposerProperties) => {
  const router = useRouter();
  const attemptKeyRef = useRef<string>(newAttemptKey());
  const submittingRef = useRef(false);
  const [composerVersion, setComposerVersion] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

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
    <form aria-busy={pending} className={className} onSubmit={handleSubmit}>
      <input name="postId" type="hidden" value={postId} />
      <input name="spaceSlug" type="hidden" value={spaceSlug} />
      {parentId ? (
        <input name="parentId" type="hidden" value={parentId} />
      ) : null}
      <label
        className="block"
        htmlFor={parentId ? `reply-${parentId}` : "comment-content"}
      >
        <span className="brand-eyebrow">{ariaLabel}</span>
        <MentionTextarea
          aria-label={ariaLabel}
          className="mt-3 min-h-32 w-full rounded-sm border bg-background px-3 py-3 text-base leading-7 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35"
          disabled={pending}
          id={parentId ? `reply-${parentId}` : "comment-content"}
          key={composerVersion}
          name="content"
          onChange={() => {
            if (error) {
              attemptKeyRef.current = newAttemptKey();
              setError("");
            }
          }}
          placeholder={placeholder}
          required
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span aria-live="polite" className="text-muted-foreground text-xs">
          {statusMessage(pending, error, success)}
        </span>
        <Button disabled={pending} type="submit">
          {submitLabel(pending, error)}
        </Button>
      </div>
      {error ? (
        <p className="mt-2 text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
};
