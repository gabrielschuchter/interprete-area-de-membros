import { auth } from "@repo/auth/server";
import { NextResponse } from "next/server";
import { searchGlobal } from "@/lib/global-search";

export const GET = async (request: Request) => {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get("q") ?? "";
  if (query.trim().length > 80) {
    return NextResponse.json(
      { error: "A busca é limitada a 80 caracteres." },
      { status: 400 }
    );
  }

  try {
    const results = await searchGlobal(userId, query);
    return NextResponse.json(
      { results },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("Global search failed", error);
    return NextResponse.json(
      { error: "Não foi possível realizar a busca agora." },
      { status: 500 }
    );
  }
};
