import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { createElement } from "react";
import { CommunityPostShareOgCard } from "@/components/community/community-post-share-og-card";
import { getAuth } from "@/lib/auth";
import { getCommunityPostSharePreview } from "@/lib/community-post-shares";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const genericTitle = "Uma publicação da Comunidade";
const genericDescription = "Acesse o Interprete para continuar a conversa.";
const genericAuthor = "Interprete · Comunidade";

export const GET = async (
  _request: NextRequest,
  { params }: { readonly params: Promise<{ token: string }> }
) => {
  let preview: Awaited<ReturnType<typeof getCommunityPostSharePreview>> = null;
  try {
    const [{ token }, session] = await Promise.all([params, getAuth()]);
    const memberId =
      session.userId &&
      !session.memberDeactivated &&
      session.memberSnapshot?.onboardingStatus === "COMPLETED"
        ? session.userId
        : null;
    preview = await getCommunityPostSharePreview(token, memberId);
  } catch {
    // Invalid links and backend failures both render the same branded card.
  }

  const response = new ImageResponse(
    createElement(CommunityPostShareOgCard, {
      authorName: preview?.authorName ?? genericAuthor,
      description: preview?.description ?? genericDescription,
      title: preview?.title ?? genericTitle,
    }),
    { width: 1200, height: 630 }
  );
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
};
