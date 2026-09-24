import "server-only";

import { ContentStatus, database } from "@repo/database";

export const getCommunitySpaces = async () =>
  database.communitySpace.findMany({
    where: { status: ContentStatus.PUBLISHED },
    orderBy: [{ position: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      _count: { select: { posts: true } },
      posts: {
        where: { status: ContentStatus.PUBLISHED, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          title: true,
          createdAt: true,
          _count: { select: { comments: true, votes: true } },
        },
      },
    },
  });

export const getCommunitySpace = async (slug: string, memberId: string) =>
  database.communitySpace.findFirst({
    where: { slug, status: ContentStatus.PUBLISHED },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      posts: {
        where: { status: ContentStatus.PUBLISHED, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: {
          id: true,
          title: true,
          content: true,
          authorId: true,
          createdAt: true,
          _count: { select: { comments: true, votes: true } },
          votes: { where: { memberId }, select: { id: true } },
        },
      },
    },
  });

export const getCommunityPost = async (
  spaceSlug: string,
  postId: string,
  memberId: string
) =>
  database.communityPost.findFirst({
    where: {
      id: postId,
      status: ContentStatus.PUBLISHED,
      deletedAt: null,
      space: { slug: spaceSlug, status: ContentStatus.PUBLISHED },
    },
    select: {
      id: true,
      title: true,
      content: true,
      authorId: true,
      createdAt: true,
      space: { select: { title: true, slug: true } },
      _count: { select: { comments: true, votes: true } },
      votes: { where: { memberId }, select: { id: true } },
      comments: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          parentId: true,
          authorId: true,
          content: true,
          createdAt: true,
          _count: { select: { votes: true } },
          votes: { where: { memberId }, select: { id: true } },
        },
      },
    },
  });

export const getStaffCommunitySpaces = async () =>
  database.communitySpace.findMany({
    orderBy: [{ status: "asc" }, { position: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      posts: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          title: true,
          authorId: true,
          createdAt: true,
          status: true,
        },
      },
    },
  });
