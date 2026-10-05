const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const recordingThumbnailPathPattern =
  /^\/api\/learning\/recordings\/[^/]+\/thumbnail\/?$/;
const apiLikePathPattern = /^\/(?:api|cron|webhooks)(?:\/|$)/;

export const isAppWriteFreezeEnabled = (value = process.env.APP_WRITE_FREEZE) =>
  value === "true";

const isCronPath = (pathname: string) =>
  pathname === "/cron" ||
  pathname.startsWith("/cron/") ||
  pathname === "/api/cron" ||
  pathname.startsWith("/api/cron/");

const isWebhookPath = (pathname: string) =>
  pathname === "/webhooks" || pathname.startsWith("/webhooks/");

const isReadMethodWithSideEffects = (method: string, pathname: string) =>
  (method === "GET" || method === "HEAD") &&
  (isCronPath(pathname) || isWebhookPath(pathname));

export const isClerkFrontendApiProxyPath = (pathname: string) =>
  pathname === "/__clerk" || pathname.startsWith("/__clerk/");

export const shouldBlockRequestDuringWriteFreeze = (input: {
  readonly method: string;
  readonly pathname: string;
  readonly enabled: boolean;
  readonly clerkFrontendApiProxy?: boolean;
}) => {
  if (!input.enabled) {
    return false;
  }

  if (
    input.clerkFrontendApiProxy &&
    isClerkFrontendApiProxyPath(input.pathname)
  ) {
    return false;
  }

  const method = input.method.toUpperCase();
  if (mutatingMethods.has(method)) {
    return true;
  }

  return (
    safeMethods.has(method) &&
    isReadMethodWithSideEffects(method, input.pathname)
  );
};

export const shouldPauseUploadDuringRollback = (input: {
  readonly method: string;
  readonly pathname: string;
  readonly enabled: boolean;
}) =>
  input.enabled &&
  input.method.toUpperCase() === "POST" &&
  (input.pathname === "/api/member-assets" ||
    recordingThumbnailPathPattern.test(input.pathname));

export const shouldPauseStorageUploadDuringRollback = (input: {
  readonly enabled: boolean;
  readonly hasFile: boolean;
}) => input.enabled && input.hasFile;

export const createWriteFreezeResponse = (request: Request) => {
  const { pathname } = new URL(request.url);
  const headers = {
    "Cache-Control": "private, no-store",
    "Retry-After": "60",
  };

  if (apiLikePathPattern.test(pathname)) {
    return Response.json(
      {
        error:
          "Temporarily unavailable during a planned data maintenance window.",
        code: "WRITE_FREEZE",
        retryable: true,
      },
      { status: 503, headers }
    );
  }

  return new Response(
    '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Manutenção temporária</title><main><h1>Manutenção temporária</h1><p>Estamos concluindo uma atualização segura. Suas alterações não foram enviadas. Tente novamente em alguns minutos.</p></main></html>',
    {
      status: 503,
      headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
    }
  );
};

export const createUploadsPausedResponse = () =>
  Response.json(
    {
      error:
        "Envios de arquivos estão temporariamente pausados durante a janela de segurança. Tente novamente após a conclusão da validação.",
      code: "UPLOADS_PAUSED",
      retryable: true,
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "private, no-store",
        "Retry-After": "3600",
      },
    }
  );
