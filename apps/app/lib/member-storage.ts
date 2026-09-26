import "server-only";

import { randomUUID } from "node:crypto";

const TRAILING_SLASH = /\/$/;
const ALLOWED_PREFIXES = [
  "profile-assets/avatars/",
  "community-assets/covers/",
  "community-assets/inline/",
  "activity-assets/submissions/",
  "library-assets/",
] as const;

const storageConfig = () => ({
  supabaseUrl: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  secretKey:
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
  bucket: process.env.SUPABASE_STORAGE_BUCKET ?? "learning-assets",
});

const encodePath = (path: string) =>
  path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const extensionByMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "text/plain": "txt",
};

const safePathSegment = (value: string) =>
  value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 120) || "unassigned";

export const memberAssetUrl = (storagePath: string) =>
  `/api/member-assets?path=${encodeURIComponent(storagePath)}`;

export const memberAssetPathFromUrl = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value, "https://interprete.local");
    if (url.pathname !== "/api/member-assets") {
      return null;
    }
    return url.searchParams.get("path");
  } catch {
    return null;
  }
};

export const isMemberAssetPath = (storagePath: string) => {
  if (
    !storagePath ||
    storagePath.includes("..") ||
    storagePath.startsWith("/")
  ) {
    return false;
  }

  return ALLOWED_PREFIXES.some((prefix) => storagePath.startsWith(prefix));
};

export const isOwnedMemberAssetPath = (storagePath: string, memberId: string) =>
  isMemberAssetPath(storagePath) &&
  ALLOWED_PREFIXES.some((prefix) =>
    storagePath.startsWith(`${prefix}${memberId}/`)
  );

export const memberAssetExtension = (mimeType: string) =>
  extensionByMimeType[mimeType] ?? null;

export const createMemberAssetPath = ({
  kind,
  memberId,
  entityId,
  mimeType,
}: {
  kind: "avatar" | "cover" | "inline" | "submission" | "library";
  memberId: string;
  entityId?: string;
  mimeType: string;
}) => {
  const extension = memberAssetExtension(mimeType);

  if (!extension) {
    return null;
  }

  const prefix = {
    avatar: `profile-assets/avatars/${memberId}`,
    cover: `community-assets/covers/${memberId}`,
    inline: `community-assets/inline/${memberId}`,
    submission: `activity-assets/submissions/${memberId}/${safePathSegment(entityId ?? "unassigned")}`,
    library: "library-assets",
  }[kind];

  return `${prefix}/${randomUUID()}.${extension}`;
};

const storageObjectUrl = (storagePath: string) => {
  const { supabaseUrl, bucket } = storageConfig();

  if (!supabaseUrl) {
    return null;
  }

  return `${supabaseUrl.replace(TRAILING_SLASH, "")}/storage/v1/object/${encodeURIComponent(bucket)}/${encodePath(storagePath)}`;
};

const storageHeaders = () => {
  const { secretKey } = storageConfig();

  return secretKey
    ? { Authorization: `Bearer ${secretKey}`, apikey: secretKey }
    : null;
};

export const uploadMemberAsset = async ({
  storagePath,
  body,
  mimeType,
}: {
  storagePath: string;
  body: ArrayBuffer;
  mimeType: string;
}) => {
  const url = storageObjectUrl(storagePath);
  const headers = storageHeaders();

  if (!(url && headers && isMemberAssetPath(storagePath))) {
    throw new Error("Storage de membros não está configurado.");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": mimeType,
      "Content-Length": String(body.byteLength),
      "x-upsert": "true",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Upload de asset falhou (${response.status}).`);
  }

  return storagePath;
};

export const deleteMemberAsset = async (storagePath: string) => {
  const url = storageObjectUrl(storagePath);
  const headers = storageHeaders();

  if (!(url && headers && isMemberAssetPath(storagePath))) {
    return false;
  }

  const response = await fetch(url, { method: "DELETE", headers });
  return response.ok || response.status === 404;
};

export const createMemberAssetSignedUrl = async (
  storagePath: string,
  expiresIn = 300
) => {
  const { supabaseUrl, secretKey, bucket } = storageConfig();

  if (!(supabaseUrl && secretKey && isMemberAssetPath(storagePath))) {
    return null;
  }

  const response = await fetch(
    `${supabaseUrl.replace(TRAILING_SLASH, "")}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodePath(storagePath)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        apikey: secretKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { signedURL?: string };

  if (!payload.signedURL) {
    return null;
  }

  return payload.signedURL.startsWith("http")
    ? payload.signedURL
    : `${supabaseUrl.replace(TRAILING_SLASH, "")}/storage/v1${payload.signedURL}`;
};
