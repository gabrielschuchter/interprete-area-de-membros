const COMMUNITY_ORIGIN = "https://community.local";

export const safeCommunityReturnPath = (value: unknown) => {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return null;
  }
  try {
    const url = new URL(value, COMMUNITY_ORIGIN);
    const isCommunityPath =
      url.pathname === "/comunidade" || url.pathname.startsWith("/comunidade/");
    if (url.origin !== COMMUNITY_ORIGIN || !isCommunityPath) {
      return null;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
};
