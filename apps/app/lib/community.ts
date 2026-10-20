import "server-only";

import {
  type CommunityPostKind,
  ContentStatus,
  database,
  MemberRole,
  type Prisma,
} from "@repo/database";
import { tracePerformance } from "@repo/observability/performance";
import { getMemberRole, requireStaff } from "@/lib/authorization";
import { communityCoverAltSelect } from "@/lib/community-cover-alt";
import {
  extractCommunityMedia,
  normalizeCommunityCoverUrl,
} from "@/lib/community-media";
import { communityPopularityScore } from "@/lib/community-ranking";
import {
  type CommunitySpaceDirectorySection,
  communitySpaceDirectoryWhere,
} from "@/lib/community-space-directory";
import {
  communityPostAudienceWhere,
  communitySpaceAudienceWhere,
} from "@/lib/community-space-rules";
import { getProfilesByClerkIds } from "@/lib/profile";

const POST_PAGE_SIZE = 10;
export const COMMUNITY_SPACE_DIRECTORY_PAGE_SIZE = 6;
const COMMENT_PAGE_SIZE = 40;
const POPULARITY_CANDIDATE_LIMIT = 200;
const wordPattern = /\s+/;
const communitySpaceDirectoryCursorPattern = /^[A-Za-z0-9_-]{1,64}$/;

const readingMinutes = (content: string) =>
  Math.max(
    1,
    Math.ceil(content.trim().split(wordPattern).filter(Boolean).length / 180)
  );

export const communityPostHref = (
  post: {
    readonly id: string;
    readonly slug: string | null;
    readonly space?: { readonly slug: string } | null;
  },
  returnTo?: string
) => {
  let path = `/comunidade/publicacoes/${post.id}`;
  if (post.space) {
    path = `/comunidade/${post.space.slug}/${post.id}`;
  }
  if (post.slug) {
    path = `/comunidade/publicacoes/${post.slug}`;
  }
  const isSafeReturnPath =
    returnTo === "/salvos" ||
    returnTo === "/comunidade" ||
    returnTo?.startsWith("/comunidade/") === true;
  if (!isSafeReturnPath) {
    return path;
  }
  const params = new URLSearchParams({ from: returnTo });
  return `${path}?${params.toString()}`;
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

export const getCommunitySpaces = async (memberId: string) => {
  const role = await getMemberRole(memberId);
  return tracePerformance("member.community.spaces", () =>
    database.communitySpace.findMany({
      where: {
        status: ContentStatus.PUBLISHED,
        ...communitySpaceAudienceWhere(
          memberId,
          role === MemberRole.ADMIN || role === MemberRole.TEACHER
        ),
      },
      orderBy: [{ position: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        icon: true,
        coverUrl: true,
        visibility: true,
        commentsClosed: true,
        ownerId: true,
        _count: {
          select: {
            posts: {
              where: { status: ContentStatus.PUBLISHED, deletedAt: null },
            },
          },
        },
        members: {
          where: { memberId },
          select: { id: true },
          take: 1,
        },
      },
    })
  );
};

export const getCommunitySpaceDirectoryPage = async (
  memberId: string,
  {
    cursor,
    query,
    section,
  }: {
    readonly cursor?: string;
    readonly query?: string;
    readonly section: CommunitySpaceDirectorySection;
  }
) => {
  const role = await getMemberRole(memberId);
  const where = communitySpaceDirectoryWhere({
    canModeratePrivateGroups:
      role === MemberRole.ADMIN || role === MemberRole.TEACHER,
    memberId,
    query,
    section,
  });
  const requestedCursor =
    cursor && communitySpaceDirectoryCursorPattern.test(cursor)
      ? cursor
      : undefined;
  const cursorSpace = requestedCursor
    ? await tracePerformance("member.community.space-directory.cursor", () =>
        database.communitySpace.findFirst({
          where: { AND: [where, { id: requestedCursor }] },
          select: { id: true },
        })
      )
    : null;
  const result = await tracePerformance(
    "member.community.space-directory",
    () =>
      database.communitySpace.findMany({
        where,
        orderBy: [{ position: "asc" }, { title: "asc" }, { id: "asc" }],
        take: COMMUNITY_SPACE_DIRECTORY_PAGE_SIZE + 1,
        ...(cursorSpace ? { cursor: { id: cursorSpace.id }, skip: 1 } : {}),
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          icon: true,
          coverUrl: true,
          visibility: true,
          ownerId: true,
          members: {
            where: { memberId },
            select: { role: true },
            take: 1,
          },
          _count: {
            select: {
              members: true,
              posts: {
                where: { status: ContentStatus.PUBLISHED, deletedAt: null },
              },
            },
          },
        },
      })
  );
  const hasMore = result.length > COMMUNITY_SPACE_DIRECTORY_PAGE_SIZE;
  const spaces = result.slice(0, COMMUNITY_SPACE_DIRECTORY_PAGE_SIZE);
  const lastSpace = spaces.at(-1);

  return {
    spaces,
    hasMore,
    nextCursor: hasMore ? lastSpace?.id : undefined,
  };
};

export type CommunitySpaceDirectoryPage = Awaited<
  ReturnType<typeof getCommunitySpaceDirectoryPage>
>;
export type CommunitySpaceDirectoryItem =
  CommunitySpaceDirectoryPage["spaces"][number];

export const getCommunityPresenceProfiles = (memberId: string) =>
  tracePerformance("member.community.presence-profiles", () =>
    database.profile.findMany({
      where: { clerkUserId: { not: memberId } },
      orderBy: [{ updatedAt: "desc" }, { displayName: "asc" }],
      take: 24,
      select: { avatarUrl: true, displayName: true, username: true },
    })
  );

export const getLatestCommunityPost = async () =>
  database.communityPost.findFirst({
    where: {
      status: ContentStatus.PUBLISHED,
      deletedAt: null,
      ...communityPostAudienceWhere(null),
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
  readonly cursor?: string;
  readonly kind?: CommunityPostKind;
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
    excerpt: true,
    contentJson: true,
    tags: true,
    coverUrl: true,
    authorId: true,
    status: true,
    isPinned: true,
    isFeatured: true,
    kind: true,
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
  canModeratePrivateGroups,
  memberId,
  query,
  sort,
  kind,
  spaceSlug,
}: {
  readonly authorIds?: string[];
  readonly canModeratePrivateGroups: boolean;
  readonly memberId: string;
  readonly query: string;
  readonly sort: CommunityFeedSort;
  readonly kind?: CommunityPostKind;
  readonly spaceSlug?: string;
}): Prisma.CommunityPostWhereInput => ({
  status: ContentStatus.PUBLISHED,
  deletedAt: null,
  ...(spaceSlug
    ? {}
    : communityPostAudienceWhere(memberId, canModeratePrivateGroups)),
  ...(sort === "unanswered" ? { comments: { none: { deletedAt: null } } } : {}),
  ...(kind ? { kind } : {}),
  ...(spaceSlug
    ? {
        space: {
          is: {
            slug: spaceSlug,
            status: ContentStatus.PUBLISHED,
            ...communitySpaceAudienceWhere(memberId, canModeratePrivateGroups),
          },
        },
      }
    : {}),
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
  cursor: string | undefined,
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
  const cursorIndex = cursor
    ? rankedPosts.findIndex(({ post }) => post.id === cursor)
    : -1;
  const start = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  const visiblePosts = rankedPosts
    .slice(start, start + POST_PAGE_SIZE)
    .map(({ post }) => post);
  const hasMore = rankedPosts.length > start + POST_PAGE_SIZE;
  return {
    hasMore,
    nextCursor: hasMore ? visiblePosts.at(-1)?.id : undefined,
    visiblePosts,
  };
};

const getChronologicalCommunityPosts = async (
  memberId: string,
  cursor: string | undefined,
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
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: POST_PAGE_SIZE + 1,
    select: communityFeedSelect(memberId),
  });
  const visiblePosts = posts.slice(0, POST_PAGE_SIZE);
  const hasMore = posts.length > POST_PAGE_SIZE;
  return {
    hasMore,
    nextCursor: hasMore ? visiblePosts.at(-1)?.id : undefined,
    visiblePosts,
  };
};

export const getCommunityFeed = async (
  memberId: string,
  options: CommunityFeedOptions = {}
) => {
  const cursor = options.cursor?.trim().slice(0, 100) || undefined;
  const query = options.query?.trim().slice(0, 100) ?? "";
  const sort = normalizeCommunitySort(options.sort);
  const [authorIds, role] = await tracePerformance(
    "member.community.search-and-role",
    () =>
      Promise.all([
        findMatchingCommunityAuthorIds(query),
        getMemberRole(memberId),
      ])
  );
  const where = communityFeedWhere({
    authorIds,
    canModeratePrivateGroups:
      role === MemberRole.ADMIN || role === MemberRole.TEACHER,
    memberId,
    query,
    sort,
    kind: options.kind,
    spaceSlug: options.spaceSlug,
  });
  const feed = await tracePerformance("member.community.feed-query", () =>
    sort === "popular"
      ? getPopularCommunityPosts(memberId, cursor, where)
      : getChronologicalCommunityPosts(memberId, cursor, where)
  );

  const enrichedPosts = await tracePerformance(
    "member.community.author-enrichment",
    () => enrichAuthors(feed.visiblePosts)
  );

  return {
    posts: enrichedPosts.map((post) => ({
      ...post,
      coverUrl: normalizeCommunityCoverUrl(post.coverUrl),
      excerpt: post.excerpt ?? "",
      media: extractCommunityMedia(post.contentJson),
      readingMinutes: readingMinutes(post.excerpt ?? ""),
    })),
    nextCursor: feed.nextCursor,
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
  const role = await getMemberRole(memberId);
  const space = await database.communitySpace.findFirst({
    where: {
      slug,
      status: ContentStatus.PUBLISHED,
      ...communitySpaceAudienceWhere(
        memberId,
        role === MemberRole.ADMIN || role === MemberRole.TEACHER
      ),
    },
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      icon: true,
      coverUrl: true,
      details: true,
      visibility: true,
      ownerId: true,
      members: {
        where: { memberId },
        select: { id: true, role: true },
        take: 1,
      },
      _count: { select: { members: true } },
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
      coverUrl: normalizeCommunityCoverUrl(post.coverUrl),
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
  content: true,
  excerpt: true,
  contentJson: true,
  tags: true,
  coverUrl: true,
  ...communityCoverAltSelect,
  authorId: true,
  isPinned: true,
  isFeatured: true,
  featuredAt: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  editedAt: true,
  space: {
    select: { id: true, title: true, slug: true, commentsClosed: true },
  },
  _count: {
    select: { comments: { where: { deletedAt: null } }, votes: true },
  },
} as const;

const getPublishedPost = async (
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
  const role = await getMemberRole(memberId);
  const canModeratePrivateGroups =
    role === MemberRole.ADMIN || role === MemberRole.TEACHER;
  const audienceWhere: Prisma.CommunityPostWhereInput = where.spaceSlug
    ? {
        space: {
          is: {
            slug: where.spaceSlug,
            status: ContentStatus.PUBLISHED,
            ...communitySpaceAudienceWhere(memberId, canModeratePrivateGroups),
          },
        },
      }
    : communityPostAudienceWhere(memberId, canModeratePrivateGroups);

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
    where: { postId: post.id, parentId: null },
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
            editedAt: true,
            deletedAt: true,
            _count: { select: { votes: true } },
            votes: { where: { memberId }, select: { id: true } },
          },
        });

  const profiles = await getProfilesByClerkIds([
    post.authorId,
    ...comments
      .filter((comment) => !comment.deletedAt)
      .map((comment) => comment.authorId),
  ]);

  return {
    ...post,
    coverUrl: normalizeCommunityCoverUrl(post.coverUrl),
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
    where: { id: commentId, postId },
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
      where: { id: comment.parentId, postId },
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
  const role = await getMemberRole(memberId);
  const canModerate = role === MemberRole.TEACHER || role === MemberRole.ADMIN;
  const post = await database.communityPost.findFirst({
    where: {
      id: postId,
      deletedAt: null,
      OR: [
        { authorId: memberId },
        ...(canModerate ? [{ status: ContentStatus.PUBLISHED }] : []),
      ],
    },
    select: {
      ...communityPostSelect,
      status: true,
    },
  });

  if (!post) {
    return null;
  }

  const profiles = await getProfilesByClerkIds([post.authorId]);
  return {
    ...post,
    coverUrl: normalizeCommunityCoverUrl(post.coverUrl),
    profile: profiles.get(post.authorId) ?? null,
  };
};

export const getMyCommunityPosts = async (
  memberId: string,
  status?: ContentStatus
) => {
  const posts = await database.communityPost.findMany({
    where: {
      authorId: memberId,
      deletedAt: null,
      ...(status ? { status } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      subtitle: true,
      slug: true,
      excerpt: true,
      status: true,
      tags: true,
      authorId: true,
      coverUrl: true,
      ...communityCoverAltSelect,
      isPinned: true,
      isFeatured: true,
      createdAt: true,
      publishedAt: true,
      updatedAt: true,
      space: { select: { title: true, slug: true } },
      _count: {
        select: { comments: { where: { deletedAt: null } }, votes: true },
      },
      votes: { where: { memberId }, select: { id: true } },
      bookmarks: { where: { memberId }, select: { id: true } },
    },
  });
  return enrichAuthors(
    posts.map((post) => ({
      ...post,
      coverUrl: normalizeCommunityCoverUrl(post.coverUrl),
      excerpt: post.excerpt ?? "",
      readingMinutes: readingMinutes(post.excerpt ?? ""),
    }))
  );
};

export type CommunityPublicationSort = "recent" | "oldest" | "title";

const MY_PUBLICATIONS_PAGE_SIZE = 20;
const COMMUNITY_PUBLICATIONS_CURSOR_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export const getMyCommunityPublicationCounts = async (memberId: string) => {
  const rows = await database.communityPost.groupBy({
    by: ["status"],
    where: { authorId: memberId, deletedAt: null },
    _count: { _all: true },
  });
  const counts = { archived: 0, drafts: 0, published: 0 };
  for (const row of rows) {
    if (row.status === ContentStatus.PUBLISHED) {
      counts.published = row._count._all;
    } else if (row.status === ContentStatus.DRAFT) {
      counts.drafts = row._count._all;
    } else if (row.status === ContentStatus.ARCHIVED) {
      counts.archived = row._count._all;
    }
  }
  return counts;
};

export const getMyCommunityPublicationPage = async (
  memberId: string,
  options: {
    readonly cursor?: string;
    readonly query?: string;
    readonly sort?: CommunityPublicationSort;
    readonly status: ContentStatus;
  }
) => {
  const take = MY_PUBLICATIONS_PAGE_SIZE;
  const cursor = options.cursor?.match(COMMUNITY_PUBLICATIONS_CURSOR_PATTERN)
    ? options.cursor
    : undefined;
  const query = options.query?.trim().slice(0, 100) ?? "";
  let orderBy: Prisma.CommunityPostOrderByWithRelationInput[];
  if (options.sort === "title") {
    orderBy = [{ title: "asc" }, { id: "asc" }];
  } else if (options.sort === "oldest") {
    orderBy = [{ updatedAt: "asc" }, { id: "asc" }];
  } else {
    orderBy = [{ updatedAt: "desc" }, { id: "desc" }];
  }
  const rows = await database.communityPost.findMany({
    where: {
      authorId: memberId,
      deletedAt: null,
      status: options.status,
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" as const } },
              { subtitle: { contains: query, mode: "insensitive" as const } },
              { excerpt: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: take + 1,
    select: {
      id: true,
      title: true,
      subtitle: true,
      slug: true,
      excerpt: true,
      status: true,
      tags: true,
      authorId: true,
      coverUrl: true,
      ...communityCoverAltSelect,
      isPinned: true,
      isFeatured: true,
      createdAt: true,
      publishedAt: true,
      updatedAt: true,
      space: { select: { title: true, slug: true } },
      _count: {
        select: { comments: { where: { deletedAt: null } }, votes: true },
      },
      votes: { where: { memberId }, select: { id: true } },
      bookmarks: { where: { memberId }, select: { id: true } },
    },
  });
  const hasMore = rows.length > take;
  const pageRows = hasMore ? rows.slice(0, take) : rows;
  return {
    nextCursor: hasMore ? (pageRows.at(-1)?.id ?? null) : null,
    posts: await enrichAuthors(
      pageRows.map((post) => ({
        ...post,
        coverUrl: normalizeCommunityCoverUrl(post.coverUrl),
        excerpt: post.excerpt ?? "",
        readingMinutes: readingMinutes(post.excerpt ?? ""),
      }))
    ),
  };
};

export const getStaffDeletedCommunityPosts = async () => {
  await requireStaff();
  const recoverableSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return database.communityPost.findMany({
    where: { deletedAt: { gte: recoverableSince, lte: new Date() } },
    orderBy: { deletedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      authorId: true,
      status: true,
      deletedAt: true,
      space: { select: { title: true, slug: true } },
    },
  });
};

export const getSavedCommunityPosts = async (
  memberId: string,
  options: {
    readonly cursor?: string;
    readonly kind?: CommunityPostKind;
    readonly query?: string;
    readonly sort?: CommunityFeedOptions["sort"];
    readonly spaceSlug?: string;
    readonly take?: number;
  } = {}
) => {
  const role = await getMemberRole(memberId);
  const canModeratePrivateGroups =
    role === MemberRole.ADMIN || role === MemberRole.TEACHER;
  const pageSize = options.take ?? 100;
  const query = options.query?.trim().slice(0, 100) ?? "";
  const sort = normalizeCommunitySort(options.sort);
  const authorIds = await findMatchingCommunityAuthorIds(query);
  const where: Prisma.CommunityBookmarkWhereInput = {
    memberId,
    post: {
      is: {
        status: ContentStatus.PUBLISHED,
        deletedAt: null,
        ...communityPostAudienceWhere(memberId, canModeratePrivateGroups),
        ...(options.kind ? { kind: options.kind } : {}),
        ...(sort === "unanswered"
          ? { comments: { none: { deletedAt: null } } }
          : {}),
        ...(options.spaceSlug
          ? {
              space: {
                is: {
                  slug: options.spaceSlug,
                  status: ContentStatus.PUBLISHED,
                  ...communitySpaceAudienceWhere(
                    memberId,
                    canModeratePrivateGroups
                  ),
                },
              },
            }
          : {}),
        ...(query
          ? {
              OR: [
                { title: { contains: query, mode: "insensitive" } },
                { subtitle: { contains: query, mode: "insensitive" } },
                { excerpt: { contains: query, mode: "insensitive" } },
                { tags: { has: query.toLowerCase() } },
                ...(authorIds?.length ? [{ authorId: { in: authorIds } }] : []),
              ],
            }
          : {}),
      },
    },
  };
  const [bookmarks, totalCount] = await Promise.all([
    database.communityBookmark.findMany({
      where,
      orderBy:
        sort === "popular"
          ? [
              { post: { isFeatured: "desc" } },
              { post: { isPinned: "desc" } },
              { post: { votes: { _count: "desc" } } },
              { post: { comments: { _count: "desc" } } },
              { post: { publishedAt: "desc" } },
              { post: { createdAt: "desc" } },
              { id: "asc" },
            ]
          : [{ createdAt: "desc" }, { id: "desc" }],
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      take: pageSize + 1,
      select: {
        id: true,
        createdAt: true,
        post: { select: communityFeedSelect(memberId) },
      },
    }),
    database.communityBookmark.count({ where }),
  ]);
  const visibleBookmarks = bookmarks.slice(0, pageSize);
  const posts = visibleBookmarks.map(({ createdAt: savedAt, post }) => ({
    ...post,
    coverUrl: normalizeCommunityCoverUrl(post.coverUrl),
    excerpt: post.excerpt ?? "",
    media: extractCommunityMedia(post.contentJson),
    readingMinutes: readingMinutes(post.excerpt ?? ""),
    savedAt,
  }));
  return {
    posts: await enrichAuthors(posts),
    hasMore: bookmarks.length > pageSize,
    totalCount,
    nextCursor:
      bookmarks.length > pageSize ? visibleBookmarks.at(-1)?.id : undefined,
  };
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
      slug: true,
      isPinned: true,
      isFeatured: true,
      createdAt: true,
      space: { select: { title: true, slug: true } },
    },
  });
