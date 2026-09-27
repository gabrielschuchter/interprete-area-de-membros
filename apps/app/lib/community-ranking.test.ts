import { describe, expect, test } from "vitest";
import { communityPopularityScore } from "./community-ranking";

const now = new Date("2026-09-27T12:00:00.000Z");

describe("community popularity", () => {
  test("gives a recent unanswered post a useful baseline", () => {
    const score = communityPopularityScore({
      comments: 0,
      createdAt: now,
      now,
      participants: 1,
      publishedAt: now,
      votes: 0,
    });

    expect(score).toBeGreaterThan(0);
  });

  test("decays older content while rewarding interactions and participants", () => {
    const recent = communityPopularityScore({
      comments: 4,
      createdAt: now,
      now,
      participants: 4,
      publishedAt: now,
      votes: 3,
    });
    const older = communityPopularityScore({
      comments: 4,
      createdAt: new Date("2026-09-20T12:00:00.000Z"),
      now,
      participants: 4,
      publishedAt: new Date("2026-09-20T12:00:00.000Z"),
      votes: 3,
    });
    const engaged = communityPopularityScore({
      comments: 12,
      createdAt: now,
      now,
      participants: 8,
      publishedAt: now,
      votes: 10,
    });

    expect(recent).toBeGreaterThan(older);
    expect(engaged).toBeGreaterThan(recent);
  });
});
