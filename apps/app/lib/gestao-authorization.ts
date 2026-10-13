import "server-only";

import { database } from "@repo/database";
import { forbidden, notFound, redirect } from "next/navigation";
import { env } from "@/env";
import { getMemberIdentitySnapshot } from "./auth";
import { requireSession } from "./authorization";
import {
  canPerformGestaoAction,
  type GestaoAction,
  type GestaoRole,
} from "./gestao-permissions";

export interface GestaoActor {
  readonly avatarUrl: string | null;
  readonly displayName: string | null;
  readonly email: string | null;
  readonly role: GestaoRole;
  readonly userId: string;
}

export interface GestaoResource {
  readonly cohortId?: string;
  readonly contentId?: string;
  readonly memberId?: string;
}

export const requireGestaoActor = async (): Promise<GestaoActor> => {
  if (env.GESTAO_V2_ENABLED !== "true") {
    notFound();
  }

  const userId = await requireSession();
  const member = await getMemberIdentitySnapshot(userId);
  if (!member || member.deactivatedAt) {
    redirect("/conta-desativada");
  }
  const role = member.role;
  if (role !== "TEACHER" && role !== "ADMIN") {
    forbidden();
  }

  return {
    avatarUrl: member.avatarUrl,
    displayName: member.displayName,
    email: member.email,
    role,
    userId,
  };
};

export const authorizeGestao = async (
  action: GestaoAction,
  resource: GestaoResource = {}
) => {
  const actor = await requireGestaoActor();
  return {
    actor,
    allowed: canPerformGestaoAction(actor.role, action),
    resource,
  };
};

export const requireGestaoAction = async (
  action: GestaoAction,
  resource: GestaoResource = {}
) => {
  const decision = await authorizeGestao(action, resource);
  if (!decision.allowed) {
    forbidden();
  }
  return decision;
};

export const requireGestaoAdmin = async () => {
  const { actor } = await requireGestaoAction("members.manage");
  return actor;
};
export const requireGestaoCohortActor = async (cohortId: string) => {
  const actor = await requireGestaoAction("cohort.manage", { cohortId });
  const cohort = await database.cohort.findFirst({
    where: {
      id: cohortId,
      ...(actor.actor.role === "ADMIN"
        ? {}
        : { teachers: { some: { memberId: actor.actor.userId } } }),
    },
    select: { id: true, version: true },
  });
  if (!cohort) {
    forbidden();
  }
  return { actor: actor.actor, cohort };
};
