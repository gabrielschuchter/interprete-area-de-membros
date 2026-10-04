"use client";

import { ptBR } from "@clerk/localizations/pt-BR";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useTheme } from "next-themes";
import type { ComponentProps } from "react";
import { interpreteAuthAppearance } from "./appearance";
import { shouldProxyClerkFrontendApi } from "./clerk-proxy";

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

  // Keep the Clerk frontend API proxy same-origin. A cross-host proxy can
  // create a session on a different Vercel alias, leaving the visible app
  // without the session cookie needed to activate it.
  const clerkProxyUrl = shouldProxyClerkFrontendApi(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  )
    ? "/__clerk"
    : undefined;

  return (
    <ClerkProvider
      {...properties}
      appearance={{
        ...interpreteAuthAppearance,
        options,
        theme: baseTheme,
      }}
      localization={ptBR}
      taskUrls={{
        "choose-organization": "/session-tasks",
        "reset-password": "/session-tasks",
        "setup-mfa": "/session-tasks",
      }}
      {...(clerkProxyUrl ? { proxyUrl: clerkProxyUrl } : {})}
    />
  );
};
