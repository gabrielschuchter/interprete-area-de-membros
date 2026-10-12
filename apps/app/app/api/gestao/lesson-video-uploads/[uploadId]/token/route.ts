import { shouldPauseUploadDuringRollback } from "@repo/security/write-freeze";
import { NextResponse } from "next/server";
import { env } from "@/env";
import { resumeGestaoLessonVideoUpload } from "@/lib/gestao-lesson-video-upload-actions";
import {
  authorizeGestaoVideoUpload,
  gestaoVideoUploadFaultResponse,
  gestaoVideoUploadJson,
  rateLimitGestaoVideoUpload,
} from "@/lib/gestao-lesson-video-upload-http";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  request: Request,
  { params }: { readonly params: Promise<{ uploadId: string }> }
) {
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
      { code: "UPLOADS_PAUSED", error: "Envios de arquivos estão pausados." },
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
  const { uploadId } = await params;
  try {
    return gestaoVideoUploadJson(
      await resumeGestaoLessonVideoUpload({
        actorId: access.actor.userId,
        uploadId,
      })
    );
  } catch (error) {
    return gestaoVideoUploadFaultResponse(error);
  }
}
