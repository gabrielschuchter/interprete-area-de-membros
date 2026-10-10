export interface ExerciseFavoriteCursor {
  readonly createdAt: Date;
  readonly id: string;
}

export const encodeExerciseFavoriteCursor = ({
  createdAt,
  id,
}: ExerciseFavoriteCursor) =>
  Buffer.from(
    JSON.stringify({ createdAt: createdAt.toISOString(), id }),
    "utf8"
  ).toString("base64url");

export const decodeExerciseFavoriteCursor = (
  value?: string
): ExerciseFavoriteCursor | null => {
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
      !("createdAt" in parsed) ||
      !("id" in parsed) ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string" ||
      parsed.id.length === 0 ||
      parsed.id.length > 128
    ) {
      return null;
    }
    const createdAt = new Date(parsed.createdAt);
    if (
      Number.isNaN(createdAt.getTime()) ||
      createdAt.toISOString() !== parsed.createdAt
    ) {
      return null;
    }
    return { createdAt, id: parsed.id };
  } catch {
    return null;
  }
};
