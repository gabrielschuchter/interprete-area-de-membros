"use server";

import { clerkClient } from "@repo/auth/server";
import { database, MemberRole } from "@repo/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAuditEvent } from "@/lib/gestao-audit";
import { requireGestaoAdmin } from "@/lib/gestao-authorization";
import {
  eraseMemberRecords,
  erasureConfirmation,
  getErasurePreview,
} from "@/lib/gestao-member-erasure";
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

type Erasure =
  | "blocked"
  | "clerk-failed"
  | "confirmation"
  | "erased"
  | "erased-with-clerk"
  | "missing";

export const eraseGestaoMemberData = async (formData: FormData) => {
  const actor = await requireGestaoAdmin();
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: actor.userId,
  });
  const memberId = text(formData, "memberId");
  const typed = text(formData, "confirmation").toLowerCase();
  const alsoClerk = formData.get("clerk") === "on";
  let outcome: Erasure = "missing";
  let erasedId: string | null = null;
  if (memberId) {
    const preview = await getErasurePreview(memberId, actor.userId);
    if (!preview) {
      outcome = "missing";
    } else if (preview.blockers.length > 0) {
      outcome = "blocked";
    } else if (typed !== erasureConfirmation(preview)) {
      outcome = "confirmation";
    } else {
      await database.$transaction(async (transaction) => {
        await eraseMemberRecords(transaction, memberId);
        await recordAuditEvent(
          {
            actorId: actor.userId,
            aggregateId: memberId,
            aggregateType: "Member",
            eventType: "gestao.member.data_erased",
            payload: {
              clerkRequested: alsoClerk,
              counts: { ...preview.counts },
              displayName: preview.displayName,
              memberId,
            },
          },
          transaction
        );
      });
      erasedId = memberId;
      outcome = "erased";
    }
  }
  if (erasedId && alsoClerk && erasedId.startsWith("user_")) {
    // Depois do banco: se o Clerk falhar, os dados já saíram e o aviso diz
    // que a conta de login continua existindo.
    try {
      const client = await clerkClient();
      await client.users.deleteUser(erasedId);
      outcome = "erased-with-clerk";
    } catch {
      outcome = "clerk-failed";
    }
  }
  revalidatePath(listPath);
  revalidatePath("/gestao", "layout");
  revalidatePath("/comunidade", "layout");
  redirect(
    erasedId
      ? `${listPath}?resultado=${outcome}`
      : `${listPath}?membro=${encodeURIComponent(memberId)}&resultado=${outcome}`
  );
};
