import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { enqueueDomainEvent } from "./events";
import { scheduleNextRecurringPlannerReminder } from "./planner-reminders";

vi.mock("server-only", () => ({}));
vi.mock("./events", async () => ({
  ...(await vi.importActual<typeof import("./events")>("./events")),
  enqueueDomainEvent: vi.fn(),
}));
vi.mock("./notifications", () => ({
  notificationOutboxConsumerKey: "notifications.create.v1",
}));

const makeTransaction = () => {
  const transaction = {
    member: { findFirst: vi.fn().mockResolvedValue({ id: "member_1" }) },
    plannerTask: { findFirst: vi.fn() },
    plannerEvent: { findFirst: vi.fn() },
    plannerPreferences: {
      findUnique: vi.fn().mockResolvedValue({ timezone: "UTC" }),
    },
    plannerTaskOccurrence: { findFirst: vi.fn().mockResolvedValue(null) },
    plannerEventOccurrence: { findFirst: vi.fn().mockResolvedValue(null) },
    plannerReminder: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "reminder_1" }),
    },
    outboxJob: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  return transaction;
};

describe("recurring planner reminders", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("OUTBOX_QUEUE_NAMESPACE", "");
    vi.mocked(enqueueDomainEvent).mockResolvedValue({
      id: "domain_event_1",
    } as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("anchors monthly occurrences to the original day of month", async () => {
    const transaction = makeTransaction();
    transaction.plannerTask.findFirst.mockResolvedValue({
      title: "Leitura",
      dueAt: new Date("2027-01-31T09:00:00.000Z"),
      recurrence: "MONTHLY",
      recurrenceUntil: null,
      reminderMinutes: 15,
    });

    await scheduleNextRecurringPlannerReminder(transaction as never, {
      memberId: "member_1",
      entityType: "PLANNER_TASK",
      entityId: "task_1",
      occurrenceAt: new Date("2027-01-31T09:00:00.000Z"),
    });

    expect(transaction.plannerReminder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        memberId: "member_1",
        entityType: "PLANNER_TASK",
        entityId: "task_1",
        occurrenceAt: new Date("2027-02-28T09:00:00.000Z"),
        remindAt: new Date("2027-02-28T08:45:00.000Z"),
        domainEventId: "domain_event_1",
      }),
    });
    expect(enqueueDomainEvent).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({ aggregateType: "planner.reminder" })
    );
    expect(transaction.outboxJob.updateMany).toHaveBeenCalledWith({
      where: {
        eventId: "domain_event_1",
        consumerKey: "preview.notifications.create.v1",
      },
      data: { availableAt: expect.any(Date) },
    });
  });

  test("uses an occurrence override and links its own calendar occurrence", async () => {
    const transaction = makeTransaction();
    transaction.plannerEvent.findFirst.mockResolvedValue({
      title: "Encontro de estudo",
      startsAt: new Date("2027-02-01T13:00:00.000Z"),
      recurrence: "WEEKLY",
      recurrenceUntil: null,
      reminderMinutes: 15,
      timezone: "UTC",
    });
    transaction.plannerEventOccurrence.findFirst.mockResolvedValue({
      startsAtOverride: new Date("2027-02-08T14:00:00.000Z"),
      titleOverride: "Sessão especial",
      deletedAt: null,
    });

    await scheduleNextRecurringPlannerReminder(transaction as never, {
      memberId: "member_1",
      entityType: "PLANNER_EVENT",
      entityId: "event_1",
      occurrenceAt: new Date("2027-02-01T13:00:00.000Z"),
    });

    expect(transaction.plannerReminder.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        occurrenceAt: new Date("2027-02-08T13:00:00.000Z"),
        remindAt: new Date("2027-02-08T13:45:00.000Z"),
      }),
    });
    expect(enqueueDomainEvent).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({
        payload: expect.objectContaining({
          notifications: [
            expect.objectContaining({
              title: "Lembrete: Sessão especial",
              href: "/planejamento?view=calendar&event=event_1&occurrence=2027-02-08T13%3A00%3A00.000Z",
            }),
          ],
        }),
      })
    );
  });
});
