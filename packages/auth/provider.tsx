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

  // Clerk production instances with a custom frontend API proxy require the
  // browser to use the exact proxy URL configured for that instance. The
  // value is deliberately environment-controlled so local, preview, and
  // production can each use their own valid proxy host.
  const configuredClerkProxyUrl =
    process.env.NEXT_PUBLIC_CLERK_PROXY_URL?.trim();
  const isLocalDevelopment = process.env.NODE_ENV === "development";
  let clerkProxyUrl: string | undefined;
  if (!isLocalDevelopment) {
    clerkProxyUrl = configuredClerkProxyUrl || "/__clerk";
  }

  return (
    <ClerkProvider
      {...properties}
      appearance={{
        ...interpreteAuthAppearance,
        options,
        theme: baseTheme,
      }}
      localization={ptBR}
      {...(clerkProxyUrl ? { proxyUrl: clerkProxyUrl } : {})}
    />
  );
};
