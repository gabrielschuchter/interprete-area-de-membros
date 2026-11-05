import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * O Planejamento deixou de existir em 04/11/2026: Metas e Calendário vivem em
 * Ferramentas. Calendários assinados (ICS) e avisos antigos ainda guardam o
 * endereço antigo; este redirecionamento os leva ao mesmo conteúdo.
 */
const redirectToTools = (request: NextRequest) => {
  const target = new URL("/ferramentas", request.nextUrl);
  target.search = request.nextUrl.search;
  return NextResponse.redirect(target, 308);
};

export const GET = redirectToTools;
export const HEAD = redirectToTools;
