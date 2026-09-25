"use server";

import { auth } from "@repo/auth/server";
import { database } from "@repo/database";
import { redirect } from "next/navigation";
import { z } from "zod";
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

const profileSchema = z.object({
  username: z.string().trim().toLowerCase().max(30),
  avatarUrl: optionalUrl(500),
  displayName: optionalText(80),
  headline: optionalText(120),
  bio: optionalText(1200),
  occupation: optionalText(120),
  institution: optionalText(160),
  city: optionalText(80),
  state: optionalText(80),
  country: optionalText(80),
  website: optionalUrl(300),
  instagram: optionalUrl(300),
  linkedin: optionalUrl(300),
  interests: z.string().trim().max(500),
});

const value = (formData: FormData, name: string) => {
  const entry = formData.get(name);
  return typeof entry === "string" ? entry : "";
};

export const updateProfile = async (formData: FormData) => {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

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
  });

  if (!(parsed.success && isValidUsername(parsed.data.username))) {
    redirect("/perfil?error=username");
  }

  const existing = await getOrCreateProfile(userId);

  if (!existing) {
    redirect("/sign-in");
  }

  const interests = parsed.data.interests
    .split(",")
    .map((interest) => interest.trim())
    .filter(Boolean)
    .slice(0, 12);

  try {
    await database.profile.update({
      where: { clerkUserId: userId },
      data: {
        username: parsed.data.username,
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
    });
  } catch {
    redirect("/perfil?error=username");
  }

  redirect("/perfil?saved=1");
};
