import "server-only";

import { startSpan } from "@sentry/nextjs";

/** Use a fixed, low-cardinality span name; never add member data or content. */
export const tracePerformance = <T>(
  name: string,
  operation: () => Promise<T>
) => startSpan({ name, op: "member.performance" }, operation);
