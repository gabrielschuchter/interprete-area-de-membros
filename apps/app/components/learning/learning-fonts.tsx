import { IBM_Plex_Mono, Inter, Source_Serif_4 } from "next/font/google";
import type { CSSProperties, ReactNode } from "react";

// The design system names Source Serif 4, Inter and IBM Plex Mono but nothing
// loads them, so every machine without them installed falls back to Georgia
// and Segoe UI. Cursos and the Sala load them here, scoped to their subtree.
const serif = Source_Serif_4({
  display: "swap",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-cb-serif",
  weight: ["400", "600"],
});
const sans = Inter({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-cb-sans",
  weight: ["400", "500", "600"],
});
const mono = IBM_Plex_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-cb-mono",
  weight: ["400", "500"],
});

const fontTokens = {
  "--font-display-family":
    'var(--font-cb-serif), "Source Serif 4", Georgia, serif',
  "--font-mono-family":
    'var(--font-cb-mono), "IBM Plex Mono", Menlo, Consolas, monospace',
  "--font-sans-family":
    'var(--font-cb-sans), "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  display: "contents",
} as CSSProperties;

export const LearningFonts = ({
  children,
}: {
  readonly children: ReactNode;
}) => (
  <div
    className={`${serif.variable} ${sans.variable} ${mono.variable}`}
    style={fontTokens}
  >
    {children}
  </div>
);
