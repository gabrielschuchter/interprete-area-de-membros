import { authMiddleware } from "@repo/auth/proxy";
import { noseconeOptions, securityMiddleware } from "@repo/security/proxy";
import { type NextProxy, type NextRequest, NextResponse } from "next/server";

const securityHeaders = securityMiddleware(noseconeOptions);
// The Clerk production instance is provisioned on this proxy domain. Keep the
// official Vercel project behind it, so Clerk cookies and frontend API calls
// remain same-origin instead of splitting auth between two aliases.
const canonicalAppHost = "interprete-area-de-membros.vercel.app";
const legacyAppHost = "interprete-area-de-membros-app.vercel.app";
const clerkProxyPrefix = "/__clerk";

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
  (_auth, req) => {
    // Keep one visible application host. The legacy alias remains available
    // only as a temporary Clerk proxy endpoint for already-issued sessions.
    if (
      req.nextUrl.hostname === legacyAppHost &&
      !req.nextUrl.pathname.startsWith(clerkProxyPrefix)
    ) {
      return redirectLegacyAppHost(req);
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
