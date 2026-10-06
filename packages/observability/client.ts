/*
 * Client observability is optional. Keep its SDK and server-side environment
 * validation out of the initial application bundle when no public DSN exists.
 */

import { sanitizeMemberTelemetryEvent } from "./privacy";

type SentryClient = typeof import("@sentry/nextjs");

const loadSentry = (() => {
  let client: Promise<SentryClient> | null = null;
  return () => (client ??= import("@sentry/nextjs"));
})();

const clientDsn = () => process.env.NEXT_PUBLIC_SENTRY_DSN;

export const initializeSentry = (): Promise<void> | undefined => {
  const dsn = clientDsn();
  if (!dsn) {
    return;
  }

  return loadSentry()
    .then((Sentry) => {
      Sentry.init({
        dsn,
        enableLogs: true,
        sendDefaultPii: false,
        tracesSampleRate: 0.2,
        beforeSend: sanitizeMemberTelemetryEvent,
        beforeSendTransaction: sanitizeMemberTelemetryEvent,
        debug: false,
        replaysOnErrorSampleRate: 1,
        replaysSessionSampleRate: 0.1,
        integrations: [
          Sentry.replayIntegration({
            maskAllText: true,
            blockAllMedia: true,
          }),
          Sentry.consoleLoggingIntegration({
            levels: ["log", "error", "warn"],
          }),
        ],
      });
    })
    .catch(() => undefined);
};

export const onRouterTransitionStart: typeof import("@sentry/nextjs").captureRouterTransitionStart =
  (...args) => {
    if (!clientDsn()) {
      return;
    }
    return loadSentry()
      .then((Sentry) => Sentry.captureRouterTransitionStart(...args))
      .catch(() => undefined);
  };
