import { analytics } from "@repo/analytics/server";
import type {
  DeletedObjectJSON,
  OrganizationJSON,
  OrganizationMembershipJSON,
  UserJSON,
  WebhookEvent,
} from "@repo/auth/server";
import { database, type Prisma } from "@repo/database";
import { withMemberIdentityLock } from "@repo/member-domain";
import { log } from "@repo/observability/log";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { env } from "@/env";

const normalizeUsername = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");

const getUserFields = (data: UserJSON) => {
  const displayName =
    data.first_name || data.last_name
      ? [data.first_name, data.last_name].filter(Boolean).join(" ")
      : null;
  const email = data.email_addresses.at(0)?.email_address ?? null;
  const avatarUrl = data.image_url ?? null;
  const base =
    normalizeUsername(
      data.username ?? displayName ?? email?.split("@")[0] ?? data.id
    ) || "membro";
  const suffix = normalizeUsername(data.id).slice(-8) || "member";
  const fallback = `${base.slice(0, 30 - suffix.length - 1)}-${suffix}`;

  return {
    displayName,
    email,
    avatarUrl,
    username: base.length >= 3 ? base : `membro-${suffix}`.slice(0, 30),
    fallbackUsername: fallback.slice(0, 30).replace(/-+$/g, ""),
  };
};

const syncMemberProfileInTransaction = async (
  transaction: Prisma.TransactionClient,
  data: UserJSON,
  useFallbackUsername = false
) => {
  const fields = getUserFields(data);
  const existingMember = await transaction.member.findUnique({
    where: { id: data.id },
    select: { deactivatedAt: true },
  });

  if (existingMember?.deactivatedAt) {
    return false;
  }

  await transaction.member.upsert({
    where: { id: data.id },
    update: {
      displayName: fields.displayName,
      email: fields.email,
      avatarUrl: fields.avatarUrl,
    },
    create: {
      id: data.id,
      displayName: fields.displayName,
      email: fields.email,
      avatarUrl: fields.avatarUrl,
    },
  });

  const existing = await transaction.profile.findUnique({
    where: { clerkUserId: data.id },
    select: { id: true, username: true, displayName: true, avatarUrl: true },
  });

  if (existing) {
    const profileUpdate = {
      ...(existing.displayName ? {} : { displayName: fields.displayName }),
      ...(existing.avatarUrl ? {} : { avatarUrl: fields.avatarUrl }),
    };

    if (Object.keys(profileUpdate).length > 0) {
      await transaction.profile.update({
        where: { id: existing.id },
        data: profileUpdate,
      });
    }
    return true;
  }

  await transaction.profile.create({
    data: {
      clerkUserId: data.id,
      username: useFallbackUsername ? fields.fallbackUsername : fields.username,
      displayName: fields.displayName,
      avatarUrl: fields.avatarUrl,
      interests: [],
    },
  });

  return true;
};

const isUniqueConstraintError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2002";

const syncMemberProfile = async (data: UserJSON) => {
  const sync = (useFallbackUsername: boolean) =>
    database.$transaction((transaction) =>
      withMemberIdentityLock(transaction, data.id, () =>
        syncMemberProfileInTransaction(transaction, data, useFallbackUsername)
      )
    );

  try {
    return await sync(false);
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    // The first transaction is rolled back before retrying with the stable
    // Clerk-ID suffix, so a profile conflict cannot leave an aborted tx open.
    return sync(true);
  }
};

const deactivateMember = async (memberId: string) => {
  await database.$transaction((transaction) =>
    withMemberIdentityLock(transaction, memberId, async () => {
      const existing = await transaction.member.findUnique({
        where: { id: memberId },
        select: { deactivatedAt: true },
      });

      if (existing?.deactivatedAt) {
        return;
      }

      const now = new Date();
      await transaction.member.upsert({
        where: { id: memberId },
        update: {
          deactivatedAt: now,
          displayName: "Membro removido",
          email: null,
          avatarUrl: null,
        },
        create: {
          id: memberId,
          deactivatedAt: now,
          displayName: "Membro removido",
        },
      });

      await transaction.profile.updateMany({
        where: { clerkUserId: memberId },
        data: {
          displayName: "Membro removido",
          avatarUrl: null,
          headline: null,
          bio: null,
          occupation: null,
          institution: null,
          city: null,
          state: null,
          country: null,
          website: null,
          instagram: null,
          linkedin: null,
          interests: [],
        },
      });
    })
  );
};

const handleUserCreated = async (data: UserJSON) => {
  const isActive = await syncMemberProfile(data);
  if (!isActive) {
    return new Response("User is deactivated", { status: 201 });
  }
  analytics?.identify({
    distinctId: data.id,
    properties: {
      email: data.email_addresses.at(0)?.email_address,
      firstName: data.first_name,
      lastName: data.last_name,
      createdAt: new Date(data.created_at),
      avatar: data.image_url,
      phoneNumber: data.phone_numbers.at(0)?.phone_number,
    },
  });

  analytics?.capture({
    event: "User Created",
    distinctId: data.id,
  });

  return new Response("User created", { status: 201 });
};

const handleUserUpdated = async (data: UserJSON) => {
  const isActive = await syncMemberProfile(data);
  if (!isActive) {
    return new Response("User is deactivated", { status: 201 });
  }
  analytics?.identify({
    distinctId: data.id,
    properties: {
      email: data.email_addresses.at(0)?.email_address,
      firstName: data.first_name,
      lastName: data.last_name,
      createdAt: new Date(data.created_at),
      avatar: data.image_url,
      phoneNumber: data.phone_numbers.at(0)?.phone_number,
    },
  });

  analytics?.capture({
    event: "User Updated",
    distinctId: data.id,
  });

  return new Response("User updated", { status: 201 });
};

const handleUserDeleted = async (data: DeletedObjectJSON) => {
  if (data.id) {
    // Keep historical records and their author identity while removing the
    // member's ability to authenticate and redact direct profile details.
    await deactivateMember(data.id);

    analytics?.identify({
      distinctId: data.id,
      properties: {
        deleted: new Date(),
      },
    });

    analytics?.capture({
      event: "User Deleted",
      distinctId: data.id,
    });
  }

  return new Response("User deleted", { status: 201 });
};

const handleOrganizationCreated = (data: OrganizationJSON) => {
  analytics?.groupIdentify({
    groupKey: data.id,
    groupType: "company",
    distinctId: data.created_by,
    properties: {
      name: data.name,
      avatar: data.image_url,
    },
  });

  if (data.created_by) {
    analytics?.capture({
      event: "Organization Created",
      distinctId: data.created_by,
    });
  }

  return new Response("Organization created", { status: 201 });
};

const handleOrganizationUpdated = (data: OrganizationJSON) => {
  analytics?.groupIdentify({
    groupKey: data.id,
    groupType: "company",
    distinctId: data.created_by,
    properties: {
      name: data.name,
      avatar: data.image_url,
    },
  });

  if (data.created_by) {
    analytics?.capture({
      event: "Organization Updated",
      distinctId: data.created_by,
    });
  }

  return new Response("Organization updated", { status: 201 });
};

const handleOrganizationMembershipCreated = (
  data: OrganizationMembershipJSON
) => {
  analytics?.groupIdentify({
    groupKey: data.organization.id,
    groupType: "company",
    distinctId: data.public_user_data.user_id,
  });

  analytics?.capture({
    event: "Organization Member Created",
    distinctId: data.public_user_data.user_id,
  });

  return new Response("Organization membership created", { status: 201 });
};

const handleOrganizationMembershipDeleted = (
  data: OrganizationMembershipJSON
) => {
  // Need to unlink the user from the group

  analytics?.capture({
    event: "Organization Member Deleted",
    distinctId: data.public_user_data.user_id,
  });

  return new Response("Organization membership deleted", { status: 201 });
};

export const POST = async (request: Request): Promise<Response> => {
  if (!env.CLERK_WEBHOOK_SIGNING_SECRET) {
    return NextResponse.json(
      { message: "Not configured", ok: false },
      { status: 503 }
    );
  }

  // Get the headers
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!(svixId && svixTimestamp && svixSignature)) {
    return new Response("Error occured -- no svix headers", {
      status: 400,
    });
  }

  // Get the body
  const body = await request.text();

  // Create a new SVIX instance with your secret.
  const webhook = new Webhook(env.CLERK_WEBHOOK_SIGNING_SECRET);

  let event: WebhookEvent | undefined;

  // Verify the payload with the headers
  try {
    event = webhook.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch (error) {
    log.error("Error verifying webhook:", { error });
    return new Response("Error occured", {
      status: 400,
    });
  }

  // Get the ID and type
  const { id } = event.data;
  const eventType = event.type;

  log.info("Webhook", { id, eventType });

  let response: Response = new Response("", { status: 201 });

  switch (eventType) {
    case "user.created": {
      response = await handleUserCreated(event.data);
      break;
    }
    case "user.updated": {
      response = await handleUserUpdated(event.data);
      break;
    }
    case "user.deleted": {
      response = await handleUserDeleted(event.data);
      break;
    }
    case "organization.created": {
      response = handleOrganizationCreated(event.data);
      break;
    }
    case "organization.updated": {
      response = handleOrganizationUpdated(event.data);
      break;
    }
    case "organizationMembership.created": {
      response = handleOrganizationMembershipCreated(event.data);
      break;
    }
    case "organizationMembership.deleted": {
      response = handleOrganizationMembershipDeleted(event.data);
      break;
    }
    default: {
      break;
    }
  }

  await analytics?.shutdown();

  return response;
};
