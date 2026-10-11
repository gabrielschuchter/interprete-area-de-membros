import "server-only";

import { MemberRole } from "@repo/database";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAuth, getMemberIdentitySnapshot } from "./auth";

export const requireSession = async () => {
  const { userId } = await getAuth();

  if (!userId) {
    redirect("/sign-in");
  }

  return userId;
};

// A page and its layout can render concurrently. Never assume the layout has
// provisioned the member before a private page or action starts using its ID.
export const requireOnboardedMemberId = async () => {
  const { userId, memberDeactivated, memberSnapshot } = await getAuth();

  if (memberDeactivated) {
    redirect("/conta-desativada");
  }
  if (!userId) {
    redirect("/sign-in");
  }
  if (memberSnapshot?.onboardingStatus !== "COMPLETED") {
    redirect("/onboarding");
  }

  return userId;
};

export const getMemberRole = cache(async (userId: string) => {
  const member = await getMemberIdentitySnapshot(userId);

  return member && !member.deactivatedAt ? member.role : MemberRole.MEMBER;
});

export const requireStaff = async () => {
  const userId = await requireSession();
  const role = await getMemberRole(userId);

  if (role !== MemberRole.TEACHER && role !== MemberRole.ADMIN) {
    redirect("/");
  }

  return { userId, role };
};

export const requireAdmin = async () => {
  const userId = await requireSession();
  const role = await getMemberRole(userId);

  if (role !== MemberRole.ADMIN) {
    redirect("/");
  }

  return { userId, role };
};
