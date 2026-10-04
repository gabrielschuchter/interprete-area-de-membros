import { shouldProxyClerkFrontendApi } from "@repo/auth/clerk-proxy";
import { authMiddleware } from "@repo/auth/proxy";
import {
  getAuthRedirectPath,
  getSafeInternalPath,
  getSessionTaskPath,
  getSignInPath,
} from "@repo/auth/redirects";
import { noseconeOptions, securityMiddleware } from "@repo/security/proxy";
import { type NextProxy, type NextRequest, NextResponse } from "next/server";

const securityHeaders = securityMiddleware(noseconeOptions);
// Clerk's production Frontend API proxy is registered on this Vercel alias.
// Keep it as the single visible host until a real custom domain is configured
// in Clerk; the other project alias is redirected here so both URLs cannot
// serve different authentication origins.
const canonicalAppHost = "interprete-area-de-membros.vercel.app";
const legacyAppHost = "interprete-area-de-membros-app.vercel.app";
const clerkProxyPrefix = "/__clerk";
// Clerk's Frontend API proxy is configured for the production instance only.
// Development instances use their accounts.dev host directly.
const shouldProxyClerkRequests = shouldProxyClerkFrontendApi(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
);
const sessionTaskPath = "/session-tasks";
const protectedRoutePrefixes = [
  "/",
  "/onboarding",
  "/admin",
  "/aprender",
  "/atividades",
  "/biblioteca",
  "/colecoes",
  "/comunidade",
  "/configuracoes",
  "/encontros",
  "/membros",
  "/notificacoes",
  "/perfil",
  "/search",
];

const matchesPath = (pathname: string, pathPrefix: string) =>
  pathPrefix === "/"
    ? pathname === "/"
    : pathname === pathPrefix || pathname.startsWith(`${pathPrefix}/`);

const isProtectedRoute = (pathname: string) =>
  protectedRoutePrefixes.some((pathPrefix) =>
    matchesPath(pathname, pathPrefix)
  );

const isSessionTaskRoute = (pathname: string) =>
  matchesPath(pathname, sessionTaskPath);

const isAuthenticationEntryRoute = (pathname: string) =>
  matchesPath(pathname, "/sign-in") ||
  matchesPath(pathname, "/sign-up") ||
  matchesPath(pathname, "/login");

const redirectToSessionTask = (req: NextRequest, returnPath: string) =>
  NextResponse.redirect(new URL(getSessionTaskPath(returnPath), req.url));

const redirectLegacyAppHost = (req: NextRequest) => {
  const url = req.nextUrl.clone();
  url.hostname = canonicalAppHost;

  const redirectUrl = url.searchParams.get("redirect_url");
  if (redirectUrl) {
    try {
      const redirect = new URL(redirectUrl);
      if (redirect.hostname === legacyAppHost) {
        redirect.hostname = canonicalAppHost;
        url.searchParams.set("redirect_url", redirect.toString());
      }
    } catch {
      // Clerk will apply its normal fallback for malformed redirect URLs.
    }
  } else {
    url.searchParams.set("redirect_url", `https://${canonicalAppHost}/`);
  }

  return NextResponse.redirect(url, 308);
};

// Clerk middleware wraps other middleware in its callback
// For apps using Clerk, compose middleware inside authMiddleware callback
// For apps without Clerk, use createNEMO for composition (see apps/web)
export default authMiddleware(
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the middleware coordinates Clerk auth states, proxy routing and canonical host redirects in one ordered request boundary
  async (auth, req) => {
    // Keep one visible application host. The legacy alias remains available
    // only long enough to redirect users to the current production project.
    if (
      req.nextUrl.hostname === legacyAppHost &&
      !req.nextUrl.pathname.startsWith(clerkProxyPrefix)
    ) {
      return redirectLegacyAppHost(req);
    }

    // Keep the commonly used /login URL compatible with the custom Clerk UI.
    // The sign-in layout sends authenticated users straight back to the app.
    if (req.nextUrl.pathname === "/login") {
      const url = req.nextUrl.clone();
      url.pathname = "/sign-in";
      return NextResponse.redirect(url, 308);
    }

    // Validate and refresh the Clerk session before protected pages render.
    // Route handlers keep their own 401/403 behavior and are guarded server-side.
    if (
      isProtectedRoute(req.nextUrl.pathname) ||
      isAuthenticationEntryRoute(req.nextUrl.pathname)
    ) {
      const authState = await auth();

      if (authState.sessionStatus === "pending") {
        const returnPath = isProtectedRoute(req.nextUrl.pathname)
          ? getSafeInternalPath(
              `${req.nextUrl.pathname}${req.nextUrl.search}`,
              req.nextUrl.origin
            )
          : getAuthRedirectPath(req.url);

        return redirectToSessionTask(req, returnPath);
      }

      if (
        isAuthenticationEntryRoute(req.nextUrl.pathname) &&
        authState.isAuthenticated
      ) {
        return NextResponse.redirect(
          new URL(getAuthRedirectPath(req.url), req.url)
        );
      }

      if (isProtectedRoute(req.nextUrl.pathname)) {
        await auth.protect();
      }
    }

    // An interrupted Clerk task must stay resumable instead of bouncing between
    // the protected app and the sign-in page.
    if (isSessionTaskRoute(req.nextUrl.pathname)) {
      const authState = await auth();

      if (authState.sessionStatus !== "pending") {
        const returnPath = getSafeInternalPath(
          req.nextUrl.searchParams.get("redirect_url") ?? "/",
          req.nextUrl.origin
        );

        return NextResponse.redirect(
          new URL(
            authState.isAuthenticated ? returnPath : getSignInPath(returnPath),
            req.url
          )
        );
      }
    }

    return securityHeaders();
  },
  { frontendApiProxy: { enabled: shouldProxyClerkRequests } }
) as unknown as NextProxy;

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    // Clerk Frontend API proxy path
    "/__clerk/:path*",
  ],
};
