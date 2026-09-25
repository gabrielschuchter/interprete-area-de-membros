import { analytics } from "@repo/analytics/server";
import type {
  DeletedObjectJSON,
  OrganizationJSON,
  OrganizationMembershipJSON,
  UserJSON,
  WebhookEvent,
} from "@repo/auth/server";
import { database } from "@repo/database";
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

const syncMemberProfile = async (data: UserJSON) => {
  const fields = getUserFields(data);

  await database.member.upsert({
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

  const existing = await database.profile.findUnique({
    where: { clerkUserId: data.id },
    select: { id: true, username: true, displayName: true, avatarUrl: true },
  });

  if (existing) {
    const profileUpdate = {
      ...(existing.displayName ? {} : { displayName: fields.displayName }),
      ...(existing.avatarUrl ? {} : { avatarUrl: fields.avatarUrl }),
    };

    if (Object.keys(profileUpdate).length > 0) {
      await database.profile.update({
        where: { id: existing.id },
        data: profileUpdate,
      });
    }
    return;
  }

  try {
    await database.profile.create({
      data: {
        clerkUserId: data.id,
        username: fields.username,
        displayName: fields.displayName,
        avatarUrl: fields.avatarUrl,
        interests: [],
      },
    });
  } catch {
    // A concurrent request may have claimed the candidate username. The
    // deterministic fallback keeps webhook delivery idempotent without
    // overwriting an existing member profile.
    const created = await database.profile.findUnique({
      where: { clerkUserId: data.id },
      select: { id: true },
    });

    if (created) {
      return;
    }

    await database.profile.create({
      data: {
        clerkUserId: data.id,
        username: fields.fallbackUsername,
        displayName: fields.displayName,
        avatarUrl: fields.avatarUrl,
        interests: [],
      },
    });
  }
};

const handleUserCreated = async (data: UserJSON) => {
  await syncMemberProfile(data);
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
  await syncMemberProfile(data);
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

const handleUserDeleted = (data: DeletedObjectJSON) => {
  if (data.id) {
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
      response = handleUserDeleted(event.data);
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
