export interface ExerciseHistoryCursor {
  readonly completedAt: Date;
  readonly id: string;
}

export const encodeExerciseHistoryCursor = ({
  completedAt,
  id,
}: ExerciseHistoryCursor) =>
  Buffer.from(
    JSON.stringify({ completedAt: completedAt.toISOString(), id }),
    "utf8"
  ).toString("base64url");

export const decodeExerciseHistoryCursor = (
  value?: string
): ExerciseHistoryCursor | null => {
  if (!(value && value.length <= 512)) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8")
    );
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("completedAt" in parsed) ||
      !("id" in parsed) ||
      typeof parsed.completedAt !== "string" ||
      typeof parsed.id !== "string" ||
      parsed.id.length === 0 ||
      parsed.id.length > 128
    ) {
      return null;
    }
    const completedAt = new Date(parsed.completedAt);
    if (
      Number.isNaN(completedAt.getTime()) ||
      completedAt.toISOString() !== parsed.completedAt
    ) {
      return null;
    }
    return { completedAt, id: parsed.id };
  } catch {
    return null;
  }
};
