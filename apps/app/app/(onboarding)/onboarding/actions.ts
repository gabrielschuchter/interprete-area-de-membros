"use server";

import { auth } from "@repo/auth/server";
import { database, OnboardingStatus, type Prisma } from "@repo/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { OnboardingPreferences } from "@/components/onboarding/types";
import {
  deleteMemberAsset,
  isOwnedMemberAssetPath,
  memberAssetPathFromUrl,
} from "@/lib/member-storage";
import {
  consumeMutationRateLimit,
  isMutationRateLimitError,
  isUniqueConstraintError,
  mutationLog,
} from "@/lib/mutation-reliability";
import {
  getOrCreateProfile,
  isValidUsername,
  normalizeUsername,
} from "@/lib/profile";

type ActionResult =
  | {
      readonly ok: true;
      readonly nextStep?: number;
      readonly completed?: boolean;
    }
  | { readonly ok: false; readonly message: string; readonly field?: string };

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

const optionalUrl = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => {
      if (!value) {
        return true;
      }
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    }, "Use um endereço http:// ou https:// válido.")
    .transform((value) => value || null);

const identitySchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Digite um nome para continuar.")
    .max(80),
  username: z
    .string()
    .trim()
    .transform(normalizeUsername)
    .refine(
      isValidUsername,
      "Escolha um username com pelo menos 3 caracteres."
    ),
});

const avatarSchema = z.object({
  avatarUrl: z
    .string()
    .trim()
    .max(500)
    .refine((value) => {
      if (!value) {
        return true;
      }
      if (value.startsWith("/api/member-assets?path=")) {
        return true;
      }
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    }, "Escolha uma imagem válida ou deixe para depois.")
    .transform((value) => value || null),
});

const contextSchema = z.object({
  headline: optionalText(120),
  bio: optionalText(1200),
  occupation: optionalText(120),
  institution: optionalText(160),
  city: optionalText(80),
  state: optionalText(80),
  country: optionalText(80),
  interests: z
    .string()
    .trim()
    .max(500)
    .transform((value) =>
      value
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 12)
    ),
});

const linksSchema = z.object({
  website: optionalUrl(300),
  instagram: optionalUrl(300),
  linkedin: optionalUrl(300),
});

const preferenceKeys = [
  "mentions",
  "commentReplies",
  "topicComments",
  "followedTopicActivity",
  "lessonAvailable",
  "moduleAvailable",
  "activityAssigned",
  "feedbackReceived",
  "activityDeadline",
  "announcements",
] as const;

const preferencesSchema = z.object(
  Object.fromEntries(preferenceKeys.map((key) => [key, z.boolean()])) as Record<
    (typeof preferenceKeys)[number],
    z.ZodBoolean
  >
);

const asRecord = (value: unknown) =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;

const memberState = async (userId: string) => {
  await getOrCreateProfile(userId);
  return database.member.findUnique({
    where: { id: userId },
    select: {
      onboardingStatus: true,
      onboardingStep: true,
      onboardingStartedAt: true,
    },
  });
};

const saveMemberProgress = async (input: {
  readonly userId: string;
  readonly nextStep: number;
  readonly preferences?: OnboardingPreferences;
  readonly profileData?: Prisma.ProfileUpdateInput;
  readonly avatarUrl?: string | null;
}) => {
  const current = await memberState(input.userId);
  if (!current) {
    return {
      ok: false as const,
      message: "Não conseguimos preparar seu espaço agora.",
    };
  }
  if (current.onboardingStatus === OnboardingStatus.COMPLETED) {
    return { ok: false as const, message: "Seu espaço já está pronto." };
  }

  const now = new Date();
  const profileDisplayName = input.profileData?.displayName;
  const memberDisplayName =
    typeof profileDisplayName === "string" ? profileDisplayName : undefined;
  const profile =
    input.profileData || input.avatarUrl !== undefined
      ? await database.profile.findUnique({
          where: { clerkUserId: input.userId },
          select: { avatarUrl: true },
        })
      : null;
  const nextAvatarPath =
    input.avatarUrl === undefined
      ? null
      : memberAssetPathFromUrl(input.avatarUrl);

  if (nextAvatarPath && !isOwnedMemberAssetPath(nextAvatarPath, input.userId)) {
    return {
      ok: false as const,
      message: "Essa imagem não pertence a esta conta.",
    };
  }

  await database.$transaction(async (transaction) => {
    if (input.profileData) {
      await transaction.profile.update({
        where: { clerkUserId: input.userId },
        data: {
          ...input.profileData,
          ...(input.avatarUrl !== undefined
            ? { avatarUrl: input.avatarUrl }
            : {}),
        },
      });
    } else if (input.avatarUrl !== undefined) {
      await transaction.profile.update({
        where: { clerkUserId: input.userId },
        data: { avatarUrl: input.avatarUrl },
      });
    }

    if (input.avatarUrl !== undefined) {
      await transaction.member.update({
        where: { id: input.userId },
        data: { avatarUrl: input.avatarUrl },
      });
    }

    if (input.preferences) {
      await transaction.notificationPreference.upsert({
        where: { memberId: input.userId },
        create: { memberId: input.userId, ...input.preferences },
        update: input.preferences,
      });
    }

    await transaction.member.update({
      where: { id: input.userId },
      data: {
        onboardingStatus: OnboardingStatus.IN_PROGRESS,
        onboardingStep: Math.max(current.onboardingStep, input.nextStep),
        onboardingStartedAt: current.onboardingStartedAt ?? now,
        ...(memberDisplayName ? { displayName: memberDisplayName } : {}),
      },
    });
  });

  const previousAvatarPath = memberAssetPathFromUrl(profile?.avatarUrl);
  if (
    previousAvatarPath &&
    nextAvatarPath !== null &&
    previousAvatarPath !== nextAvatarPath
  ) {
    await deleteMemberAsset(previousAvatarPath);
  }

  return { ok: true as const, nextStep: input.nextStep };
};

type ParsedStep =
  | {
      readonly ok: true;
      readonly avatarUrl?: string | null;
      readonly preferences?: OnboardingPreferences;
      readonly profileData?: Prisma.ProfileUpdateInput;
    }
  | { readonly ok: false; readonly field: string; readonly message: string };

const parseStepPayload = (
  step: number,
  data: Record<string, unknown>
): ParsedStep => {
  if (step === 1) {
    const parsed = identitySchema.safeParse(data);
    return parsed.success
      ? { ok: true, profileData: parsed.data }
      : {
          ok: false,
          field: parsed.error.issues[0]?.path[0]?.toString() ?? "identity",
          message: parsed.error.issues[0]?.message ?? "Confira seu nome.",
        };
  }

  if (step === 2) {
    const parsed = avatarSchema.safeParse(data);
    return parsed.success
      ? { ok: true, avatarUrl: parsed.data.avatarUrl }
      : {
          ok: false,
          field: "avatarUrl",
          message: parsed.error.issues[0]?.message ?? "Confira a imagem.",
        };
  }

  if (step === 3) {
    const parsed = contextSchema.safeParse(data);
    return parsed.success
      ? { ok: true, profileData: parsed.data }
      : {
          ok: false,
          field: "context",
          message:
            parsed.error.issues[0]?.message ?? "Confira essas informações.",
        };
  }

  if (step === 4) {
    const parsed = linksSchema.safeParse(data);
    return parsed.success
      ? { ok: true, profileData: parsed.data }
      : {
          ok: false,
          field: "links",
          message: parsed.error.issues[0]?.message ?? "Confira seus links.",
        };
  }

  const parsed = preferencesSchema.safeParse(data);
  return parsed.success
    ? { ok: true, preferences: parsed.data }
    : {
        ok: false,
        field: "preferences",
        message: "Escolha suas preferências para continuar.",
      };
};

export const startOnboarding = async (): Promise<ActionResult> => {
  const { userId } = await auth();
  if (!userId) {
    return {
      ok: false,
      message: "Sua sessão terminou. Entre novamente para continuar.",
    };
  }

  try {
    await consumeMutationRateLimit({
      action: "onboarding.save",
      memberId: userId,
    });
    const current = await memberState(userId);
    if (!current) {
      return {
        ok: false,
        message: "Não conseguimos preparar seu espaço agora.",
      };
    }
    if (current.onboardingStatus === OnboardingStatus.COMPLETED) {
      return { ok: true, completed: true };
    }
    await database.member.update({
      where: { id: userId },
      data: {
        onboardingStatus: OnboardingStatus.IN_PROGRESS,
        onboardingStep: Math.max(current.onboardingStep, 1),
        onboardingStartedAt: current.onboardingStartedAt ?? new Date(),
      },
    });
    mutationLog({
      action: "onboarding.save",
      memberId: userId,
      resource: "onboarding",
      status: "success",
    });
    return { ok: true, nextStep: Math.max(current.onboardingStep, 1) };
  } catch (error) {
    if (isMutationRateLimitError(error)) {
      return {
        ok: false,
        message: "Vamos com calma. Tente novamente em alguns segundos.",
      };
    }
    console.error("Onboarding start failed", error);
    return {
      ok: false,
      message: "Não conseguimos começar agora. Tente novamente.",
    };
  }
};

export const saveOnboardingStep = async (
  input: unknown
): Promise<ActionResult> => {
  const { userId } = await auth();
  if (!userId) {
    return {
      ok: false,
      message: "Sua sessão terminou. Entre novamente para continuar.",
    };
  }

  const record = asRecord(input);
  const step = typeof record?.step === "number" ? record.step : 0;
  const data = asRecord(record?.data);
  if (!(record && data && Number.isInteger(step) && step >= 1 && step <= 5)) {
    return { ok: false, message: "Não conseguimos entender essa etapa." };
  }

  try {
    await consumeMutationRateLimit({
      action: "onboarding.save",
      memberId: userId,
    });

    const parsed = parseStepPayload(step, data);
    if (!parsed.ok) {
      return parsed;
    }

    const result = await saveMemberProgress({
      userId,
      nextStep: step + 1,
      preferences: parsed.preferences,
      profileData: parsed.profileData,
      avatarUrl: parsed.avatarUrl,
    });
    if (!result.ok) {
      return result;
    }
    mutationLog({
      action: "onboarding.save",
      memberId: userId,
      resource: "onboarding",
      status: "success",
    });
    return result;
  } catch (error) {
    if (isMutationRateLimitError(error)) {
      return {
        ok: false,
        message: "Vamos com calma. Tente novamente em alguns segundos.",
      };
    }
    if (isUniqueConstraintError(error)) {
      return {
        ok: false,
        field: "username",
        message: "Esse username já está em uso. Escolha outro.",
      };
    }
    console.error("Onboarding step save failed", error);
    mutationLog({
      action: "onboarding.save",
      memberId: userId,
      resource: "onboarding",
      status: "error",
    });
    return {
      ok: false,
      message: "Não conseguimos salvar isso agora. Tente novamente.",
    };
  }
};

export const completeOnboarding = async (): Promise<ActionResult> => {
  const { userId } = await auth();
  if (!userId) {
    return {
      ok: false,
      message: "Sua sessão terminou. Entre novamente para continuar.",
    };
  }

  try {
    await consumeMutationRateLimit({
      action: "onboarding.save",
      memberId: userId,
    });
    const profile = await getOrCreateProfile(userId, false);
    if (!(profile?.displayName?.trim() && isValidUsername(profile.username))) {
      return {
        ok: false,
        field: "identity",
        message: "Só falta confirmar como você quer aparecer por aqui.",
      };
    }

    const current = await database.member.findUnique({
      where: { id: userId },
      select: { onboardingStatus: true },
    });
    if (current?.onboardingStatus === OnboardingStatus.COMPLETED) {
      return { ok: true, completed: true };
    }

    await database.member.update({
      where: { id: userId },
      data: {
        onboardingStatus: OnboardingStatus.COMPLETED,
        onboardingStep: 6,
        onboardingVersion: 1,
        onboardingCompletedAt: new Date(),
      },
    });
    revalidatePath("/", "layout");
    mutationLog({
      action: "onboarding.save",
      memberId: userId,
      resource: "onboarding",
      status: "success",
    });
    return { ok: true, completed: true };
  } catch (error) {
    if (isMutationRateLimitError(error)) {
      return {
        ok: false,
        message: "Vamos com calma. Tente novamente em alguns segundos.",
      };
    }
    console.error("Onboarding completion failed", error);
    return {
      ok: false,
      message: "Não conseguimos concluir seu espaço agora. Tente novamente.",
    };
  }
};
