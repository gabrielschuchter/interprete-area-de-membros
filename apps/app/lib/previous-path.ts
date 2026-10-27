export const PREVIOUS_PATH_KEY = "interprete:previous-path";
const CURRENT_PATH_KEY = "interprete:current-path";

const pathEndPattern = /[?#]/;

const isInternalPath = (value: string | null): value is string =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//");

const pathnameOf = (path: string) => path.split(pathEndPattern)[0] ?? path;

/** Called on every in-app navigation: the page we were on becomes "previous". */
export const rememberNavigation = (nextPath: string) => {
  try {
    const current = window.sessionStorage.getItem(CURRENT_PATH_KEY);
    if (current === nextPath) {
      return;
    }
    if (isInternalPath(current)) {
      window.sessionStorage.setItem(PREVIOUS_PATH_KEY, current);
    }
    window.sessionStorage.setItem(CURRENT_PATH_KEY, nextPath);
  } catch {
    // Private mode or blocked storage: the back link keeps its fallback.
  }
};

/** The page the member was on before this one, unless it is this very page. */
export const readPreviousPath = (currentPathname: string) => {
  try {
    const previous = window.sessionStorage.getItem(PREVIOUS_PATH_KEY);
    if (!isInternalPath(previous)) {
      return null;
    }
    return pathnameOf(previous) === currentPathname ? null : previous;
  } catch {
    return null;
  }
};

export const previousPathLabel = (path: string) => {
  const pathname = pathnameOf(path);
  if (pathname.startsWith("/comunidade/grupos/")) {
    return "Voltar para o grupo";
  }
  if (
    pathname.startsWith("/comunidade/publicacoes/") ||
    pathname.includes("/discussao")
  ) {
    return "Voltar para a discussão";
  }
  if (pathname === "/comunidade" || pathname.startsWith("/comunidade/")) {
    return "Voltar para a comunidade";
  }
  if (pathname === "/membros") {
    return "Voltar para os membros";
  }
  if (pathname === "/notificacoes") {
    return "Voltar para as notificações";
  }
  return "Voltar";
};
