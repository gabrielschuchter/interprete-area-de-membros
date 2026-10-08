"use server";

import {
  CommunitySpaceInvitationStatus,
  CommunitySpaceMemberRole,
  database,
} from "@repo/database";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  deleteMemberAsset,
  isOwnedMemberAssetPath,
  memberAssetPathFromUrl,
} from "@/lib/member-storage";
import { consumeMutationRateLimit } from "@/lib/mutation-reliability";
import {
  getOrCreateProfile,
  isValidUsername,
  normalizeUsername,
} from "@/lib/profile";

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

const optionalAvatar = z
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
  }, "Use uma imagem enviada ou um endereço http:// ou https:// válido.")
  .transform((value) => value || null);

const profileSchema = z.object({
  username: z.string().trim().toLowerCase().max(30),
  avatarUrl: optionalAvatar,
  displayName: optionalText(80),
  headline: optionalText(60),
  bio: optionalText(280),
  occupation: optionalText(120),
  institution: optionalText(160),
  city: optionalText(80),
  state: optionalText(80),
  country: optionalText(80),
  website: optionalUrl(300),
  instagram: optionalUrl(300),
  linkedin: optionalUrl(300),
  interests: z.string().trim().max(500),
  showInDirectory: z.boolean(),
});

export interface ProfileUpdateState {
  readonly fieldErrors?: Partial<Record<string, string>>;
  readonly message?: string;
  readonly status: "idle" | "error" | "success";
}

const value = (formData: FormData, name: string) => {
  const entry = formData.get(name);
  return typeof entry === "string" ? entry : "";
};

export const updateProfile = async (
  _previousState: ProfileUpdateState,
  formData: FormData
): Promise<ProfileUpdateState> => {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  await consumeMutationRateLimit({
    action: "profile.update",
    memberId: userId,
  });

  const parsed = profileSchema.safeParse({
    username: normalizeUsername(value(formData, "username")),
    avatarUrl: value(formData, "avatarUrl"),
    displayName: value(formData, "displayName"),
    headline: value(formData, "headline"),
    bio: value(formData, "bio"),
    occupation: value(formData, "occupation"),
    institution: value(formData, "institution"),
    city: value(formData, "city"),
    state: value(formData, "state"),
    country: value(formData, "country"),
    website: value(formData, "website"),
    instagram: value(formData, "instagram"),
    linkedin: value(formData, "linkedin"),
    interests: value(formData, "interests"),
    showInDirectory: value(formData, "showInDirectory") === "true",
  });

  if (!(parsed.success && isValidUsername(parsed.data.username))) {
    return {
      fieldErrors: parsed.success
        ? { username: "Use de 3 a 30 caracteres: letras, números e hífens." }
        : Object.fromEntries(
            Object.entries(parsed.error.flatten().fieldErrors).map(
              ([field, messages]) => [
                field,
                messages?.[0] ?? "Confira este campo.",
              ]
            )
          ),
      message: "Revise os campos destacados.",
      status: "error",
    };
  }

  const existing = await getOrCreateProfile(userId);

  if (!existing) {
    redirect("/sign-in");
  }

  const nextAvatarPath = memberAssetPathFromUrl(parsed.data.avatarUrl);
  if (nextAvatarPath && !isOwnedMemberAssetPath(nextAvatarPath, userId)) {
    return {
      fieldErrors: { avatarUrl: "A foto enviada não pertence a este perfil." },
      message: "Escolha outra foto para continuar.",
      status: "error",
    };
  }

  const interests = parsed.data.interests
    .split(",")
    .map((interest) => interest.trim())
    .filter(Boolean)
    .slice(0, 12);

  try {
    await database.$transaction([
      database.profile.update({
        where: { clerkUserId: userId },
        data: {
          username: parsed.data.username,
          showInDirectory: parsed.data.showInDirectory,
          avatarUrl: parsed.data.avatarUrl,
          displayName: parsed.data.displayName,
          headline: parsed.data.headline,
          bio: parsed.data.bio,
          occupation: parsed.data.occupation,
          institution: parsed.data.institution,
          city: parsed.data.city,
          state: parsed.data.state,
          country: parsed.data.country,
          website: parsed.data.website,
          instagram: parsed.data.instagram,
          linkedin: parsed.data.linkedin,
          interests,
        },
      }),
      database.member.update({
        where: { id: userId },
        data: { avatarUrl: parsed.data.avatarUrl },
      }),
    ]);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return {
        fieldErrors: { username: "Este username já está em uso." },
        message: "Escolha outro endereço para seu perfil.",
        status: "error",
      };
    }
    throw error;
  }

  const previousAvatarPath = memberAssetPathFromUrl(existing.avatarUrl);
  if (previousAvatarPath && previousAvatarPath !== nextAvatarPath) {
    try {
      await deleteMemberAsset(previousAvatarPath);
    } catch {
      // A cleanup error must not report a failed profile save after commit.
    }
  }

  revalidatePath("/perfil");
  revalidatePath("/membros");
  revalidatePath(`/membros/${existing.username}`);
  revalidatePath(`/membros/${parsed.data.username}`);
  return { message: "Perfil atualizado.", status: "success" };
};

export const respondToStudyGroupInvitation = async (formData: FormData) => {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }
  const invitationId = value(formData, "invitationId").trim();
  const response = value(formData, "response").trim();
  if (!invitationId || (response !== "ACCEPTED" && response !== "DECLINED")) {
    return;
  }
  await consumeMutationRateLimit({
    action: "community.group.invitation.respond",
    memberId: userId,
  });
  const invitation = await database.$transaction(async (transaction) => {
    const current = await transaction.communitySpaceInvitation.findFirst({
      where: {
        id: invitationId,
        inviteeId: userId,
        status: CommunitySpaceInvitationStatus.PENDING,
        space: { is: { status: "PUBLISHED" } },
      },
      select: {
        id: true,
        spaceId: true,
        space: { select: { slug: true } },
      },
    });
    if (!current) {
      return null;
    }
    const result = await transaction.communitySpaceInvitation.updateMany({
      where: {
        id: current.id,
        inviteeId: userId,
        status: CommunitySpaceInvitationStatus.PENDING,
      },
      data: {
        status: response,
        respondedAt: new Date(),
      },
    });
    if (result.count !== 1) {
      return null;
    }
    if (response === "ACCEPTED") {
      await transaction.communitySpaceMember.upsert({
        where: {
          spaceId_memberId: { spaceId: current.spaceId, memberId: userId },
        },
        create: {
          spaceId: current.spaceId,
          memberId: userId,
          role: CommunitySpaceMemberRole.MEMBER,
        },
        update: {},
      });
    }
    return current;
  });
  if (invitation) {
    revalidatePath("/perfil");
    revalidatePath("/comunidade");
    revalidatePath(`/comunidade/${invitation.space.slug}`);
  }
};
