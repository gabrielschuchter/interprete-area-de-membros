"use server";

import { StudyCampaignRenewalMode } from "@repo/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/authorization";
import {
  CommunityGoalConflictError,
  CommunityGoalValidationError,
  renewCommunityGoalManually as renewGoalPeriod,
  saveCommunityGoal as saveGoal,
} from "@/lib/community-goal";

const dateTimeLocalPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/;

const value = (formData: FormData, name: string) => {
  const entry = formData.get(name);
  return typeof entry === "string" ? entry.trim() : "";
};

const parseDateTime = (formData: FormData, name: string) => {
  const input = value(formData, name);
  if (!dateTimeLocalPattern.test(input)) {
    return null;
  }
  const date = new Date(`${input.length === 16 ? `${input}:00` : input}-03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseUpdatedAt = (formData: FormData) => {
  const input = value(formData, "updatedAt");
  if (!input) {
    return undefined;
  }
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const parseTargetMinutes = (formData: FormData) => {
  const targetHours = Number(value(formData, "targetHours"));
  if (!Number.isFinite(targetHours)) {
    return null;
  }
  const minutes = Math.round(targetHours * 60);
  return Math.abs(targetHours * 60 - minutes) < 0.0001 ? minutes : null;
};

const renewalModeSchema = z.nativeEnum(StudyCampaignRenewalMode);

const finishAction = (
  result: "salva" | "renovada" | "conflito" | "invalida"
): never => {
  if (result === "salva" || result === "renovada") {
    revalidatePath("/comunidade");
    revalidatePath("/comunidade/meta");
    revalidatePath("/admin/estudo");
  }
  return redirect(`/comunidade/meta?resultado=${result}`);
};

export const saveCommunityGoal = async (formData: FormData) => {
  const { userId } = await requireStaff();
  const title = value(formData, "title");
  const startsAt = parseDateTime(formData, "startsAt");
  const endsAt = parseDateTime(formData, "endsAt");
  const targetMinutes = parseTargetMinutes(formData);
  const renewalMode = renewalModeSchema.safeParse(
    value(formData, "renewalMode")
  );
  const campaignId = value(formData, "campaignId") || undefined;
  const updatedAt = parseUpdatedAt(formData);

  if (!title) {
    return finishAction("invalida");
  }
  if (!startsAt) {
    return finishAction("invalida");
  }
  if (!endsAt) {
    return finishAction("invalida");
  }
  if (targetMinutes === null) {
    return finishAction("invalida");
  }
  if (!renewalMode.success) {
    return finishAction("invalida");
  }
  if (campaignId && !updatedAt) {
    return finishAction("invalida");
  }

  try {
    await saveGoal(
      {
        campaignId,
        title,
        targetMinutes,
        startsAt,
        endsAt,
        renewalMode: renewalMode.data,
        updatedAt,
      },
      userId
    );
  } catch (error) {
    if (error instanceof CommunityGoalConflictError) {
      return finishAction("conflito");
    }
    if (error instanceof CommunityGoalValidationError) {
      return finishAction("invalida");
    }
    throw error;
  }

  return finishAction("salva");
};

export const renewCommunityGoalManually = async (formData: FormData) => {
  await requireStaff();
  const campaignId = value(formData, "campaignId");
  const startsAt = parseDateTime(formData, "startsAt");
  const endsAt = parseDateTime(formData, "endsAt");
  const updatedAt = parseUpdatedAt(formData);
  if (!campaignId) {
    return finishAction("invalida");
  }
  if (!startsAt) {
    return finishAction("invalida");
  }
  if (!endsAt) {
    return finishAction("invalida");
  }
  if (!updatedAt) {
    return finishAction("invalida");
  }

  try {
    await renewGoalPeriod({ campaignId, startsAt, endsAt, updatedAt });
  } catch (error) {
    if (error instanceof CommunityGoalConflictError) {
      return finishAction("conflito");
    }
    if (error instanceof CommunityGoalValidationError) {
      return finishAction("invalida");
    }
    throw error;
  }

  return finishAction("renovada");
};
