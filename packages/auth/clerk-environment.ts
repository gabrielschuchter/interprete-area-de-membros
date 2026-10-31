interface ClerkEnvironmentConfiguration {
  autoProxyGuardEnabled?: boolean;
  disableAutoProxy?: string;
  nodeEnv?: string;
  proxyVariables?: readonly string[];
  publishableKey?: string;
  secretKey?: string;
  vercelProductionUrl?: string;
  vercelTargetEnv?: string;
}

export const getClerkEnvironmentConfigurationError = ({
  autoProxyGuardEnabled = false,
  nodeEnv,
  publishableKey,
  secretKey,
  proxyVariables = [],
  vercelTargetEnv,
  vercelProductionUrl,
  disableAutoProxy,
}: ClerkEnvironmentConfiguration) => {
  const configuredProxyVariables = proxyVariables.filter(Boolean);
  if (configuredProxyVariables.length > 0) {
    return `A Frontend API do Clerk usa DNS dedicado. Remova as variáveis antigas: ${configuredProxyVariables.join(", ")}.`;
  }

  if (
    autoProxyGuardEnabled &&
    vercelTargetEnv === "production" &&
    publishableKey?.startsWith("pk_live_") &&
    vercelProductionUrl?.toLowerCase().endsWith(".vercel.app") &&
    disableAutoProxy !== "true"
  ) {
    return "CLERK_DISABLE_AUTO_PROXY=true é obrigatório: a URL de produção Vercel ativa automaticamente o proxy legado do Clerk.";
  }

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

  if (
    nodeEnv === "development" &&
    (publishableEnvironment === "production" ||
      secretEnvironment === "production")
  ) {
    return "O desenvolvimento local exige chaves Clerk Development (pk_test_/sk_test_); chaves Production não são aceitas em next dev.";
  }

  return undefined;
};
