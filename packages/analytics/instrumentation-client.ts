let posthogClient: Promise<typeof import("posthog-js")> | null = null;

const loadPostHog = () => (posthogClient ??= import("posthog-js"));

export const initializeAnalytics = (): Promise<void> | undefined => {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!(key && host)) {
    return;
  }

  return loadPostHog()
    .then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: host,
        defaults: "2025-05-24",
      });
    })
    .catch(() => undefined);
};
