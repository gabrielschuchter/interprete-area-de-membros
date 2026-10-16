import { describe, expect, it } from "vitest";
import {
  classifyMemberNavigation,
  memberNavigationDurations,
  memberNavigationExitDuration,
  memberNavigationTotalDuration,
  portalShortcutPaths,
  portalSideForPath,
  remainingMemberTransitionDuration,
  shouldInterceptMemberLink,
  shouldReplaceActiveMemberTransition,
} from "./member-navigation";

describe("member navigation transition contract", () => {
  it("uses corridor traversal only for the two portal arcs", () => {
    expect(
      classifyMemberNavigation({
        currentPath: "/",
        destinationPath: "/estudar",
        portalArc: true,
      })
    ).toBe("cross");
    expect(
      classifyMemberNavigation({
        currentPath: "/",
        destinationPath: "/comunidade",
        portalArc: false,
      })
    ).toBe("short");
  });

  it("routes portal shortcuts, returns, internal navigation, and same-route changes", () => {
    expect(
      classifyMemberNavigation({
        currentPath: "/",
        destinationPath: "/aprender",
      })
    ).toBe("short");
    expect(
      classifyMemberNavigation({
        currentPath: "/comunidade/grupos",
        destinationPath: "/",
      })
    ).toBe("back");
    expect(
      classifyMemberNavigation({
        currentPath: "/biblioteca",
        destinationPath: "/salvos",
      })
    ).toBe("std");
    expect(
      classifyMemberNavigation({
        currentPath: "/comunidade",
        destinationPath: "/comunidade",
      })
    ).toBeNull();
  });

  it("maps the twelve links to eleven real destinations and their section side", () => {
    expect(Object.keys(portalShortcutPaths)).toHaveLength(11);
    expect(portalSideForPath("/encontros/gravacoes")).toBe("comunidade");
    expect(portalSideForPath("/comunidade/minhas-publicacoes")).toBe(
      "comunidade"
    );
    expect(portalSideForPath("/planejamento")).toBe("estudar");
  });

  it("uses the approved timings, with the mobile card exit", () => {
    expect(memberNavigationDurations).toMatchObject({
      back: { enter: 520, exit: 160 },
      cross: { enter: 520, exit: 218 },
      fade: { enter: 120, exit: 60 },
      short: { enter: 360, exit: 160 },
      std: { enter: 220, exit: 0 },
    });
    expect(memberNavigationExitDuration("cross", true)).toBe(300);
    expect(memberNavigationExitDuration("fade", true)).toBe(60);
    expect(memberNavigationExitDuration("std", true)).toBe(0);
    expect(memberNavigationTotalDuration("cross", true)).toBe(520);
    expect(memberNavigationTotalDuration("back", true)).toBe(520);
    expect(memberNavigationTotalDuration("fade", true)).toBe(120);
    expect(memberNavigationTotalDuration("short", false)).toBe(360);
    expect(memberNavigationTotalDuration("std", false)).toBe(220);
  });

  it("does not restart finished time or duplicate a transition target", () => {
    expect(remainingMemberTransitionDuration(520, 100, 300)).toBe(320);
    expect(remainingMemberTransitionDuration(520, 100, 700)).toBe(0);
    expect(shouldReplaceActiveMemberTransition("/estudar", "/estudar")).toBe(
      false
    );
    expect(shouldReplaceActiveMemberTransition("/estudar", "/comunidade")).toBe(
      true
    );
  });

  it("leaves modified, external, download, and same-route links to the browser", () => {
    const base = {
      button: 0,
      ariaDisabled: false,
      defaultPrevented: false,
      download: false,
      modified: false,
      relExternal: false,
      sameOrigin: true,
      sameRoute: false,
      target: "",
    };
    expect(shouldInterceptMemberLink(base)).toBe(true);
    expect(shouldInterceptMemberLink({ ...base, modified: true })).toBe(false);
    expect(shouldInterceptMemberLink({ ...base, sameOrigin: false })).toBe(
      false
    );
    expect(shouldInterceptMemberLink({ ...base, download: true })).toBe(false);
    expect(shouldInterceptMemberLink({ ...base, ariaDisabled: true })).toBe(
      false
    );
    expect(shouldInterceptMemberLink({ ...base, target: "_blank" })).toBe(
      false
    );
    expect(shouldInterceptMemberLink({ ...base, sameRoute: true })).toBe(false);
    expect(shouldInterceptMemberLink({ ...base, relExternal: true })).toBe(
      false
    );
  });
});
