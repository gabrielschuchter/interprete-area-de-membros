import "server-only";

import { NextResponse } from "next/server";
import { authorizeGestao } from "./gestao-authorization";
import { LessonVideoUploadFault } from "./gestao-lesson-video-upload-actions";
import {
  consumeMutationRateLimit,
  isMutationRateLimitError,
} from "./mutation-reliability";

const responseHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie",
};

export const gestaoVideoUploadJson = (
  body: unknown,
  status = 200,
  headers: HeadersInit = {}
) =>
  NextResponse.json(body, {
    status,
    headers: { ...responseHeaders, ...headers },
  });

export const authorizeGestaoVideoUpload = async () => {
  const decision = await authorizeGestao("content.manage");
  if (!decision.allowed) {
    return {
      response: gestaoVideoUploadJson(
        { code: "FORBIDDEN", error: "Você não pode editar este conteúdo." },
        403
      ),
    } as const;
  }
  return { actor: decision.actor } as const;
};

export const rateLimitGestaoVideoUpload = async (actorId: string) => {
  try {
    await consumeMutationRateLimit({
      action: "asset.upload",
      memberId: actorId,
    });
    return null;
  } catch (error) {
    if (isMutationRateLimitError(error)) {
      return gestaoVideoUploadJson(
        {
          code: "RATE_LIMITED",
          error:
            "Você enviou muitos arquivos. Aguarde antes de tentar novamente.",
          retryAfterSeconds: error.retryAfterSeconds,
        },
        429,
        { "Retry-After": String(error.retryAfterSeconds) }
      );
    }
    throw error;
  }
};

export const gestaoVideoUploadFaultResponse = (error: unknown) => {
  if (error instanceof LessonVideoUploadFault) {
    return gestaoVideoUploadJson(
      { code: error.code, error: error.message },
      error.status
    );
  }
  return gestaoVideoUploadJson(
    {
      code: "UNAVAILABLE",
      error: "Não foi possível concluir o envio do vídeo. Tente novamente.",
    },
    500
  );
};
