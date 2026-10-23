export type MemberNavigationKind = "back" | "cross" | "fade" | "short" | "std";

export type PortalSide = "comunidade" | "estudar";

export const memberNavigationDurations: Readonly<
  Record<
    MemberNavigationKind,
    { readonly enter: number; readonly exit: number }
  >
> = {
  back: { enter: 520, exit: 160 },
  cross: { enter: 520, exit: 218 },
  fade: { enter: 120, exit: 60 },
  short: { enter: 360, exit: 160 },
  std: { enter: 220, exit: 0 },
};

export const portalShortcutPaths: Readonly<Record<string, PortalSide>> = {
  "/estudar": "estudar",
  "/cursos": "estudar",
  "/exercicios": "estudar",
  "/atividades": "estudar",
  "/biblioteca": "estudar",
  "/planejamento": "estudar",
  "/ferramentas": "estudar",
  "/comunidade": "comunidade",
  "/encontros": "comunidade",
  "/comunidade/grupos": "comunidade",
  "/comunidade/meus-topicos": "comunidade",
};

export const portalSideForPath = (pathname: string): PortalSide =>
  pathname === "/comunidade" ||
  pathname.startsWith("/comunidade/") ||
  pathname === "/encontros" ||
  pathname.startsWith("/encontros/")
    ? "comunidade"
    : "estudar";

export const classifyMemberNavigation = ({
  currentPath,
  destinationPath,
  portalArc = false,
}: {
  readonly currentPath: string;
  readonly destinationPath: string;
  readonly portalArc?: boolean;
}): MemberNavigationKind | null => {
  if (currentPath === destinationPath) {
    return null;
  }

  if (destinationPath === "/") {
    return "back";
  }

  if (currentPath === "/") {
    return portalArc ? "cross" : "short";
  }

  return "std";
};

export const memberNavigationExitDuration = (
  kind: MemberNavigationKind,
  mobile: boolean
) =>
  mobile && (kind === "back" || kind === "cross" || kind === "short")
    ? 300
    : memberNavigationDurations[kind].exit;

export const memberNavigationTotalDuration = (
  kind: MemberNavigationKind,
  mobile: boolean
) =>
  mobile && (kind === "back" || kind === "cross" || kind === "short")
    ? 520
    : memberNavigationDurations[kind].enter;

export const remainingMemberTransitionDuration = (
  totalDuration: number,
  startedAt: number,
  now: number
) => Math.max(0, totalDuration - (now - startedAt));

export const shouldReplaceActiveMemberTransition = (
  activeTargetPath: string,
  destinationPath: string
) => activeTargetPath !== destinationPath;

export const shouldInterceptMemberLink = ({
  button,
  ariaDisabled,
  defaultPrevented,
  download,
  modified,
  sameOrigin,
  sameRoute,
  target,
  relExternal,
}: {
  readonly button: number;
  readonly ariaDisabled: boolean;
  readonly defaultPrevented: boolean;
  readonly download: boolean;
  readonly modified: boolean;
  readonly relExternal: boolean;
  readonly sameOrigin: boolean;
  readonly sameRoute: boolean;
  readonly target: string;
}) =>
  !(defaultPrevented || ariaDisabled) &&
  button === 0 &&
  !modified &&
  !download &&
  target !== "_blank" &&
  !relExternal &&
  sameOrigin &&
  !sameRoute;
