import "server-only";

import { database, MemberRole } from "@repo/database";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAuth } from "./auth";

export const requireSession = async () => {
  const { userId } = await getAuth();

  if (!userId) {
    redirect("/sign-in");
  }

  return userId;
};

export const getMemberRole = cache(async (userId: string) => {
  const member = await database.member.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  return member?.role ?? MemberRole.MEMBER;
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
