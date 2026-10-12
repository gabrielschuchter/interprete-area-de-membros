"use server";

import { z } from "zod";
import {
  issueCohortCalendarFeedToken,
  revokeCohortCalendarFeedToken,
} from "@/lib/cohort-calendar-feed";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { consumeMutationRateLimit } from "@/lib/mutation-reliability";

export type CohortCalendarFeedActionResult =
  | { readonly ok: true; readonly url?: string; readonly revoked?: boolean }
  | {
      readonly ok: false;
      readonly code: "validation" | "forbidden" | "not-found" | "unavailable";
      readonly message: string;
    };

const cohortIdSchema = z.string().trim().min(1).max(255);

export const createGestaoCohortCalendarFeed = async (
  input: unknown
): Promise<CohortCalendarFeedActionResult> => {
  const parsed = cohortIdSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: "Turma inválida.",
    };
  }
  try {
    const { actor } = await requireGestaoAction("cohort.manage", {
      cohortId: parsed.data,
    });
    await consumeMutationRateLimit({
      action: "cohort.mutation",
      memberId: actor.userId,
    });
    const token = await issueCohortCalendarFeedToken(actor.userId, parsed.data);
    if (!token) {
      return {
        ok: false,
        code: "not-found",
        message: "Turma não encontrada ou sem acesso.",
      };
    }
    return {
      ok: true,
      url: `/api/gestao/calendar-feed?token=${encodeURIComponent(token)}`,
    };
  } catch {
    return {
      ok: false,
      code: "unavailable",
      message: "Não foi possível criar a assinatura agora.",
    };
  }
};

export const revokeGestaoCohortCalendarFeed = async (
  input: unknown
): Promise<CohortCalendarFeedActionResult> => {
  const parsed = cohortIdSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "validation",
      message: "Turma inválida.",
    };
  }
  try {
    const { actor } = await requireGestaoAction("cohort.manage", {
      cohortId: parsed.data,
    });
    await consumeMutationRateLimit({
      action: "cohort.mutation",
      memberId: actor.userId,
    });
    const revoked = await revokeCohortCalendarFeedToken(
      actor.userId,
      parsed.data
    );
    if (revoked === null) {
      return {
        ok: false,
        code: "not-found",
        message: "Turma não encontrada ou sem acesso.",
      };
    }
    return { ok: true, revoked: true };
  } catch {
    return {
      ok: false,
      code: "unavailable",
      message: "Não foi possível revogar a assinatura agora.",
    };
  }
};
