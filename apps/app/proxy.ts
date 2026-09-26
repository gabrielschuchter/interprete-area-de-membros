import { authMiddleware } from "@repo/auth/proxy";
import { noseconeOptions, securityMiddleware } from "@repo/security/proxy";
import { type NextProxy, type NextRequest, NextResponse } from "next/server";

const securityHeaders = securityMiddleware(noseconeOptions);
// Keep the official Vercel project as the one visible application host. The
// older alias is redirected here so users never land on a stale deployment.
const canonicalAppHost = "interprete-area-de-membros-app.vercel.app";
const legacyAppHost = "interprete-area-de-membros.vercel.app";
const clerkProxyPrefix = "/__clerk";
const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const canonicalHome = `https://${canonicalAppHost}/`;

const redirectLegacyAppHost = (req: NextRequest) => {
  const url = req.nextUrl.clone();
  url.protocol = "https:";
  url.hostname = canonicalAppHost;

  const redirectUrl = url.searchParams.get("redirect_url");
  if (redirectUrl) {
    try {
      const redirect = new URL(redirectUrl);
      if (redirect.protocol !== "https:") {
        url.searchParams.set("redirect_url", canonicalHome);
      } else if (redirect.hostname === legacyAppHost) {
        redirect.hostname = canonicalAppHost;
        url.searchParams.set("redirect_url", redirect.toString());
      } else if (redirect.hostname !== canonicalAppHost) {
        url.searchParams.set("redirect_url", canonicalHome);
      }
    } catch {
      url.searchParams.set("redirect_url", canonicalHome);
    }
  } else {
    url.searchParams.set("redirect_url", canonicalHome);
  }

  return NextResponse.redirect(url, 308);
};

const isCrossSiteMutation = (req: NextRequest) => {
  if (safeMethods.has(req.method.toUpperCase())) {
    return false;
  }

  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    return true;
  }

  const origin = req.headers.get("origin");
  if (!origin) {
    // Non-browser/server-side callers may omit Origin. Authentication and the
    // route-level authorization rules remain responsible for those requests.
    return false;
  }

  try {
    const originUrl = new URL(origin);
    return originUrl.origin !== req.nextUrl.origin;
  } catch {
    return true;
  }
};

const crossSiteMutationResponse = (req: NextRequest) => {
  const headers = {
    "Cache-Control": "private, no-store",
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin, Sec-Fetch-Site",
  };

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Solicitação cross-site recusada." },
      { status: 403, headers }
    );
  }

  return new NextResponse("Solicitação cross-site recusada.", {
    status: 403,
    headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
  });
};

// Clerk middleware wraps other middleware in its callback
// For apps using Clerk, compose middleware inside authMiddleware callback
// For apps without Clerk, use createNEMO for composition (see apps/web)
export default authMiddleware(
  (_auth, req) => {
    // Keep one visible application host. The legacy alias remains available
    // only long enough to redirect users to the current production project.
    if (
      req.nextUrl.hostname === legacyAppHost &&
      !req.nextUrl.pathname.startsWith(clerkProxyPrefix)
    ) {
      return redirectLegacyAppHost(req);
    }

    if (isCrossSiteMutation(req)) {
      return crossSiteMutationResponse(req);
    }

    return securityHeaders();
  },
  { frontendApiProxy: { enabled: true } }
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
