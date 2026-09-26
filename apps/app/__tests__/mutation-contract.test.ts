import { describe, expect, test } from "vitest";
import { mutationLimits, readIdempotencyKey } from "../lib/mutation-contract";

describe("mutation contract", () => {
  test("accepts UUID idempotency keys and rejects ambiguous values", () => {
    const key = "550e8400-e29b-41d4-a716-446655440000";

    expect(readIdempotencyKey(key)).toBe(key);
    expect(readIdempotencyKey(` ${key} `)).toBe(key);
    expect(readIdempotencyKey("same-comment-text")).toBeNull();
    expect(readIdempotencyKey(null)).toBeNull();
  });

  test("keeps server limits explicit for critical mutations", () => {
    expect(mutationLimits["community.comment.create"]).toEqual({
      max: 10,
      windowMs: 60_000,
    });
    expect(mutationLimits["community.vote"].max).toBeGreaterThan(0);
    expect(mutationLimits["asset.upload"].windowMs).toBeGreaterThan(60_000);
  });
});
