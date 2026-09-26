import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getAccessibleAsset } from "@/lib/content-access";
import { requireMemberId } from "@/lib/learning";
import {
  createLearningAssetSignedUrl,
  getLearningAssetStorageHeaders,
  getLearningAssetStorageUrl,
} from "@/lib/learning-storage";

export const dynamic = "force-dynamic";

interface AssetRouteProperties {
  readonly params: Promise<{ assetId: string }>;
}

const safeExternalUrl = (value: string | null) => {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
};

const isHlsAsset = (mimeType: string | null) =>
  mimeType === "application/vnd.apple.mpegurl" ||
  mimeType === "application/x-mpegURL" ||
  mimeType === "audio/mpegurl";
const hlsLineBreaks = /\r?\n/;
const hlsUriAttribute = /URI="([^"]+)"/;
const HLS_TOKEN_TTL_SECONDS = 60 * 30;

interface HlsPlaybackTokenPayload {
  readonly assetId: string;
  readonly directory: string;
  readonly expiresAt: number;
  readonly memberId: string;
}

const encodeTokenPart = (value: string) =>
  Buffer.from(value, "utf8").toString("base64url");

const hlsTokenSecret = () =>
  process.env.LEARNING_ASSET_TOKEN_SECRET ??
  process.env.SUPABASE_SECRET_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  null;

const signHlsPlaybackToken = (
  assetId: string,
  memberId: string,
  directory: string,
  expiresInSeconds = HLS_TOKEN_TTL_SECONDS
) => {
  const secret = hlsTokenSecret();
  if (!secret) {
    return null;
  }

  const payload: HlsPlaybackTokenPayload = {
    assetId,
    memberId,
    directory,
    expiresAt: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };
  const encodedPayload = encodeTokenPart(JSON.stringify(payload));
  const signature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
  return `${encodedPayload}.${signature}`;
};

const verifyHlsPlaybackToken = (
  token: string | null,
  assetId: string,
  memberId: string,
  storagePath: string
) => {
  const secret = hlsTokenSecret();
  if (!(secret && token)) {
    return null;
  }

  const [encodedPayload, providedSignature] = token.split(".");
  if (!(encodedPayload && providedSignature)) {
    return null;
  }

  const expectedSignature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
  const expectedBuffer = Buffer.from(expectedSignature);
  const providedBuffer = Buffer.from(providedSignature);
  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as Partial<HlsPlaybackTokenPayload>;
    const playlistDirectory = storagePath.slice(
      0,
      storagePath.lastIndexOf("/") + 1
    );
    const tokenAssetId = payload.assetId;
    const tokenMemberId = payload.memberId;
    const directory = payload.directory;
    const expiresAt = payload.expiresAt;
    if (
      typeof tokenAssetId !== "string" ||
      typeof tokenMemberId !== "string" ||
      typeof directory !== "string" ||
      typeof expiresAt !== "number" ||
      tokenAssetId !== assetId ||
      tokenMemberId !== memberId ||
      directory !== playlistDirectory ||
      !Number.isInteger(expiresAt) ||
      expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return {
      assetId: tokenAssetId,
      memberId: tokenMemberId,
      directory,
      expiresAt,
    };
  } catch {
    return null;
  }
};

const resolveHlsPath = (playlistPath: string, referencedPath: string) => {
  if (
    !referencedPath ||
    referencedPath.startsWith("/") ||
    referencedPath.includes("?")
  ) {
    return null;
  }
  const base = playlistPath.slice(0, playlistPath.lastIndexOf("/") + 1);
  const parts = `${base}${referencedPath}`.split("/");
  const resolved: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      return null;
    }
    resolved.push(part);
  }
  return resolved.join("/");
};

const assetProxyUrl = (
  request: Request,
  storagePath: string,
  hlsToken?: string
) => {
  const url = new URL(request.url);
  url.search = "";
  url.searchParams.set("hlsPart", storagePath);
  if (hlsToken) {
    url.searchParams.set("hlsToken", hlsToken);
  }
  return url.toString();
};

const proxyStorageResponse = async (
  request: Request,
  storageUrl: string,
  storageHeaders?: HeadersInit,
  cacheControl = "private, no-store"
) => {
  const upstream = await fetch(storageUrl, {
    cache: "no-store",
    headers: {
      ...(storageHeaders ?? {}),
      ...(request.headers.get("range")
        ? { Range: request.headers.get("range") as string }
        : {}),
    },
  });

  if (!(upstream.ok || upstream.status === 206)) {
    return NextResponse.json(
      { error: "Private asset could not be read" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }

  const headers = new Headers({
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
  });
  for (const header of [
    "accept-ranges",
    "content-length",
    "content-range",
    "content-type",
    "etag",
    "last-modified",
  ]) {
    const value = upstream.headers.get(header);
    if (value) {
      headers.set(header, value);
    }
  }
  return new Response(upstream.body, { status: upstream.status, headers });
};

type AccessibleAsset = NonNullable<
  Awaited<ReturnType<typeof getAccessibleAsset>>
>;

const invalidHlsSegmentResponse = (status = 404) =>
  NextResponse.json(
    { error: "Invalid HLS segment" },
    { status, headers: { "Cache-Control": "no-store" } }
  );

const isSafeHlsSegmentPath = (storagePath: string, directory: string) =>
  storagePath.startsWith(directory) && !storagePath.includes("..");

const serveTokenizedHlsSegment = (
  request: Request,
  assetId: string,
  memberId: string,
  hlsPart: string,
  hlsToken: string
) => {
  const tokenPayload = verifyHlsPlaybackToken(
    hlsToken,
    assetId,
    memberId,
    hlsPart
  );
  if (!tokenPayload) {
    return invalidHlsSegmentResponse();
  }
  if (!isSafeHlsSegmentPath(hlsPart, tokenPayload.directory)) {
    return invalidHlsSegmentResponse();
  }

  const storageUrl = getLearningAssetStorageUrl(hlsPart);
  const storageHeaders = getLearningAssetStorageHeaders();
  if (!(storageUrl && storageHeaders)) {
    return NextResponse.json(
      { error: "Private storage is not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  return proxyStorageResponse(
    request,
    storageUrl,
    storageHeaders,
    "private, max-age=300"
  );
};

const rewriteHlsPlaylist = (
  request: Request,
  assetId: string,
  memberId: string,
  storagePath: string,
  playlist: string
) => {
  const playlistDirectory = storagePath.slice(
    0,
    storagePath.lastIndexOf("/") + 1
  );
  const playbackToken = signHlsPlaybackToken(
    assetId,
    memberId,
    playlistDirectory
  );
  if (!playbackToken) {
    return null;
  }

  return playlist
    .split(hlsLineBreaks)
    .map((line) => {
      const uriMatch = line.match(hlsUriAttribute);
      const referencedPath = uriMatch?.[1] ?? (line.trim() || null);
      if (!referencedPath || (line.trim().startsWith("#") && !uriMatch)) {
        return line;
      }

      const path = resolveHlsPath(storagePath, referencedPath);
      if (!path) {
        return line;
      }
      const tokenizedUrl = assetProxyUrl(request, path, playbackToken);
      return uriMatch
        ? line.replace(referencedPath, tokenizedUrl)
        : tokenizedUrl;
    })
    .join("\n");
};

const serveHlsPlaylist = async (
  request: Request,
  assetId: string,
  memberId: string,
  storagePath: string,
  signedUrl: string
) => {
  const upstream = await fetch(signedUrl, { cache: "no-store" });
  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Private HLS playlist could not be read" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }

  const rewritten = rewriteHlsPlaylist(
    request,
    assetId,
    memberId,
    storagePath,
    await upstream.text()
  );
  if (!rewritten) {
    return NextResponse.json(
      { error: "Private storage is not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  return new Response(rewritten, {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/vnd.apple.mpegurl",
      "X-Content-Type-Options": "nosniff",
    },
  });
};

const serveStoredAsset = async (
  request: Request,
  assetId: string,
  memberId: string,
  asset: AccessibleAsset,
  hlsPart: string | null
) => {
  const storagePath = asset.storagePath;
  if (!storagePath) {
    return NextResponse.json(
      { error: "Asset is awaiting storage import" },
      { status: 409, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (isHlsAsset(asset.mimeType) && hlsPart) {
    const playlistDirectory = storagePath.slice(
      0,
      storagePath.lastIndexOf("/") + 1
    );
    if (!isSafeHlsSegmentPath(hlsPart, playlistDirectory)) {
      return invalidHlsSegmentResponse(400);
    }
    const segmentUrl = await createLearningAssetSignedUrl(hlsPart, 300);
    return segmentUrl
      ? proxyStorageResponse(request, segmentUrl)
      : NextResponse.json(
          { error: "Private storage is not configured" },
          { status: 503, headers: { "Cache-Control": "no-store" } }
        );
  }

  const signedUrl = await createLearningAssetSignedUrl(storagePath);
  if (!signedUrl) {
    return NextResponse.json(
      { error: "Private storage is not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  return isHlsAsset(asset.mimeType)
    ? serveHlsPlaylist(request, assetId, memberId, storagePath, signedUrl)
    : proxyStorageResponse(request, signedUrl);
};

export const GET = async (
  request: Request,
  { params }: AssetRouteProperties
) => {
  const { assetId } = await params;
  const requestUrl = new URL(request.url);
  const hlsPart = requestUrl.searchParams.get("hlsPart");
  const hlsToken = requestUrl.searchParams.get("hlsToken");
  const memberId = await requireMemberId();

  // Every request must carry a valid Clerk session. The short-lived capability
  // is bound to this member + asset + directory and only avoids repeating
  // Prisma authorization and Supabase signing for every HLS segment.
  if (hlsPart && hlsToken) {
    return serveTokenizedHlsSegment(
      request,
      assetId,
      memberId,
      hlsPart,
      hlsToken
    );
  }

  const asset = await getAccessibleAsset(assetId, memberId);

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  if (asset.storagePath) {
    return serveStoredAsset(request, assetId, memberId, asset, hlsPart);
  }

  const externalUrl = safeExternalUrl(asset.externalUrl);
  if (externalUrl) {
    return NextResponse.redirect(externalUrl, {
      status: 307,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  return NextResponse.json(
    { error: "Asset is awaiting storage import" },
    { status: 409, headers: { "Cache-Control": "no-store" } }
  );
};
