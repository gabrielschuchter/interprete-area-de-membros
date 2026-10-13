import { config, withAnalyzer } from "@repo/next-config";
import { withLogging, withSentry } from "@repo/observability/next-config";
import type { NextConfig } from "next";
import { env } from "@/env";

let nextConfig: NextConfig = withLogging(config);

// Every application API route is either identity-bound or protected by an
// authorization check. Set a safe default at the routing boundary so an
// unauthenticated redirect/error cannot be stored as a shared response before
// an individual handler has a chance to add its more specific headers.
nextConfig = {
  ...nextConfig,
  experimental: {
    ...nextConfig.experimental,
    authInterrupts: true,
    // Windows QA shares memory with dev servers and Chrome. Vercel keeps
    // its Linux defaults rather than one prerender worker per local CPU.
    ...(process.platform === "win32" ? { cpus: 2 } : {}),
  },
  logging: {
    incomingRequests: {
      ignore: [/__clerk_/],
    },
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store",
          },
        ],
      },
    ];
  },
};

if (env.VERCEL) {
  nextConfig = withSentry(nextConfig);
}

if (env.ANALYZE === "true") {
  nextConfig = withAnalyzer(nextConfig);
}

export default nextConfig;
