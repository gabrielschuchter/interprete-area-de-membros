import "server-only";

export const communityCoverAltEnabled =
  process.env.COMMUNITY_POST_COVER_ALT_ENABLED === "true";

export const communityCoverAltSelect = communityCoverAltEnabled
  ? { coverAltText: true as const }
  : {};

export const communityCoverAltValue = (value: string) =>
  communityCoverAltEnabled ? value.trim().slice(0, 500) : "";
