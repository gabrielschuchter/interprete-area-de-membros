import "server-only";

import { auth as clerkAuth, currentUser } from "@repo/auth/server";
import { database } from "@repo/database";
import { tracePerformance } from "@repo/observability/performance";
import { cache } from "react";
import { applyMemberDeactivation } from "./auth-state";
import {
  decodePreviewToken,
  previewCookieName,
  previewRealCookieName,
} from "./preview-session";

type ClerkAuthResult = Awaited<ReturnType<typeof clerkAuth>>;
type CurrentUserResult = Awaited<ReturnType<typeof currentUser>>;

export type MemberAuthResult = Pick<
  ClerkAuthResult,
  "userId" | "isAuthenticated" | "redirectToSignIn" | "redirectToSignUp"
> & {
  memberDeactivated?: boolean;
  memberSnapshot?: Awaited<ReturnType<typeof getMemberIdentitySnapshot>>;
};

if (
  process.env.GESTAO_DEV_AUTH === "true" &&
  process.env.NODE_ENV !== "development"
) {
  throw new Error(
    "GESTAO_DEV_AUTH is available only in the local development runtime."
  );
}

export const getMemberIdentitySnapshot = cache(async (userId: string) =>
  database.member.findUnique({
    where: { id: userId },
    select: {
      deactivatedAt: true,
      displayName: true,
      email: true,
      avatarUrl: true,
      role: true,
      onboardingStatus: true,
    },
  })
);

/**
 * "Ver como aluno": só vale para a equipe, nas telas do aluno (o cookie que
 * marca a Gestão a mantém com a identidade real) e para um aluno ativo.
 */
const applyPreview = async (
  base: MemberAuthResult
): Promise<MemberAuthResult> => {
  if (!base.userId) {
    return base;
  }
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const raw = jar.get(previewCookieName)?.value;
  if (!raw || jar.has(previewRealCookieName)) {
    return base;
  }
  const token = decodePreviewToken(raw);
  const role = base.memberSnapshot?.role;
  if (
    !token ||
    token.actorId !== base.userId ||
    (role !== "ADMIN" && role !== "TEACHER")
  ) {
    return base;
  }
  const target = await getMemberIdentitySnapshot(token.targetId);
  if (!target || target.deactivatedAt || target.role !== "MEMBER") {
    return base;
  }
  return { ...base, memberSnapshot: target, userId: token.targetId };
};

const resolveAuth = cache(async (): Promise<MemberAuthResult> => {
  if (process.env.NODE_ENV === "development") {
    const { getDevelopmentAuthSession } = await import("./development-auth");
    const developmentSession = await getDevelopmentAuthSession();

    if (developmentSession) {
      const member = await tracePerformance("member.auth.snapshot", () =>
        getMemberIdentitySnapshot(developmentSession.userId)
      );

      if (!member) {
        throw new Error(
          "GESTAO_DEV_AUTH_USER_ID must identify a seeded local QA member."
        );
      }

      return {
        ...applyMemberDeactivation(
          developmentSession,
          Boolean(member.deactivatedAt)
        ),
        memberSnapshot: member.deactivatedAt ? null : member,
      };
    }
  }

  const session = await tracePerformance("member.auth.clerk", () =>
    clerkAuth()
  );

  const member = session.userId
    ? await tracePerformance("member.auth.snapshot", () =>
        getMemberIdentitySnapshot(session.userId as string)
      )
    : null;

  return {
    ...applyMemberDeactivation(session, Boolean(member?.deactivatedAt)),
    memberSnapshot: member?.deactivatedAt ? null : member,
  };
});

export const getAuth = cache(async () => applyPreview(await resolveAuth()));

// Keep the familiar Clerk function name at app call sites while enforcing the
// internal identity tombstone on every server page, action, and route handler.
export const auth = getAuth;

export const getCurrentUser = cache(
  async (): Promise<CurrentUserResult> => currentUser()
);
