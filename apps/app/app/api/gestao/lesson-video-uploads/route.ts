import { shouldPauseUploadDuringRollback } from "@repo/security/write-freeze";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { gestaoVideoUploadLimit } from "@/lib/gestao-lesson-video-upload";
import {
  createGestaoLessonVideoUpload,
  parseCreateGestaoLessonVideoUploadInput,
} from "@/lib/gestao-lesson-video-upload-actions";
import {
  authorizeGestaoVideoUpload,
  gestaoVideoUploadFaultResponse,
  gestaoVideoUploadJson,
  rateLimitGestaoVideoUpload,
} from "@/lib/gestao-lesson-video-upload-http";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const access = await authorizeGestaoVideoUpload();
  if ("response" in access) {
    return access.response;
  }
  if (
    shouldPauseUploadDuringRollback({
      method: request.method,
      pathname: new URL(request.url).pathname,
      enabled: env.UPLOADS_PAUSED_FOR_ROLLBACK === "true",
    })
  ) {
    return NextResponse.json(
      {
        code: "UPLOADS_PAUSED",
        error:
          "Envios de arquivos estão pausados durante a janela de segurança.",
        retryable: true,
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "private, no-store",
          "Retry-After": "3600",
        },
      }
    );
  }
  const limited = await rateLimitGestaoVideoUpload(access.actor.userId);
  if (limited) {
    return limited;
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return gestaoVideoUploadJson(
      { code: "INVALID", error: "Os dados do envio não são válidos." },
      400
    );
  }
  if (
    typeof raw === "object" &&
    raw !== null &&
    "sizeBytes" in raw &&
    typeof raw.sizeBytes === "number" &&
    raw.sizeBytes > gestaoVideoUploadLimit()
  ) {
    return gestaoVideoUploadJson(
      {
        code: "TOO_LARGE",
        error: `O vídeo precisa ter no máximo ${Math.floor(gestaoVideoUploadLimit() / 1_000_000)} MB.`,
      },
      413
    );
  }
  const input = parseCreateGestaoLessonVideoUploadInput(raw);
  if (!input) {
    return gestaoVideoUploadJson(
      {
        code: "INVALID",
        error: "Escolha um vídeo MP4 ou WebM e confira os dados da aula.",
      },
      400
    );
  }

  try {
    const session = await createGestaoLessonVideoUpload({
      actorId: access.actor.userId,
      input,
    });
    return gestaoVideoUploadJson(session);
  } catch (error) {
    return gestaoVideoUploadFaultResponse(error);
  }
}
