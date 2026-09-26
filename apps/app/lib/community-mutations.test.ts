import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

interface MockComment {
  authorId: string;
  content: string;
  contentJson: null;
  id: string;
  idempotencyKey: string;
  parentId: null;
  postId: string;
}

const { databaseMock, state } = vi.hoisted(() => {
  const state: { comments: Map<string, MockComment> } = {
    comments: new Map(),
  };

  const post = {
    authorId: "member-owner",
    id: "post-1",
    slug: null,
    space: null,
    title: "Uma discussão",
  };

  const databaseMock = {
    communityComment: {
      create: vi.fn(({ data }: { data: Omit<MockComment, "id"> }) => {
        if (state.comments.has(data.idempotencyKey)) {
          const error = new Error("duplicate");
          Object.assign(error, { code: "P2002" });
          throw error;
        }
        const comment = {
          ...data,
          id: `comment-${state.comments.size + 1}`,
        };
        state.comments.set(data.idempotencyKey, comment);
        return { id: comment.id };
      }),
      findFirst: vi.fn(() => ({ id: "comment-parent" })),
      findUnique: vi.fn(({ where }: { where: Record<string, unknown> }) => {
        if (where.id) {
          return (
            [...state.comments.values()].find(
              (comment) => comment.id === where.id
            ) ?? null
          );
        }
        const attempt = where.authorId_idempotencyKey as
          | { authorId: string; idempotencyKey: string }
          | undefined;
        if (!attempt) {
          return null;
        }
        const comment = state.comments.get(attempt.idempotencyKey);
        return comment ? { ...comment, post } : null;
      }),
    },
    communityPost: {
      findFirst: vi.fn(async () => post),
    },
    topicFollow: {
      upsert: vi.fn(() => ({ id: "follow-1" })),
    },
  };

  return { databaseMock, state };
});

vi.mock("@repo/database", () => ({
  ContentStatus: { PUBLISHED: "PUBLISHED" },
  database: databaseMock,
}));

vi.mock("./notifications", () => ({
  documentHasGroupMention: () => false,
  notifyCommunityComment: vi.fn(() => undefined),
}));

vi.mock("./profile", () => ({
  getOrCreateProfile: vi.fn(() => undefined),
}));

vi.mock("./mutation-reliability", () => ({
  consumeMutationRateLimit: vi.fn(() => undefined),
  isMutationRateLimitError: () => false,
  isUniqueConstraintError: (error: unknown) =>
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002",
  mutationLog: vi.fn(),
}));

import { createCommunityComment } from "./community-mutations";

const input = (idempotencyKey: string) => ({
  actorId: "member-author",
  content: "Uma contribuição legítima.",
  document: undefined,
  groupMentionConfirmed: false,
  idempotencyKey,
  parentId: null,
  postId: "post-1",
});

describe("community mutation idempotency", () => {
  beforeEach(() => {
    state.comments.clear();
    vi.clearAllMocks();
  });

  test("concurrent requests with one key resolve to one canonical comment", async () => {
    const [first, second] = await Promise.all([
      createCommunityComment(input("550e8400-e29b-41d4-a716-446655440000")),
      createCommunityComment(input("550e8400-e29b-41d4-a716-446655440000")),
    ]);

    expect(first.commentId).toBe("comment-1");
    expect(second.commentId).toBe("comment-1");
    expect(databaseMock.communityComment.create).toHaveBeenCalledTimes(2);
    expect(state.comments.size).toBe(1);
  });

  test("different keys represent different logical comments", async () => {
    const first = await createCommunityComment(
      input("550e8400-e29b-41d4-a716-446655440000")
    );
    const second = await createCommunityComment(
      input("550e8400-e29b-41d4-a716-446655440001")
    );

    expect(first.commentId).toBe("comment-1");
    expect(second.duplicate).toBe(false);
    expect(databaseMock.communityComment.create).toHaveBeenCalledTimes(2);
  });
});
