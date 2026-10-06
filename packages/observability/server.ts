/*
 * This file configures the initialization of Sentry on the server.
 * The config you add here will be used whenever the server handles a request.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

// biome-ignore lint/performance/noNamespaceImport: Sentry SDK convention
import * as Sentry from "@sentry/nextjs";
import { keys } from "./keys";
import { sanitizeMemberTelemetryEvent } from "./privacy";

export const initializeSentry = (): ReturnType<typeof Sentry.init> =>
  Sentry.init({
    dsn: keys().NEXT_PUBLIC_SENTRY_DSN,

    // Enable logging
    enableLogs: true,

    sendDefaultPii: false,
    tracesSampleRate: 0.2,
    beforeSend: sanitizeMemberTelemetryEvent,
    beforeSendTransaction: sanitizeMemberTelemetryEvent,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,

    // Capture local variables in stack traces for better debugging
    includeLocalVariables: false,

    // Integrations for console logging
    integrations: [
      // Send console.log, console.error, and console.warn calls as logs to Sentry
      Sentry.consoleLoggingIntegration({ levels: ["log", "error", "warn"] }),
    ],
  });
