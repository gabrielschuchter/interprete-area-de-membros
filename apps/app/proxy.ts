import { authMiddleware } from "@repo/auth/proxy";
import {
  getAuthRedirectPath,
  getSafeInternalPath,
  getSessionTaskPath,
  getSignInPath,
} from "@repo/auth/redirects";
import {
  resolveApplicationAuthOrigins,
  resolveApplicationOrigin,
} from "@repo/next-config/application-origin";
import { noseconeOptions, securityMiddleware } from "@repo/security/proxy";
import {
  createWriteFreezeResponse,
  shouldBlockRequestDuringWriteFreeze,
} from "@repo/security/write-freeze";
import {
  type NextFetchEvent,
  type NextProxy,
  type NextRequest,
  NextResponse,
} from "next/server";
import { env } from "@/env";
import { getLegacyApplicationRedirect } from "./lib/application-host";
import { gestaoLegacyAdminDestination } from "./lib/gestao-navigation";

const securityHeaders = securityMiddleware(noseconeOptions);
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
    req.cookies.has(previewRealCookie)
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

// Clerk middleware wraps other middleware in its callback
// For apps using Clerk, compose middleware inside authMiddleware callback
// For apps without Clerk, use createNEMO for composition (see apps/web)
const clerkAuthProxy = useDevelopmentTestAuth
  ? null
  : authMiddleware(
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the middleware coordinates Clerk state with the app's internal route guards
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
          })
        ) {
          return createWriteFreezeResponse(req);
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
            const adminRedirect = legacyAdminRedirect(req);
            if (adminRedirect) {
              return adminRedirect;
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
      {
        authorizedParties: resolveApplicationAuthOrigins({
          applicationUrl: env.NEXT_PUBLIC_APP_URL,
        }),
      }
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

const applicationProxy = (req: NextRequest, event: NextFetchEvent) => {
  // Redirect legacy production aliases before Clerk reads cookies or validates
  // origins. Unsafe requests fail closed so a form/action body is never replayed.
  if (process.env.VERCEL_ENV === "production") {
    const legacyRedirect = getLegacyApplicationRedirect(
      req.nextUrl,
      resolveApplicationOrigin({
        applicationUrl: env.NEXT_PUBLIC_APP_URL,
      })
    );
    if (legacyRedirect) {
      if (req.method === "GET" || req.method === "HEAD") {
        return NextResponse.redirect(legacyRedirect, 308);
      }
      return new NextResponse(null, {
        status: 421,
        headers: { "Cache-Control": "private, no-store" },
      });
    }
  }

  return useDevelopmentTestAuth
    ? developmentTestAuthProxy(req)
    : (clerkAuthProxy as NextProxy)(req, event);
};

export default applicationProxy as unknown as NextProxy;

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
