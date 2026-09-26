import { authMiddleware } from "@repo/auth/proxy";
import { noseconeOptions, securityMiddleware } from "@repo/security/proxy";
import { type NextProxy, type NextRequest, NextResponse } from "next/server";

const securityHeaders = securityMiddleware(noseconeOptions);
const canonicalAppHost = "interprete-area-de-membros-app.vercel.app";
const clerkPrimaryHost = "interprete-area-de-membros.vercel.app";
const clerkAuthPaths = new Set(["/sign-in", "/sign-up"]);

const redirectToClerkPrimaryHost = (req: NextRequest) => {
  const url = req.nextUrl.clone();
  url.hostname = clerkPrimaryHost;

  const redirectUrl = url.searchParams.get("redirect_url");
  if (redirectUrl) {
    try {
      const redirect = new URL(redirectUrl);
      if (redirect.hostname === canonicalAppHost) {
        redirect.hostname = clerkPrimaryHost;
        url.searchParams.set("redirect_url", redirect.toString());
      }
    } catch {
      // Clerk will apply its normal fallback for malformed redirect URLs.
    }
  } else {
    url.searchParams.set("redirect_url", `https://${clerkPrimaryHost}/`);
  }

  return NextResponse.redirect(url);
};

// Clerk middleware wraps other middleware in its callback
// For apps using Clerk, compose middleware inside authMiddleware callback
// For apps without Clerk, use createNEMO for composition (see apps/web)
export default authMiddleware(
  (_auth, req) => {
    // Clerk's production instance is currently attached to the primary
    // Vercel host. Keep the canonical app URL usable by handing only the
    // authentication screens to that host until a custom Clerk domain is
    // configured; protected application routes remain on the app project.
    if (
      req.nextUrl.hostname === canonicalAppHost &&
      clerkAuthPaths.has(req.nextUrl.pathname)
    ) {
      return redirectToClerkPrimaryHost(req);
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
