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

  // Keep the frontend API proxy on the same canonical host as the app. An
  // absolute value from an older deployment would move Clerk requests and
  // session cookies to a different Vercel project.
  const configuredClerkProxyUrl = process.env.NEXT_PUBLIC_CLERK_PROXY_URL;
  const clerkProxyUrl = configuredClerkProxyUrl || "/__clerk";

  return (
    <ClerkProvider
      {...properties}
      appearance={{
        ...interpreteAuthAppearance,
        options,
        theme: baseTheme,
      }}
      localization={ptBR}
      proxyUrl={clerkProxyUrl}
    />
  );
};
