import {
  isValidUsername,
  normalizeUsername,
  USERNAME_MAX_LENGTH,
} from "@/lib/username-rules";

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 60;

// Provisioning (lib/profile.ts) falls back to "membro" and suffixes it with
// part of the Clerk id on collision. None of these were chosen by the person.
const NON_USERNAME_CHARS = /[^a-z0-9-]/;
const LEADING_AT = /^@+/;
const WHITESPACE = /\s+/g;
const WHITESPACE_RUN = /\s+/;
const TRAILING_HYPHENS = /-+$/;
const HYPHENS = /-/g;
const GENERIC_USERNAME = /^membro(?:-membro)?(?:-[a-z0-9]{4,8})?$/;

export const isGenericDisplayName = (value: string | null | undefined) =>
  !value?.trim() || value.trim().toLowerCase() === "membro";

export const isGenericUsername = (value: string | null | undefined) =>
  !value || GENERIC_USERNAME.test(value);

// Route segments and school terms nobody may claim as an address.
export const reservedUsernames = new Set([
  "admin",
  "administrador",
  "administracao",
  "ajuda",
  "api",
  "aprender",
  "atividades",
  "biblioteca",
  "cadastrar",
  "cadastro",
  "colecoes",
  "comunidade",
  "configuracoes",
  "conta",
  "conta-desativada",
  "convites",
  "cursos",
  "encontros",
  "entrar",
  "equipe",
  "escola",
  "estudar",
  "exercicios",
  "ferramentas",
  "gestao",
  "interprete",
  "membro",
  "membros",
  "moderacao",
  "notificacoes",
  "onboarding",
  "perfil",
  "planejamento",
  "privacidade",
  "professor",
  "professora",
  "salvos",
  "sign-in",
  "sign-up",
  "sistema",
  "suporte",
  "tarefas",
  "termos-de-uso",
]);

export const isReservedUsername = (value: string) =>
  reservedUsernames.has(value);

export type UsernameLocalStatus =
  | "empty"
  | "short"
  | "invalid"
  | "reserved"
  | "ok";

// What can be said before asking the server. The alphabet follows the app's
// existing username contract (see lib/username-rules.ts).
export const localUsernameStatus = (value: string): UsernameLocalStatus => {
  if (!value) {
    return "empty";
  }
  if (NON_USERNAME_CHARS.test(value)) {
    return "invalid";
  }
  if (value.replace(HYPHENS, "").length < 3 || value.length < 3) {
    return "short";
  }
  if (!isValidUsername(value)) {
    return "invalid";
  }
  if (isReservedUsername(value)) {
    return "reserved";
  }
  return "ok";
};

// Lowercases and drops spaces as the person types, leaving any other invalid
// character visible so the field can explain it.
export const typedUsername = (value: string) =>
  value
    .replace(LEADING_AT, "")
    .replace(WHITESPACE, "")
    .toLowerCase()
    .slice(0, 40);

export const usernameFromName = (name: string) => normalizeUsername(name);

export const firstName = (name: string) =>
  name.trim().split(WHITESPACE_RUN)[0] ?? "";

const withSuffix = (base: string, suffix: string) =>
  `${base.slice(0, USERNAME_MAX_LENGTH - suffix.length - 1).replace(TRAILING_HYPHENS, "")}-${suffix}`;

// Candidate addresses offered when the chosen one is taken or reserved:
// {base}-pbe, {base}-{initial of the last name}, {base}-{year}.
export const usernameSuggestions = (
  value: string,
  displayName: string,
  year: number
) => {
  const base = normalizeUsername(value) || usernameFromName(displayName);
  if (!base) {
    return [];
  }
  const parts = displayName.trim().split(WHITESPACE_RUN).filter(Boolean);
  const lastInitial =
    parts.length > 1 ? normalizeUsername(parts.at(-1) ?? "").slice(0, 1) : "";
  const candidates = [
    withSuffix(base, "pbe"),
    lastInitial ? withSuffix(base, lastInitial) : null,
    withSuffix(base, String(year)),
  ];
  return [
    ...new Set(
      candidates.filter(
        (candidate): candidate is string =>
          candidate !== null &&
          candidate !== value &&
          isValidUsername(candidate) &&
          !isReservedUsername(candidate)
      )
    ),
  ];
};

export const validDisplayName = (value: string) => {
  const trimmed = value.trim();
  return (
    trimmed.length >= DISPLAY_NAME_MIN &&
    trimmed.length <= DISPLAY_NAME_MAX &&
    !isGenericDisplayName(trimmed)
  );
};
