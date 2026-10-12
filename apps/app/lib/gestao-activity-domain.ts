export interface ActivityRubricInput {
  readonly position: number;
  readonly title: string;
  readonly weight: number;
}

export type ActivityRubricParseResult =
  | { readonly ok: true; readonly criteria: readonly ActivityRubricInput[] }
  | { readonly ok: false; readonly reason: "invalid-row" | "too-many" };

const textEntries = (formData: FormData, name: string) =>
  formData
    .getAll(name)
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""));

const validSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const parseActivityRubric = (
  formData: FormData
): ActivityRubricParseResult => {
  const titles = textEntries(formData, "rubricTitle");
  const weights = textEntries(formData, "rubricWeight");
  if (Math.max(titles.length, weights.length) > 12) {
    return { ok: false, reason: "too-many" };
  }
  const criteria: ActivityRubricInput[] = [];
  for (
    let index = 0;
    index < Math.max(titles.length, weights.length);
    index += 1
  ) {
    const title = titles[index] ?? "";
    const weightValue = weights[index] ?? "";
    if (!(title || weightValue)) {
      continue;
    }
    const weight = Number(weightValue);
    if (
      !(title && weightValue) ||
      title.length > 120 ||
      !Number.isInteger(weight) ||
      weight < 0 ||
      weight > 100
    ) {
      return { ok: false, reason: "invalid-row" };
    }
    criteria.push({ title, weight, position: criteria.length });
  }
  return { ok: true, criteria };
};

export const validateActivityPublication = (
  criteria: readonly ActivityRubricInput[],
  dueAt: Date | null,
  now = new Date()
) => {
  if (
    criteria.length === 0 ||
    criteria.reduce((sum, item) => sum + item.weight, 0) !== 100
  ) {
    return "criteria" as const;
  }
  if (!dueAt || dueAt.getTime() <= now.getTime()) {
    return "due-date" as const;
  }
  return null;
};

export const normalizeActivitySlug = (value: string) => {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return validSlugPattern.test(slug) ? slug : null;
};
