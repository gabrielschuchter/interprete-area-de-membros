export type YouTubeSchedule = "daily" | "off" | "weekly";

export interface YouTubePolicy {
  readonly allowUpload: boolean;
  readonly notifyUnavailable: boolean;
  readonly schedule: YouTubeSchedule;
  readonly unlistedOnly: boolean;
}

export const youtubePolicySettingKey = "youtubeIntegration";

export const defaultYouTubePolicy: YouTubePolicy = {
  allowUpload: true,
  notifyUnavailable: true,
  schedule: "daily",
  unlistedOnly: false,
};

export const youtubeScheduleLabels: Record<YouTubeSchedule, string> = {
  daily: "Todos os dias, às 06h",
  off: "Só quando alguém pedir",
  weekly: "Toda segunda-feira, às 06h",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parseYouTubePolicy = (value: unknown): YouTubePolicy => {
  if (!isRecord(value)) {
    return defaultYouTubePolicy;
  }
  const flag = (key: keyof YouTubePolicy, fallback: boolean) =>
    typeof value[key] === "boolean" ? value[key] : fallback;
  const schedule: YouTubeSchedule =
    value.schedule === "off" || value.schedule === "weekly"
      ? value.schedule
      : "daily";
  return {
    allowUpload: flag("allowUpload", defaultYouTubePolicy.allowUpload),
    notifyUnavailable: flag(
      "notifyUnavailable",
      defaultYouTubePolicy.notifyUnavailable
    ),
    schedule,
    unlistedOnly: flag("unlistedOnly", defaultYouTubePolicy.unlistedOnly),
  };
};
