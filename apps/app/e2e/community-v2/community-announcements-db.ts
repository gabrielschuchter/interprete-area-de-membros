import { readFileSync } from "node:fs";
import { database } from "@repo/database";

interface Request {
  readonly input: Record<string, unknown>;
  readonly operation: string;
}

const runId = process.env.COMMUNITY_QA_RUN_ID ?? "";
const databaseUrl = new URL(process.env.DATABASE_URL ?? "http://invalid.local");
if (
  process.env.COMMUNITY_QA_ISOLATED !== "true" ||
  !["announcements", "full"].includes(process.env.COMMUNITY_QA_SUITE ?? "") ||
  !/^\d{8}-\d{6}-[a-f0-9]{8}$/.test(runId) ||
  databaseUrl.hostname !== "127.0.0.1" ||
  databaseUrl.port !== "54325" ||
  databaseUrl.pathname.slice(1) !== "interprete_community_v2_qa" ||
  databaseUrl.username !== "community_qa"
) {
  throw new Error("Announcement E2E requires the guarded local QA database.");
}

const query = async ({ operation, input }: Request) => {
  switch (operation) {
    case "prepare": {
      const adminId = input.adminId as string;
      const memberId = input.memberId as string;
      const cohort = await database.$transaction(async (tx) => {
        const created = await tx.cohort.create({
          data: {
            name: `Avisos QA ${runId}`,
            normalizedName: `avisos-qa-${runId}`,
            slug: `avisos-qa-${runId}`,
            startsAt: new Date(Date.now() - 60_000),
            createdByMemberId: adminId,
          },
          select: { id: true, name: true },
        });
        await tx.cohortMembership.create({
          data: {
            activeKey: `${encodeURIComponent(created.id)}:${encodeURIComponent(memberId)}`,
            cohortId: created.id,
            memberId,
            createdByMemberId: adminId,
          },
          select: { id: true },
        });
        return created;
      });
      const members = await database.member.findMany({
        where: {
          id: {
            in: [
              memberId,
              input.secondaryMemberId as string,
              input.teacherId as string,
              adminId,
            ],
          },
          deactivatedAt: null,
        },
        select: {
          id: true,
          role: true,
          displayName: true,
          profile: { select: { displayName: true, username: true } },
        },
      });
      return { cohort, members };
    }
    case "announcement":
      return database.announcement.findFirst({
        where: { title: input.title as string, deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          body: true,
          audience: true,
          recipientIds: true,
          status: true,
          startsAt: true,
          endsAt: true,
          isImportant: true,
          version: true,
          cohorts: { select: { cohortId: true } },
          notifications: {
            select: {
              memberId: true,
              announcementId: true,
              announcementVersion: true,
            },
          },
        },
      });
    case "dismissal":
      return database.announcementDismissal.findUnique({
        where: {
          announcementId_memberId_announcementVersion: {
            announcementId: input.announcementId as string,
            memberId: input.memberId as string,
            announcementVersion: input.version as number,
          },
        },
        select: { dismissedAt: true, announcementVersion: true },
      });
    case "set-window":
      return database.announcement.update({
        where: { id: input.announcementId as string },
        data: {
          ...(typeof input.startsAt === "string"
            ? { startsAt: new Date(input.startsAt) }
            : {}),
          ...(typeof input.endsAt === "string"
            ? { endsAt: new Date(input.endsAt) }
            : {}),
        },
        select: { id: true, startsAt: true, endsAt: true, version: true },
      });
    case "outbox": {
      const events = await database.domainEvent.findMany({
        where: {
          eventType: "notifications.batch_requested",
          aggregateType: "announcement",
          aggregateId: input.announcementId as string,
        },
        orderBy: { occurredAt: "desc" },
        take: 10,
        select: {
          idempotencyKey: true,
          payload: true,
          jobs: { select: { consumerKey: true, status: true } },
        },
      });
      const notifications = await database.notification.findMany({
        where: { announcementId: input.announcementId as string },
        select: { memberId: true, announcementVersion: true },
      });
      return {
        events: events.map((event) => ({
          idempotencyKey: event.idempotencyKey,
          recipients: Array.isArray(
            (event.payload as { readonly notifications?: unknown[] })
              .notifications
          )
            ? (
                event.payload as {
                  readonly notifications: Array<{
                    readonly recipientId: string;
                  }>;
                }
              ).notifications.map(({ recipientId }) => recipientId)
            : [],
          jobs: event.jobs,
        })),
        notifications,
      };
    }
    case "cleanup": {
      const announcementIds = input.announcementIds as string[];
      const cohortId = input.cohortId as string;
      await database.$transaction([
        database.announcement.deleteMany({
          where: { id: { in: announcementIds } },
        }),
        database.cohortMembership.deleteMany({ where: { cohortId } }),
        database.cohort.deleteMany({ where: { id: cohortId } }),
      ]);
      return { removed: announcementIds.length };
    }
    default:
      throw new Error(`Unsupported announcement QA operation: ${operation}`);
  }
};

const request = JSON.parse(readFileSync(0, "utf8")) as Request;
const result = await query(request);
process.stdout.write(JSON.stringify(result));
