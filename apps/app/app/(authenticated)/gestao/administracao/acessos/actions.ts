"use server";

import {
  AccessGrantOrigin,
  AccessResourceType,
  database,
} from "@repo/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAuditEvent } from "@/lib/gestao-audit";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { parseGrantResource } from "@/lib/gestao-member-access-domain";
import { consumeMutationRateLimit } from "@/lib/mutation-reliability";

const listPath = "/gestao/administracao/acessos";
const maxResources = 300;
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;

export interface GrantAccessState {
  readonly error: string | null;
}

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const fail = (error: string): GrantAccessState => ({ error });

const countExisting = async (
  type: "COURSE" | "LESSON" | "MODULE",
  ids: readonly string[]
) => {
  if (ids.length === 0) {
    return 0;
  }
  const where = { id: { in: [...ids] } };
  if (type === "COURSE") {
    return await database.course.count({ where });
  }
  return type === "MODULE"
    ? await database.module.count({ where })
    : await database.lesson.count({ where });
};

export const grantGestaoAccess = async (
  _previous: GrantAccessState,
  formData: FormData
): Promise<GrantAccessState> => {
  const { actor } = await requireGestaoAction("access.manage");
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: actor.userId,
  });
  const memberId = text(formData, "memberId");
  const expiresRaw = text(formData, "expiresAt");
  const resources = [
    ...new Set(
      formData
        .getAll("resources")
        .filter((value): value is string => typeof value === "string")
    ),
  ].flatMap((value) => parseGrantResource(value) ?? []);
  if (!memberId) {
    return fail("Escolha o membro que receberá o acesso.");
  }
  if (resources.length === 0) {
    return fail("Marque ao menos um conteúdo.");
  }
  if (resources.length > maxResources) {
    return fail(`Marque no máximo ${maxResources} itens por concessão.`);
  }
  if (expiresRaw && !dayPattern.test(expiresRaw)) {
    return fail("Informe uma data de expiração válida.");
  }
  const expiresAt = expiresRaw
    ? new Date(`${expiresRaw}T23:59:59-03:00`)
    : null;
  const now = new Date();
  if (expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt <= now)) {
    return fail("A expiração precisa estar no futuro.");
  }
  const member = await database.member.findFirst({
    where: { id: memberId, role: "MEMBER", deactivatedAt: null },
    select: { id: true },
  });
  if (!member) {
    return fail("Escolha um aluno ativo da lista.");
  }
  for (const type of ["COURSE", "MODULE", "LESSON"] as const) {
    const ids = resources.filter((r) => r.type === type).map((r) => r.id);
    if ((await countExisting(type, ids)) !== ids.length) {
      return fail("Algum conteúdo escolhido não existe mais. Recarregue.");
    }
  }
  const granted = await database.$transaction(async (transaction) => {
    const active = await transaction.accessGrantSource.findMany({
      where: {
        subjectMemberId: memberId,
        origin: AccessGrantOrigin.DIRECT,
        revokedAt: null,
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      },
      select: { resourceId: true, resourceType: true },
    });
    const have = new Set(
      active.map((row) => `${row.resourceType}:${row.resourceId}`)
    );
    const fresh = resources.filter((r) => !have.has(`${r.type}:${r.id}`));
    if (fresh.length > 0) {
      await transaction.accessGrantSource.createMany({
        data: fresh.map((r) => ({
          createdByMemberId: actor.userId,
          origin: AccessGrantOrigin.DIRECT,
          resourceId: r.id,
          resourceType: AccessResourceType[r.type],
          subjectMemberId: memberId,
          validUntil: expiresAt,
        })),
      });
      await recordAuditEvent(
        {
          actorId: actor.userId,
          aggregateId: memberId,
          aggregateType: "Member",
          eventType: "gestao.access.granted",
          payload: {
            count: fresh.length,
            expiresAt: expiresAt?.toISOString() ?? null,
            resources: fresh.map((r) => `${r.type}:${r.id}`).slice(0, 50),
          },
        },
        transaction
      );
    }
    return fresh.length;
  });
  revalidatePath(listPath);
  revalidatePath("/cursos");
  redirect(
    `${listPath}?membro=${encodeURIComponent(memberId)}&resultado=${granted > 0 ? "concedido" : "ja-existia"}`
  );
};

export const revokeGestaoAccess = async (formData: FormData) => {
  const { actor } = await requireGestaoAction("access.manage");
  await consumeMutationRateLimit({
    action: "admin.mutation",
    memberId: actor.userId,
  });
  const memberId = text(formData, "memberId");
  const grantId = text(formData, "grantId");
  const kind = text(formData, "kind");
  let revoked = 0;
  if (memberId && grantId && (kind === "source" || kind === "legacy")) {
    revoked = await database.$transaction(async (transaction) => {
      const result =
        kind === "source"
          ? await transaction.accessGrantSource.updateMany({
              where: {
                id: grantId,
                origin: AccessGrantOrigin.DIRECT,
                revokedAt: null,
                subjectMemberId: memberId,
              },
              data: { revokedAt: new Date() },
            })
          : await transaction.accessGrant.deleteMany({
              where: { id: grantId, memberId },
            });
      if (result.count > 0) {
        await recordAuditEvent(
          {
            actorId: actor.userId,
            aggregateId: memberId,
            aggregateType: "Member",
            eventType: "gestao.access.revoked",
            payload: { grantId, kind },
          },
          transaction
        );
      }
      return result.count;
    });
  }
  revalidatePath(listPath);
  revalidatePath("/cursos");
  redirect(
    `${listPath}?membro=${encodeURIComponent(memberId)}&resultado=${revoked > 0 ? "revogado" : "indisponivel"}`
  );
};
