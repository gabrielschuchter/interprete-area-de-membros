const LANGUAGE_SEPARATOR_PATTERN = /[,/]/;

const LANGUAGE_LABELS: Readonly<Record<string, string>> = {
  en: "English",
  es: "Español",
  pt: "Português",
};

export const libraryLanguageLabel = (language: string | null) =>
  language
    ?.split(LANGUAGE_SEPARATOR_PATTERN)
    .map((code) => LANGUAGE_LABELS[code.toLowerCase()] ?? code)
    .join(" · ") ?? "Idioma não informado";

export const libraryDifficultyLabel = (difficulty: string | null) =>
  ({
    ADVANCED: "Avançado",
    INTERMEDIATE: "Intermediário",
    INTRODUCTORY: "Introdutório",
  })[difficulty ?? ""] ?? "Nível não informado";

export const libraryAccessLabel = (access: string | null) =>
  ({
    FREE_TOOL: "Ferramenta gratuita",
    FREE_TO_READ: "Leitura gratuita",
    OPEN_ACCESS: "Acesso aberto",
  })[access ?? ""] ?? "Acesso gratuito";
