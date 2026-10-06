import { afterEach, expect, test } from "vitest";
import {
  canPrefetchForConnection,
  reserveNavigationPrefetch,
  resetNavigationPrefetchBudget,
} from "./navigation-prefetch";

afterEach(resetNavigationPrefetchBudget);

test("limits speculative route loads and does not prefetch one destination twice", () => {
  expect(reserveNavigationPrefetch("/", "/aprender")).toBe(true);
  expect(reserveNavigationPrefetch("/", "/aprender")).toBe(false);
  expect(reserveNavigationPrefetch("/", "/comunidade")).toBe(true);
  expect(reserveNavigationPrefetch("/", "/biblioteca")).toBe(false);
});

test("treats fragment links as the same destination for the route budget", () => {
  expect(
    reserveNavigationPrefetch("/comunidade", "/comunidade/post-1#comments")
  ).toBe(true);
  expect(reserveNavigationPrefetch("/comunidade", "/comunidade/post-1")).toBe(
    false
  );
});

test("starts a fresh intent budget after the route changes", () => {
  reserveNavigationPrefetch("/", "/aprender");
  reserveNavigationPrefetch("/", "/comunidade");

  expect(reserveNavigationPrefetch("/aprender", "/comunidade")).toBe(true);
});

test("starts a fresh intent budget when pagination changes query parameters", () => {
  expect(
    reserveNavigationPrefetch("/admin/library?page=1", "/admin/library?page=2")
  ).toBe(true);
  expect(
    reserveNavigationPrefetch("/admin/library?page=1", "/admin/library?page=3")
  ).toBe(true);

  expect(
    reserveNavigationPrefetch("/admin/library?page=2", "/admin/library?page=3")
  ).toBe(true);
});

test("does not prefetch when data saving or a constrained network is active", () => {
  expect(canPrefetchForConnection({ saveData: true })).toBe(false);
  expect(canPrefetchForConnection({ effectiveType: "2g" })).toBe(false);
  expect(canPrefetchForConnection({ effectiveType: "slow-2g" })).toBe(false);
  expect(canPrefetchForConnection({ effectiveType: "4g" })).toBe(true);
});
