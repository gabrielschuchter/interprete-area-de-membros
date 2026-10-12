import "server-only";

import { notFound, redirect } from "next/navigation";
import { env } from "@/env";
import { getMemberIdentitySnapshot } from "./auth";
import { requireStaff } from "./authorization";
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

  const { userId, role } = await requireStaff();
  const member = await getMemberIdentitySnapshot(userId);
  if (!member || member.deactivatedAt) {
    redirect("/conta-desativada");
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
    redirect("/gestao/administracao?restrito=1");
  }
  return decision;
};

export const requireGestaoAdmin = async () => {
  const { actor } = await requireGestaoAction("members.manage");
  return actor;
};
