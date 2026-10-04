import "server-only";

import { auth as clerkAuth, currentUser } from "@repo/auth/server";
import { database } from "@repo/database";
import { cache } from "react";
import { applyMemberDeactivation } from "./auth-state";

type ClerkAuthResult = Awaited<ReturnType<typeof clerkAuth>>;
type CurrentUserResult = Awaited<ReturnType<typeof currentUser>>;

export type MemberAuthResult = Pick<
  ClerkAuthResult,
  "userId" | "isAuthenticated" | "redirectToSignIn" | "redirectToSignUp"
> & {
  memberDeactivated?: boolean;
};

export const getMemberIdentitySnapshot = cache(async (userId: string) =>
  database.member.findUnique({
    where: { id: userId },
    select: {
      deactivatedAt: true,
      displayName: true,
      email: true,
      avatarUrl: true,
    },
  })
);

export const getAuth = cache(async (): Promise<MemberAuthResult> => {
  const session = await clerkAuth();

  const member = session.userId
    ? await getMemberIdentitySnapshot(session.userId)
    : null;

  return applyMemberDeactivation(session, Boolean(member?.deactivatedAt));
});

// Keep the familiar Clerk function name at app call sites while enforcing the
// internal identity tombstone on every server page, action, and route handler.
export const auth = getAuth;

export const getCurrentUser = cache(
  async (): Promise<CurrentUserResult> => currentUser()
);
