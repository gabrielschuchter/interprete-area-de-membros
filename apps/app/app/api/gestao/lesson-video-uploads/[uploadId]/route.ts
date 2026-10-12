import { cancelGestaoLessonVideoUpload } from "@/lib/gestao-lesson-video-upload-actions";
import {
  authorizeGestaoVideoUpload,
  gestaoVideoUploadFaultResponse,
  gestaoVideoUploadJson,
} from "@/lib/gestao-lesson-video-upload-http";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function DELETE(
  _request: Request,
  { params }: { readonly params: Promise<{ uploadId: string }> }
) {
  const access = await authorizeGestaoVideoUpload();
  if ("response" in access) {
    return access.response;
  }
  const { uploadId } = await params;
  try {
    return gestaoVideoUploadJson(
      await cancelGestaoLessonVideoUpload({
        actorId: access.actor.userId,
        uploadId,
      })
    );
  } catch (error) {
    return gestaoVideoUploadFaultResponse(error);
  }
}
