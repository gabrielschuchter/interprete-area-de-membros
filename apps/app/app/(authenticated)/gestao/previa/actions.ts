"use server";

import { database } from "@repo/database";
import { cookies } from "next/headers";
import { recordAuditEvent } from "@/lib/gestao-audit";
import { requireGestaoActor } from "@/lib/gestao-authorization";
import {
  getGestaoCorrectionCohortScope,
  getGestaoCorrectionRecipientScope,
} from "@/lib/gestao-correction-scope";
import { safeGestaoReturnPath } from "@/lib/gestao-navigation";
import {
  encodePreviewToken,
  previewCookieName,
  previewLifetimeSeconds,
  previewRealCookieName,
} from "@/lib/preview-session";

export interface StartPreviewState {
  readonly error: string | null;
  /** Destino da prévia; o cliente abre com recarga completa para a barra aparecer. */
  readonly goto?: string;
}

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const resolveTarget = async (
  actor: Awaited<ReturnType<typeof requireGestaoActor>>,
  kind: string,
  value: string
) => {
  if (kind === "cohort") {
    const cohort = await database.cohort.findFirst({
      where: { AND: [getGestaoCorrectionCohortScope(actor), { id: value }] },
      select: {
        name: true,
        memberships: {
          where: {
            leftAt: null,
            member: { is: { deactivatedAt: null, role: "MEMBER" } },
            status: "ACTIVE",
          },
          orderBy: { joinedAt: "asc" },
          select: { memberId: true },
          take: 1,
        },
      },
    });
    const first = cohort?.memberships[0];
    if (!(cohort && first)) {
      return null;
    }
    return { label: `aluno da ${cohort.name}`, targetId: first.memberId };
  }
  const member = await database.member.findFirst({
    where: {
      AND: [getGestaoCorrectionRecipientScope(actor), { id: value }],
      role: "MEMBER",
    },
    select: { displayName: true, id: true },
  });
  return member
    ? { label: member.displayName ?? "aluno", targetId: member.id }
    : null;
};

export const startGestaoPreview = async (
  _previous: StartPreviewState,
  formData: FormData
): Promise<StartPreviewState> => {
  const actor = await requireGestaoActor();
  const kind = text(formData, "kind") === "cohort" ? "cohort" : "member";
  const value = text(formData, kind === "cohort" ? "cohortId" : "memberId");
  if (!value) {
    return {
      error:
        kind === "cohort"
          ? "Escolha uma turma."
          : "Escolha um aluno pela busca.",
    };
  }
  const target = await resolveTarget(actor, kind, value);
  if (!target) {
    return {
      error:
        kind === "cohort"
          ? "Esta turma não existe, não é sua ou ainda não tem alunos ativos."
          : "Este aluno não existe ou não está no seu escopo.",
    };
  }
  const expiresAt = Date.now() + previewLifetimeSeconds * 1000;
  const token = encodePreviewToken({
    actorId: actor.userId,
    expiresAt,
    label: target.label,
    targetId: target.targetId,
  });
  if (!token) {
    return { error: "A prévia não está configurada neste ambiente." };
  }
  const secure = process.env.NODE_ENV === "production";
  const jar = await cookies();
  jar.set(previewCookieName, token, {
    httpOnly: true,
    maxAge: previewLifetimeSeconds,
    path: "/",
    sameSite: "lax",
    secure,
  });
  // Enviado só sob /gestao: ali a Gestão continua com a identidade real.
  jar.set(previewRealCookieName, "1", {
    httpOnly: true,
    maxAge: previewLifetimeSeconds,
    path: "/gestao",
    sameSite: "lax",
    secure,
  });
  await recordAuditEvent({
    actorId: actor.userId,
    aggregateId: target.targetId,
    aggregateType: "Member",
    eventType: "gestao.preview.started",
    payload: { mode: kind },
  });
  return {
    error: null,
    goto: safeGestaoReturnPath(text(formData, "from") || null),
  };
};
