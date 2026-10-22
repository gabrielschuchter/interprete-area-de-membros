import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { database } from "@repo/database";
import { cache } from "react";
import {
  getCommunityPostShareDetails,
  getPublicCommunityPostShareDetails,
} from "./community";

const shareTokenPattern = /^[A-Za-z0-9_-]{43}$/;
const shareListLimit = 20;

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
