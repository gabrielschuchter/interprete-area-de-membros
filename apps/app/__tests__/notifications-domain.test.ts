import { describe, expect, test } from "vitest";
import {
  mergeNotificationRecipients,
  notificationFilterTypes,
  notificationPriority,
  selectNotificationType,
} from "../lib/notifications-domain";

describe("notification domain rules", () => {
  test("deduplicates a direct mention above a reply and topic activity", () => {
    expect(selectNotificationType("TOPIC_COMMENT", "COMMENT_REPLY")).toBe(
      "COMMENT_REPLY"
    );
    expect(selectNotificationType("COMMENT_REPLY", "MENTION")).toBe("MENTION");
    expect(selectNotificationType("MENTION", "TOPIC_COMMENT")).toBe("MENTION");
  });

  test("keeps direct replies from being replaced by lower-priority activity", () => {
    expect(
      selectNotificationType("COMMENT_REPLY", "FOLLOWED_TOPIC_ACTIVITY")
    ).toBe("COMMENT_REPLY");
    expect(notificationPriority.MENTION).toBeGreaterThan(
      notificationPriority.COMMENT_REPLY
    );
  });

  test("keeps notification filters aligned with the product taxonomy", () => {
    expect(notificationFilterTypes.MENTIONS).toEqual(["MENTION"]);
    expect(notificationFilterTypes.COMMUNITY).toContain("COMMENT_REPLY");
    expect(notificationFilterTypes.ACTIVITIES).toContain("FEEDBACK_RECEIVED");
    expect(notificationFilterTypes.LEARNING).toEqual([
      "LESSON_AVAILABLE",
      "MODULE_AVAILABLE",
    ]);
  });

  test("does not notify the actor and keeps only the highest-priority event", () => {
    expect(
      mergeNotificationRecipients("member-a", [
        { memberId: "member-a", type: "MENTION" },
        { memberId: "member-b", type: "TOPIC_COMMENT" },
        { memberId: "member-b", type: "COMMENT_REPLY" },
        { memberId: "member-b", type: "MENTION" },
      ])
    ).toEqual([["member-b", "MENTION"]]);
  });
});
