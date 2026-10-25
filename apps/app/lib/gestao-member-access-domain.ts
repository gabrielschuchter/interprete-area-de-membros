export type AccessOriginKey =
  | "ASSIGNMENT"
  | "COHORT"
  | "DIRECT"
  | "ENROLLMENT"
  | "HISTORICAL"
  | "LEGACY_GRANT"
  | "OPEN_ACCESS";

export const accessOriginLabels: Record<AccessOriginKey, string> = {
  ASSIGNMENT: "Atribuição",
  COHORT: "Turma",
  DIRECT: "Direta",
  ENROLLMENT: "Matrícula",
  HISTORICAL: "Histórica",
  LEGACY_GRANT: "Legada",
  OPEN_ACCESS: "Aberto",
};

export const revocableOrigins: readonly AccessOriginKey[] = [
  "DIRECT",
  "LEGACY_GRANT",
];

export const accessOriginHints: Record<AccessOriginKey, string> = {
  ASSIGNMENT: "Revogue em Atribuições",
  COHORT: "Remova da turma",
  DIRECT: "",
  ENROLLMENT: "Vem da matrícula no curso",
  HISTORICAL: "Gerido em Gravações históricas",
  LEGACY_GRANT: "",
  OPEN_ACCESS: "Desligue no curso",
};

const day = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "America/Sao_Paulo",
});

export const validityLabel = (origin: AccessOriginKey, until: Date | null) => {
  if (until) {
    return `até ${day.format(until)}`;
  }
  if (origin === "COHORT") {
    return "Enquanto estiver na turma";
  }
  if (origin === "ASSIGNMENT") {
    return "Enquanto a atribuição valer";
  }
  return "Sem expiração";
};

export type GrantResource = "COURSE" | "LESSON" | "MODULE";

export const grantResourceTypes: readonly GrantResource[] = [
  "COURSE",
  "MODULE",
  "LESSON",
];

export const parseGrantResource = (value: string) => {
  const [type, ...rest] = value.split(":");
  const id = rest.join(":");
  const known = grantResourceTypes.find((candidate) => candidate === type);
  return known && id ? { id, type: known } : null;
};
