import { getAuth } from "@/lib/auth";
import {
  getCommunityPostShareCoverBytes,
  getCommunityPostSharePreview,
} from "@/lib/community-post-shares";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const privateHeaders = {
  "Cache-Control": "private, no-store",
  "Content-Disposition": "inline",
  "Referrer-Policy": "no-referrer",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export const GET = async (
  _request: Request,
  { params }: { readonly params: Promise<{ token: string }> }
) => {
  try {
    const [{ token }, session] = await Promise.all([params, getAuth()]);
    const memberId =
      session.userId &&
      !session.memberDeactivated &&
      session.memberSnapshot?.onboardingStatus === "COMPLETED"
        ? session.userId
        : null;
    const preview = await getCommunityPostSharePreview(token, memberId);
    if (!preview?.coverUrl) {
      return new Response(null, { status: 404, headers: privateHeaders });
    }

    const cover = await getCommunityPostShareCoverBytes(preview.coverUrl);
    if (!cover) {
      return new Response(null, { status: 404, headers: privateHeaders });
    }

    return new Response(Buffer.from(cover.bytes), {
      status: 200,
      headers: {
        ...privateHeaders,
        "Content-Length": String(cover.bytes.byteLength),
        "Content-Type": cover.mimeType,
      },
    });
  } catch {
    return new Response(null, { status: 404, headers: privateHeaders });
  }
};
