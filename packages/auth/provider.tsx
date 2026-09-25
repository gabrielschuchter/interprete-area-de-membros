"use client";

import { ptBR } from "@clerk/localizations/pt-BR";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useTheme } from "next-themes";
import type { ComponentProps } from "react";
import { interpreteAuthAppearance } from "./appearance";

type AuthProviderProperties = ComponentProps<typeof ClerkProvider> & {
  privacyUrl?: string;
  termsUrl?: string;
  helpUrl?: string;
};

export const AuthProvider = ({
  privacyUrl,
  termsUrl,
  helpUrl,
  ...properties
}: AuthProviderProperties) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const baseTheme = isDark ? dark : undefined;

  const options = {
    privacyPageUrl: privacyUrl,
    termsPageUrl: termsUrl,
    helpPageUrl: helpUrl,
  };

  return (
    <ClerkProvider
      {...properties}
      appearance={{
        ...interpreteAuthAppearance,
        options,
        theme: baseTheme,
      }}
      localization={ptBR}
    />
  );
};
