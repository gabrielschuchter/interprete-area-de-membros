import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/notification-outbox-dispatch", () => ({
  dispatchPendingNotifications: vi.fn(() => undefined),
}));

interface MockComment {
  authorId: string;
  content: string;
  contentJson: null;
  createdAt: Date;
  id: string;
  idempotencyKey: string;
  parentId: null;
  postId: string;
}

const { databaseMock, notifyMock, profileMock, state } = vi.hoisted(() => {
  const state: {
    comments: Map<string, MockComment>;
    notificationEvents: Set<string>;
    nestedParent: boolean;
    postVisible: boolean;
    raceComment: MockComment | null;
    raceOnCreate: boolean;
  } = {
    comments: new Map(),
    notificationEvents: new Set(),
    nestedParent: false,
    postVisible: true,
    raceComment: null,
    raceOnCreate: false,
  };

  const post = {
    authorId: "member-owner",
    id: "post-1",
    slug: null,
    space: null,
    title: "Uma discussão",
  };
  let transactionQueue = Promise.resolve();

  const notifyMock = vi.fn(({ commentId }: { commentId: string }) => {
    state.notificationEvents.add(commentId);
    return Promise.resolve();
  });
  const profileMock = vi.fn(() => undefined);
  const databaseMock = {
    $transaction: vi.fn(
      async (operation: (transaction: unknown) => unknown) => {
        const previous = transactionQueue;
        let release!: () => void;
        transactionQueue = new Promise<void>((resolve) => {
          release = resolve;
        });
        await previous;
        const snapshot = new Map(state.comments);
        const eventSnapshot = new Set(state.notificationEvents);
        try {
          return await operation(databaseMock);
        } catch (error) {
          state.comments.clear();
          for (const [key, comment] of snapshot) {
            state.comments.set(key, comment);
          }
          state.notificationEvents.clear();
          for (const eventId of eventSnapshot) {
            state.notificationEvents.add(eventId);
          }
          throw error;
        } finally {
          release();
        }
      }
    ),
    communityComment: {
      create: vi.fn(
        ({ data }: { data: Omit<MockComment, "id" | "createdAt"> }) => {
          if (state.raceOnCreate) {
            state.raceOnCreate = false;
            state.raceComment = {
              ...data,
              id: "comment-raced",
              createdAt: new Date("2026-10-20T12:00:00.000Z"),
            };
            const error = new Error("concurrent insert");
            Object.assign(error, { code: "P2002" });
            throw error;
          }
          if (state.comments.has(data.idempotencyKey)) {
            const error = new Error("duplicate");
            Object.assign(error, { code: "P2002" });
            throw error;
          }
          const comment = {
            ...data,
            id: `comment-${state.comments.size + 1}`,
            createdAt: new Date("2026-10-20T12:00:00.000Z"),
          };
          state.comments.set(data.idempotencyKey, comment);
          return { id: comment.id, createdAt: comment.createdAt };
        }
      ),
      findFirst: vi.fn(({ where }: { where: { parentId?: null } }) =>
        state.nestedParent && where.parentId === null
          ? null
          : { id: "comment-parent" }
      ),
      findUnique: vi.fn(({ where }: { where: Record<string, unknown> }) => {
        const comment = where.id
          ? [...state.comments.values()].find(
              (candidate) => candidate.id === where.id
            )
          : (() => {
              const idempotencyKey = (
                where.authorId_idempotencyKey as
                  | { authorId: string; idempotencyKey: string }
                  | undefined
              )?.idempotencyKey;
              return (
                state.comments.get(idempotencyKey ?? "") ??
                (state.raceComment?.idempotencyKey === idempotencyKey
                  ? state.raceComment
                  : null)
              );
            })();
        if (!comment) {
          return null;
        }
        return { ...comment, post };
      }),
    },
    communityPost: {
      findFirst: vi.fn(() => (state.postVisible ? post : null)),
    },
    domainEvent: {
      findFirst: vi.fn(({ where }: { where: { aggregateId: string } }) =>
        state.notificationEvents.has(where.aggregateId) ||
        state.raceComment?.id === where.aggregateId
          ? { id: "event-1" }
          : null
      ),
    },
    member: {
      findUnique: vi.fn(() => ({ role: "MEMBER", deactivatedAt: null })),
    },
    topicFollow: {
      upsert: vi.fn(() => ({ id: "follow-1" })),
    },
  };

  return { databaseMock, notifyMock, profileMock, state };
});

vi.mock("@repo/database", () => ({
  ContentStatus: { PUBLISHED: "PUBLISHED" },
  database: databaseMock,
}));

vi.mock("./notifications", () => ({
  documentHasGroupMention: () => false,
  notifyCommunityComment: notifyMock,
}));

vi.mock("./profile", () => ({
  getOrCreateProfile: profileMock,
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

describe("community comment transaction and idempotency", () => {
  beforeEach(() => {
    state.comments.clear();
    state.notificationEvents.clear();
    state.nestedParent = false;
    state.postVisible = true;
    state.raceComment = null;
    state.raceOnCreate = false;
    vi.clearAllMocks();
    notifyMock
      .mockReset()
      .mockImplementation(({ commentId }: { commentId: string }) => {
        state.notificationEvents.add(commentId);
        return Promise.resolve();
      });
  });

  test("concurrent requests with one key resolve to one canonical comment", async () => {
    const [first, second] = await Promise.all([
      createCommunityComment(input("550e8400-e29b-41d4-a716-446655440000")),
      createCommunityComment(input("550e8400-e29b-41d4-a716-446655440000")),
    ]);

    expect(first.commentId).toBe("comment-1");
    expect(second.commentId).toBe("comment-1");
    expect(second.duplicate).toBe(true);
    expect(databaseMock.communityComment.create).toHaveBeenCalledTimes(1);
    expect(state.comments.size).toBe(1);
    expect(notifyMock).toHaveBeenCalledTimes(1);
  });

  test("a unique-key race returns the committed canonical comment", async () => {
    state.raceOnCreate = true;

    const result = await createCommunityComment(
      input("550e8400-e29b-41d4-a716-446655440003")
    );

    expect(result).toMatchObject({
      commentId: "comment-raced",
      duplicate: true,
      postId: "post-1",
    });
    expect(state.comments.size).toBe(0);
    expect(notifyMock).not.toHaveBeenCalled();
  });

  test("different keys represent different logical comments", async () => {
    const first = await createCommunityComment(
      input("550e8400-e29b-41d4-a716-446655440000")
    );
    const second = await createCommunityComment(
      input("550e8400-e29b-41d4-a716-446655440001")
    );

    expect(first.commentId).toBe("comment-1");
    expect(second.commentId).toBe("comment-2");
    expect(second.duplicate).toBe(false);
    expect(databaseMock.communityComment.create).toHaveBeenCalledTimes(2);
  });

  test("a retry rechecks access before returning an existing comment", async () => {
    const commentInput = input("550e8400-e29b-41d4-a716-446655440000");
    await createCommunityComment(commentInput);
    state.postVisible = false;

    await expect(createCommunityComment(commentInput)).rejects.toThrow(
      "Esta discussão não está disponível para comentários."
    );
    expect(notifyMock).toHaveBeenCalledTimes(1);
  });

  test("does not provision a profile when the discussion is unavailable", async () => {
    state.postVisible = false;

    await expect(
      createCommunityComment(input("550e8400-e29b-41d4-a716-446655440004"))
    ).rejects.toThrow("Esta discussão não está disponível para comentários.");
    expect(profileMock).not.toHaveBeenCalled();
    expect(databaseMock.communityComment.create).not.toHaveBeenCalled();
  });

  test("rejects replies to comments that already have a parent", async () => {
    state.nestedParent = true;

    await expect(
      createCommunityComment({
        ...input("550e8400-e29b-41d4-a716-446655440002"),
        parentId: "comment-reply",
      })
    ).rejects.toThrow("A resposta original não está mais disponível.");
    expect(databaseMock.communityComment.create).not.toHaveBeenCalled();
    expect(state.comments.size).toBe(0);
  });

  test("a failed notification enqueue rolls back the new comment", async () => {
    notifyMock.mockRejectedValueOnce(new Error("outbox unavailable"));

    await expect(
      createCommunityComment(input("550e8400-e29b-41d4-a716-446655440000"))
    ).rejects.toThrow("outbox unavailable");
    expect(state.comments.size).toBe(0);
    expect(databaseMock.communityComment.create).toHaveBeenCalledTimes(1);
  });
});
