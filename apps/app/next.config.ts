import { config, withAnalyzer } from "@repo/next-config";
import { withLogging, withSentry } from "@repo/observability/next-config";
import type { NextConfig } from "next";
import { env } from "@/env";

const localDistDir = process.env.INTERPRETE_LOCAL_DIST_DIR;
if (
  localDistDir &&
  (process.env.VERCEL || !/^\.next-local-[a-z0-9-]+$/.test(localDistDir))
) {
  throw new Error("Diretório de QA local inválido ou configurado na Vercel.");
}

let nextConfig: NextConfig = withLogging(config);

// Every application API route is either identity-bound or protected by an
// authorization check. Set a safe default at the routing boundary so an
// unauthenticated redirect/error cannot be stored as a shared response before
// an individual handler has a chance to add its more specific headers.
nextConfig = {
  ...nextConfig,
  ...(localDistDir ? { distDir: localDistDir } : {}),
  experimental: {
    ...nextConfig.experimental,
    authInterrupts: true,
    // Windows QA shares memory with dev servers and Chrome. Vercel keeps
    // its Linux defaults rather than one prerender worker per local CPU.
    ...(process.platform === "win32" ? { cpus: 2 } : {}),
  },
  logging: {
    incomingRequests: {
      ignore: [
        /__clerk_/,
        /\/comunidade\/compartilhar\/[A-Za-z0-9_-]{43}(?:\/opengraph-image)?/,
      ],
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
      {
        source: "/comunidade/compartilhar/:token",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      {
        source: "/comunidade/compartilhar/:token/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
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
