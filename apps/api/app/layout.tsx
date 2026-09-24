import type { Metadata } from "next";
import type { ReactNode } from "react";

interface RootLayoutProperties {
  readonly children: ReactNode;
}

const configuredUrl =
  process.env.VERCEL_PROJECT_PRODUCTION_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3002";

export const metadata: Metadata = {
  metadataBase: new URL(
    configuredUrl.startsWith("http")
      ? configuredUrl
      : `https://${configuredUrl}`
  ),
};

const RootLayout = ({ children }: RootLayoutProperties) => (
  <html lang="pt-BR">
    <body>{children}</body>
  </html>
);

export default RootLayout;
