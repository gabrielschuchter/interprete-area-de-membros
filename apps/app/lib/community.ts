import "server-only";

import { ContentStatus, database } from "@repo/database";

const POST_PAGE_SIZE = 20;
const COMMENT_PAGE_SIZE = 40;

export const getCommunitySpaces = async () =>
  database.communitySpace.findMany({
    where: { status: ContentStatus.PUBLISHED },
    orderBy: [{ position: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      _count: {
        select: {
          posts: {
            where: { status: ContentStatus.PUBLISHED, deletedAt: null },
          },
        },
      },
      posts: {
        where: { status: ContentStatus.PUBLISHED, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          title: true,
          createdAt: true,
          _count: {
            select: {
              comments: { where: { deletedAt: null } },
              votes: true,
            },
          },
        },
      },
    },
  });

export const getCommunitySpace = async (
  slug: string,
  memberId: string,
  page = 1
) => {
  const currentPage = Number.isInteger(page) && page > 0 ? page : 1;
  const space = await database.communitySpace.findFirst({
    where: { slug, status: ContentStatus.PUBLISHED },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      posts: {
        where: { status: ContentStatus.PUBLISHED, deletedAt: null },
        orderBy: { createdAt: "desc" },
        skip: (currentPage - 1) * POST_PAGE_SIZE,
        take: POST_PAGE_SIZE + 1,
        select: {
          id: true,
          title: true,
          content: true,
          authorId: true,
          createdAt: true,
          _count: {
            select: {
              comments: { where: { deletedAt: null } },
              votes: true,
            },
          },
          votes: { where: { memberId }, select: { id: true } },
        },
      },
    },
  });

  if (!space) {
    return null;
  }

  const hasMorePosts = space.posts.length > POST_PAGE_SIZE;

  return {
    ...space,
    posts: space.posts.slice(0, POST_PAGE_SIZE),
    page: currentPage,
    hasMorePosts,
  };
};

export const getCommunityPost = async (
  spaceSlug: string,
  postId: string,
  memberId: string,
  commentsPage = 1
) => {
  const currentPage =
    Number.isInteger(commentsPage) && commentsPage > 0 ? commentsPage : 1;
  const [post, commentRoots] = await Promise.all([
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
        _count: {
          select: {
            comments: { where: { deletedAt: null } },
            votes: true,
          },
        },
        votes: { where: { memberId }, select: { id: true } },
      },
    }),
    database.communityComment.findMany({
      where: { postId, parentId: null, deletedAt: null },
      orderBy: { createdAt: "asc" },
      skip: (currentPage - 1) * COMMENT_PAGE_SIZE,
      take: COMMENT_PAGE_SIZE + 1,
      select: { id: true },
    }),
  ]);

  if (!post) {
    return null;
  }

  const hasMoreComments = commentRoots.length > COMMENT_PAGE_SIZE;
  const visibleRootIds = new Set(
    commentRoots.slice(0, COMMENT_PAGE_SIZE).map(({ id }) => id)
  );
  const comments =
    visibleRootIds.size === 0
      ? []
      : await database.communityComment.findMany({
          where: { postId, deletedAt: null },
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
        });

  const visibleCommentIds = new Set(visibleRootIds);
  let foundReply = true;

  while (foundReply) {
    foundReply = false;

    for (const comment of comments) {
      if (
        comment.parentId &&
        visibleCommentIds.has(comment.parentId) &&
        !visibleCommentIds.has(comment.id)
      ) {
        visibleCommentIds.add(comment.id);
        foundReply = true;
      }
    }
  }

  return {
    ...post,
    comments: comments.filter(({ id }) => visibleCommentIds.has(id)),
    commentsPage: currentPage,
    hasMoreComments,
  };
};

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
