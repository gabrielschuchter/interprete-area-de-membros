import "server-only";

import {
  type CommunityPostKind,
  ContentStatus,
  database,
  type Prisma,
} from "@repo/database";
import { extractCommunityMedia } from "@/lib/community-media";
import { communityPopularityScore } from "@/lib/community-ranking";
import { getProfilesByClerkIds } from "@/lib/profile";

const POST_PAGE_SIZE = 20;
const COMMENT_PAGE_SIZE = 40;
const POPULARITY_CANDIDATE_LIMIT = 200;
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

export const getCommunitySpaces = () =>
  database.communitySpace.findMany({
    where: { status: ContentStatus.PUBLISHED },
    orderBy: [{ position: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      icon: true,
      commentsClosed: true,
      _count: {
        select: {
          posts: {
            where: { status: ContentStatus.PUBLISHED, deletedAt: null },
          },
        },
      },
    },
  });

export const getLatestCommunityPost = async () =>
  database.communityPost.findFirst({
    where: {
      status: ContentStatus.PUBLISHED,
      deletedAt: null,
      OR: [
        { space: null },
        { space: { is: { status: ContentStatus.PUBLISHED } } },
      ],
    },
    orderBy: [
      { isFeatured: "desc" },
      { isPinned: "desc" },
      { publishedAt: "desc" },
      { createdAt: "desc" },
    ],
    select: {
      id: true,
      title: true,
      slug: true,
      space: { select: { slug: true } },
    },
  });

interface CommunityFeedOptions {
  readonly kind?: CommunityPostKind;
  readonly page?: number;
  readonly query?: string;
  readonly sort?: "recent" | "popular" | "unanswered";
  readonly spaceSlug?: string;
}

const communityFeedSelect = (memberId: string) =>
  ({
    id: true,
    title: true,
    subtitle: true,
    slug: true,
    kind: true,
    excerpt: true,
    contentJson: true,
    tags: true,
    coverUrl: true,
    authorId: true,
    status: true,
    isPinned: true,
    isFeatured: true,
    publishedAt: true,
    createdAt: true,
    space: { select: { title: true, slug: true } },
    _count: {
      select: { comments: { where: { deletedAt: null } }, votes: true },
    },
    votes: { where: { memberId }, select: { id: true } },
    bookmarks: { where: { memberId }, select: { id: true } },
  }) as const;

type CommunityFeedSort = NonNullable<CommunityFeedOptions["sort"]>;

const normalizeCommunityPage = (page: number | undefined) =>
  Number.isInteger(page) && (page ?? 1) > 0 ? (page ?? 1) : 1;

const normalizeCommunitySort = (
  sort: CommunityFeedOptions["sort"]
): CommunityFeedSort =>
  sort === "popular" || sort === "unanswered" ? sort : "recent";

const findMatchingCommunityAuthorIds = async (query: string) => {
  if (!query) {
    return undefined;
  }
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
  return matchingProfiles.map((profile) => profile.clerkUserId);
};

const communityFeedWhere = ({
  authorIds,
  kind,
  query,
  sort,
  spaceSlug,
}: {
  readonly authorIds?: string[];
  readonly kind?: CommunityPostKind;
  readonly query: string;
  readonly sort: CommunityFeedSort;
  readonly spaceSlug?: string;
}): Prisma.CommunityPostWhereInput => ({
  status: ContentStatus.PUBLISHED,
  deletedAt: null,
  ...(kind ? { kind } : {}),
  ...(sort === "unanswered" ? { comments: { none: { deletedAt: null } } } : {}),
  ...(spaceSlug
    ? {
        space: { is: { slug: spaceSlug, status: ContentStatus.PUBLISHED } },
      }
    : {
        OR: [
          { space: null },
          { space: { is: { status: ContentStatus.PUBLISHED } } },
        ],
      }),
  ...(query
    ? {
        AND: [
          {
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
              {
                comments: {
                  some: {
                    content: { contains: query, mode: "insensitive" },
                    deletedAt: null,
                  },
                },
              },
              ...(authorIds && authorIds.length > 0
                ? [{ authorId: { in: authorIds } }]
                : []),
            ],
          },
        ],
      }
    : {}),
});

const getPopularCommunityPosts = async (
  memberId: string,
  page: number,
  where: Prisma.CommunityPostWhereInput
) => {
  // Keep the ranking bounded: interactions seed the candidate pool, then the
  // small deterministic score applies participant count and time decay.
  const candidatePosts = await database.communityPost.findMany({
    where,
    orderBy: [
      { isFeatured: "desc" },
      { isPinned: "desc" },
      { votes: { _count: "desc" } },
      { comments: { _count: "desc" } },
      { publishedAt: "desc" },
      { createdAt: "desc" },
      { id: "asc" },
    ],
    take: POPULARITY_CANDIDATE_LIMIT,
    select: communityFeedSelect(memberId),
  });
  const participantRows = candidatePosts.length
    ? await database.communityComment.groupBy({
        by: ["postId", "authorId"],
        where: {
          deletedAt: null,
          postId: { in: candidatePosts.map((post) => post.id) },
        },
      })
    : [];
  const participantsByPost = new Map<string, Set<string>>();
  for (const participant of participantRows) {
    const participants =
      participantsByPost.get(participant.postId) ?? new Set<string>();
    participants.add(participant.authorId);
    participantsByPost.set(participant.postId, participants);
  }
  const now = new Date();
  const rankedPosts = candidatePosts
    .map((post) => ({
      post,
      score: communityPopularityScore({
        comments: post._count.comments,
        createdAt: post.createdAt,
        now,
        participants: new Set([
          post.authorId,
          ...(participantsByPost.get(post.id) ?? []),
        ]).size,
        publishedAt: post.publishedAt,
        votes: post._count.votes,
      }),
    }))
    .sort((left, right) => {
      if (left.post.isFeatured !== right.post.isFeatured) {
        return left.post.isFeatured ? -1 : 1;
      }
      if (left.post.isPinned !== right.post.isPinned) {
        return left.post.isPinned ? -1 : 1;
      }
      if (left.score !== right.score) {
        return right.score - left.score;
      }
      const rightDate = (
        right.post.publishedAt ?? right.post.createdAt
      ).getTime();
      const leftDate = (left.post.publishedAt ?? left.post.createdAt).getTime();
      return rightDate - leftDate || left.post.id.localeCompare(right.post.id);
    });
  const start = (page - 1) * POST_PAGE_SIZE;
  return {
    hasMore: rankedPosts.length > start + POST_PAGE_SIZE,
    visiblePosts: rankedPosts
      .slice(start, start + POST_PAGE_SIZE)
      .map(({ post }) => post),
  };
};

const getChronologicalCommunityPosts = async (
  memberId: string,
  page: number,
  where: Prisma.CommunityPostWhereInput
) => {
  const posts = await database.communityPost.findMany({
    where,
    orderBy: [
      { isFeatured: "desc" },
      { isPinned: "desc" },
      { publishedAt: "desc" },
      { createdAt: "desc" },
      { id: "asc" },
    ],
    skip: (page - 1) * POST_PAGE_SIZE,
    take: POST_PAGE_SIZE + 1,
    select: communityFeedSelect(memberId),
  });
  return {
    hasMore: posts.length > POST_PAGE_SIZE,
    visiblePosts: posts.slice(0, POST_PAGE_SIZE),
  };
};

export const getCommunityFeed = async (
  memberId: string,
  options: CommunityFeedOptions = {}
) => {
  const page = normalizeCommunityPage(options.page);
  const query = options.query?.trim().slice(0, 100) ?? "";
  const sort = normalizeCommunitySort(options.sort);
  const authorIds = await findMatchingCommunityAuthorIds(query);
  const where = communityFeedWhere({
    authorIds,
    kind: options.kind,
    query,
    sort,
    spaceSlug: options.spaceSlug,
  });
  const feed =
    sort === "popular"
      ? await getPopularCommunityPosts(memberId, page, where)
      : await getChronologicalCommunityPosts(memberId, page, where);

  const enrichedPosts = await enrichAuthors(feed.visiblePosts);

  return {
    posts: enrichedPosts.map((post) => ({
      ...post,
      excerpt: post.excerpt ?? "",
      media: extractCommunityMedia(post.contentJson),
      readingMinutes: readingMinutes(post.excerpt ?? ""),
    })),
    page,
    hasMore: feed.hasMore,
    query,
    sort,
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
      commentsClosed: true,
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
          contentJson: true,
          tags: true,
          coverUrl: true,
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
      media: extractCommunityMedia(post.contentJson),
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
  isFeatured: true,
  featuredAt: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  space: {
    select: { id: true, title: true, slug: true, commentsClosed: true },
  },
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
) => {
  let identityWhere: Prisma.CommunityPostWhereInput = {};
  if (where.id) {
    identityWhere = { id: where.id };
  } else if (where.slug) {
    identityWhere = { OR: [{ slug: where.slug }, { id: where.slug }] };
  }
  const audienceWhere: Prisma.CommunityPostWhereInput = where.spaceSlug
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
      };

  return database.communityPost.findFirst({
    where: {
      AND: [
        identityWhere,
        audienceWhere,
        { status: ContentStatus.PUBLISHED, deletedAt: null },
      ],
    },
    select: {
      ...communityPostSelect,
      votes: { where: { memberId }, select: { id: true } },
      bookmarks: { where: { memberId }, select: { id: true } },
      followers: {
        where: { userId: memberId },
        select: { id: true, mutedAt: true },
      },
    },
  });
};

const getPostWithComments = async (
  post: NonNullable<Awaited<ReturnType<typeof getPublishedPost>>>,
  memberId: string,
  commentsPage: number
) => {
  const commentRoots = await database.communityComment.findMany({
    where: { postId: post.id, parentId: null, deletedAt: null },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
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
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            parentId: true,
            authorId: true,
            content: true,
            contentJson: true,
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

export const getCommunityCommentPage = async (
  postId: string,
  commentId: string
) => {
  const initialComment = await database.communityComment.findFirst({
    where: { id: commentId, postId, deletedAt: null },
    select: { id: true, parentId: true, createdAt: true },
  });

  if (!initialComment) {
    return 1;
  }

  let comment = initialComment;
  const visited = new Set<string>();
  while (comment.parentId && !visited.has(comment.id)) {
    visited.add(comment.id);
    const parentComment = await database.communityComment.findFirst({
      where: { id: comment.parentId, postId, deletedAt: null },
      select: { id: true, parentId: true, createdAt: true },
    });
    if (!parentComment) {
      break;
    }
    comment = parentComment;
  }

  const rootsBefore = await database.communityComment.count({
    where: {
      postId,
      parentId: null,
      deletedAt: null,
      OR: [
        { createdAt: { lt: comment.createdAt } },
        { createdAt: comment.createdAt, id: { lte: comment.id } },
      ],
    },
  });

  return Math.max(1, Math.ceil(rootsBefore / COMMENT_PAGE_SIZE));
};

export const getCommunityPost = async (
  spaceSlug: string,
  postId: string,
  memberId: string,
  commentsPage = 1,
  commentId?: string
) => {
  const post = await getPublishedPost({ spaceSlug, id: postId }, memberId);
  if (!post) {
    return null;
  }
  const resolvedCommentsPage = commentId
    ? await getCommunityCommentPage(post.id, commentId)
    : normalizeCommentsPage(commentsPage);
  return getPostWithComments(post, memberId, resolvedCommentsPage);
};

export const getCommunityPostBySlug = async (
  slug: string,
  memberId: string,
  commentsPage = 1,
  commentId?: string
) => {
  const post = await getPublishedPost({ slug }, memberId);
  if (!post) {
    return null;
  }
  const resolvedCommentsPage = commentId
    ? await getCommunityCommentPage(post.id, commentId)
    : normalizeCommentsPage(commentsPage);
  return getPostWithComments(post, memberId, resolvedCommentsPage);
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
      description: true,
      status: true,
      commentsClosed: true,
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
      isPinned: true,
      isFeatured: true,
      createdAt: true,
      space: { select: { title: true, slug: true } },
    },
  });
