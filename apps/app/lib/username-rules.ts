// Username rules shared by the server (Perfil, onboarding) and the onboarding
// client, which validates as the person types. Mentions and /membros/{username}
// depend on this alphabet: lowercase letters, digits and inner hyphens.
export const USERNAME_MAX_LENGTH = 30;
const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/;

export const normalizeUsername = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, USERNAME_MAX_LENGTH)
    .replace(/-+$/g, "");

export const isValidUsername = (value: string) =>
  value.length >= 3 &&
  value.length <= USERNAME_MAX_LENGTH &&
  USERNAME_PATTERN.test(value);
