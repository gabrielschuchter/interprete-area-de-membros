import "server-only";

import { database, type Prisma } from "@repo/database";
import { withMemberIdentityLock } from "@repo/member-domain";
import { tracePerformance } from "@repo/observability/performance";
import { cache } from "react";
import { env } from "@/env";
import { getCurrentUser, getMemberIdentitySnapshot } from "./auth";

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

const uniqueUsername = async (
  base: string,
  clerkUserId: string,
  transaction: Prisma.TransactionClient
) => {
  const existing = await transaction.profile.findUnique({
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

const createProfileInTransaction = async (
  transaction: Prisma.TransactionClient,
  data: {
    clerkUserId: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  },
  useFallbackUsername: boolean
) => {
  const username = useFallbackUsername
    ? `${data.username.slice(0, USERNAME_MAX_LENGTH - 9)}-${normalizeUsername(data.clerkUserId).slice(-8) || "member"}`
    : data.username;

  return transaction.profile.create({
    data: {
      ...data,
      username: await uniqueUsername(username, data.clerkUserId, transaction),
      interests: [],
    },
  });
};

const getClerkIdentityForProvisioning = () =>
  tracePerformance("member.profile.clerk-provision", () => getCurrentUser());

const syncMemberIdentity = async (
  transaction: Prisma.TransactionClient,
  clerkUserId: string,
  member: {
    deactivatedAt: Date | null;
    displayName: string | null;
    email: string | null;
    avatarUrl: string | null;
  } | null,
  profileAvatarUrl: string | null | undefined,
  identity: {
    displayName: string | null;
    email: string | null;
    avatarUrl: string | null;
  }
) => {
  if (member?.deactivatedAt) {
    return false;
  }

  const nextAvatarUrl =
    profileAvatarUrl === undefined ? identity.avatarUrl : profileAvatarUrl;
  if (!member) {
    await transaction.member.create({
      data: { id: clerkUserId, ...identity },
    });
    return true;
  }

  if (
    member.displayName !== identity.displayName ||
    member.email !== identity.email ||
    member.avatarUrl !== nextAvatarUrl
  ) {
    await transaction.member.update({
      where: { id: clerkUserId },
      data: { ...identity, avatarUrl: nextAvatarUrl },
    });
  }

  return true;
};

export const getOrCreateProfile = cache(
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the read-only maintenance guard must precede identity synchronization in this cached helper.
  async (userId?: string, syncFromClerk = true) => {
    if (userId && !syncFromClerk) {
      return database.profile.findUnique({ where: { clerkUserId: userId } });
    }

    let knownIdentity:
      | {
          existingProfile: Awaited<
            ReturnType<typeof database.profile.findUnique>
          >;
          memberSnapshot: Awaited<ReturnType<typeof getMemberIdentitySnapshot>>;
        }
      | undefined;

    if (userId) {
      const [memberSnapshot, existingProfile] = await tracePerformance(
        "member.profile.local-snapshot",
        () =>
          Promise.all([
            getMemberIdentitySnapshot(userId),
            database.profile.findUnique({ where: { clerkUserId: userId } }),
          ])
      );
      knownIdentity = { existingProfile, memberSnapshot };

      // Clerk webhooks keep the local identity projection current. Existing
      // members therefore do not need a Backend API round trip on navigation.
      if (memberSnapshot?.deactivatedAt) {
        return existingProfile;
      }
      if (memberSnapshot && existingProfile) {
        return existingProfile;
      }
      if (env.APP_WRITE_FREEZE === "true") {
        return existingProfile;
      }
    }

    if (env.APP_WRITE_FREEZE === "true") {
      const currentUser = await getClerkIdentityForProvisioning();
      const clerkUserId = userId ?? currentUser?.id;
      return clerkUserId
        ? database.profile.findUnique({ where: { clerkUserId } })
        : null;
    }

    const user = await getClerkIdentityForProvisioning();
    const clerkUserId = userId ?? user?.id;

    if (!(user && clerkUserId)) {
      return null;
    }

    const displayName =
      user.fullName ??
      ([user.firstName, user.lastName].filter(Boolean).join(" ") || null);
    const email = user.primaryEmailAddress?.emailAddress ?? null;
    const [memberSnapshot, existingProfile] =
      knownIdentity && clerkUserId === userId
        ? [knownIdentity.memberSnapshot, knownIdentity.existingProfile]
        : await Promise.all([
            getMemberIdentitySnapshot(clerkUserId),
            database.profile.findUnique({ where: { clerkUserId } }),
          ]);

    if (memberSnapshot?.deactivatedAt) {
      return existingProfile;
    }

    const expectedAvatarUrl = existingProfile
      ? existingProfile.avatarUrl
      : (user.imageUrl ?? null);
    if (
      existingProfile &&
      memberSnapshot?.displayName === displayName &&
      memberSnapshot.email === email &&
      memberSnapshot.avatarUrl === expectedAvatarUrl
    ) {
      return existingProfile;
    }

    const createOrSync = (useFallbackUsername: boolean) =>
      tracePerformance("member.profile.identity-sync", () =>
        database.$transaction((transaction) =>
          withMemberIdentityLock(transaction, clerkUserId, async () => {
            const member = await transaction.member.findUnique({
              where: { id: clerkUserId },
              select: {
                deactivatedAt: true,
                displayName: true,
                email: true,
                avatarUrl: true,
              },
            });
            const existing = await transaction.profile.findUnique({
              where: { clerkUserId },
            });

            const isActive = await syncMemberIdentity(
              transaction,
              clerkUserId,
              member,
              existing?.avatarUrl,
              { displayName, email, avatarUrl: user.imageUrl ?? null }
            );

            if (!isActive) {
              return existing;
            }

            if (existing) {
              return existing;
            }

            return createProfileInTransaction(
              transaction,
              {
                clerkUserId,
                username: usernameFromClerkUser(user),
                displayName,
                avatarUrl: user.imageUrl ?? null,
              },
              useFallbackUsername
            );
          })
        )
      );

    try {
      return await createOrSync(false);
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      // A concurrent member may claim the same username. The failed
      // transaction has rolled back before retrying with the Clerk-ID suffix.
      const existing = await database.profile.findUnique({
        where: { clerkUserId },
      });
      if (existing) {
        return existing;
      }
      return createOrSync(true);
    }
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

export const getProfileSummaryStats = cache(async (memberId: string) => {
  const [completedLessons, enrollments, topicCount] = await Promise.all([
    database.lessonProgress.count({ where: { memberId, status: "COMPLETED" } }),
    database.enrollment.count({ where: { memberId } }),
    database.communityPost.count({
      where: { authorId: memberId, deletedAt: null },
    }),
  ]);
  return { completedLessons, enrollments, topicCount };
});

export const getMemberDirectory = (query = "") => {
  const normalizedQuery = query.trim().slice(0, 80);

  return database.profile.findMany({
    where: normalizedQuery
      ? {
          showInDirectory: true,
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
      : { showInDirectory: true },
    orderBy: [{ displayName: "asc" }, { username: "asc" }],
    take: 48,
    select: {
      clerkUserId: true,
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
