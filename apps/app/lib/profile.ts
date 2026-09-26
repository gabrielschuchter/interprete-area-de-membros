import "server-only";

import { database } from "@repo/database";
import { cache } from "react";
import { getCurrentUser } from "./auth";

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
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
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

const isUniqueConstraintError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2002";

const createProfileSafely = async (data: {
  clerkUserId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}) => {
  try {
    return await database.profile.create({
      data: {
        ...data,
        interests: [],
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    // Concurrent authenticated requests can race between findUnique and
    // create. Prefer the row that won the race for this Clerk identity.
    const existingProfile = await database.profile.findUnique({
      where: { clerkUserId: data.clerkUserId },
    });

    if (existingProfile) {
      return existingProfile;
    }

    // A different member may have claimed the same generated display name in
    // the same window. The Clerk id suffix keeps the fallback deterministic.
    return database.profile.create({
      data: {
        ...data,
        username: await uniqueUsername(data.username, data.clerkUserId),
        interests: [],
      },
    });
  }
};

export const getOrCreateProfile = cache(
  async (userId?: string, syncFromClerk = true) => {
    if (userId && !syncFromClerk) {
      return database.profile.findUnique({ where: { clerkUserId: userId } });
    }

    const user = await getCurrentUser();
    const clerkUserId = userId ?? user?.id;

    if (!(user && clerkUserId)) {
      return null;
    }

    const displayName =
      user.fullName ??
      ([user.firstName, user.lastName].filter(Boolean).join(" ") || null);
    const email = user.primaryEmailAddress?.emailAddress ?? null;
    const existing = await database.profile.findUnique({
      where: { clerkUserId },
    });
    const avatarUrl = existing?.avatarUrl ?? user.imageUrl ?? null;

    await database.member.upsert({
      where: { id: clerkUserId },
      update: { displayName, email, avatarUrl },
      create: { id: clerkUserId, displayName, email, avatarUrl },
    });

    if (existing) {
      return existing;
    }

    const username = await uniqueUsername(
      usernameFromClerkUser(user),
      clerkUserId
    );

    return createProfileSafely({
      clerkUserId,
      username,
      displayName,
      avatarUrl,
    });
  }
);

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
      member: { select: { role: true } },
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
      member: { select: { role: true } },
    },
  });

export const getMemberDirectory = (query = "") => {
  const normalizedQuery = query.trim().slice(0, 80);

  return database.profile.findMany({
    where: normalizedQuery
      ? {
          OR: [
            {
              username: {
                contains: normalizedQuery.toLowerCase(),
                mode: "insensitive",
              },
            },
            {
              displayName: {
                contains: normalizedQuery,
                mode: "insensitive",
              },
            },
            {
              headline: {
                contains: normalizedQuery,
                mode: "insensitive",
              },
            },
            { interests: { has: normalizedQuery.toLowerCase() } },
          ],
        }
      : undefined,
    orderBy: [{ displayName: "asc" }, { username: "asc" }],
    take: 48,
    select: {
      username: true,
      displayName: true,
      avatarUrl: true,
      headline: true,
      occupation: true,
      interests: true,
      member: { select: { role: true } },
    },
  });
};

export const getStaffMembers = () =>
  database.member.findMany({
    orderBy: [{ role: "desc" }, { displayName: "asc" }, { email: "asc" }],
    select: {
      id: true,
      displayName: true,
      email: true,
      avatarUrl: true,
      role: true,
      createdAt: true,
      profile: {
        select: {
          username: true,
          headline: true,
        },
      },
    },
  });
