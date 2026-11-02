import { resolveApplicationOrigin } from "@repo/next-config/application-origin";

interface ApiOriginConfiguration {
  readonly branchUrl?: string;
  readonly configuredUrl?: string;
  readonly deploymentUrl?: string;
  readonly environment?: string;
  readonly nodeEnvironment?: string;
  readonly productionUrl?: string;
}

export const resolveApiOrigin = (
  configuration: ApiOriginConfiguration = {}
) => {
  const environment = configuration.environment ?? process.env.VERCEL_ENV;
  const configuredUrl =
    configuration.configuredUrl ?? process.env.NEXT_PUBLIC_API_URL;
  const productionUrl =
    configuration.productionUrl ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (
    environment === "production" &&
    !productionUrl?.trim() &&
    !configuredUrl?.trim()
  ) {
    throw new Error(
      "VERCEL_PROJECT_PRODUCTION_URL or NEXT_PUBLIC_API_URL must be a valid HTTPS URL for the API Production environment."
    );
  }

  let applicationUrl: string;
  if (environment === "production") {
    applicationUrl = productionUrl ?? configuredUrl ?? "";
  } else if (environment === "preview") {
    applicationUrl = "";
  } else {
    applicationUrl = configuredUrl ?? "http://localhost:3002";
  }

  return resolveApplicationOrigin({
    applicationUrl,
    environment,
    branchUrl: configuration.branchUrl ?? process.env.VERCEL_BRANCH_URL,
    deploymentUrl: configuration.deploymentUrl ?? process.env.VERCEL_URL,
    nodeEnvironment: configuration.nodeEnvironment ?? process.env.NODE_ENV,
  });
};
