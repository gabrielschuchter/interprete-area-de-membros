import { authMiddleware } from "@repo/auth/proxy";
import { noseconeOptions, securityMiddleware } from "@repo/security/proxy";
import { type NextProxy, type NextRequest, NextResponse } from "next/server";

const securityHeaders = securityMiddleware(noseconeOptions);
const currentVercelHost = "interprete-area-de-membros-app.vercel.app";
const clerkCompatibleHost = "interprete-area-de-membros.vercel.app";
const clerkAuthPaths = new Set(["/sign-in", "/sign-up"]);

const redirectToClerkCompatibleHost = (req: NextRequest) => {
  const url = req.nextUrl.clone();
  url.hostname = clerkCompatibleHost;

  const redirectUrl = url.searchParams.get("redirect_url");
  if (redirectUrl) {
    try {
      const redirect = new URL(redirectUrl);
      if (redirect.hostname === currentVercelHost) {
        redirect.hostname = clerkCompatibleHost;
        url.searchParams.set("redirect_url", redirect.toString());
      }
    } catch {
      // Clerk will ignore malformed redirect URLs using its normal fallback.
    }
  } else {
    url.searchParams.set("redirect_url", `https://${clerkCompatibleHost}/`);
  }

  return NextResponse.redirect(url);
};

// Clerk middleware wraps other middleware in its callback
// For apps using Clerk, compose middleware inside authMiddleware callback
// For apps without Clerk, use createNEMO for composition (see apps/web)
export default authMiddleware(
  (_auth, req) => {
    if (
      req.nextUrl.hostname === currentVercelHost &&
      clerkAuthPaths.has(req.nextUrl.pathname)
    ) {
      return redirectToClerkCompatibleHost(req);
    }

    return securityHeaders();
  },
  {
    frontendApiProxy: { enabled: true },
  }
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
