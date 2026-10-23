// "Aprender" was renamed to "Cursos". Old links live in e-mails, notifications,
// calendar feeds and bookmarks, so every /aprender URL keeps resolving.
export const legacyLearningPathname = (segments: readonly string[]) => {
  const [first, ...rest] = segments.map((segment) =>
    encodeURIComponent(segment)
  );

  if (!first) {
    return "/cursos";
  }
  if (first === "minhas-gravacoes") {
    return "/encontros/gravacoes";
  }
  if (first === "cursos") {
    return rest.length > 0 ? `/cursos/${rest.join("/")}` : "/cursos";
  }

  return `/cursos/${[first, ...rest].join("/")}`;
};
