import { Reenie_Beanie } from "next/font/google";
import type { ReactNode } from "react";

// Handwritten notes beside the student card (D4: self-hosted through
// next/font, used only by the notes, with a cursive fallback).
const handwriting = Reenie_Beanie({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-ob-hand",
  weight: "400",
});

export const HandwritingFont = ({
  children,
}: {
  readonly children: ReactNode;
}) => <div className={`${handwriting.variable} contents`}>{children}</div>;
