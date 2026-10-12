import { describe, expect, it } from "vitest";
import {
  normalizeActivitySlug,
  parseActivityRubric,
  validateActivityPublication,
} from "./gestao-activity-domain";

const form = (...rows: readonly (readonly [string, string])[]) => {
  const data = new FormData();
  for (const [title, weight] of rows) {
    data.append("rubricTitle", title);
    data.append("rubricWeight", weight);
  }
  return data;
};

describe("activity rubric inputs", () => {
  it("ignores fully blank rows and compacts positions", () => {
    const result = parseActivityRubric(
      form(["Clareza", "40"], ["", ""], ["Aplicação", "60"])
    );
    expect(result).toEqual({
      ok: true,
      criteria: [
        { title: "Clareza", weight: 40, position: 0 },
        { title: "Aplicação", weight: 60, position: 1 },
      ],
    });
  });

  it("rejects incomplete and out-of-range rows", () => {
    expect(parseActivityRubric(form(["Clareza", ""]))).toEqual({
      ok: false,
      reason: "invalid-row",
    });
    expect(parseActivityRubric(form(["Clareza", "101"]))).toEqual({
      ok: false,
      reason: "invalid-row",
    });
  });

  it("requires exactly 100% and a future deadline before publication", () => {
    const now = new Date("2026-10-12T12:00:00.000Z");
    const criteria = [
      { title: "Clareza", weight: 40, position: 0 },
      { title: "Aplicação", weight: 60, position: 1 },
    ];
    expect(
      validateActivityPublication(
        criteria,
        new Date("2026-10-13T12:00:00Z"),
        now
      )
    ).toBeNull();
    expect(
      validateActivityPublication(
        [{ title: "Clareza", weight: 99, position: 0 }],
        new Date("2026-10-13T12:00:00Z"),
        now
      )
    ).toBe("criteria");
    expect(validateActivityPublication(criteria, now, now)).toBe("due-date");
  });

  it("normalizes accented titles into stable slugs", () => {
    expect(normalizeActivitySlug("Revisão clínica: caso 1")).toBe(
      "revisao-clinica-caso-1"
    );
    expect(normalizeActivitySlug("---")).toBeNull();
  });
});
