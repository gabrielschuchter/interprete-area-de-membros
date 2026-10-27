import "./styles.css";
import "./portal.css";
import "./portal-b2.css";
import { DesignSystemProvider } from "@repo/design-system";
import { fonts } from "@repo/design-system/lib/fonts";
import { createMetadata } from "@repo/seo/metadata";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  learningFontClassName,
  learningFontTokens,
} from "@/components/learning/learning-fonts";

interface RootLayoutProperties {
  readonly children: ReactNode;
}

export const metadata: Metadata = createMetadata({
  title: "Área de membros",
  description: "Seu espaço de aprendizagem no Interprete.",
});

const RootLayout = ({ children }: RootLayoutProperties) => (
  <html
    className={`${fonts} ${learningFontClassName}`}
    lang="pt-BR"
    style={learningFontTokens}
    suppressHydrationWarning
  >
    <body>
      <DesignSystemProvider>{children}</DesignSystemProvider>
    </body>
  </html>
);

export default RootLayout;
