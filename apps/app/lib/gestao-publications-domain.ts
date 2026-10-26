export type GestaoPublicationTab = "archived" | "published" | "reported";

export const gestaoPublicationTabs: readonly (readonly [
  GestaoPublicationTab,
  string,
])[] = [
  ["published", "Publicadas"],
  ["archived", "Arquivadas"],
  ["reported", "Denunciadas"],
];

export const gestaoPublicationMarks = [
  ["fixada", "Fixada"],
  ["destaque", "Destaque"],
] as const;

export type GestaoPublicationMark = (typeof gestaoPublicationMarks)[number][0];

export const gestaoPublicationTabFromParam = (value: string | undefined) =>
  gestaoPublicationTabs.find(([key]) => key === value)?.[0] ?? "published";

export const gestaoPublicationMarkFromParam = (value: string | undefined) =>
  gestaoPublicationMarks.find(([key]) => key === value)?.[0] ?? null;

const zone = "America/Sao_Paulo";
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: zone,
  year: "numeric",
});
const dayFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  timeZone: zone,
});
const monthFormat = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  timeZone: zone,
});

const msPerDay = 86_400_000;

/** "hoje", "ontem" ou "25 set." no fuso de Brasília. */
export const gestaoRelativeDay = (date: Date, now = new Date()) => {
  const key = dayKeyFormat.format(date);
  if (key === dayKeyFormat.format(now)) {
    return "hoje";
  }
  if (key === dayKeyFormat.format(new Date(now.getTime() - msPerDay))) {
    return "ontem";
  }
  return `${dayFormat.format(date)} ${monthFormat.format(date)}`;
};

const whitespace = /\s+/;

export const gestaoInitials = (name: string) =>
  name
    .split(whitespace)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
