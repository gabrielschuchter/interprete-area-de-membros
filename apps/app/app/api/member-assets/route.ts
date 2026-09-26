import { auth } from "@repo/auth/server";
import { database, MemberRole } from "@repo/database";
import { NextResponse } from "next/server";
import {
  createMemberAssetPath,
  createMemberAssetSignedUrl,
  deleteMemberAsset,
  isMemberAssetPath,
  isOwnedMemberAssetPath,
  memberAssetUrl,
  uploadMemberAsset,
} from "@/lib/member-storage";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_LIBRARY_BYTES = 20 * 1024 * 1024;
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const libraryTypes = new Set([...imageTypes, "application/pdf", "text/plain"]);

// Sharp's native Linux bindings require the Node.js runtime in Vercel. Keep
// image processing isolated from the Bun runtime used by the rest of the app.
export const runtime = "nodejs";

const hasImageSignature = async (file: File) => {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());

  if (file.type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (file.type === "image/png") {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value
    );
  }

  return (
    file.type === "image/webp" &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
};

const hasLibrarySignature = async (file: File) => {
  if (imageTypes.has(file.type)) {
    return hasImageSignature(file);
  }
  if (file.type === "application/pdf") {
    const bytes = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    return String.fromCharCode(...bytes) === "%PDF-";
  }
  return file.type === "text/plain";
};

const unauthorized = () =>
  NextResponse.json({ error: "Não autenticado." }, { status: 401 });

const getPath = (request: Request) =>
  new URL(request.url).searchParams.get("path")?.trim() ?? "";

const canReadPath = async (path: string, userId: string) => {
  if (!isMemberAssetPath(path)) {
    return false;
  }

  if (
    path.startsWith("community-assets/") ||
    path.startsWith("library-assets/")
  ) {
    return true;
  }

  if (isOwnedMemberAssetPath(path, userId)) {
    return true;
  }

  const member = await database.member.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  return (
    member?.role === MemberRole.ADMIN || member?.role === MemberRole.TEACHER
  );
};

export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return unauthorized();
  }

  const path = getPath(request);

  if (!(await canReadPath(path, userId))) {
    return NextResponse.json(
      { error: "Asset não encontrado." },
      { status: 404 }
    );
  }

  const signedUrl = await createMemberAssetSignedUrl(path);

  if (!signedUrl) {
    return NextResponse.json(
      { error: "Asset não encontrado." },
      { status: 404 }
    );
  }

  // Do not redirect the browser to Supabase here. The app deliberately uses
  // Cross-Origin-Embedder-Policy: require-corp, while a signed Storage URL is
  // served by another origin and does not carry the CORP header required by
  // the browser. Proxy the already-authorized bytes through this same-origin
  // route instead; the bucket remains private and no signed URL is persisted.
  const assetResponse = await fetch(signedUrl, {
    cache: "no-store",
  });

  if (!(assetResponse.ok && assetResponse.body)) {
    return NextResponse.json(
      { error: "Asset não encontrado." },
      { status: 404 }
    );
  }

  const headers = new Headers({
    "Cache-Control": "private, max-age=300, stale-while-revalidate=60",
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
  });
  const contentType = assetResponse.headers.get("content-type");
  const contentLength = assetResponse.headers.get("content-length");

  if (contentType) {
    headers.set("Content-Type", contentType);
  }
  if (contentLength) {
    headers.set("Content-Length", contentLength);
  }

  return new Response(assetResponse.body, { headers });
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this endpoint deliberately keeps authentication, validation, normalization, authorization, and storage atomic.
export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return unauthorized();
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const assetType = formData.get("assetType");
  const entityId = formData.get("entityId");

  const kindByType = {
    avatar: "avatar",
    "community-cover": "cover",
    "community-inline": "inline",
    "activity-submission": "submission",
    library: "library",
  } as const;
  const kind = kindByType[assetType as keyof typeof kindByType];

  if (!kind) {
    return NextResponse.json(
      { error: "Tipo de asset inválido." },
      { status: 400 }
    );
  }

  const allowedTypes = kind === "library" ? libraryTypes : imageTypes;
  if (!(file instanceof File && allowedTypes.has(file.type))) {
    return NextResponse.json(
      {
        error:
          kind === "library"
            ? "Envie JPG, PNG, WebP, PDF ou texto."
            : "Envie uma imagem JPG, PNG ou WebP.",
      },
      { status: 400 }
    );
  }

  const maxBytes = kind === "library" ? MAX_LIBRARY_BYTES : MAX_IMAGE_BYTES;
  if (file.size <= 0 || file.size > maxBytes) {
    return NextResponse.json(
      {
        error:
          kind === "library"
            ? "O arquivo deve ter entre 1 byte e 20 MB."
            : "A imagem deve ter entre 1 byte e 5 MB.",
      },
      { status: 400 }
    );
  }

  if (!(await hasLibrarySignature(file))) {
    return NextResponse.json(
      { error: "O conteúdo do arquivo não corresponde ao tipo informado." },
      { status: 400 }
    );
  }

  if (kind === "library") {
    const member = await database.member.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (
      member?.role !== MemberRole.ADMIN &&
      member?.role !== MemberRole.TEACHER
    ) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
  }

  let body: ArrayBuffer = await file.arrayBuffer();
  let storageMimeType = file.type;
  let imageMetadata: {
    inputMimeType: string;
    inputSize: number;
    inputWidth: number;
    inputHeight: number;
    width: number;
    height: number;
    size: number;
  } | null = null;

  if (imageTypes.has(file.type)) {
    try {
      const { normalizeMemberImage } = await import("@/lib/member-image");
      const normalized = await normalizeMemberImage(file, kind);
      body = normalized.body.buffer.slice(
        normalized.body.byteOffset,
        normalized.body.byteOffset + normalized.body.byteLength
      ) as ArrayBuffer;
      storageMimeType = normalized.mimeType;
      imageMetadata = normalized;
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error && error.name === "MemberImageError"
              ? error.message
              : "Não foi possível processar a imagem.",
        },
        { status: 400 }
      );
    }
  }

  const path = createMemberAssetPath({
    kind,
    memberId: userId,
    entityId: typeof entityId === "string" ? entityId : undefined,
    mimeType: storageMimeType,
  });

  if (!path) {
    return NextResponse.json(
      { error: "Tipo de imagem inválido." },
      { status: 400 }
    );
  }

  await uploadMemberAsset({
    storagePath: path,
    body,
    mimeType: storageMimeType,
  });

  return NextResponse.json({
    path,
    url: memberAssetUrl(path),
    mimeType: storageMimeType,
    ...(imageMetadata
      ? {
          inputMimeType: imageMetadata.inputMimeType,
          inputSize: imageMetadata.inputSize,
          inputWidth: imageMetadata.inputWidth,
          inputHeight: imageMetadata.inputHeight,
          width: imageMetadata.width,
          height: imageMetadata.height,
          size: imageMetadata.size,
        }
      : { size: file.size }),
  });
}

export async function DELETE(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return unauthorized();
  }

  const path = getPath(request);

  if (!isOwnedMemberAssetPath(path, userId)) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  await deleteMemberAsset(path);
  return NextResponse.json({ ok: true });
}
