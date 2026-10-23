export const personalContentNavigation = [
  {
    href: "/encontros/gravacoes",
    icon: "recordings",
    label: "Minhas gravações",
  },
] as const;

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
  if (pathname.startsWith("/comunidade/meus-topicos")) {
    return "Meus tópicos";
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
    return "Planejamento · Tarefas";
  }
  if (pathname.startsWith("/planejamento")) {
    const section = pathname.split("/").filter(Boolean)[1];
    return section ? `Planejamento · ${section}` : "Estudar · Planejamento";
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
  if (pathname.startsWith("/comunidade/salvos")) {
    return "Comunidade · Salvos";
  }
  if (pathname.startsWith("/comunidade/meus-topicos")) {
    return "Perfil · Meus tópicos";
  }
  if (pathname === "/comunidade" || pathname.startsWith("/comunidade/")) {
    return "Início › Comunidade";
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
