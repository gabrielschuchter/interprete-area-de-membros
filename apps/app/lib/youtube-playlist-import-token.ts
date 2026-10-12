import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { YouTubePlaylistItem } from "./youtube-verification";

const tokenPayloadSchema = z.object({
  actorId: z.string().min(1).max(128),
  expiresAt: z.number().int().positive(),
  playlistId: z.string().regex(/^[A-Za-z0-9_-]{10,128}$/),
  position: z.number().int().nonnegative(),
  purpose: z.literal("gestao.youtube-playlist-import.v1"),
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  videoTitle: z.string().max(1000),
});
const base64UrlPattern = /^[A-Za-z0-9_-]+$/;

export type YouTubePlaylistImportTokenPayload = z.infer<
  typeof tokenPayloadSchema
>;

const signatureFor = (encodedPayload: string, secret: string) =>
  createHmac("sha256", secret)
    .update(`gestao.youtube-playlist-import.v1.${encodedPayload}`)
    .digest("base64url");

export const createYouTubePlaylistImportToken = ({
  actorId,
  expiresAt,
  item,
  playlistId,
  secret,
}: {
  readonly actorId: string;
  readonly expiresAt: number;
  readonly item: YouTubePlaylistItem;
  readonly playlistId: string;
  readonly secret: string;
}) => {
  if (!(item.importable && item.metadata)) {
    return null;
  }

  const payload = tokenPayloadSchema.parse({
    actorId,
    expiresAt,
    playlistId,
    position: item.position,
    purpose: "gestao.youtube-playlist-import.v1",
    videoId: item.videoId,
    videoTitle: item.title,
  });
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url"
  );
  return `${encodedPayload}.${signatureFor(encodedPayload, secret)}`;
};

export const readYouTubePlaylistImportToken = (
  token: string,
  {
    actorId,
    now = Date.now(),
    secret,
  }: {
    readonly actorId: string;
    readonly now?: number;
    readonly secret: string;
  }
): YouTubePlaylistImportTokenPayload | null => {
  if (token.length > 2048) {
    return null;
  }
  const [encodedPayload, providedSignature, ...extra] = token.split(".");
  if (
    !(encodedPayload && providedSignature) ||
    extra.length > 0 ||
    !base64UrlPattern.test(encodedPayload) ||
    !base64UrlPattern.test(providedSignature)
  ) {
    return null;
  }

  const expectedBuffer = Buffer.from(
    signatureFor(encodedPayload, secret),
    "base64url"
  );
  const providedBuffer = Buffer.from(providedSignature, "base64url");
  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return null;
  }

  try {
    const payload = tokenPayloadSchema.parse(
      JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"))
    );
    return payload.actorId === actorId && payload.expiresAt > now
      ? payload
      : null;
  } catch {
    return null;
  }
};
