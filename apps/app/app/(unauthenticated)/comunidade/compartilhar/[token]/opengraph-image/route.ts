import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { createElement } from "react";
import sharp from "sharp";
import { CommunityPostShareOgCard } from "@/components/community/community-post-share-og-card";
import { getAuth } from "@/lib/auth";
import {
  getCommunityPostShareCoverBytes,
  getCommunityPostSharePreview,
} from "@/lib/community-post-shares";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const genericTitle = "Uma publicação da Comunidade";
const genericDescription = "Acesse o Interprete para continuar a conversa.";
const genericAuthor = "Interprete · Comunidade";

const findDesignSystemPackage = () => {
  const candidates = [
    resolve(process.cwd(), "packages/design-system/package.json"),
    resolve(process.cwd(), "../../packages/design-system/package.json"),
  ];
  const packagePath = candidates.find(existsSync);
  if (!packagePath) {
    throw new Error("Não foi possível localizar as fontes do design system.");
  }
  return packagePath;
};

const designSystemRequire = createRequire(findDesignSystemPackage());

const loadOgFonts = async () => {
  const files = [
    "@fontsource/source-serif-4/files/source-serif-4-latin-600-normal.woff",
    "@fontsource/inter/files/inter-latin-400-normal.woff",
    "@fontsource/inter/files/inter-latin-500-normal.woff",
    "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff",
  ];
  const [sourceSerif, inter, interMedium, plexMono] = await Promise.all(
    files.map((file) => readFile(designSystemRequire.resolve(file)))
  );
  return [
    { name: "Source Serif 4", data: sourceSerif, weight: 600 as const },
    { name: "Inter", data: inter, weight: 400 as const },
    { name: "Inter", data: interMedium, weight: 500 as const },
    { name: "IBM Plex Mono", data: plexMono, weight: 500 as const },
  ];
};

let ogFontsPromise: ReturnType<typeof loadOgFonts> | undefined;
const getOgFonts = () => (ogFontsPromise ??= loadOgFonts());

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

  let coverDataUrl: string | null = null;
  if (preview?.coverUrl) {
    const cover = await getCommunityPostShareCoverBytes(preview.coverUrl);
    if (cover) {
      try {
        const image = await sharp(Buffer.from(cover.bytes))
          .rotate()
          .resize(1200, 630, { fit: "cover" })
          .jpeg({ quality: 82 })
          .toBuffer();
        coverDataUrl = `data:image/jpeg;base64,${image.toString("base64")}`;
      } catch {
        // An unavailable or malformed cover falls back to the designed card.
      }
    }
  }

  const fonts = await getOgFonts();
  const response = new ImageResponse(
    createElement(CommunityPostShareOgCard, {
      authorName: preview?.authorName ?? genericAuthor,
      category: preview?.tags[0] ?? "Comunidade",
      commentCount: preview?.commentCount ?? null,
      coverDataUrl,
      description: preview?.metaDescription ?? genericDescription,
      title: preview?.title ?? genericTitle,
    }),
    { width: 1200, height: 630, fonts }
  );
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
};
