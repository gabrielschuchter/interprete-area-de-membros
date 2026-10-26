"use server";

import { database, MemberRole } from "@repo/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAuditEvent } from "@/lib/gestao-audit";
import { requireGestaoAdmin } from "@/lib/gestao-authorization";
import { consumeMutationRateLimit } from "@/lib/mutation-reliability";

const listPath = "/gestao/administracao/membros";

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

type RoleChange = "changed" | "invalid" | "last-admin" | "unchanged";

export const changeGestaoMemberRole = async (formData: FormData) => {
  const actor = await requireGestaoAdmin();
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: actor.userId,
  });
  const memberId = text(formData, "memberId");
  const next = Object.values(MemberRole).find(
    (role) => role === text(formData, "role")
  );
  const expected = Object.values(MemberRole).find(
    (role) => role === text(formData, "from")
  );
  let outcome: RoleChange = "invalid";
  if (memberId && next && expected) {
    outcome = await database.$transaction(async (transaction) => {
      const current = await transaction.member.findUnique({
        where: { id: memberId },
        select: { role: true },
      });
      if (!current || current.role !== expected) {
        return "invalid" as const;
      }
      if (current.role === next) {
        return "unchanged" as const;
      }
      if (current.role === MemberRole.ADMIN) {
        const others = await transaction.member.count({
          where: {
            deactivatedAt: null,
            id: { not: memberId },
            role: MemberRole.ADMIN,
          },
        });
        if (others === 0) {
          return "last-admin" as const;
        }
      }
      await transaction.member.update({
        where: { id: memberId },
        data: { role: next },
      });
      await recordAuditEvent(
        {
          actorId: actor.userId,
          aggregateId: memberId,
          aggregateType: "Member",
          eventType: "gestao.member.role_changed",
          payload: { from: current.role, memberId, to: next },
        },
        transaction
      );
      return "changed" as const;
    });
  }
  revalidatePath(listPath);
  revalidatePath("/gestao", "layout");
  redirect(
    `${listPath}?membro=${encodeURIComponent(memberId)}&resultado=${outcome}`
  );
};
