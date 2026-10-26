"use server";

import {
  database,
  libraryCatalogCategories,
  OnboardingStatus,
  type Prisma,
} from "@repo/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth, getCurrentUser } from "@/lib/auth";
import {
  createMemberAssetPath,
  deleteMemberAsset,
  isOwnedMemberAssetPath,
  memberAssetPathFromUrl,
  memberAssetUrl,
  uploadMemberAsset,
} from "@/lib/member-storage";
import {
  consumeMutationRateLimit,
  isMutationRateLimitError,
  isUniqueConstraintError,
  mutationLog,
} from "@/lib/mutation-reliability";
import { notificationPreferenceKeys } from "@/lib/notification-preference-groups";
import {
  DISPLAY_NAME_MAX,
  isGenericUsername,
  localUsernameStatus,
  usernameSuggestions,
  validDisplayName,
} from "@/lib/onboarding/identity";
import { normalizeProfileLink } from "@/lib/onboarding/links";
import {
  LAST_STEP_INDEX,
  ONBOARDING_FLOW_VERSION,
  onboardingSteps,
  stepIndex,
} from "@/lib/onboarding/steps";
import type {
  OnboardingResult,
  OnboardingStepPayload,
  SavedStep,
  UsernameCheck,
} from "@/lib/onboarding/types";
import { getOrCreateProfile } from "@/lib/profile";

const BIO_MAX = 240;
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

type Failure = Extract<OnboardingResult, { ok: false }>;

const fail = (
  code: Failure["code"],
  extra?: Omit<Failure, "ok" | "code">
): Failure => ({ ok: false, code, ...extra });

const sessionMemberId = async () => {
  const { userId, memberDeactivated } = await auth();
  return userId && !memberDeactivated ? userId : null;
};

const readProgress = (memberId: string) =>
  database.member.findUnique({
    where: { id: memberId },
    select: {
      onboardingStatus: true,
      onboardingStep: true,
      onboardingStartedAt: true,
    },
  });

// Runs a mutation with the session member, the shared rate limit and the
// error mapping every onboarding action needs.
const withMember = async <T>(
  action: "onboarding.save" | "onboarding.username" | "asset.upload",
  run: (memberId: string) => Promise<OnboardingResult<T>>
): Promise<OnboardingResult<T>> => {
  const memberId = await sessionMemberId();
  if (!memberId) {
    return fail("UNAUTHENTICATED");
  }
  try {
    await consumeMutationRateLimit({ action, memberId });
    return await run(memberId);
  } catch (error) {
    if (isMutationRateLimitError(error)) {
      return fail("RATE_LIMITED");
    }
    if (isUniqueConstraintError(error)) {
      return fail("USERNAME_TAKEN", { field: "username" });
    }
    console.error("Onboarding action failed", error);
    mutationLog({
      action: "onboarding.save",
      memberId,
      resource: "onboarding",
      status: "error",
    });
    return fail("UNAVAILABLE");
  }
};

const advance = async (
  transaction: Prisma.TransactionClient,
  memberId: string,
  current: NonNullable<Awaited<ReturnType<typeof readProgress>>>,
  nextStep: number
) => {
  const reachedStep = Math.min(
    LAST_STEP_INDEX,
    Math.max(current.onboardingStep, nextStep)
  );
  await transaction.member.update({
    where: { id: memberId },
    data: {
      onboardingStatus: OnboardingStatus.IN_PROGRESS,
      onboardingStep: reachedStep,
      onboardingStartedAt: current.onboardingStartedAt ?? new Date(),
    },
  });
  return reachedStep;
};

const usernameAvailability = async (
  memberId: string,
  value: string,
  displayName: string
): Promise<UsernameCheck> => {
  const local = localUsernameStatus(value);
  const suggest = async () => {
    const candidates = usernameSuggestions(
      value,
      displayName,
      new Date().getFullYear()
    );
    if (candidates.length === 0) {
      return [];
    }
    const owners = await database.profile.findMany({
      where: { username: { in: candidates } },
      select: { username: true },
    });
    const taken = new Set(owners.map((owner) => owner.username));
    return candidates.filter((candidate) => !taken.has(candidate)).slice(0, 3);
  };

  if (local === "empty" || local === "short") {
    return { status: "short", suggestions: [] };
  }
  if (local === "invalid") {
    return { status: "invalid", suggestions: [] };
  }
  const owner = await database.profile.findUnique({
    where: { username: value },
    select: { clerkUserId: true },
  });
  if (owner?.clerkUserId === memberId) {
    return { status: "free", suggestions: [] };
  }
  if (local === "reserved") {
    return { status: "reserved", suggestions: await suggest() };
  }
  if (owner) {
    return { status: "taken", suggestions: await suggest() };
  }
  return { status: "free", suggestions: [] };
};

export const checkOnboardingUsername = async (
  value: unknown,
  displayName: unknown
): Promise<OnboardingResult<UsernameCheck>> =>
  withMember("onboarding.username", async (memberId) => {
    if (typeof value !== "string" || value.length > 40) {
      return fail("INVALID");
    }
    return {
      ok: true,
      data: await usernameAvailability(
        memberId,
        value,
        typeof displayName === "string" ? displayName.slice(0, 80) : ""
      ),
    };
  });

export const startOnboarding = async (): Promise<OnboardingResult<SavedStep>> =>
  withMember("onboarding.save", async (memberId) => {
    await getOrCreateProfile(memberId);
    const current = await readProgress(memberId);
    if (!current) {
      return fail("UNAVAILABLE");
    }
    if (current.onboardingStatus === OnboardingStatus.COMPLETED) {
      return { ok: true, data: { reachedStep: LAST_STEP_INDEX } };
    }
    const reachedStep = await database.$transaction((transaction) =>
      advance(transaction, memberId, current, 1)
    );
    return { ok: true, data: { reachedStep } };
  });

const identitySchema = z.object({
  displayName: z.string().trim().max(DISPLAY_NAME_MAX).refine(validDisplayName),
  username: z.string().trim().toLowerCase().max(30),
});

const aboutSchema = z.object({
  occupation: z.string().trim().max(120),
  institution: z.string().trim().max(160),
  bio: z.string().trim().max(BIO_MAX),
  website: z.string().trim().max(300),
  instagram: z.string().trim().max(300),
  linkedin: z.string().trim().max(300),
});

const preferencesSchema = z.object(
  Object.fromEntries(
    notificationPreferenceKeys.map((key) => [key, z.boolean()])
  ) as Record<(typeof notificationPreferenceKeys)[number], z.ZodBoolean>
);

const interestsSchema = z
  .array(z.string())
  .max(libraryCatalogCategories.length)
  .refine((items) =>
    items.every((item) =>
      (libraryCatalogCategories as readonly string[]).includes(item)
    )
  );

const avatarSchema = z.string().trim().max(500).nullable();

// Empty answers mean "no change": an onboarding answer never erases what the
// Perfil already has.
const keepFilled = (value: string) => (value ? value : undefined);

const asRecord = (value: unknown) =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;

export const saveOnboardingStep = async (
  input: unknown
): Promise<OnboardingResult<SavedStep>> =>
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this unit deliberately keeps one step workflow (validation, saving state, offline and session handling) together.
  withMember("onboarding.save", async (memberId) => {
    const record = asRecord(input);
    const step = typeof record?.step === "string" ? record.step : "";
    const index = stepIndex(step);
    if (!record || index < 0 || index === LAST_STEP_INDEX) {
      return fail("INVALID");
    }
    const payload = record as unknown as OnboardingStepPayload;

    const profile = await getOrCreateProfile(memberId);
    const current = await readProgress(memberId);
    if (!(profile && current)) {
      return fail("UNAVAILABLE");
    }
    if (current.onboardingStatus === OnboardingStatus.COMPLETED) {
      return { ok: true, data: { reachedStep: LAST_STEP_INDEX } };
    }

    let profileData: Prisma.ProfileUpdateInput | null = null;
    let memberData: Prisma.MemberUpdateInput | null = null;
    let preferences: Record<string, boolean> | null = null;
    let interests: string[] | null = null;
    let replacedAvatarPath: string | null = null;

    if (payload.step === "identidade") {
      const parsed = identitySchema.safeParse(payload);
      if (!parsed.success) {
        return fail("INVALID", { field: "displayName" });
      }
      const check = await usernameAvailability(
        memberId,
        parsed.data.username,
        parsed.data.displayName
      );
      if (check.status === "taken" || check.status === "reserved") {
        return fail(
          check.status === "taken" ? "USERNAME_TAKEN" : "USERNAME_RESERVED",
          { field: "username", suggestions: check.suggestions }
        );
      }
      if (check.status !== "free") {
        return fail("INVALID", { field: "username" });
      }
      profileData = {
        displayName: parsed.data.displayName,
        username: parsed.data.username,
      };
      memberData = { displayName: parsed.data.displayName };
    } else if (payload.step === "foto") {
      const parsed = avatarSchema.safeParse(payload.avatarUrl);
      if (!parsed.success) {
        return fail("INVALID", { field: "avatarUrl" });
      }
      const next = parsed.data || null;
      if (next !== profile.avatarUrl) {
        const nextPath = memberAssetPathFromUrl(next);
        // A new photo must be one this member just uploaded through the
        // member-assets route; removing (null) is always allowed.
        if (next && !(nextPath && isOwnedMemberAssetPath(nextPath, memberId))) {
          return fail("INVALID", { field: "avatarUrl" });
        }
        profileData = { avatarUrl: next };
        memberData = { avatarUrl: next };
        replacedAvatarPath = memberAssetPathFromUrl(profile.avatarUrl);
      }
    } else if (payload.step === "sobre") {
      const parsed = aboutSchema.safeParse(payload);
      if (!parsed.success) {
        return fail("INVALID", { field: "bio" });
      }
      const links = {
        website: normalizeProfileLink("website", parsed.data.website),
        instagram: normalizeProfileLink("instagram", parsed.data.instagram),
        linkedin: normalizeProfileLink("linkedin", parsed.data.linkedin),
      };
      const invalidLink = Object.entries(links).find(([, url]) => url === null);
      if (invalidLink) {
        return fail("INVALID", { field: invalidLink[0] });
      }
      profileData = {
        occupation: keepFilled(parsed.data.occupation),
        institution: keepFilled(parsed.data.institution),
        bio: keepFilled(parsed.data.bio),
        website: keepFilled(links.website ?? ""),
        instagram: keepFilled(links.instagram ?? ""),
        linkedin: keepFilled(links.linkedin ?? ""),
      };
    } else if (payload.step === "interesses") {
      const parsed = interestsSchema.safeParse(payload.interests);
      if (!parsed.success) {
        return fail("INVALID", { field: "interests" });
      }
      // Interests typed in the Perfil that are not Library categories stay.
      const categories = new Set<string>(libraryCatalogCategories);
      interests = [
        ...new Set([
          ...parsed.data,
          ...profile.interests.filter((interest) => !categories.has(interest)),
        ]),
      ];
      profileData = { interests };
    } else if (payload.step === "avisos") {
      const parsed = preferencesSchema.safeParse(payload.preferences);
      if (!parsed.success) {
        return fail("INVALID", { field: "preferences" });
      }
      preferences = parsed.data;
    }

    const reachedStep = await database.$transaction(async (transaction) => {
      if (profileData) {
        await transaction.profile.update({
          where: { clerkUserId: memberId },
          data: profileData,
        });
      }
      if (memberData) {
        await transaction.member.update({
          where: { id: memberId },
          data: memberData,
        });
      }
      if (preferences) {
        await transaction.notificationPreference.upsert({
          where: { memberId },
          create: { memberId, ...preferences },
          update: preferences,
        });
      }
      return advance(transaction, memberId, current, index + 1);
    });

    if (replacedAvatarPath) {
      // The previous photo goes only after the new one is saved.
      await deleteMemberAsset(replacedAvatarPath).catch(() => false);
    }
    if (payload.step === "identidade" && profileData) {
      revalidatePath(`/membros/${profile.username}`);
      revalidatePath("/membros");
    }
    mutationLog({
      action: "onboarding.save",
      memberId,
      resource: "onboarding",
      status: "success",
    });
    return { ok: true, data: { reachedStep } };
  });

export const skipOnboardingStep = async (
  step: unknown
): Promise<OnboardingResult<SavedStep>> =>
  withMember("onboarding.save", async (memberId) => {
    const index = typeof step === "string" ? stepIndex(step) : -1;
    if (index < 0 || !onboardingSteps[index].skippable) {
      return fail("NOT_SKIPPABLE");
    }
    const current = await readProgress(memberId);
    if (!current) {
      return fail("UNAVAILABLE");
    }
    if (current.onboardingStatus === OnboardingStatus.COMPLETED) {
      return { ok: true, data: { reachedStep: LAST_STEP_INDEX } };
    }
    const reachedStep = await database.$transaction((transaction) =>
      advance(transaction, memberId, current, index + 1)
    );
    return { ok: true, data: { reachedStep } };
  });

const imageType = (bytes: Uint8Array) => {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value
    )
  ) {
    return "image/png";
  }
  if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
};

// "Usar a foto da minha conta": copies the Clerk photo into the member's own
// storage so the Perfil never depends on an external address. The Perfil
// changes only when the person continues from the photo step.
export const importAccountPhoto = async (): Promise<
  OnboardingResult<{ readonly url: string }>
> =>
  withMember("asset.upload", async (memberId) => {
    const user = await getCurrentUser();
    if (!(user?.id === memberId && user.hasImage && user.imageUrl)) {
      return fail("NO_ACCOUNT_PHOTO");
    }
    const source = new URL(user.imageUrl);
    if (source.protocol !== "https:") {
      return fail("NO_ACCOUNT_PHOTO");
    }
    source.searchParams.set("width", "512");
    const response = await fetch(source, { cache: "no-store" });
    if (!response.ok) {
      return fail("NO_ACCOUNT_PHOTO");
    }
    const body = await response.arrayBuffer();
    const mimeType = imageType(new Uint8Array(body.slice(0, 12)));
    if (
      !mimeType ||
      body.byteLength === 0 ||
      body.byteLength > AVATAR_MAX_BYTES
    ) {
      return fail("NO_ACCOUNT_PHOTO");
    }
    const storagePath = createMemberAssetPath({
      kind: "avatar",
      memberId,
      mimeType,
    });
    if (!storagePath) {
      return fail("NO_ACCOUNT_PHOTO");
    }
    await uploadMemberAsset({ storagePath, body, mimeType });
    return { ok: true, data: { url: memberAssetUrl(storagePath) } };
  });

export const completeOnboarding = async (): Promise<OnboardingResult> =>
  withMember("onboarding.save", async (memberId) => {
    const [profile, current] = await Promise.all([
      getOrCreateProfile(memberId, false),
      database.member.findUnique({
        where: { id: memberId },
        select: { onboardingStatus: true },
      }),
    ]);
    if (current?.onboardingStatus === OnboardingStatus.COMPLETED) {
      return { ok: true, data: undefined };
    }
    if (
      !(
        profile &&
        validDisplayName(profile.displayName ?? "") &&
        !isGenericUsername(profile.username) &&
        localUsernameStatus(profile.username) !== "invalid"
      )
    ) {
      return fail("INCOMPLETE_REQUIRED");
    }
    await database.member.update({
      where: { id: memberId },
      data: {
        onboardingStatus: OnboardingStatus.COMPLETED,
        onboardingStep: LAST_STEP_INDEX,
        onboardingVersion: ONBOARDING_FLOW_VERSION,
        onboardingCompletedAt: new Date(),
      },
    });
    revalidatePath("/", "layout");
    mutationLog({
      action: "onboarding.save",
      memberId,
      resource: "onboarding",
      status: "success",
    });
    return { ok: true, data: undefined };
  });
