const activityQueuePath =
  /^\/gestao\/ensino\/atividades\/([A-Za-z0-9_-]+)\/entregas$/;

export const correctionNavigation = (candidate: string) => {
  const fallback = "/gestao/alunos/correcoes";
  let url: URL;
  try {
    url = new URL(candidate || fallback, "http://gestao.local");
  } catch {
    return { path: fallback, filters: {} };
  }
  const activity = activityQueuePath.exec(url.pathname);
  if (
    url.origin !== "http://gestao.local" ||
    (url.pathname !== fallback && !activity)
  ) {
    return { path: fallback, filters: {} };
  }
  return {
    path: `${url.pathname}${url.search}`,
    filters: {
      activityId: activity?.[1],
      cohortId: url.searchParams.get("turma")?.trim() || undefined,
      query: url.searchParams.get("q")?.trim().slice(0, 120) || undefined,
    },
  };
};

export const correctionResultPath = (
  path: string,
  result: "feedback-enviado" | "rascunho-salvo",
  submissionId: string,
  nextSubmissionId?: string
) => {
  const url = new URL(correctionNavigation(path).path, "http://gestao.local");
  url.searchParams.set("resultado", result);
  if (result === "feedback-enviado") {
    url.searchParams.set("estado", "PENDING");
    url.searchParams.delete("pagina");
    url.searchParams.delete("entrega");
    if (nextSubmissionId) {
      url.searchParams.set("entrega", nextSubmissionId);
    }
  } else {
    url.searchParams.set("entrega", submissionId);
  }
  return `${url.pathname}${url.search}`;
};
