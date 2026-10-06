export const personalContentNavigation = [
  {
    href: "/encontros/gravacoes",
    icon: "recordings",
    label: "Minhas gravações",
  },
  { href: "/comunidade/salvos", icon: "saved", label: "Salvos" },
] as const;

export const memberSectionForPathname = (pathname: string) => {
  if (pathname.startsWith("/admin")) {
    return "Professor";
  }
  if (pathname.startsWith("/aprender")) {
    return "Aprender";
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
    return "Salvos";
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
