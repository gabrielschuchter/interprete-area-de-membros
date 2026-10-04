import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const GET = async () => {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;
  if (!(url && publishableKey)) {
    return NextResponse.json({ configured: false });
  }
  return NextResponse.json({ configured: true, publishableKey, url });
};
