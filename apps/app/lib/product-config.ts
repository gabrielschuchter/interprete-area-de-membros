import "server-only";

import { database } from "@repo/database";
import { cache } from "react";
import { getPublishedLearningPaths } from "./learning";

export const productSettingKeys = {
  recordingsExperienceV2: "recordingsExperienceV2",
  showLearnNavigation: "showLearnNavigation",
} as const;

export interface MemberProductConfig {
  readonly recordingsExperienceV2: boolean;
  readonly showLearnNavigation: boolean;
}

const defaults: MemberProductConfig = {
  recordingsExperienceV2: true,
  showLearnNavigation: true,
};

const booleanValue = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

export const getProductConfig = cache(async () => {
  const settings = await database.productSetting.findMany({
    where: {
      key: { in: Object.values(productSettingKeys) },
    },
    select: { key: true, value: true },
  });
  const values = new Map(
    settings.map((setting) => [setting.key, setting.value])
  );

  return {
    recordingsExperienceV2: booleanValue(
      values.get(productSettingKeys.recordingsExperienceV2),
      defaults.recordingsExperienceV2
    ),
    showLearnNavigation: booleanValue(
      values.get(productSettingKeys.showLearnNavigation),
      defaults.showLearnNavigation
    ),
  } satisfies MemberProductConfig;
});

export const getMemberProductConfig = cache(async (memberId: string) => {
  const [config, paths] = await Promise.all([
    getProductConfig(),
    getPublishedLearningPaths(memberId),
  ]);

  const hasAccessibleAsyncContent = paths.some((path) =>
    path.courses.some((course) => course.modules.length > 0)
  );

  return {
    ...config,
    // A flag can intentionally turn Learn off, but it cannot make an empty
    // learning area look available to members.
    showLearnNavigation:
      config.showLearnNavigation && hasAccessibleAsyncContent,
  } satisfies MemberProductConfig;
});
