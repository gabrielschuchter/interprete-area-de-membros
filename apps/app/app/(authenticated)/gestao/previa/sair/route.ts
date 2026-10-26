import { NextResponse } from "next/server";
import { requireGestaoActor } from "@/lib/gestao-authorization";
import {
  previewCookieName,
  previewRealCookieName,
} from "@/lib/preview-session";

export const dynamic = "force-dynamic";

/** Encerra a prévia. Só apaga cookies, por isso aceita GET (link da barra). */
export const GET = async (request: Request) => {
  await requireGestaoActor();
  const response = NextResponse.redirect(new URL("/gestao", request.url), 303);
  response.cookies.delete({ name: previewCookieName, path: "/" });
  response.cookies.delete({ name: previewRealCookieName, path: "/gestao" });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
};
