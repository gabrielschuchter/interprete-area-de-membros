import { createHmac } from "node:crypto";
import { auth } from "@repo/auth/server";
import { NextResponse } from "next/server";

const noStoreHeaders = { "Cache-Control": "private, no-store" } as const;

const encode = (value: string) => Buffer.from(value).toString("base64url");

const sign = (header: string, payload: string, secret: string) =>
  createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");

export const GET = async () => {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Não autenticado" },
      { status: 401, headers: noStoreHeaders }
    );
  }

  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Realtime ainda não está configurado neste ambiente." },
      { status: 503, headers: noStoreHeaders }
    );
  }

  const header = encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encode(
    JSON.stringify({
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 300,
      role: "authenticated",
      sub: userId,
    })
  );
  return NextResponse.json(
    {
      token: `${header}.${payload}.${sign(header, payload, secret)}`,
    },
    { headers: noStoreHeaders }
  );
};
