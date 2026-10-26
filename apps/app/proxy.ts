import { shouldProxyClerkFrontendApi } from "@repo/auth/clerk-proxy";
import { authMiddleware } from "@repo/auth/proxy";
import {
  getAuthRedirectPath,
  getSafeInternalPath,
  getSessionTaskPath,
  getSignInPath,
} from "@repo/auth/redirects";
import { noseconeOptions, securityMiddleware } from "@repo/security/proxy";
import {
  createWriteFreezeResponse,
  isClerkFrontendApiProxyPath,
  shouldBlockRequestDuringWriteFreeze,
} from "@repo/security/write-freeze";
import { type NextProxy, type NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { gestaoLegacyAdminDestination } from "./lib/gestao-navigation";

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
const loopbackHostnames = new Set(["localhost", "127.0.0.1", "[::1]"]);
const developmentServerAuthFlag = process.env.GESTAO_DEV_AUTH;
const developmentClientAuthFlag = process.env.NEXT_PUBLIC_GESTAO_DEV_AUTH;

if (
  process.env.NODE_ENV === "development" &&
  ((developmentServerAuthFlag !== undefined &&
    developmentServerAuthFlag !== "true" &&
    developmentServerAuthFlag !== "false") ||
    (developmentClientAuthFlag !== undefined &&
      developmentClientAuthFlag !== "true" &&
      developmentClientAuthFlag !== "false"))
) {
  throw new Error(
    "GESTAO_DEV_AUTH and NEXT_PUBLIC_GESTAO_DEV_AUTH must be either true or false."
  );
}

if (
  process.env.NODE_ENV === "development" &&
  (developmentServerAuthFlag === "true") !==
    (developmentClientAuthFlag === "true")
) {
  throw new Error(
    "GESTAO_DEV_AUTH and NEXT_PUBLIC_GESTAO_DEV_AUTH must be enabled together for local QA."
  );
}

const useDevelopmentTestAuth =
  process.env.NODE_ENV === "development" &&
  developmentServerAuthFlag === "true";
const protectedRoutePrefixes = [
  "/",
  "/onboarding",
  "/admin",
  "/gestao",
  "/professor",
  "/cursos",
  "/atividades",
  "/biblioteca",
  "/colecoes",
  "/comunidade",
  "/configuracoes",
  "/encontros",
  "/estudar",
  "/exercicios",
  "/ferramentas",
  "/membros",
  "/notificacoes",
  "/perfil",
  "/planejamento",
  "/salvos",
  "/tarefas",
  "/search",
];

// "Ver como aluno" é só leitura: com a prévia ativa, qualquer escrita fora da
// Gestão (onde vale a identidade real) é recusada antes de chegar ao app.
const previewCookie = "gestao_preview";
const previewRealCookie = "gestao_preview_real";
const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

const previewWriteDenial = (req: NextRequest) => {
  if (
    safeMethods.has(req.method) ||
    !req.cookies.has(previewCookie) ||
    req.cookies.has(previewRealCookie) ||
    isClerkFrontendApiProxyPath(req.nextUrl.pathname)
  ) {
    return null;
  }
  return NextResponse.json(
    { error: "Você está em uma prévia. Nada aqui altera dados." },
    { status: 403, headers: { "Cache-Control": "private, no-store" } }
  );
};

const matchesPath = (pathname: string, pathPrefix: string) =>
  pathPrefix === "/"
    ? pathname === "/"
    : pathname === pathPrefix || pathname.startsWith(`${pathPrefix}/`);

const communityInviteLinkPathPattern = /^\/comunidade\/convite\/[^/]+\/?$/;
const communityPostSharePathPattern =
  /^\/comunidade\/compartilhar\/[A-Za-z0-9_-]{1,128}(?:\/(?:opengraph-image|cover))?\/?$/;

const isCommunityInviteLinkRoute = (pathname: string) =>
  communityInviteLinkPathPattern.test(pathname);

const isCommunityPostShareRoute = (pathname: string) =>
  communityPostSharePathPattern.test(pathname);

const isProtectedRoute = (pathname: string) =>
  !(
    isCommunityInviteLinkRoute(pathname) || isCommunityPostShareRoute(pathname)
  ) &&
  protectedRoutePrefixes.some((pathPrefix) =>
    matchesPath(pathname, pathPrefix)
  );

const gestaoBoundaryResponse = async (req: NextRequest, userId: string) => {
  if (
    env.GESTAO_V2_ENABLED !== "true" ||
    !matchesPath(req.nextUrl.pathname, "/gestao")
  ) {
    return null;
  }
  const { canEnterGestaoRoute } = await import(
    "./lib/gestao-route-authorization"
  );
  const selectedCohorts = req.nextUrl.searchParams.getAll("turma");
  if (
    selectedCohorts.length <= 1 &&
    (await canEnterGestaoRoute(
      userId,
      req.nextUrl.pathname,
      selectedCohorts[0]
    ))
  ) {
    return null;
  }
  const headers = new Headers((await securityHeaders()).headers);
  headers.set("Cache-Control", "private, no-store");
  if (req.method !== "GET" && req.method !== "HEAD") {
    // Nosecone returns NextResponse.next(). Its continuation marker must not
    // turn this terminal denial into permission to dispatch a Server Action.
    headers.delete("x-middleware-next");
    return NextResponse.json(
      { error: "Você não tem mais acesso a esta área." },
      { status: 403, headers }
    );
  }
  return NextResponse.next({ status: 403, headers });
};

const legacyAdminRedirect = (req: NextRequest) => {
  if (
    env.GESTAO_V2_ENABLED !== "true" ||
    !matchesPath(req.nextUrl.pathname, "/admin")
  ) {
    return null;
  }
  const destination = gestaoLegacyAdminDestination(req.nextUrl.pathname);
  if (!destination) {
    return null;
  }
  const url = req.nextUrl.clone();
  url.pathname = destination;
  return NextResponse.redirect(url, 307);
};

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
const clerkProxy = useDevelopmentTestAuth
  ? null
  : authMiddleware(
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the middleware coordinates Clerk auth states, proxy routing and canonical host redirects in one ordered request boundary
      async (auth, req) => {
        const previewDenial = previewWriteDenial(req);
        if (previewDenial) {
          return previewDenial;
        }
        if (
          shouldBlockRequestDuringWriteFreeze({
            method: req.method,
            pathname: req.nextUrl.pathname,
            enabled: env.APP_WRITE_FREEZE === "true",
            clerkFrontendApiProxy: isClerkFrontendApiProxyPath(
              req.nextUrl.pathname
            ),
          })
        ) {
          return createWriteFreezeResponse(req);
        }

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
            if (!authState.isAuthenticated) {
              return NextResponse.redirect(
                new URL(
                  getSignInPath(`${req.nextUrl.pathname}${req.nextUrl.search}`),
                  req.url
                )
              );
            }
            await auth.protect();
            const denial = await gestaoBoundaryResponse(
              req,
              authState.userId as string
            );
            if (denial) {
              return denial;
            }
            const legacyRedirect = legacyAdminRedirect(req);
            if (legacyRedirect) {
              return legacyRedirect;
            }
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
                authState.isAuthenticated
                  ? returnPath
                  : getSignInPath(returnPath),
                req.url
              )
            );
          }
        }

        return securityHeaders();
      },
      { frontendApiProxy: { enabled: shouldProxyClerkRequests } }
    );

const developmentTestAuthProxy = async (req: NextRequest) => {
  const host = req.nextUrl.hostname.toLowerCase();
  if (!loopbackHostnames.has(host)) {
    return new NextResponse(null, { status: 404 });
  }

  const previewDenial = previewWriteDenial(req);
  if (previewDenial) {
    return previewDenial;
  }

  if (
    shouldBlockRequestDuringWriteFreeze({
      method: req.method,
      pathname: req.nextUrl.pathname,
      enabled: env.APP_WRITE_FREEZE === "true",
      clerkFrontendApiProxy: isClerkFrontendApiProxyPath(req.nextUrl.pathname),
    })
  ) {
    return createWriteFreezeResponse(req);
  }

  const { resolveDevelopmentAuthUserId } = await import(
    "./lib/development-auth-config"
  );
  const userId = resolveDevelopmentAuthUserId({
    enabled: developmentServerAuthFlag,
    publicEnabled: developmentClientAuthFlag,
    nodeEnv: process.env.NODE_ENV,
    userId: process.env.GESTAO_DEV_AUTH_USER_ID,
  });
  const denial = userId ? await gestaoBoundaryResponse(req, userId) : null;
  return denial ?? legacyAdminRedirect(req) ?? securityHeaders();
};

export default (useDevelopmentTestAuth
  ? developmentTestAuthProxy
  : clerkProxy) as unknown as NextProxy;

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
