import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { database } from "@repo/database";
import { cache } from "react";
import {
  getCommunityPostShareDetails,
  getPublicCommunityPostShareDetails,
} from "./community";
import {
  createMemberAssetSignedUrl,
  memberAssetPathFromUrl,
} from "./member-storage";

const shareTokenPattern = /^[A-Za-z0-9_-]{43}$/;
const shareListLimit = 20;
const shareCoverMaxBytes = 5 * 1024 * 1024;
const shareCoverMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const hashShareToken = (token: string) =>
  createHash("sha256").update(token, "utf8").digest("hex");

export const isCommunityPostShareToken = (token: string) =>
  shareTokenPattern.test(token);

export const createCommunityPostShareLink = async (
  postId: string,
  createdById: string
) => {
  const post = await getCommunityPostShareDetails(postId, createdById);
  if (!post) {
    return null;
  }

  // The capability exists only in this response and the recipient's URL.
  // The database and every subsequent read retain only its SHA-256 digest.
  const token = randomBytes(32).toString("base64url");
  const link = await database.communityPostShareLink.create({
    data: {
      postId,
      createdById,
      tokenHash: hashShareToken(token),
    },
    select: { id: true, createdAt: true },
  });

  return { ...link, token };
};

export const listCommunityPostShareLinks = async (
  postId: string,
  memberId: string
) => {
  const post = await database.communityPost.findUnique({
    where: { id: postId },
    select: { authorId: true },
  });
  if (!post) {
    return [];
  }

  const rows = await database.communityPostShareLink.findMany({
    where: {
      postId,
      ...(post.authorId === memberId ? {} : { createdById: memberId }),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: shareListLimit,
    select: { id: true, createdAt: true, revokedAt: true, createdById: true },
  });

  return rows.map(({ createdById, ...link }) => ({
    ...link,
    createdByCurrentUser: createdById === memberId,
    canRevoke: post.authorId === memberId || createdById === memberId,
  }));
};

export const revokeCommunityPostShareLink = async (
  shareLinkId: string,
  memberId: string
) => {
  const link = await database.communityPostShareLink.findUnique({
    where: { id: shareLinkId },
    select: {
      createdById: true,
      post: { select: { authorId: true } },
    },
  });
  if (
    !link ||
    (link.createdById !== memberId && link.post.authorId !== memberId)
  ) {
    return false;
  }

  await database.communityPostShareLink.updateMany({
    where: { id: shareLinkId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return true;
};

export const getCommunityPostSharePreview = cache(
  async (token: string, memberId: string | null) => {
    if (!isCommunityPostShareToken(token)) {
      return null;
    }

    const link = await database.communityPostShareLink.findUnique({
      where: { tokenHash: hashShareToken(token) },
      select: { postId: true, revokedAt: true },
    });
    if (!link || link.revokedAt) {
      return null;
    }

    return memberId
      ? getCommunityPostShareDetails(link.postId, memberId)
      : getPublicCommunityPostShareDetails(link.postId);
  }
);

/**
 * Read a cover only after the caller has resolved the active share link against
 * the current audience. The short-lived Storage URL stays inside this server
 * helper and is never returned to the page, OG metadata, logs, or browser.
 */
export const getCommunityPostShareCoverBytes = async (
  coverUrl: string | null | undefined
) => {
  const path = memberAssetPathFromUrl(coverUrl);
  if (!path?.startsWith("community-assets/covers/")) {
    return null;
  }

  try {
    const signedUrl = await createMemberAssetSignedUrl(path, 60);
    if (!signedUrl) {
      return null;
    }

    const response = await fetch(signedUrl, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    const mimeType = response.headers
      .get("content-type")
      ?.split(";")[0]
      ?.trim()
      .toLowerCase();
    const contentLength = Number(response.headers.get("content-length"));
    if (!(response.ok && response.body)) {
      return null;
    }
    if (!(mimeType && shareCoverMimeTypes.has(mimeType))) {
      return null;
    }
    if (Number.isFinite(contentLength) && contentLength > shareCoverMaxBytes) {
      return null;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      byteLength += value.byteLength;
      if (byteLength > shareCoverMaxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    if (byteLength === 0) {
      return null;
    }
    const bytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { bytes, mimeType };
  } catch {
    return null;
  }
};
