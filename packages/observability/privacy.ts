interface TelemetryEvent {
  request?: {
    cookies?: unknown;
    data?: unknown;
    headers?: unknown;
    query_string?: unknown;
    url?: unknown;
  };
  user?: unknown;
}

/** Remove identity and request payloads before member-area telemetry leaves the app. */
export const sanitizeMemberTelemetryEvent = <T extends TelemetryEvent>(
  event: T
): T => {
  if (event.request) {
    event.request.url = undefined;
    event.request.query_string = undefined;
    event.request.cookies = undefined;
    event.request.data = undefined;
    event.request.headers = undefined;
  }
  event.user = undefined;
  return event;
};
