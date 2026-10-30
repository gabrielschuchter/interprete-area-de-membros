const legacyMemberHosts = new Set([
  "interprete-area-de-membros.vercel.app",
  "interprete-area-de-membros-app.vercel.app",
]);

const isLegacyMemberHost = (hostname: string) =>
  legacyMemberHosts.has(hostname.toLowerCase());

export const getLegacyApplicationRedirect = (
  requestUrl: string | URL,
  canonicalOrigin: string | URL
) => {
  const source = new URL(requestUrl);
  if (!isLegacyMemberHost(source.hostname)) {
    return null;
  }

  const canonical = new URL(canonicalOrigin);
  const destination = new URL(source);
  destination.protocol = canonical.protocol;
  destination.host = canonical.host;
  if (destination.pathname === "/login") {
    destination.pathname = "/sign-in";
  }

  const requestedRedirect = destination.searchParams.get("redirect_url");
  const redirectParam = requestedRedirect ? "redirect_url" : "redirectUrl";
  const requestedRedirectUrl =
    requestedRedirect ?? destination.searchParams.get("redirectUrl");
  if (requestedRedirectUrl) {
    try {
      const redirect = new URL(requestedRedirectUrl, canonical);
      if (isLegacyMemberHost(redirect.hostname)) {
        redirect.protocol = canonical.protocol;
        redirect.host = canonical.host;
        destination.searchParams.set(redirectParam, redirect.href);
      }
    } catch {
      // Preserve malformed Clerk values so Clerk can apply its safe fallback.
    }
  }

  return destination;
};
