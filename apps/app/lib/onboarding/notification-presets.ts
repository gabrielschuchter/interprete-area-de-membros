import {
  allNotificationPreferencesOn,
  type NotificationPreferenceValues,
  notificationPreferenceKeys,
} from "@/lib/notification-preference-groups";

export type NotificationPreset = "tudo" | "essencial" | "um";

// "Só o essencial" follows its approved copy literally: mentions, replies to
// your comments, deadlines and teachers' announcements (D12, option A).
const essentialKeys = new Set([
  "mentions",
  "commentReplies",
  "activityDeadline",
  "announcements",
]);

export const essentialNotificationPreferences = Object.fromEntries(
  notificationPreferenceKeys.map((key) => [key, essentialKeys.has(key)])
) as NotificationPreferenceValues;

export const presetPreferences = (
  preset: Exclude<NotificationPreset, "um">
): NotificationPreferenceValues =>
  preset === "tudo"
    ? { ...allNotificationPreferencesOn }
    : { ...essentialNotificationPreferences };

const same = (
  left: NotificationPreferenceValues,
  right: NotificationPreferenceValues
) => notificationPreferenceKeys.every((key) => left[key] === right[key]);

// The option that matches what the person already has, so opening the step
// never changes saved preferences by itself.
export const presetFor = (
  values: NotificationPreferenceValues
): NotificationPreset => {
  if (same(values, allNotificationPreferencesOn)) {
    return "tudo";
  }
  if (same(values, essentialNotificationPreferences)) {
    return "essencial";
  }
  return "um";
};
