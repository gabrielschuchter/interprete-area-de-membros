import type { Metadata } from "next";
import type { ReactNode } from "react";
import { resolveApiOrigin } from "../lib/application-origin";

interface RootLayoutProperties {
  readonly children: ReactNode;
}

export const metadata: Metadata = {
  metadataBase: new URL(resolveApiOrigin()),
};

const RootLayout = ({ children }: RootLayoutProperties) => (
  <html lang="pt-BR">
    <body>{children}</body>
  </html>
);

export default RootLayout;
