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

test("starts a fresh intent budget after the route changes", () => {
  reserveNavigationPrefetch("/", "/aprender");
  reserveNavigationPrefetch("/", "/comunidade");

  expect(reserveNavigationPrefetch("/aprender", "/comunidade")).toBe(true);
});

test("does not prefetch when data saving or a constrained network is active", () => {
  expect(canPrefetchForConnection({ saveData: true })).toBe(false);
  expect(canPrefetchForConnection({ effectiveType: "2g" })).toBe(false);
  expect(canPrefetchForConnection({ effectiveType: "slow-2g" })).toBe(false);
  expect(canPrefetchForConnection({ effectiveType: "4g" })).toBe(true);
});
