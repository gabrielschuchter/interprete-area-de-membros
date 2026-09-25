import "server-only";

import { ContentStatus, database } from "@repo/database";
import { getProfilesByClerkIds } from "@/lib/profile";

const POST_PAGE_SIZE = 20;
const COMMENT_PAGE_SIZE = 40;
const wordPattern = /\s+/;

const readingMinutes = (content: string) =>
  Math.max(
    1,
    Math.ceil(content.trim().split(wordPattern).filter(Boolean).length / 180)
  );

const enrichAuthors = async <T extends { authorId: string }>(
  rows: readonly T[]
) => {
  const profiles = await getProfilesByClerkIds(rows.map((row) => row.authorId));
  return rows.map((row) => ({
    ...row,
    profile: profiles.get(row.authorId) ?? null,
  }));
};

export const getCommunitySpaces = async () => {
  const spaces = await database.communitySpace.findMany({
    where: { status: ContentStatus.PUBLISHED },
    orderBy: [{ position: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      icon: true,
      _count: {
        select: {
          posts: {
            where: { status: ContentStatus.PUBLISHED, deletedAt: null },
          },
        },
      },
      posts: {
        where: { status: ContentStatus.PUBLISHED, deletedAt: null },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        take: 3,
        select: {
          id: true,
          title: true,
          authorId: true,
          createdAt: true,
          _count: {
            select: { comments: { where: { deletedAt: null } }, votes: true },
          },
        },
      },
    },
  });

  return Promise.all(
    spaces.map(async (space) => ({
      ...space,
      posts: await enrichAuthors(space.posts),
    }))
  );
};

interface CommunityFeedOptions {
  readonly page?: number;
  readonly query?: string;
  readonly sort?: "recent" | "popular";
  readonly spaceSlug?: string;
}

export const getCommunityFeed = async (
  memberId: string,
  options: CommunityFeedOptions = {}
) => {
  const page =
    Number.isInteger(options.page) && (options.page ?? 1) > 0
      ? (options.page ?? 1)
      : 1;
  const query = options.query?.trim().slice(0, 100) ?? "";
  let authorIds: string[] | undefined;

  if (query) {
    const matchingProfiles = await database.profile.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: "insensitive" } },
          { displayName: { contains: query, mode: "insensitive" } },
          { headline: { contains: query, mode: "insensitive" } },
        ],
      },
      select: { clerkUserId: true },
      take: 50,
    });
    authorIds = matchingProfiles.map((profile) => profile.clerkUserId);
  }

  const posts = await database.communityPost.findMany({
    where: {
      status: ContentStatus.PUBLISHED,
      deletedAt: null,
      ...(options.spaceSlug
        ? {
            space: { slug: options.spaceSlug, status: ContentStatus.PUBLISHED },
          }
        : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { content: { contains: query, mode: "insensitive" } },
              { tags: { has: query.toLowerCase() } },
              { space: { title: { contains: query, mode: "insensitive" } } },
              ...(authorIds && authorIds.length > 0
                ? [{ authorId: { in: authorIds } }]
                : []),
            ],
          }
        : {}),
    },
    orderBy:
      options.sort === "popular"
        ? [
            { isPinned: "desc" },
            { votes: { _count: "desc" } },
            { createdAt: "desc" },
          ]
        : [{ isPinned: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * POST_PAGE_SIZE,
    take: POST_PAGE_SIZE + 1,
    select: {
      id: true,
      title: true,
      slug: true,
      content: true,
      contentJson: true,
      tags: true,
      authorId: true,
      status: true,
      isPinned: true,
      publishedAt: true,
      createdAt: true,
      space: { select: { title: true, slug: true } },
      _count: {
        select: { comments: { where: { deletedAt: null } }, votes: true },
      },
      votes: { where: { memberId }, select: { id: true } },
      bookmarks: { where: { memberId }, select: { id: true } },
    },
  });

  const hasMore = posts.length > POST_PAGE_SIZE;
  return {
    posts: (await enrichAuthors(posts.slice(0, POST_PAGE_SIZE))).map(
      (post) => ({
        ...post,
        readingMinutes: readingMinutes(post.content),
      })
    ),
    page,
    hasMore,
    query,
    sort: options.sort === "popular" ? "popular" : "recent",
    spaceSlug: options.spaceSlug ?? "",
  };
};

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
      icon: true,
      posts: {
        where: { status: ContentStatus.PUBLISHED, deletedAt: null },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        skip: (currentPage - 1) * POST_PAGE_SIZE,
        take: POST_PAGE_SIZE + 1,
        select: {
          id: true,
          title: true,
          slug: true,
          content: true,
          contentJson: true,
          tags: true,
          authorId: true,
          isPinned: true,
          publishedAt: true,
          createdAt: true,
          _count: {
            select: { comments: { where: { deletedAt: null } }, votes: true },
          },
          votes: { where: { memberId }, select: { id: true } },
          bookmarks: { where: { memberId }, select: { id: true } },
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
    posts: (await enrichAuthors(space.posts.slice(0, POST_PAGE_SIZE))).map(
      (post) => ({
        ...post,
        readingMinutes: readingMinutes(post.content),
      })
    ),
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
        slug: true,
        content: true,
        contentJson: true,
        tags: true,
        authorId: true,
        isPinned: true,
        publishedAt: true,
        createdAt: true,
        space: { select: { title: true, slug: true } },
        _count: {
          select: { comments: { where: { deletedAt: null } }, votes: true },
        },
        votes: { where: { memberId }, select: { id: true } },
        bookmarks: { where: { memberId }, select: { id: true } },
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

  const visibleComments = comments.filter(({ id }) =>
    visibleCommentIds.has(id)
  );
  return {
    ...post,
    profile:
      (await getProfilesByClerkIds([post.authorId])).get(post.authorId) ?? null,
    comments: await enrichAuthors(visibleComments),
    readingMinutes: readingMinutes(post.content),
    commentsPage: currentPage,
    hasMoreComments,
  };
};

export const getMyCommunityPosts = async (memberId: string) => {
  const posts = await database.communityPost.findMany({
    where: { authorId: memberId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      content: true,
      status: true,
      tags: true,
      isPinned: true,
      createdAt: true,
      updatedAt: true,
      space: { select: { title: true, slug: true } },
      _count: {
        select: { comments: { where: { deletedAt: null } }, votes: true },
      },
    },
  });
  return posts;
};

export const getSavedCommunityPosts = async (memberId: string) => {
  const bookmarks = await database.communityBookmark.findMany({
    where: {
      memberId,
      post: { status: ContentStatus.PUBLISHED, deletedAt: null },
    },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      post: {
        select: {
          id: true,
          title: true,
          slug: true,
          content: true,
          tags: true,
          publishedAt: true,
          createdAt: true,
          authorId: true,
          space: { select: { title: true, slug: true } },
          _count: {
            select: { comments: { where: { deletedAt: null } }, votes: true },
          },
        },
      },
    },
  });

  const posts = bookmarks.map(({ createdAt: savedAt, post }) => ({
    ...post,
    savedAt,
  }));
  return enrichAuthors(posts);
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
