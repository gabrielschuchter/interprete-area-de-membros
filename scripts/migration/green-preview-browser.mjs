/** Reuses existing Preview access; never provisions a bypass or sends it to Clerk. */
export const greenBrowserContext = async (browser, options, origin, bypass) => {
  const context = await browser.newContext(options);
  await context.route("**/*", (route) => {
    const request = route.request();
    const target = new URL(request.url());
    if (
      target.hostname === "wkclodjbrynerfgufmyb.supabase.co" ||
      (request.isNavigationRequest() &&
        target.hostname.endsWith(".vercel.app") &&
        target.origin !== origin)
    ) {
      return route.abort("blockedbyclient");
    }
    if (!bypass) {
      return route.continue();
    }
    if (new URL(request.url()).origin === origin) {
      return route.continue({
        headers: { ...request.headers(), "x-vercel-protection-bypass": bypass },
      });
    }
    return route.continue();
  });
  const requests = new Proxy(context.request, {
    get(target, property) {
      const value = Reflect.get(target, property, target);
      if (typeof value !== "function") {
        return value;
      }
      return (url, options = {}) => {
        if (new URL(url).origin !== origin) {
          throw new Error("QA request refused unknown target.");
        }
        return value.call(target, url, {
          ...options,
          headers: { ...options.headers, "x-vercel-protection-bypass": bypass },
        });
      };
    },
  });
  return new Proxy(context, {
    get(target, property) {
      if (property === "request") {
        return requests;
      }
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
};
