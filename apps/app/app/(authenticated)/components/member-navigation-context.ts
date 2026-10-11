"use client";

import { createContext, useContext } from "react";

export interface PortalTransitionGeometry {
  readonly dx: number;
  readonly dy: number;
  readonly offsetX: number;
  readonly scale: number;
}

export interface PortalTransition {
  readonly corridor: "estudar" | "comunidade" | null;
  readonly direction: "enter" | "return";
  readonly geometry: PortalTransitionGeometry | null;
  readonly id: number;
  readonly minimumElapsed: boolean;
  readonly mode: "corridor" | "direct";
  readonly phase:
    | "camera"
    | "fade"
    | "direct"
    | "return-prep"
    | "returning"
    | "return-direct"
    | "waiting";
  readonly targetPath: string;
}

export type MemberRouteTransitionPhase = "entering" | "leaving";

export interface MemberNavigationContextValue {
  readonly displayName: string;
  readonly memberId: string;
  readonly navigate: (href: string) => void;
  readonly onPortalReady: (
    transitionId: number,
    geometry: PortalTransitionGeometry
  ) => void;
  readonly showLearnNavigation: boolean;
  readonly transition: PortalTransition | null;
}

export const MemberNavigationContext =
  createContext<MemberNavigationContextValue | null>(null);

export const useMemberNavigation = () => useContext(MemberNavigationContext);
