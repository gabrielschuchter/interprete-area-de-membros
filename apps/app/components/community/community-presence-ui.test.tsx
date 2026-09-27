import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CommunityPresence } from "./community-presence";

const presenceHarness = vi.hoisted(() => ({
  state: {} as Record<string, Record<string, unknown>[]>,
  sync: null as null | (() => void),
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
    createClient: vi.fn(() => ({
      channel: vi.fn(() => channel),
      realtime: { setAuth: vi.fn(() => Promise.resolve()) },
      removeChannel: vi.fn(() => Promise.resolve({ status: "ok" })),
    })),
  };
});

describe("CommunityPresence UI", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    presenceHarness.state = {};
    presenceHarness.sync = null;
  });

  test("shows the live count and links an active member to the internal profile", async () => {
    presenceHarness.state = {
      ana: [{ displayName: "Ana", avatarUrl: null }],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((input: unknown) => {
        const path = String(input);
        const body = path.includes("realtime-config")
          ? { anonKey: "anon-key", url: "https://example.supabase.co" }
          : { token: "short-lived-token" };
        return Promise.resolve(
          new Response(JSON.stringify(body), {
            headers: { "Content-Type": "application/json" },
            status: 200,
          })
        );
      })
    );

    render(
      <CommunityPresence
        profile={{ avatarUrl: null, displayName: "Eu", username: "eu" }}
      />
    );

    await waitFor(() =>
      expect(screen.getByText("1 membro online")).toBeTruthy()
    );
    expect(
      screen
        .getByRole("link", { name: "Abrir perfil de Ana" })
        .getAttribute("href")
    ).toBe("/membros/ana");
    expect(screen.getByRole("link").getAttribute("title")).toBe("Ana");
  });
});
