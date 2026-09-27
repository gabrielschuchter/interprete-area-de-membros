import "server-only";

import { randomUUID } from "node:crypto";

const TRAILING_SLASH = /\/$/;
const RECORDING_THUMBNAIL_PREFIX = "recording-thumbnails/";

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

export const isRecordingThumbnailPath = (storagePath: string) =>
  Boolean(
    storagePath &&
      !storagePath.includes("..") &&
      !storagePath.startsWith("/") &&
      storagePath.startsWith(RECORDING_THUMBNAIL_PREFIX)
  );

export const createRecordingThumbnailPath = (recordingId: string) =>
  `${RECORDING_THUMBNAIL_PREFIX}${recordingId}/${randomUUID()}.webp`;

export const uploadRecordingThumbnail = async ({
  storagePath,
  body,
}: {
  storagePath: string;
  body: ArrayBuffer;
}) => {
  const url = storageObjectUrl(storagePath);
  const headers = storageHeaders();

  if (!(url && headers && isRecordingThumbnailPath(storagePath))) {
    throw new Error("Storage de gravações não está configurado.");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "image/webp",
      "Content-Length": String(body.byteLength),
      "x-upsert": "true",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Upload da capa falhou (${response.status}).`);
  }

  return storagePath;
};

export const deleteRecordingThumbnail = async (storagePath: string) => {
  const url = storageObjectUrl(storagePath);
  const headers = storageHeaders();

  if (!(url && headers && isRecordingThumbnailPath(storagePath))) {
    return false;
  }

  const response = await fetch(url, { method: "DELETE", headers });
  return response.ok || response.status === 404;
};

export const createRecordingThumbnailSignedUrl = async (
  storagePath: string,
  expiresIn = 300
) => {
  const { supabaseUrl, secretKey, bucket } = storageConfig();

  if (!(supabaseUrl && secretKey && isRecordingThumbnailPath(storagePath))) {
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
