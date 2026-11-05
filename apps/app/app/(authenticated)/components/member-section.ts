export const personalContentNavigation = [
  {
    href: "/comunidade/encontros/gravacoes",
    icon: "recordings",
    label: "Minhas gravações",
  },
] as const;

const communityPublicationPrefixes = [
  "/comunidade/meus-topicos",
  "/comunidade/minhas-publicacoes",
] as const;

const isCommunityPublicationPath = (pathname: string) =>
  communityPublicationPrefixes.some((prefix) => pathname.startsWith(prefix));

export const memberSectionForPathname = (pathname: string) => {
  if (pathname === "/salvos") {
    return "Salvos";
  }
  if (pathname.startsWith("/admin")) {
    return "Professor";
  }
  if (pathname.startsWith("/cursos")) {
    return "Cursos";
  }
  if (pathname.startsWith("/tarefas")) {
    return "Metas e tarefas";
  }
  if (pathname.startsWith("/exercicios")) {
    return "Exercícios";
  }
  if (pathname.startsWith("/atividades")) {
    return "Atividades";
  }
  if (isCommunityPublicationPath(pathname)) {
    return "Minhas publicações";
  }
  if (pathname.startsWith("/comunidade/salvos")) {
    return "Comunidade";
  }
  if (pathname.startsWith("/comunidade")) {
    return "Comunidade";
  }
  if (pathname.startsWith("/biblioteca")) {
    return "Biblioteca";
  }
  if (pathname.startsWith("/encontros/gravacoes")) {
    return "Minhas gravações";
  }
  if (pathname.startsWith("/encontros")) {
    return "Encontros";
  }
  if (pathname.startsWith("/membros")) {
    return "Membros";
  }
  if (pathname.startsWith("/configuracoes")) {
    return "Configurações";
  }
  if (pathname.startsWith("/notificacoes")) {
    return "Notificações";
  }
  if (pathname === "/perfil") {
    return "Perfil";
  }
  return "Início";
};

const communityBreadcrumbAreas = [
  ["/comunidade/encontros/gravacoes", "Minhas gravações"],
  ["/comunidade/encontros", "Encontros"],
  ["/comunidade/grupos", "Grupos"],
  ["/comunidade/salvos", "Salvos"],
  ["/comunidade/minhas-publicacoes", "Minhas publicações"],
  ["/comunidade/meus-topicos", "Minhas publicações"],
  ["/comunidade/publicacoes", "Explorar"],
  ["/comunidade/meta", "Meta coletiva"],
  ["/comunidade/novo", "Nova publicação"],
  ["/comunidade/editor", "Nova publicação"],
] as const;

export const memberBreadcrumbForPathname = (pathname: string) => {
  if (pathname === "/salvos") {
    return "Salvos";
  }
  if (pathname === "/estudar") {
    return "Início › Estudar";
  }
  if (pathname.startsWith("/cursos")) {
    return "Estudar · Cursos";
  }
  if (pathname.startsWith("/tarefas")) {
    return "Ferramentas · Tarefas";
  }
  if (pathname.startsWith("/ferramentas")) {
    const section = pathname.split("/").filter(Boolean)[1];
    return section ? `Ferramentas · ${section}` : "Estudar · Ferramentas";
  }
  if (pathname.startsWith("/exercicios")) {
    return "Estudar · Exercícios";
  }
  if (pathname.startsWith("/atividades")) {
    return "Estudar · Atividades";
  }
  if (pathname.startsWith("/biblioteca")) {
    return "Estudar · Biblioteca";
  }
  if (pathname.startsWith("/encontros/gravacoes")) {
    return "Comunidade · Minhas gravações";
  }
  if (pathname === "/encontros" || pathname.startsWith("/encontros/")) {
    return "Comunidade · Encontros";
  }
  // Mesmo padrão do Estudar: "Início › Comunidade" na entrada e
  // "Comunidade · Área" nas subáreas.
  if (pathname === "/comunidade") {
    return "Início › Comunidade";
  }
  if (pathname.startsWith("/comunidade/")) {
    const area = communityBreadcrumbAreas.find(
      ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );
    return `Comunidade · ${area?.[1] ?? "Grupos"}`;
  }
  return memberSectionForPathname(pathname);
};

export const isSidebarPathActive = (
  activePath: string,
  href: string,
  knownHrefs: readonly string[]
) => {
  const mostSpecificHref = knownHrefs
    .filter(
      (candidate) =>
        activePath === candidate ||
        (candidate !== "/" && activePath.startsWith(`${candidate}/`))
    )
    .sort((left, right) => right.length - left.length)[0];

  return href === "/" ? activePath === "/" : mostSpecificHref === href;
};
