import { IBM_Plex_Mono, Inter, Source_Serif_4 } from "next/font/google";
import type { CSSProperties, ReactNode } from "react";

// The design system names Source Serif 4, Inter and IBM Plex Mono but nothing
// loaded them, so every machine without them installed fell back to Georgia and
// Segoe UI. They are loaded once, on <html> (see app/layout.tsx), so that
// portals (menus, dialogs, toasts), onboarding, sign-in and error pages get the
// same families as the shell instead of whatever the visitor's system has.
const serif = Source_Serif_4({
  display: "swap",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-cb-serif",
});
const sans = Inter({
  display: "swap",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-cb-sans",
});
const mono = IBM_Plex_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-cb-mono",
  weight: ["400", "500", "600"],
});

export const learningFontClassName = `${serif.variable} ${sans.variable} ${mono.variable}`;

export const learningFontTokens = {
  "--font-display-family":
    'var(--font-cb-serif), "Source Serif 4", Georgia, serif',
  "--font-mono-family":
    'var(--font-cb-mono), "IBM Plex Mono", Menlo, Consolas, monospace',
  "--font-sans-family":
    'var(--font-cb-sans), "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
} as CSSProperties;

/** Kept so existing layouts compile; the fonts now live on <html>. */
export const LearningFonts = ({
  children,
}: {
  readonly children: ReactNode;
}) => <>{children}</>;
