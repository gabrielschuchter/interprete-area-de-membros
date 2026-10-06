import assert from "node:assert/strict";
import test from "node:test";
import { findPerformanceBudgetViolations } from "./app-performance-budget.mjs";

const budgets = {
  criticalRoutes: [
    { route: "home", maxGzipBytes: 250_000 },
    { route: "learning", maxGzipBytes: 260_000 },
  ],
};

test("accepts measured routes under their individual gzip budgets", () => {
  assert.deepEqual(
    findPerformanceBudgetViolations(
      [
        { route: "home", gzipBytes: 240_000 },
        { route: "learning", gzipBytes: 255_000 },
      ],
      budgets
    ),
    []
  );
});

test("reports missing critical routes and per-route budget regressions", () => {
  assert.deepEqual(
    findPerformanceBudgetViolations(
      [{ route: "home", gzipBytes: 250_001 }],
      budgets
    ),
    [
      "Missing performance measurement for learning.",
      "home initial JavaScript is 250001 bytes gzip; budget is 250000.",
    ]
  );
});
