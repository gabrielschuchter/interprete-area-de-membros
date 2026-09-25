import type { Theme } from "@clerk/types";

/**
 * Shared Clerk appearance tokens. Keeping these here prevents sign-in, sign-up,
 * UserButton and the opened UserProfile from drifting apart visually.
 */
export const interpreteAuthAppearance = {
  variables: {
    colorPrimary: "var(--brand-dark-amaranth)",
    colorPrimaryForeground: "var(--brand-pink-essence)",
    colorForeground: "var(--text-primary)",
    colorMutedForeground: "var(--text-secondary)",
    colorBackground: "var(--surface-paper)",
    colorInput: "var(--surface-paper)",
    colorInputForeground: "var(--text-primary)",
    colorBorder: "var(--border-subtle)",
    colorRing: "var(--brand-classic-crimson)",
    fontFamily: "var(--font-sans-family)",
    fontFamilyButtons: "var(--font-sans-family)",
    fontWeight: {
      bold: "var(--font-weight-semibold)",
      medium: "var(--font-weight-medium)",
      normal: "var(--font-weight-normal)",
    },
    borderRadius: "var(--radius)",
    spacing: "0.5rem",
  } satisfies Theme["variables"],
  elements: {
    card: "border border-border bg-card shadow-none",
    dividerLine: "bg-border",
    dividerText: "text-text-muted",
    formButtonPrimary:
      "bg-brand-structural text-primary-foreground hover:bg-brand-depth focus-visible:ring-2 focus-visible:ring-brand-action",
    formFieldInput:
      "border-border bg-surface-paper text-text-primary focus:border-brand-structural focus:ring-brand-structural",
    formFieldLabel: "text-text-primary",
    footerActionLink: "text-brand-structural hover:text-brand-depth",
    socialButtonsBlockButton:
      "border-border bg-surface-paper text-text-primary hover:bg-surface-muted",
    socialButtonsIconButton: "bg-card",
    navbarButton: "text-foreground",
  } satisfies Theme["elements"],
} satisfies Pick<Theme, "elements" | "variables">;
