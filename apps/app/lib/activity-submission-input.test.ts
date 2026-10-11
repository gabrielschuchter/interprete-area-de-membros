import { expect, test } from "vitest";
import { activitySubmissionInput } from "./activity-submission-input";

test("accepts file-only submissions without a text field", () => {
  const file = new File(["QA"], "qa.txt", { type: "text/plain" });
  expect(activitySubmissionInput(null, file)).toEqual({
    ok: true,
    text: "",
    file,
  });
});
test("requires a response or a file", () => {
  expect(activitySubmissionInput("  ", null).ok).toBe(false);
});
test("does not let a file bypass the text size limit", () => {
  expect(
    activitySubmissionInput(
      "x".repeat(40_001),
      new File(["QA"], "qa.txt", { type: "text/plain" })
    ).ok
  ).toBe(false);
});
test("rejects unsupported attachments", () => {
  expect(
    activitySubmissionInput(
      null,
      new File(["QA"], "qa.exe", { type: "application/octet-stream" })
    ).ok
  ).toBe(false);
});
