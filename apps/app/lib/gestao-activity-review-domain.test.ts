import { describe, expect, it } from "vitest";
import {
  isReviewForCurrentSubmission,
  parseActivityReview,
} from "./gestao-activity-review-domain";

const criteria = [
  { id: "clarity", weight: 40 },
  { id: "application", weight: 60 },
];

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) {
    data.set(name, value);
  }
  return data;
};

describe("activity correction reviews", () => {
  it("does not reuse a draft or score from a previous submission version", () => {
    const submissionAt = new Date("2026-10-12T12:00:00.000Z");
    expect(
      isReviewForCurrentSubmission({
        reviewAt: new Date("2026-10-12T11:59:59.000Z"),
        reviewRubricVersion: 2,
        submissionAt,
        submissionRubricVersion: 2,
      })
    ).toBe(false);
    expect(
      isReviewForCurrentSubmission({
        reviewAt: new Date("2026-10-12T12:00:01.000Z"),
        reviewRubricVersion: 1,
        submissionAt,
        submissionRubricVersion: 2,
      })
    ).toBe(false);
  });

  it("allows an empty comment and partial scores in a saved draft", () => {
    expect(
      parseActivityReview(form({ "score:clarity": "8" }), criteria, "draft")
    ).toEqual({
      ok: true,
      content: "",
      scores: { clarity: 8 },
      weightedAverage: null,
    });
  });

  it("requires a comment and every criterion score before sending", () => {
    expect(parseActivityReview(form({}), criteria, "send")).toEqual({
      ok: false,
      reason: "comment-required",
    });
    expect(
      parseActivityReview(form({ content: "Orientação" }), criteria, "send")
    ).toEqual({ ok: false, reason: "scores-required" });
  });

  it("calculates the informational weighted average from 0 to 10 scores", () => {
    expect(
      parseActivityReview(
        form({
          content: "Orientação concreta",
          "score:clarity": "8",
          "score:application": "7",
        }),
        criteria,
        "send"
      )
    ).toEqual({
      ok: true,
      content: "Orientação concreta",
      scores: { clarity: 8, application: 7 },
      weightedAverage: 7.4,
    });
  });

  it("rejects invalid scores and foreign criterion fields", () => {
    expect(
      parseActivityReview(form({ "score:clarity": "11" }), criteria, "draft")
    ).toEqual({ ok: false, reason: "score-invalid" });
    expect(
      parseActivityReview(form({ "score:other": "5" }), criteria, "draft")
    ).toEqual({ ok: false, reason: "score-invalid" });
  });
});
