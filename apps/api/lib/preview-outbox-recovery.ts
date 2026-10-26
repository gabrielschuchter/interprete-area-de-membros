const previewOutboxUrl =
  "https://interprete-area-de-membro-git-afba70-gabrielschuchters-projects.vercel.app/cron/outbox";
const recoveryTimeoutMilliseconds = 8000;
const latestStartMilliseconds = 45_000;

interface PreviewRecoveryConfiguration {
  readonly enabled: boolean;
  readonly environment: string | undefined;
  readonly namespace: string | undefined;
  readonly secret: string | undefined;
}

type PreviewRecoveryResult =
  | { readonly status: "succeeded" }
  | {
      readonly status: "failed";
      readonly reason: "configuration" | "oidc" | "http" | "transport";
      readonly httpStatus?: number;
    }
  | { readonly status: "skipped"; readonly reason: "budget" };

// The existing durable five-minute scheduler retries this hop on its next cycle.
// The Preview deployment alone claims preview.* jobs and enforces its QA allowlist.
export const recoverPreviewOutbox = async (
  request: Request,
  configuration: PreviewRecoveryConfiguration,
  elapsedMilliseconds: number,
  fetcher: typeof fetch = fetch
): Promise<PreviewRecoveryResult | undefined> => {
  if (
    !configuration.enabled ||
    configuration.environment !== "production" ||
    configuration.namespace
  ) {
    return;
  }
  if (elapsedMilliseconds >= latestStartMilliseconds) {
    return { status: "skipped", reason: "budget" };
  }
  if (!configuration.secret || configuration.secret.trim().length < 32) {
    return { status: "failed", reason: "configuration" };
  }
  const oidcToken = request.headers.get("x-vercel-oidc-token");
  if (!oidcToken) {
    return { status: "failed", reason: "oidc" };
  }

  try {
    const response = await fetcher(previewOutboxUrl, {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(recoveryTimeoutMilliseconds),
      headers: {
        Authorization: `Bearer ${configuration.secret}`,
        "x-vercel-trusted-oidc-idp-token": oidcToken,
      },
    });
    // Never read or log the response body, tokens, headers, or recipient data.
    if (response.status !== 200) {
      return { status: "failed", reason: "http", httpStatus: response.status };
    }
    return { status: "succeeded" };
  } catch {
    return { status: "failed", reason: "transport" };
  }
};
