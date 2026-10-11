const routeNames: Readonly<Record<string, string>> = {
  aprender: "Aprender",
  atividades: "Atividades",
  biblioteca: "Biblioteca",
  comunidade: "Comunidade",
  configuracoes: "Configurações",
  encontros: "Encontros",
  exercicios: "Exercícios",
  ferramentas: "Ferramentas",
  notificacoes: "Notificações",
  perfil: "Perfil",
  planejamento: "Planejamento",
  salvos: "Salvos",
  estudar: "Estudar",
  tarefas: "Tarefas",
};

export const focusMemberRouteHeading = (main: HTMLElement | null) => {
  const heading = main?.querySelector<HTMLElement>(
    '.member-route-page:not([aria-hidden="true"]) h1'
  );

  if (!heading) {
    main?.focus({ preventScroll: true });
    return null;
  }

  heading.setAttribute("tabindex", "-1");
  heading.focus({ preventScroll: true });
  return heading.textContent?.replace(/\s+/g, " ").trim() || null;
};

export const memberRouteAnnouncementLabel = (
  pathname: string,
  heading: string | null
) => {
  if (pathname === "/") {
    return "Início";
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 1 && heading) {
    return heading;
  }

  return routeNames[segments[0] ?? ""] ?? heading ?? "esta página";
};
