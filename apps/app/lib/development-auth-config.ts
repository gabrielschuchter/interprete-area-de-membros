export interface DevelopmentAuthEnvironment {
  readonly enabled: string | undefined;
  readonly nodeEnv: string | undefined;
  readonly userId: string | undefined;
}

export const resolveDevelopmentAuthUserId = ({
  enabled,
  nodeEnv,
  userId,
}: DevelopmentAuthEnvironment): string | null => {
  if (enabled !== undefined && enabled !== "true" && enabled !== "false") {
    throw new Error("GESTAO_DEV_AUTH must be either true or false.");
  }

  if (enabled !== "true") {
    return null;
  }

  if (nodeEnv !== "development") {
    throw new Error(
      "GESTAO_DEV_AUTH is available only in the local development runtime."
    );
  }

  const normalizedUserId = userId?.trim();
  if (!normalizedUserId) {
    throw new Error(
      "GESTAO_DEV_AUTH_USER_ID is required when local QA authentication is enabled."
    );
  }

  return normalizedUserId;
};
