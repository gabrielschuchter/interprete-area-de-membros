export const shouldProxyClerkFrontendApi = (publishableKey?: string) =>
  publishableKey?.startsWith("pk_live_") ?? false;

interface ClerkDevelopmentConfiguration {
  frontendApi?: string;
  nodeEnv?: string;
  proxyUrl?: string;
  publishableKey?: string;
  secretKey?: string;
}

export const getClerkDevelopmentConfigurationError = ({
  nodeEnv,
  publishableKey,
  secretKey,
  proxyUrl,
  frontendApi,
}: ClerkDevelopmentConfiguration) => {
  let publishableEnvironment: "development" | "production" | undefined;
  if (publishableKey?.startsWith("pk_live_")) {
    publishableEnvironment = "production";
  } else if (publishableKey?.startsWith("pk_test_")) {
    publishableEnvironment = "development";
  }

  let secretEnvironment: "development" | "production" | undefined;
  if (secretKey?.startsWith("sk_live_")) {
    secretEnvironment = "production";
  } else if (secretKey?.startsWith("sk_test_")) {
    secretEnvironment = "development";
  }

  if (
    publishableEnvironment &&
    secretEnvironment &&
    publishableEnvironment !== secretEnvironment
  ) {
    return "Os prefixos de ambiente de NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY e CLERK_SECRET_KEY precisam coincidir. Copie o par da mesma instância Clerk.";
  }

  if (nodeEnv !== "development") {
    return undefined;
  }

  if (
    publishableEnvironment === "production" ||
    secretEnvironment === "production"
  ) {
    return "O desenvolvimento local exige chaves Clerk Development (pk_test_/sk_test_); chaves Production não são aceitas em next dev.";
  }

  if (publishableEnvironment === "development" && (proxyUrl || frontendApi)) {
    return "Este app usa a Frontend API da instância Development diretamente. Remova CLERK_PROXY_URL, NEXT_PUBLIC_CLERK_PROXY_URL, CLERK_FAPI e NEXT_PUBLIC_CLERK_FAPI do ambiente local.";
  }

  return undefined;
};
