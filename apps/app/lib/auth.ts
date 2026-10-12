import "server-only";

import { auth as clerkAuth, currentUser } from "@repo/auth/server";
import { database } from "@repo/database";
import { tracePerformance } from "@repo/observability/performance";
import { cache } from "react";
import { applyMemberDeactivation } from "./auth-state";

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

export const getAuth = cache(async (): Promise<MemberAuthResult> => {
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

// Keep the familiar Clerk function name at app call sites while enforcing the
// internal identity tombstone on every server page, action, and route handler.
export const auth = getAuth;

export const getCurrentUser = cache(
  async (): Promise<CurrentUserResult> => currentUser()
);
