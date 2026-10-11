export const formatStudyTimestamp = (
  value: Date | string | null | undefined,
  timezone = "America/Sao_Paulo"
) => {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: timezone,
      }).format(date);
};

export const formatNoteListDate = (
  value: Date | string | null | undefined,
  timezone: string,
  referenceNow: string
) => {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const dayNumber = (entry: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(entry);
    const part = (name: string) =>
      Number(parts.find((item) => item.type === name)?.value);
    return Date.UTC(part("year"), part("month") - 1, part("day")) / 86_400_000;
  };
  const dayDifference = dayNumber(new Date(referenceNow)) - dayNumber(date);
  if (dayDifference === 0) {
    return `Hoje, ${new Intl.DateTimeFormat("pt-BR", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)}`;
  }
  if (dayDifference === 1) {
    return "Ontem";
  }
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    day: "numeric",
    month: "short",
  })
    .format(date)
    .replace(" de ", " ");
};
