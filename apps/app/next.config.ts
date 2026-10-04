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
