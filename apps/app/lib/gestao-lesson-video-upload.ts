import "server-only";

import { createClient } from "@supabase/supabase-js";

export {
  GESTAO_VIDEO_UPLOAD_DEFAULT_LIMIT,
  GESTAO_VIDEO_UPLOAD_SESSION_TTL_MS,
  GESTAO_VIDEO_UPLOAD_TOKEN_TTL_MS,
  type GestaoVideoMimeType,
  gestaoVideoExtension,
  hasGestaoVideoSignature,
  isGestaoVideoMimeType,
  normalizeGestaoVideoFileName,
} from "./gestao-video-file";

import { env } from "@/env";
import {
  GESTAO_VIDEO_UPLOAD_DEFAULT_LIMIT,
  hasGestaoVideoSignature,
} from "./gestao-video-file";

export const gestaoVideoUploadLimit = () =>
  env.GESTAO_VIDEO_MAX_UPLOAD_BYTES ?? GESTAO_VIDEO_UPLOAD_DEFAULT_LIMIT;

const supabaseHostnamePattern = /\.supabase\.co$/i;

const storageConfiguration = () => {
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!(supabaseUrl && secretKey)) {
    return null;
  }

  const url = new URL(supabaseUrl);
  const hostname = url.hostname.replace(
    supabaseHostnamePattern,
    ".storage.supabase.co"
  );
  const tusEndpoint = new URL("/storage/v1/upload/resumable", url);
  tusEndpoint.hostname = hostname;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;

  return {
    bucket: process.env.SUPABASE_STORAGE_BUCKET ?? "learning-assets",
    client: createClient(supabaseUrl, secretKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    }),
    publishableKey: publishableKey ?? null,
    tusEndpoint: tusEndpoint.toString(),
  };
};

export const getGestaoVideoUploadStorage = () => storageConfiguration();

export const createGestaoVideoUploadToken = async (storagePath: string) => {
  const configuration = storageConfiguration();
  if (!configuration) {
    return null;
  }
  const { data, error } = await configuration.client.storage
    .from(configuration.bucket)
    .createSignedUploadUrl(storagePath);
  if (error || !data?.token) {
    return null;
  }
  return {
    bucket: configuration.bucket,
    endpoint: configuration.tusEndpoint,
    publishableKey: configuration.publishableKey,
    token: data.token,
  };
};

export const inspectGestaoVideoStorageObject = async (storagePath: string) => {
  const configuration = storageConfiguration();
  if (!configuration) {
    return null;
  }
  const result = await configuration.client.storage
    .from(configuration.bucket)
    .info(storagePath);
  if (result.error || !result.data) {
    return null;
  }
  const sizeBytes = Number(result.data.size);
  const mimeType =
    typeof result.data.contentType === "string"
      ? result.data.contentType
      : null;
  if (!(Number.isSafeInteger(sizeBytes) && mimeType)) {
    return null;
  }
  return { mimeType, sizeBytes };
};

export const hasValidGestaoVideoStorageSignature = async (
  storagePath: string,
  mimeType: string
): Promise<boolean | null> => {
  const configuration = storageConfiguration();
  if (!configuration) {
    return null;
  }
  const { data, error } = await configuration.client.storage
    .from(configuration.bucket)
    .createSignedUrl(storagePath, 60);
  if (error || !data?.signedUrl) {
    return null;
  }

  let response: Response;
  try {
    response = await fetch(data.signedUrl, {
      cache: "no-store",
      headers: { Range: "bytes=0-15" },
    });
  } catch {
    return null;
  }
  if (response.status !== 206 || !response.body) {
    await response.body?.cancel();
    return null;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (byteLength < 16) {
      const part = await reader.read();
      if (part.done) {
        break;
      }
      const remaining = 16 - byteLength;
      const chunk = part.value.slice(0, remaining);
      chunks.push(chunk);
      byteLength += chunk.byteLength;
      if (part.value.byteLength > remaining) {
        await reader.cancel();
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return hasGestaoVideoSignature(mimeType, bytes);
};

export const deleteGestaoVideoStorageObject = async (storagePath: string) => {
  const configuration = storageConfiguration();
  if (!configuration) {
    return false;
  }
  const { error } = await configuration.client.storage
    .from(configuration.bucket)
    .remove([storagePath]);
  return !error;
};
