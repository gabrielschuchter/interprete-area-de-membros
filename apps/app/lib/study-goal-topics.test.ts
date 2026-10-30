import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/database", () => ({
  database: {},
  libraryCatalogCategories: [
    "Epidemiologia e desenhos de estudo",
    "Bioestatística e interpretação",
    "Nutrição baseada em evidências",
  ],
  StudyActivityKind: {
    EXERCISE: "EXERCISE",
    LESSON: "LESSON",
    LIBRARY_ITEM: "LIBRARY_ITEM",
  },
  StudyGoalPeriod: { MONTHLY: "MONTHLY", WEEKLY: "WEEKLY" },
}));

const { allocateTopicsEvenly, catalogTopicFor } = await import(
  "./study-goal-topics"
);

describe("study goal topics", () => {
  it("splits 100% in whole parts, remainder first", () => {
    expect(allocateTopicsEvenly(["A", "B", "C"])).toEqual([
      { topic: "A", sharePercent: 34 },
      { topic: "B", sharePercent: 33 },
      { topic: "C", sharePercent: 33 },
    ]);
    expect(allocateTopicsEvenly(["A", "A"])).toEqual([
      { topic: "A", sharePercent: 100 },
    ]);
    expect(allocateTopicsEvenly([])).toEqual([]);
  });

  it("matches free categories to the catalog ignoring case and accents", () => {
    expect(catalogTopicFor("bioestatistica e interpretacao")).toBe(
      "Bioestatística e interpretação"
    );
    expect(catalogTopicFor(" Nutrição baseada em evidências ")).toBe(
      "Nutrição baseada em evidências"
    );
    expect(catalogTopicFor("Outra coisa")).toBeNull();
    expect(catalogTopicFor(null)).toBeNull();
  });
});
