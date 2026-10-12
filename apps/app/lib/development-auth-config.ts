export interface DevelopmentAuthEnvironment {
  readonly enabled: string | undefined;
  readonly nodeEnv: string | undefined;
  readonly publicEnabled: string | undefined;
  readonly userId: string | undefined;
}

export const resolveDevelopmentAuthUserId = ({
  enabled,
  publicEnabled,
  nodeEnv,
  userId,
}: DevelopmentAuthEnvironment): string | null => {
  if (enabled !== undefined && enabled !== "true" && enabled !== "false") {
    throw new Error("GESTAO_DEV_AUTH must be either true or false.");
  }

  if (
    publicEnabled !== undefined &&
    publicEnabled !== "true" &&
    publicEnabled !== "false"
  ) {
    throw new Error(
      "NEXT_PUBLIC_GESTAO_DEV_AUTH must be either true or false."
    );
  }

  const serverEnabled = enabled === "true";
  const clientEnabled = publicEnabled === "true";

  if (serverEnabled && nodeEnv !== "development") {
    throw new Error(
      "GESTAO_DEV_AUTH is available only in the local development runtime."
    );
  }

  if (nodeEnv === "development" && serverEnabled !== clientEnabled) {
    throw new Error(
      "GESTAO_DEV_AUTH and NEXT_PUBLIC_GESTAO_DEV_AUTH must be enabled together for local QA."
    );
  }

  if (!serverEnabled) {
    return null;
  }

  const normalizedUserId = userId?.trim();
  if (!normalizedUserId) {
    throw new Error(
      "GESTAO_DEV_AUTH_USER_ID is required when local QA authentication is enabled."
    );
  }

  return normalizedUserId;
};
