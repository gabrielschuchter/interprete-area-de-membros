"use client";

import { createContext, useContext } from "react";
import type { MemberNavigationKind, PortalSide } from "./member-navigation";

export interface PortalTransition {
  readonly corridor: PortalSide | null;
  readonly direction: "enter" | "return";
  readonly durationMs: number;
  readonly exitDurationMs: number;
  readonly href: string;
  readonly id: number;
  readonly kind: MemberNavigationKind;
  readonly phase: "committing" | "entering" | "leaving";
  readonly startedAt: number;
  readonly targetPath: string;
  readonly vector: { readonly x: number; readonly y: number } | null;
}

export type MemberRouteTransitionPhase = PortalTransition["phase"];

export interface MemberNavigationContextValue {
  readonly displayName: string;
  readonly imageFailed: boolean;
  readonly imageReady: boolean;
  readonly memberId: string;
  readonly navigate: (href: string) => void;
  readonly navigateShell?: (href: string) => void;
  readonly navigationFailure: string | null;
  readonly onPortalImageError: () => void;
  readonly onPortalImageReady: (imageId: string) => void;
  readonly retryNavigation: () => void;
  readonly showLearnNavigation: boolean;
  readonly transition: PortalTransition | null;
}

export const MemberNavigationContext =
  createContext<MemberNavigationContextValue | null>(null);

export const useMemberNavigation = () => useContext(MemberNavigationContext);
