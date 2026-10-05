import {
  createWriteFreezeResponse,
  shouldBlockRequestDuringWriteFreeze,
} from "@repo/security/write-freeze";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/env";

export default function proxy(request: NextRequest) {
  if (
    shouldBlockRequestDuringWriteFreeze({
      method: request.method,
      pathname: request.nextUrl.pathname,
      enabled: env.APP_WRITE_FREEZE === "true",
    })
  ) {
    return createWriteFreezeResponse(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/cron/:path*", "/webhooks/:path*"],
};
