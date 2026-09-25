export const dynamic = "force-dynamic";

const sanitizeDatabaseError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return { name: "UnknownError", message: "Unknown database error" };
  }

  const candidate = error as Error & { code?: string };
  const message = error.message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[REDACTED_DATABASE_URL]")
    .replace(/password=[^\s&]+/gi, "password=[REDACTED]");

  return {
    name: error.name,
    code: candidate.code,
    message,
  };
};

export const GET = async (request?: Request): Promise<Response> => {
  const deep = request
    ? new URL(request.url).searchParams.get("deep") === "1"
    : false;

  if (!deep) {
    return new Response("OK", { status: 200 });
  }

  const authConfigured = Boolean(
    process.env.CLERK_SECRET_KEY &&
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  );

  if (!process.env.DATABASE_URL) {
    return Response.json(
      {
        ok: false,
        checks: {
          auth: authConfigured ? "configured" : "missing",
          database: "missing",
        },
      },
      { status: 503 }
    );
  }

  try {
    const { database } = await import("@repo/database");
    await database.$queryRaw`SELECT 1`;

    return Response.json(
      {
        ok: authConfigured,
        checks: {
          auth: authConfigured ? "configured" : "missing",
          database: "ok",
        },
      },
      { status: authConfigured ? 200 : 503 }
    );
  } catch (error) {
    console.error("[health] database check failed", sanitizeDatabaseError(error));

    return Response.json(
      {
        ok: false,
        checks: {
          auth: authConfigured ? "configured" : "missing",
          database: "error",
        },
      },
      { status: 503 }
    );
  }
};
