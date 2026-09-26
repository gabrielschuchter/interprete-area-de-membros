import { auth } from "@repo/auth/server";
import { NextResponse } from "next/server";

const noStoreHeaders = { "Cache-Control": "private, no-store" } as const;

export const GET = async () => {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Não autenticado" },
      { status: 401, headers: noStoreHeaders }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!(url && anonKey)) {
    return NextResponse.json(
      { error: "Realtime ainda não está configurado neste ambiente." },
      { status: 503, headers: noStoreHeaders }
    );
  }
  return NextResponse.json({ anonKey, url }, { headers: noStoreHeaders });
};
