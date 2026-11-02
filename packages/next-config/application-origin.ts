interface ApplicationOriginConfiguration {
  readonly applicationUrl?: string;
  readonly branchUrl?: string;
  readonly deploymentUrl?: string;
  readonly environment?: string;
  readonly nodeEnvironment?: string;
}

const loopbackHostnames = new Set(["localhost", "127.0.0.1", "[::1]"]);
const absoluteUrlSchemePattern = /^[a-z][a-z\d+.-]*:\/\//i;

const asOrigin = (value: string | undefined, protocol = "https:") => {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  const candidate = absoluteUrlSchemePattern.test(normalized)
    ? normalized
    : `${protocol}//${normalized}`;

  try {
    const url = new URL(candidate);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
};

const asHttpsOrigin = (value: string | undefined) => {
  const origin = asOrigin(value);
  return origin && new URL(origin).protocol === "https:" ? origin : null;
};

const asLoopbackHttpOrigin = (value: string | undefined) => {
  const origin = asOrigin(value, "http:");
  if (!origin) {
    return null;
  }
  const url = new URL(origin);
  return url.protocol === "http:" && loopbackHostnames.has(url.hostname)
    ? origin
    : null;
};

const currentConfiguration = (): ApplicationOriginConfiguration => ({
  applicationUrl: process.env.NEXT_PUBLIC_APP_URL,
  environment: process.env.VERCEL_ENV,
  branchUrl: process.env.VERCEL_BRANCH_URL,
  deploymentUrl: process.env.VERCEL_URL,
  nodeEnvironment: process.env.NODE_ENV,
});

const mergeConfiguration = (
  overrides: ApplicationOriginConfiguration
): Required<ApplicationOriginConfiguration> => {
  const current = currentConfiguration();
  return {
    applicationUrl: overrides.applicationUrl ?? current.applicationUrl ?? "",
    environment: overrides.environment ?? current.environment ?? "",
    branchUrl: overrides.branchUrl ?? current.branchUrl ?? "",
    deploymentUrl: overrides.deploymentUrl ?? current.deploymentUrl ?? "",
    nodeEnvironment: overrides.nodeEnvironment ?? current.nodeEnvironment ?? "",
  };
};

/**
 * Resolve the public origin of the running member application.
 * Production is explicitly configured; Vercel Preview links stay on the
 * current branch/deployment even if a shared Preview variable is stale.
 */
export const resolveApplicationOrigin = (
  overrides: ApplicationOriginConfiguration = {}
) => {
  const configuration = mergeConfiguration(overrides);

  if (configuration.environment === "preview") {
    const previewOrigin =
      asHttpsOrigin(configuration.branchUrl) ??
      asHttpsOrigin(configuration.deploymentUrl);
    if (!previewOrigin) {
      throw new Error(
        "Vercel Preview requires VERCEL_BRANCH_URL or VERCEL_URL so public links stay inside the Preview deployment."
      );
    }
    return previewOrigin;
  }

  if (configuration.environment === "production") {
    const productionOrigin = asHttpsOrigin(configuration.applicationUrl);
    if (productionOrigin) {
      return productionOrigin;
    }
    throw new Error(
      "NEXT_PUBLIC_APP_URL must be a valid HTTPS URL for Production."
    );
  }

  const configuredOrigin =
    asHttpsOrigin(configuration.applicationUrl) ??
    asLoopbackHttpOrigin(configuration.applicationUrl);
  if (configuredOrigin) {
    return configuredOrigin;
  }

  if (configuration.applicationUrl.trim()) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL must be a valid HTTPS URL or a loopback HTTP URL in local development."
    );
  }

  if (["development", "test"].includes(configuration.nodeEnvironment)) {
    return "http://localhost:3000";
  }

  throw new Error(
    "NEXT_PUBLIC_APP_URL must be a valid HTTPS URL for deployed environments."
  );
};

/**
 * Clerk's server-side origin allowlist is strict in Production. Preview gets
 * only its own immutable/branch Vercel origins, never the Production origin.
 */
export const resolveApplicationAuthOrigins = (
  overrides: ApplicationOriginConfiguration = {}
) => {
  const configuration = mergeConfiguration(overrides);
  const applicationOrigin = resolveApplicationOrigin(configuration);
  if (configuration.environment !== "preview") {
    return [applicationOrigin];
  }

  return [
    ...new Set(
      [
        applicationOrigin,
        asHttpsOrigin(configuration.branchUrl),
        asHttpsOrigin(configuration.deploymentUrl),
      ].filter((origin): origin is string => Boolean(origin))
    ),
  ];
};
