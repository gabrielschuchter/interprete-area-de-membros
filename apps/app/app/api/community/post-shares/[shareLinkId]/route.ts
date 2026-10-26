import { type NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { revokeCommunityPostShareLink } from "@/lib/community-post-shares";
import {
  consumeMutationRateLimit,
  isMutationRateLimitError,
} from "@/lib/mutation-reliability";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: privateHeaders });

const genericFailure = "Não foi possível concluir o compartilhamento.";
const shareLinkIdPattern = /^[a-z0-9]{8,32}$/i;

export const DELETE = async (
  request: NextRequest,
  { params }: { readonly params: Promise<{ shareLinkId: string }> }
) => {
  if (
    request.headers.get("origin") !== request.nextUrl.origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    return json({ error: genericFailure }, 403);
  }

  try {
    const [{ shareLinkId }, session] = await Promise.all([params, getAuth()]);
    if (
      !session.userId ||
      session.memberDeactivated ||
      session.memberSnapshot?.onboardingStatus !== "COMPLETED" ||
      !shareLinkIdPattern.test(shareLinkId)
    ) {
      return json({ error: genericFailure }, 404);
    }

    await consumeMutationRateLimit({
      action: "community.post.share-link.revoke",
      memberId: session.userId,
    });
    if (!(await revokeCommunityPostShareLink(shareLinkId, session.userId))) {
      return json({ error: genericFailure }, 404);
    }
    return json({ ok: true });
  } catch (error) {
    if (isMutationRateLimitError(error)) {
      return NextResponse.json(
        { error: "Muitas ações em sequência. Tente novamente em instantes." },
        {
          status: 429,
          headers: {
            ...privateHeaders,
            "Retry-After": String(error.retryAfterSeconds),
          },
        }
      );
    }
    return json({ error: genericFailure }, 500);
  }
};
