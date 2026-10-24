const gestaoRoutesByLegacyPath: Record<string, string> = {
  "": "/gestao",
  conteudo: "/gestao/ensino/cursos",
  exercicios: "/gestao/ensino/exercicios",
  atividades: "/gestao/ensino/atividades",
  biblioteca: "/gestao/ensino/biblioteca",
  colecoes: "/gestao/ensino/colecoes",
  atribuicoes: "/gestao/alunos/atribuicoes",
  "metas-e-tarefas": "/gestao/alunos/tarefas",
  medalhas: "/gestao/administracao/medalhas",
  membros: "/gestao/administracao/membros",
  comunidade: "/gestao/comunidade/publicacoes",
  avisos: "/gestao/comunidade/avisos",
  encontros: "/gestao/comunidade/encontros",
  gravacoes: "/gestao/administracao/gravacoes-historicas",
  acessos: "/gestao/administracao/acessos",
  personalizacao: "/gestao/administracao/personalizacao",
};

const legacyAdminRoutesByPath: Record<string, string> = {
  "": "/admin",
  conteudo: "/admin/learning",
  exercicios: "/admin/exercicios",
  atividades: "/admin/activities",
  biblioteca: "/admin/library",
  colecoes: "/admin/colecoes",
  atribuicoes: "/admin/atribuicoes",
  "metas-e-tarefas": "/admin/estudo",
  medalhas: "/admin/badges",
  membros: "/admin/membros",
  comunidade: "/admin/community",
  avisos: "/admin/avisos",
  encontros: "/admin/meetings",
  gravacoes: "/admin/gravacoes",
  acessos: "/admin/acessos",
  personalizacao: "/admin/personalizacao",
};

const gestaoCommunityDestinations: Record<string, string> = {
  publicacoes: "/admin/community",
  avisos: "/admin/avisos",
  "avisos/novo": "/admin/avisos",
  encontros: "/admin/meetings",
};

export const gestaoCommunityDestination = (pathSegments: readonly string[]) =>
  gestaoCommunityDestinations[pathSegments.join("/")] ?? null;

const gestaoAdministrationDestinations: Record<string, string> = {
  membros: "/admin/membros",
  acessos: "/admin/acessos",
  "gravacoes-historicas": "/admin/gravacoes",
  personalizacao: "/admin/personalizacao",
  medalhas: "/admin/badges",
};

export const gestaoAdministrationDestination = (
  pathSegments: readonly string[]
) => gestaoAdministrationDestinations[pathSegments.join("/")] ?? null;

const gestaoStudentDestinations: Record<string, string> = {
  atribuicoes: "/admin/atribuicoes",
  "atribuicoes/nova": "/admin/atribuicoes",
  tarefas: "/admin/estudo",
};

export const gestaoStudentDestination = (pathSegments: readonly string[]) =>
  gestaoStudentDestinations[pathSegments.join("/")] ?? null;

export type RedirectSearchParams = Record<
  string,
  string | string[] | undefined
>;

const serializedSearch = (searchParams: RedirectSearchParams) => {
  const params = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(searchParams)) {
    for (const value of Array.isArray(rawValue) ? rawValue : [rawValue]) {
      if (value !== undefined) {
        params.append(key, value);
      }
    }
  }
  const query = params.toString();
  return query ? `?${query}` : "";
};

export const professorDestination = (
  pathSegments: readonly string[] | undefined,
  gestaoEnabled: boolean,
  searchParams: RedirectSearchParams = {}
) => {
  const key = (pathSegments ?? []).join("/");
  const routes = gestaoEnabled
    ? gestaoRoutesByLegacyPath
    : legacyAdminRoutesByPath;
  const fallback = gestaoEnabled ? "/gestao" : "/admin";
  return `${routes[key] ?? fallback}${serializedSearch(searchParams)}`;
};

export const isGestaoShellPath = (pathname: string) =>
  pathname === "/gestao" ||
  pathname.startsWith("/gestao/") ||
  pathname === "/professor" ||
  pathname.startsWith("/professor/");

export const safeGestaoReturnPath = (value: string | null | undefined) => {
  if (!value || value.includes("\\")) {
    return "/estudar";
  }

  try {
    const origin = "https://gestao-return.invalid";
    const url = new URL(value, origin);
    if (url.origin !== origin) {
      return "/estudar";
    }
    if (
      url.pathname === "/gestao" ||
      url.pathname.startsWith("/gestao/") ||
      url.pathname === "/professor" ||
      url.pathname.startsWith("/professor/") ||
      url.pathname === "/admin" ||
      url.pathname.startsWith("/admin/") ||
      url.pathname === "/sign-in" ||
      url.pathname.startsWith("/sign-in/")
    ) {
      return "/estudar";
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/estudar";
  }
};

export const withGestaoReturnPath = (href: string, returnPath: string) => {
  const url = new URL(href, "https://gestao-route.invalid");
  const params = url.searchParams;
  params.set("from", safeGestaoReturnPath(returnPath));
  return `${url.pathname}?${params.toString()}${url.hash}`;
};

const legacyAdminStaticDestinations: Record<string, string> = {
  "/admin": "/gestao",
  "/admin/learning": "/gestao/ensino/cursos",
  "/admin/learning/courses/new": "/gestao/ensino/cursos/novo",
  "/admin/library": "/gestao/ensino/biblioteca",
  "/admin/exercicios": "/gestao/ensino/exercicios",
  "/admin/activities": "/gestao/ensino/atividades",
  "/admin/colecoes": "/gestao/ensino/colecoes",
  "/admin/atribuicoes": "/gestao/alunos/atribuicoes",
  "/admin/estudo": "/gestao/alunos/tarefas",
  "/admin/badges": "/gestao/administracao/medalhas",
  "/admin/membros": "/gestao/administracao/membros",
  "/admin/community": "/gestao/comunidade/publicacoes",
  "/admin/avisos": "/gestao/comunidade/avisos",
  "/admin/meetings": "/gestao/comunidade/encontros",
  "/admin/gravacoes": "/gestao/administracao/gravacoes-historicas",
  "/admin/acessos": "/gestao/administracao/acessos",
  "/admin/personalizacao": "/gestao/administracao/personalizacao",
};

const legacyAdminPatternDestinations: readonly [RegExp, string][] = [
  [
    /^\/admin\/learning\/courses\/([^/]+)\/preview$/u,
    "/gestao/ensino/cursos/$1/preview",
  ],
  [/^\/admin\/learning\/courses\/([^/]+)$/u, "/gestao/ensino/cursos/$1"],
  [/^\/admin\/exercicios\/([^/]+)$/u, "/gestao/ensino/exercicios/$1"],
  [/^\/admin\/membros\/([^/]+)$/u, "/gestao/alunos/perfil/$1"],
];

// Maps a legacy /admin address to its Gestão address so staff never leave the
// Gestão shell. Returns null for paths with no Gestão equivalent.
export const gestaoLegacyAdminDestination = (pathname: string) => {
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  const direct = legacyAdminStaticDestinations[normalized];
  if (direct) {
    return direct;
  }
  for (const [pattern, template] of legacyAdminPatternDestinations) {
    if (pattern.test(normalized)) {
      return normalized.replace(pattern, template);
    }
  }
  return null;
};
