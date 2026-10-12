export interface ReviewCriterion {
  readonly id: string;
  readonly weight: number;
}

export const isReviewForCurrentSubmission = (input: {
  readonly reviewAt: Date | null;
  readonly reviewRubricVersion: number;
  readonly submissionAt: Date;
  readonly submissionRubricVersion: number;
}) =>
  input.reviewAt !== null &&
  input.reviewRubricVersion === input.submissionRubricVersion &&
  input.reviewAt >= input.submissionAt;

export type ActivityReviewParseResult =
  | {
      readonly ok: true;
      readonly content: string;
      readonly scores: Readonly<Record<string, number>>;
      readonly weightedAverage: number | null;
    }
  | {
      readonly ok: false;
      readonly reason:
        | "comment-required"
        | "comment-too-long"
        | "score-invalid"
        | "scores-required";
    };

const fieldValue = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
};

export const parseActivityReview = (
  formData: FormData,
  criteria: readonly ReviewCriterion[],
  intent: "draft" | "send"
): ActivityReviewParseResult => {
  const content = fieldValue(formData, "content");
  if (content.length > 20_000) {
    return { ok: false, reason: "comment-too-long" };
  }
  if (intent === "send" && !content) {
    return { ok: false, reason: "comment-required" };
  }

  const criterionIds = new Set(criteria.map(({ id }) => id));
  const scores: Record<string, number> = {};
  for (const [name, value] of formData.entries()) {
    if (!name.startsWith("score:")) {
      continue;
    }
    const criterionId = name.slice("score:".length);
    if (!criterionIds.has(criterionId) || typeof value !== "string") {
      return { ok: false, reason: "score-invalid" };
    }
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }
    const score = Number(normalized);
    if (!Number.isInteger(score) || score < 0 || score > 10) {
      return { ok: false, reason: "score-invalid" };
    }
    scores[criterionId] = score;
  }

  if (
    intent === "send" &&
    criteria.some(({ id }) => scores[id] === undefined)
  ) {
    return { ok: false, reason: "scores-required" };
  }

  const totalWeight = criteria.reduce((sum, { weight }) => sum + weight, 0);
  const weightedPoints = criteria.reduce(
    (sum, criterion) => sum + (scores[criterion.id] ?? 0) * criterion.weight,
    0
  );
  const allCriteriaScored =
    criteria.length > 0 && criteria.every(({ id }) => scores[id] !== undefined);

  return {
    ok: true,
    content,
    scores,
    weightedAverage:
      allCriteriaScored && totalWeight > 0
        ? Number((weightedPoints / totalWeight).toFixed(1))
        : null,
  };
};
