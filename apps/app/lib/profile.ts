import "server-only";

import { currentUser } from "@repo/auth/server";
import { database } from "@repo/database";

const USERNAME_MAX_LENGTH = 30;
const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/;

export const normalizeUsername = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, USERNAME_MAX_LENGTH)
    .replace(/-+$/g, "");

export const isValidUsername = (value: string) =>
  value.length >= 3 &&
  value.length <= USERNAME_MAX_LENGTH &&
  USERNAME_PATTERN.test(value);

const usernameFromClerkUser = (
  user: NonNullable<Awaited<ReturnType<typeof currentUser>>>
) => {
  const preferredName =
    user.fullName ??
    [user.firstName, user.lastName].filter(Boolean).join(" ") ??
    user.primaryEmailAddress?.emailAddress.split("@")[0] ??
    "membro";
  const normalized = normalizeUsername(preferredName) || "membro";
  return normalized.length >= 3
    ? normalized
    : `${normalized}-membro`.slice(0, USERNAME_MAX_LENGTH);
};

const uniqueUsername = async (base: string, clerkUserId: string) => {
  const existing = await database.profile.findUnique({
    where: { username: base },
    select: { clerkUserId: true },
  });

  if (!existing || existing.clerkUserId === clerkUserId) {
    return base;
  }

  const suffix = normalizeUsername(clerkUserId).slice(-6) || "member";
  const prefix = base
    .slice(0, USERNAME_MAX_LENGTH - suffix.length - 1)
    .replace(/-+$/g, "");
  return `${prefix}-${suffix}`.slice(0, USERNAME_MAX_LENGTH);
};

export const getOrCreateProfile = async (userId?: string) => {
  const user = await currentUser();
  const clerkUserId = userId ?? user?.id;

  if (!(user && clerkUserId)) {
    return null;
  }

  const displayName =
    user.fullName ??
    ([user.firstName, user.lastName].filter(Boolean).join(" ") || null);
  const email = user.primaryEmailAddress?.emailAddress ?? null;
  const avatarUrl = user.imageUrl ?? null;

  await database.member.upsert({
    where: { id: clerkUserId },
    update: { displayName, email, avatarUrl },
    create: { id: clerkUserId, displayName, email, avatarUrl },
  });

  const existing = await database.profile.findUnique({
    where: { clerkUserId },
  });

  if (existing) {
    return existing;
  }

  const username = await uniqueUsername(
    usernameFromClerkUser(user),
    clerkUserId
  );

  return database.profile.create({
    data: {
      clerkUserId,
      username,
      displayName,
      avatarUrl,
      interests: [],
    },
  });
};

export const getProfilesByClerkIds = async (
  clerkUserIds: readonly string[]
) => {
  const ids = [...new Set(clerkUserIds.filter(Boolean))];

  if (ids.length === 0) {
    return new Map();
  }

  const profiles = await database.profile.findMany({
    where: { clerkUserId: { in: ids } },
    select: {
      clerkUserId: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      headline: true,
    },
  });

  return new Map(profiles.map((profile) => [profile.clerkUserId, profile]));
};

export const getPublicProfile = async (username: string) =>
  database.profile.findUnique({
    where: { username: username.toLowerCase() },
    select: {
      clerkUserId: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      headline: true,
      bio: true,
      occupation: true,
      institution: true,
      city: true,
      state: true,
      country: true,
      website: true,
      instagram: true,
      linkedin: true,
      interests: true,
      createdAt: true,
    },
  });
