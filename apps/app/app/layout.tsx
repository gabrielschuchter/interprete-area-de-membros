import "./styles.css";
import { DesignSystemProvider } from "@repo/design-system";
import { fonts } from "@repo/design-system/lib/fonts";
import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import type { ReactNode } from "react";

interface RootLayoutProperties {
  readonly children: ReactNode;
}

export const metadata: Metadata = createMetadata({
  title: "Área de membros",
  description: "Seu espaço de aprendizagem no Interprete.",
});

const RootLayout = ({ children }: RootLayoutProperties) => (
  <html className={fonts} lang="pt-BR" suppressHydrationWarning>
    <body>
      <DesignSystemProvider>{children}</DesignSystemProvider>
    </body>
  </html>
);

export default RootLayout;
