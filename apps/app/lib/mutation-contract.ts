export const mutationLimits = {
  "community.comment.create": { max: 10, windowMs: 60_000 },
  "community.post.create": { max: 5, windowMs: 10 * 60_000 },
  "community.mutation": { max: 60, windowMs: 60_000 },
  "community.vote": { max: 30, windowMs: 60_000 },
  "community.bookmark": { max: 30, windowMs: 60_000 },
  "community.follow": { max: 30, windowMs: 60_000 },
  "community.moderation": { max: 30, windowMs: 60_000 },
  "member.search": { max: 60, windowMs: 60_000 },
  "activity.submit": { max: 10, windowMs: 10 * 60_000 },
  "activity.mutation": { max: 30, windowMs: 60_000 },
  "asset.upload": { max: 20, windowMs: 10 * 60_000 },
  "asset.delete": { max: 30, windowMs: 60_000 },
  "notification.mutation": { max: 60, windowMs: 60_000 },
  "profile.update": { max: 10, windowMs: 10 * 60_000 },
  "library.bookmark": { max: 30, windowMs: 60_000 },
  "library.mutation": { max: 30, windowMs: 60_000 },
  "meeting.mutation": { max: 30, windowMs: 60_000 },
  "admin.mutation": { max: 60, windowMs: 60_000 },
} as const;

export type MutationAction = keyof typeof mutationLimits;

const idempotencyKeyPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const readIdempotencyKey = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return idempotencyKeyPattern.test(normalized) ? normalized : null;
};

export const readIdempotencyKeyFromForm = (formData: FormData) =>
  readIdempotencyKey(formData.get("idempotencyKey"));
