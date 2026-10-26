import "server-only";
import { database } from "@repo/database";
import {
  parseYouTubePolicy,
  youtubePolicySettingKey,
} from "./integrations-domain";

export const getYouTubePolicy = async () => {
  const row = await database.productSetting.findUnique({
    where: { key: youtubePolicySettingKey },
    select: { value: true },
  });
  return parseYouTubePolicy(row?.value ?? null);
};
