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

export const communityPostHref = (post: {
  readonly id: string;
  readonly slug: string | null;
  readonly space?: { readonly slug: string } | null;
}) => {
  if (post.slug) {
    return `/comunidade/publicacoes/${post.slug}`;
  }

  if (post.space) {
    return `/comunidade/${post.space.slug}/${post.id}`;
  }

  return `/comunidade/publicacoes/${post.id}`;
};

type ProfileMap = Awaited<ReturnType<typeof getProfilesByClerkIds>>;

const attachProfiles = <T extends { authorId: string }>(
  rows: readonly T[],
  profiles: ProfileMap
) =>
  rows.map((row) => ({
    ...row,
    profile: profiles.get(row.authorId) ?? null,
  }));

const enrichAuthors = async <T extends { authorId: string }>(
  rows: readonly T[]
) => {
  const profiles = await getProfilesByClerkIds(rows.map((row) => row.authorId));
  return attachProfiles(rows, profiles);
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

  const profiles = await getProfilesByClerkIds(
    spaces.flatMap((space) => space.posts.map((post) => post.authorId))
  );

  return spaces.map((space) => ({
    ...space,
    posts: attachProfiles(space.posts, profiles),
  }));
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
            space: {
              is: { slug: options.spaceSlug, status: ContentStatus.PUBLISHED },
            },
          }
        : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { excerpt: { contains: query, mode: "insensitive" } },
              { content: { contains: query, mode: "insensitive" } },
              { tags: { has: query.toLowerCase() } },
              {
                space: {
                  is: { title: { contains: query, mode: "insensitive" } },
                },
              },
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
            { publishedAt: "desc" },
            { createdAt: "desc" },
          ]
        : [
            { isPinned: "desc" },
            { publishedAt: "desc" },
            { createdAt: "desc" },
          ],
    skip: (page - 1) * POST_PAGE_SIZE,
    take: POST_PAGE_SIZE + 1,
    select: {
      id: true,
      title: true,
      subtitle: true,
      slug: true,
      kind: true,
      excerpt: true,
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
  const visiblePosts = posts.slice(0, POST_PAGE_SIZE);
  const enrichedPosts = await enrichAuthors(visiblePosts);

  return {
    posts: enrichedPosts.map((post) => ({
      ...post,
      excerpt: post.excerpt ?? "",
      readingMinutes: readingMinutes(post.excerpt ?? ""),
    })),
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
        orderBy: [
          { isPinned: "desc" },
          { publishedAt: "desc" },
          { createdAt: "desc" },
        ],
        skip: (currentPage - 1) * POST_PAGE_SIZE,
        take: POST_PAGE_SIZE + 1,
        select: {
          id: true,
          title: true,
          subtitle: true,
          slug: true,
          kind: true,
          excerpt: true,
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
      },
    },
  });
  if (!space) {
    return null;
  }
  const hasMorePosts = space.posts.length > POST_PAGE_SIZE;
  const visiblePosts = space.posts.slice(0, POST_PAGE_SIZE);
  return {
    ...space,
    posts: (await enrichAuthors(visiblePosts)).map((post) => ({
      ...post,
      excerpt: post.excerpt ?? "",
      readingMinutes: readingMinutes(post.excerpt ?? ""),
    })),
    page: currentPage,
    hasMorePosts,
  };
};

const communityPostSelect = {
  id: true,
  title: true,
  subtitle: true,
  slug: true,
  kind: true,
  content: true,
  excerpt: true,
  contentJson: true,
  tags: true,
  coverUrl: true,
  authorId: true,
  isPinned: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  space: { select: { id: true, title: true, slug: true } },
  _count: {
    select: { comments: { where: { deletedAt: null } }, votes: true },
  },
} as const;

const getPublishedPost = (
  where: {
    readonly id?: string;
    readonly slug?: string;
    readonly spaceSlug?: string;
  },
  memberId: string
) =>
  database.communityPost.findFirst({
    where: {
      ...(where.id ? { id: where.id } : {}),
      ...(where.slug ? { slug: where.slug } : {}),
      ...(where.spaceSlug
        ? {
            space: {
              is: { slug: where.spaceSlug, status: ContentStatus.PUBLISHED },
            },
          }
        : {
            OR: [
              { space: null },
              { space: { is: { status: ContentStatus.PUBLISHED } } },
            ],
          }),
      status: ContentStatus.PUBLISHED,
      deletedAt: null,
    },
    select: {
      ...communityPostSelect,
      votes: { where: { memberId }, select: { id: true } },
      bookmarks: { where: { memberId }, select: { id: true } },
    },
  });

const getPostWithComments = async (
  post: NonNullable<Awaited<ReturnType<typeof getPublishedPost>>>,
  memberId: string,
  commentsPage: number
) => {
  const commentRoots = await database.communityComment.findMany({
    where: { postId: post.id, parentId: null, deletedAt: null },
    orderBy: { createdAt: "asc" },
    skip: (commentsPage - 1) * COMMENT_PAGE_SIZE,
    take: COMMENT_PAGE_SIZE + 1,
    select: { id: true },
  });
  const hasMoreComments = commentRoots.length > COMMENT_PAGE_SIZE;
  const visibleRootIds = commentRoots
    .slice(0, COMMENT_PAGE_SIZE)
    .map(({ id }) => id);
  const comments =
    visibleRootIds.length === 0
      ? []
      : await database.communityComment.findMany({
          where: {
            postId: post.id,
            deletedAt: null,
            OR: [
              { id: { in: visibleRootIds } },
              { parentId: { in: visibleRootIds } },
            ],
          },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            parentId: true,
            authorId: true,
            content: true,
            createdAt: true,
            updatedAt: true,
            _count: { select: { votes: true } },
            votes: { where: { memberId }, select: { id: true } },
          },
        });

  const profiles = await getProfilesByClerkIds([
    post.authorId,
    ...comments.map((comment) => comment.authorId),
  ]);

  return {
    ...post,
    profile: profiles.get(post.authorId) ?? null,
    comments: attachProfiles(comments, profiles),
    readingMinutes: readingMinutes(post.content),
    commentsPage,
    hasMoreComments,
  };
};

const normalizeCommentsPage = (page: number) =>
  Number.isInteger(page) && page > 0 ? page : 1;

export const getCommunityPost = async (
  spaceSlug: string,
  postId: string,
  memberId: string,
  commentsPage = 1
) => {
  const post = await getPublishedPost({ spaceSlug, id: postId }, memberId);
  return post
    ? getPostWithComments(post, memberId, normalizeCommentsPage(commentsPage))
    : null;
};

export const getCommunityPostBySlug = async (
  slug: string,
  memberId: string,
  commentsPage = 1
) => {
  const post = await getPublishedPost({ slug }, memberId);
  return post
    ? getPostWithComments(post, memberId, normalizeCommentsPage(commentsPage))
    : null;
};

export const getCommunityEditorPost = async (
  postId: string,
  memberId: string
) => {
  const post = await database.communityPost.findFirst({
    where: { id: postId, authorId: memberId, deletedAt: null },
    select: {
      ...communityPostSelect,
      status: true,
    },
  });

  if (!post) {
    return null;
  }

  const profiles = await getProfilesByClerkIds([post.authorId]);
  return { ...post, profile: profiles.get(post.authorId) ?? null };
};

export const getMyCommunityPosts = async (memberId: string) => {
  const posts = await database.communityPost.findMany({
    where: { authorId: memberId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      subtitle: true,
      slug: true,
      kind: true,
      excerpt: true,
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
  return posts.map((post) => ({ ...post, excerpt: post.excerpt ?? "" }));
};

export const getSavedCommunityPosts = async (memberId: string) => {
  const bookmarks = await database.communityBookmark.findMany({
    where: {
      memberId,
      post: {
        status: ContentStatus.PUBLISHED,
        deletedAt: null,
        OR: [
          { space: null },
          { space: { is: { status: ContentStatus.PUBLISHED } } },
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      createdAt: true,
      post: {
        select: {
          id: true,
          title: true,
          subtitle: true,
          slug: true,
          kind: true,
          excerpt: true,
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
    excerpt: post.excerpt ?? "",
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

export const getStaffCommunityPosts = async () =>
  database.communityPost.findMany({
    where: { deletedAt: null },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 100,
    select: {
      id: true,
      title: true,
      authorId: true,
      status: true,
      kind: true,
      slug: true,
      createdAt: true,
      space: { select: { title: true, slug: true } },
    },
  });
