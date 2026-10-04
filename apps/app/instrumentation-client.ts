import { initializeAnalytics } from "@repo/analytics/instrumentation-client";
import { initializeSentry } from "@repo/observability/client";

const initializeOptionalTelemetry = () => {
  initializeSentry();
  initializeAnalytics();
};

if (typeof window.requestIdleCallback === "function") {
  window.requestIdleCallback(initializeOptionalTelemetry, { timeout: 1500 });
} else {
  window.setTimeout(initializeOptionalTelemetry, 800);
}

export { onRouterTransitionStart } from "@repo/observability/client";
