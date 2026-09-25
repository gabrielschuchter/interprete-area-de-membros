import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export const GET = async (): Promise<Response> => {
  const authConfigured = Boolean(
    process.env.CLERK_SECRET_KEY &&
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  );

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
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

    return NextResponse.json(
      {
        ok: authConfigured,
        checks: {
          auth: authConfigured ? "configured" : "missing",
          database: "ok",
        },
      },
      { status: authConfigured ? 200 : 503 }
    );
  } catch {
    return NextResponse.json(
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
