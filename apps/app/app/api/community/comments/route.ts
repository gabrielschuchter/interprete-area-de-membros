import { auth } from "@repo/auth/server";
import type { Prisma } from "@repo/database";
import { NextResponse } from "next/server";
import {
  plainTextFromDocument,
  sanitizeRichDocument,
} from "@/lib/community-content";
import { createCommunityComment } from "@/lib/community-mutations";
import { readIdempotencyKey } from "@/lib/mutation-contract";
import { isMutationRateLimitError } from "@/lib/mutation-reliability";

const errorResponse = (error: string, status: number) =>
  NextResponse.json({ ok: false, error }, { status });

const contentFromRequest = (
  body: Record<string, unknown>,
  document: ReturnType<typeof sanitizeRichDocument>
) => {
  if (document) {
    return plainTextFromDocument(document).trim();
  }
  if (typeof body.content === "string") {
    return body.content.trim();
  }
  return "";
};

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return errorResponse("Você precisa entrar para comentar.", 401);
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return errorResponse("Dados de comentário inválidos.", 422);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return errorResponse("Dados de comentário inválidos.", 422);
  }

  const postId = typeof body.postId === "string" ? body.postId.trim() : "";
  const parentId =
    typeof body.parentId === "string" && body.parentId.trim()
      ? body.parentId.trim()
      : null;
  const spaceSlug =
    typeof body.spaceSlug === "string" && body.spaceSlug.trim()
      ? body.spaceSlug.trim()
      : undefined;
  const idempotencyKey = readIdempotencyKey(body.idempotencyKey);
  const document = sanitizeRichDocument(body.contentDocument);
  const content = contentFromRequest(body, document);

  if (!(postId && idempotencyKey && content) || content.length > 10_000) {
    return errorResponse(
      "Escreva um comentário de até 10.000 caracteres e tente novamente.",
      422
    );
  }

  try {
    const result = await createCommunityComment({
      actorId: userId,
      content,
      document: document as Prisma.InputJsonValue | undefined,
      groupMentionConfirmed: body.confirmGroupMention === true,
      idempotencyKey,
      parentId,
      postId,
      requestId: request.headers.get("x-request-id") ?? undefined,
      spaceSlug,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (isMutationRateLimitError(error)) {
      return NextResponse.json(
        {
          ok: false,
          code: "RATE_LIMITED",
          error:
            "Você está fazendo muitas ações em sequência. Tente novamente em alguns segundos.",
          retryAfterSeconds: error.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds) },
        }
      );
    }

    return errorResponse(
      error instanceof Error
        ? error.message
        : "Não foi possível publicar o comentário.",
      409
    );
  }
}
