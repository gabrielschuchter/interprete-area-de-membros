import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { resetNavigationPrefetchBudget } from "../../app/(authenticated)/components/navigation-prefetch";
import { NotificationRealtime } from "../../app/(authenticated)/components/notification-realtime";
import { getAuthenticatedRealtimeClient } from "../../lib/realtime-client";
import {
  CommunityPresence,
  mergeCommunityPresenceMembers,
  type OnlineCommunityMember,
  rotateCommunityPresenceMembers,
} from "./community-presence";

const presenceHarness = vi.hoisted(() => ({
  createdClients: 0,
  state: {} as Record<string, Record<string, unknown>[]>,
  sync: null as null | (() => void),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/comunidade",
  useSearchParams: () => ({ toString: () => "" }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    prefetch,
    ...properties
  }: ComponentProps<"a"> & { readonly prefetch?: boolean }) => (
    <a
      data-prefetch={prefetch === true ? "enabled" : "disabled"}
      href={href}
      {...properties}
    />
  ),
}));

vi.mock("@supabase/supabase-js", () => {
  const channel = {
    on: vi.fn(
      (
        type: string,
        filter: { readonly event?: string },
        callback: () => void
      ) => {
        if (type === "presence" && filter.event === "sync") {
          presenceHarness.sync = callback;
        }
        return channel;
      }
    ),
    presenceState: vi.fn(() => presenceHarness.state),
    subscribe: vi.fn((callback: (status: string) => void) => {
      callback("SUBSCRIBED");
      return channel;
    }),
    track: vi.fn(() => Promise.resolve({ status: "ok" })),
    untrack: vi.fn(() => Promise.resolve({ status: "ok" })),
  };

  return {
    createClient: vi.fn(() => {
      presenceHarness.createdClients += 1;
      return {
        channel: vi.fn(() => channel),
        realtime: { setAuth: vi.fn(() => Promise.resolve()) },
        removeChannel: vi.fn(() => Promise.resolve({ status: "ok" })),
      };
    }),
  };
});

describe("CommunityPresence UI", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    presenceHarness.createdClients = 0;
    presenceHarness.state = {};
    presenceHarness.sync = null;
    resetNavigationPrefetchBudget();
  });

  test("combines live and saved profiles and links members to their profiles", async () => {
    presenceHarness.state = {
      ana: [{ displayName: "Ana", avatarUrl: null }],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((input: unknown) => {
        const path = String(input);
        const body = path.includes("realtime-config")
          ? {
              configured: true,
              publishableKey: "publishable-key",
              url: "https://example.supabase.co",
            }
          : {
              expiresAt: Date.now() + 300_000,
              memberId: "eu",
              token: "short-lived-token",
            };
        return Promise.resolve(
          new Response(JSON.stringify(body), {
            headers: { "Content-Type": "application/json" },
            status: 200,
          })
        );
      })
    );

    render(
      <>
        <CommunityPresence
          fallbackProfiles={[
            {
              avatarUrl: null,
              displayName: "Bruna",
              username: "bruna",
            },
          ]}
          memberId="eu"
          profile={{ avatarUrl: null, displayName: "Eu", username: "eu" }}
        />
        <NotificationRealtime
          memberId="eu"
          onNotification={vi.fn()}
          onResync={vi.fn()}
          onStatusChange={vi.fn()}
        />
      </>
    );

    await waitFor(() =>
      expect(screen.getByText("3 membros online")).toBeTruthy()
    );
    const profileLink = screen.getByRole("link", {
      name: "Abrir perfil de Ana",
    });
    expect(profileLink.getAttribute("href")).toBe("/membros/ana");
    expect(profileLink.getAttribute("data-prefetch")).toBe("disabled");
    fireEvent.pointerEnter(profileLink);
    await waitFor(() =>
      expect(profileLink.getAttribute("data-prefetch")).toBe("enabled")
    );
    expect(profileLink.getAttribute("title")).toBe("Ana");
    expect(
      screen
        .getByRole("link", { name: "Abrir perfil de Bruna" })
        .getAttribute("href")
    ).toBe("/membros/bruna");
    expect(presenceHarness.createdClients).toBe(1);
    await expect(
      getAuthenticatedRealtimeClient("outro-membro")
    ).rejects.toThrow("Realtime não emitiu um token válido.");
  });

  test("deduplicates real profiles and rotates a seven-profile window", () => {
    const members: OnlineCommunityMember[] = Array.from(
      { length: 9 },
      (_, index) => ({
        avatarUrl: null,
        displayName: `Pessoa ${index + 1}`,
        username: `pessoa-${index + 1}`,
      })
    );

    const merged = mergeCommunityPresenceMembers(
      members.slice(0, 2),
      members.slice(1)
    );

    expect(merged).toHaveLength(9);
    const firstWindow = rotateCommunityPresenceMembers(merged, 0);
    const secondWindow = rotateCommunityPresenceMembers(merged, 1);
    const wrappedWindow = rotateCommunityPresenceMembers(merged, 8);
    expect(firstWindow.map(({ username }) => username)).toEqual(
      members.slice(0, 7).map(({ username }) => username)
    );
    expect(secondWindow.map(({ username }) => username)).toEqual(
      members.slice(1, 8).map(({ username }) => username)
    );
    expect(wrappedWindow.map(({ username }) => username)).toEqual([
      "pessoa-9",
      ...members.slice(0, 6).map(({ username }) => username),
    ]);
  });
});
