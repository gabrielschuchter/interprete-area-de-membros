import { type NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import {
  createCommunityPostShareLink,
  listCommunityPostShareLinks,
} from "@/lib/community-post-shares";
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

const getShareActor = async () => {
  const session = await getAuth();
  if (
    !session.userId ||
    session.memberDeactivated ||
    session.memberSnapshot?.onboardingStatus !== "COMPLETED"
  ) {
    return null;
  }
  return session.userId;
};

const isSameOriginMutation = (request: NextRequest) =>
  request.headers.get("origin") === request.nextUrl.origin &&
  request.headers.get("sec-fetch-site") !== "cross-site";

export const GET = async (request: NextRequest) => {
  try {
    const memberId = await getShareActor();
    if (!memberId) {
      return json({ error: genericFailure }, 401);
    }
    const postId = request.nextUrl.searchParams.get("postId") ?? "";
    if (postId.length < 1 || postId.length > 128) {
      return json({ error: genericFailure }, 400);
    }
    const links = await listCommunityPostShareLinks(postId, memberId);
    return json({ links });
  } catch {
    return json({ error: genericFailure }, 500);
  }
};

export const POST = async (request: NextRequest) => {
  if (!isSameOriginMutation(request)) {
    return json({ error: genericFailure }, 403);
  }

  try {
    const memberId = await getShareActor();
    if (!memberId) {
      return json({ error: genericFailure }, 401);
    }
    const body: unknown = await request.json();
    if (
      !body ||
      typeof body !== "object" ||
      !("postId" in body) ||
      typeof body.postId !== "string" ||
      body.postId.length < 1 ||
      body.postId.length > 128
    ) {
      return json({ error: genericFailure }, 400);
    }

    await consumeMutationRateLimit({
      action: "community.post.share-link.create",
      memberId,
    });
    const link = await createCommunityPostShareLink(body.postId, memberId);
    if (!link) {
      return json({ error: genericFailure }, 404);
    }

    const url = new URL(
      `/comunidade/compartilhar/${link.token}`,
      request.nextUrl.origin
    ).toString();
    return json(
      {
        id: link.id,
        url,
        createdAt: link.createdAt,
      },
      201
    );
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
