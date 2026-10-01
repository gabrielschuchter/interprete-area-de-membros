export const shouldProxyClerkFrontendApi = (publishableKey?: string) =>
  publishableKey?.startsWith("pk_live_") ?? false;
