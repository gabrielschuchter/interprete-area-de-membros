import { database, MemberRole } from "@repo/database";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMemberRole } from "@/lib/authorization";
import { MemberImageError, normalizeMemberImage } from "@/lib/member-image";
import {
  createRecordingThumbnailPath,
  createRecordingThumbnailSignedUrl,
  deleteRecordingThumbnail,
  uploadRecordingThumbnail,
} from "@/lib/recording-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RecordingThumbnailRouteProperties {
  readonly params: Promise<{ recordingId: string }>;
}

const staffCanManage = (role: MemberRole) =>
  role === MemberRole.ADMIN || role === MemberRole.TEACHER;

const getAuthorizedRecording = async (
  recordingId: string,
  memberId: string
) => {
  const [role, recording] = await Promise.all([
    getMemberRole(memberId),
    database.importedRecording.findUnique({
      where: { id: recordingId },
      select: { id: true, group: { select: { memberId: true } } },
    }),
  ]);

  if (
    !(
      recording &&
      (staffCanManage(role) || recording.group.memberId === memberId)
    )
  ) {
    return null;
  }

  return { role, recording };
};

export const GET = async (
  _request: Request,
  { params }: RecordingThumbnailRouteProperties
) => {
  const { userId } = await auth();
  const { recordingId } = await params;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const recording = await database.importedRecording.findUnique({
    where: { id: recordingId },
    select: {
      thumbnailPath: true,
      group: { select: { memberId: true } },
    },
  });
  if (!recording) {
    return NextResponse.json(
      { error: "Capa não encontrada." },
      { status: 404 }
    );
  }

  const role = await getMemberRole(userId);
  if (!(staffCanManage(role) || recording.group.memberId === userId)) {
    return NextResponse.json(
      { error: "Capa não encontrada." },
      { status: 404 }
    );
  }
  if (!recording.thumbnailPath) {
    return NextResponse.json(
      { error: "Esta gravação ainda não tem capa." },
      { status: 404 }
    );
  }

  const signedUrl = await createRecordingThumbnailSignedUrl(
    recording.thumbnailPath
  );
  if (!signedUrl) {
    return NextResponse.json(
      { error: "A capa não está disponível agora." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const upstream = await fetch(signedUrl, { cache: "no-store" });
  if (!(upstream.ok && upstream.body)) {
    return NextResponse.json(
      { error: "A capa não pôde ser lida." },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }

  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "Content-Type": upstream.headers.get("content-type") ?? "image/webp",
    "X-Content-Type-Options": "nosniff",
    Vary: "Cookie",
  });
  const contentLength = upstream.headers.get("content-length");
  if (contentLength) {
    headers.set("Content-Length", contentLength);
  }
  return new Response(upstream.body, { headers });
};

export const POST = async (
  request: Request,
  { params }: RecordingThumbnailRouteProperties
) => {
  const { userId } = await auth();
  const { recordingId } = await params;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const authorized = await getAuthorizedRecording(recordingId, userId);
  if (!(authorized && staffCanManage(authorized.role))) {
    return NextResponse.json(
      { error: "Acesso não autorizado." },
      { status: 403 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Escolha uma imagem." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: "A imagem precisa ter entre 1 byte e 5 MB." },
      { status: 400 }
    );
  }

  let normalized: Awaited<ReturnType<typeof normalizeMemberImage>>;
  try {
    normalized = await normalizeMemberImage(file, "cover");
  } catch (error) {
    const message =
      error instanceof MemberImageError
        ? error.message
        : "Não foi possível processar esta capa.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const storagePath = createRecordingThumbnailPath(recordingId);
  const body = normalized.body.buffer.slice(
    normalized.body.byteOffset,
    normalized.body.byteOffset + normalized.body.byteLength
  ) as ArrayBuffer;

  try {
    await uploadRecordingThumbnail({ storagePath, body });
    const current = await database.importedRecording.findUnique({
      where: { id: recordingId },
      select: { thumbnailPath: true },
    });
    await database.importedRecording.update({
      where: { id: recordingId },
      data: {
        thumbnailHeight: normalized.height,
        thumbnailMimeType: normalized.mimeType,
        thumbnailPath: storagePath,
        thumbnailSizeBytes: normalized.size,
        thumbnailWidth: normalized.width,
      },
    });

    if (current?.thumbnailPath && current.thumbnailPath !== storagePath) {
      await deleteRecordingThumbnail(current.thumbnailPath);
    }

    return NextResponse.json({
      height: normalized.height,
      mimeType: normalized.mimeType,
      path: storagePath,
      url: `/api/learning/recordings/${recordingId}/thumbnail`,
      width: normalized.width,
    });
  } catch (error) {
    await deleteRecordingThumbnail(storagePath);
    console.error("Recording thumbnail upload failed", {
      error: error instanceof Error ? error.message : "unknown_error",
      recordingId,
      userId,
    });
    return NextResponse.json(
      { error: "Não foi possível salvar a capa agora." },
      { status: 500 }
    );
  }
};

export const DELETE = async (
  _request: Request,
  { params }: RecordingThumbnailRouteProperties
) => {
  const { userId } = await auth();
  const { recordingId } = await params;
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const authorized = await getAuthorizedRecording(recordingId, userId);
  if (!(authorized && staffCanManage(authorized.role))) {
    return NextResponse.json(
      { error: "Acesso não autorizado." },
      { status: 403 }
    );
  }

  const current = await database.importedRecording.findUnique({
    where: { id: recordingId },
    select: { thumbnailPath: true },
  });
  await database.importedRecording.update({
    where: { id: recordingId },
    data: {
      thumbnailHeight: null,
      thumbnailMimeType: null,
      thumbnailPath: null,
      thumbnailSizeBytes: null,
      thumbnailWidth: null,
    },
  });
  if (current?.thumbnailPath) {
    await deleteRecordingThumbnail(current.thumbnailPath);
  }

  return NextResponse.json({ ok: true });
};
