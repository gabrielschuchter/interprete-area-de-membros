// Links typed in "Deixar um caminho até você". The Perfil stores full http(s)
// URLs, so every accepted form is normalized to one (D9: "@usuario" is
// accepted for Instagram).
export type ProfileLinkKind = "website" | "instagram" | "linkedin";

const INSTAGRAM_HANDLE = /^@?([a-z0-9._]{1,30})$/i;
const HTTP_PREFIX = /^https?:\/\//i;
const INSTAGRAM_URL =
  /^https?:\/\/(?:www\.)?instagram\.com\/([a-z0-9._]+)\/?$/i;
const LOOKS_LIKE_HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)+(?:[/?#].*)?$/i;

const httpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

// Returns "" for an empty field, the normalized URL, or null when the value
// cannot be read as a link.
export const normalizeProfileLink = (
  kind: ProfileLinkKind,
  raw: string
): string | null => {
  const value = raw.trim();
  if (!value) {
    return "";
  }
  if (kind === "instagram") {
    const handle = INSTAGRAM_HANDLE.exec(value);
    if (handle) {
      return `https://instagram.com/${handle[1]}`;
    }
  }
  if (HTTP_PREFIX.test(value)) {
    return httpUrl(value);
  }
  if (LOOKS_LIKE_HOST.test(value)) {
    return httpUrl(`https://${value}`);
  }
  return null;
};

// Shows a stored URL the way people type it back (Instagram as @handle).
export const displayProfileLink = (kind: ProfileLinkKind, url: string) => {
  if (kind === "instagram") {
    const match = INSTAGRAM_URL.exec(url);
    if (match) {
      return `@${match[1]}`;
    }
  }
  return url;
};
