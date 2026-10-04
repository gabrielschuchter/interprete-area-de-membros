const authenticationOnlyPaths = [
  "/login",
  "/register",
  "/session-tasks",
  "/sign-in",
  "/sign-up",
];

const isAuthenticationOnlyPath = (pathname: string) =>
  authenticationOnlyPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

export const getSafeInternalPath = (value: string, origin: string) => {
  try {
    const base = new URL(origin);
    const target = new URL(value, base);

    if (
      target.origin !== base.origin ||
      target.pathname.startsWith("/__clerk") ||
      isAuthenticationOnlyPath(target.pathname)
    ) {
      return "/";
    }

    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/";
  }
};

export const getAuthRedirectPath = (currentHref: string) => {
  try {
    const currentUrl = new URL(currentHref);
    const requestedTarget =
      currentUrl.searchParams.get("redirect_url") ??
      currentUrl.searchParams.get("redirectUrl");

    if (!requestedTarget) {
      return "/";
    }

    return getSafeInternalPath(requestedTarget, currentUrl.origin);
  } catch {
    return "/";
  }
};

export const getSessionTaskPath = (returnPath: string) => {
  const search = new URLSearchParams({ redirect_url: returnPath });
  return `/session-tasks?${search.toString()}`;
};

export const getSignInPath = (returnPath: string) => {
  const safeReturnPath = getSafeInternalPath(
    returnPath,
    "https://interprete.invalid"
  );
  const search = new URLSearchParams({ redirect_url: safeReturnPath });
  return `/sign-in?${search.toString()}`;
};

export const getAuthCompletionPath = (
  currentHref: string,
  currentTaskKey?: string | null
) => {
  const returnPath = getAuthRedirectPath(currentHref);

  return currentTaskKey ? getSessionTaskPath(returnPath) : returnPath;
};
