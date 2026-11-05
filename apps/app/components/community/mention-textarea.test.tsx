import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MentionTextarea } from "./mention-textarea";

const searching = /Buscando/;
const nobody = /Ninguém encontrado/;
const failed = /Não foi possível buscar/;

const type = (value: string) => {
  const textarea = screen.getByRole("textbox");
  fireEvent.change(textarea, {
    target: { value, selectionStart: value.length },
  });
};

describe("MentionTextarea search states", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        addEventListener: vi.fn(),
        matches: false,
        removeEventListener: vi.fn(),
      }))
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  test("shows the empty state instead of searching forever", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json({ items: [] })))
    );
    render(<MentionTextarea />);
    type("@gabr");
    expect(await screen.findByText(searching)).toBeTruthy();
    expect(await screen.findByText(nobody)).toBeTruthy();
    expect(screen.queryByText(searching)).toBeNull();
  });

  test("shows an error state when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("{}", { status: 500 })))
    );
    render(<MentionTextarea />);
    type("@gabr");
    expect(await screen.findByText(failed)).toBeTruthy();
    expect(screen.queryByText(searching)).toBeNull();
  });

  test("lists people returned by the search", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          Response.json({
            items: [
              {
                id: "u1",
                username: "gabriel",
                displayName: "Gabriel",
                avatarUrl: null,
                kind: "USER",
                role: "MEMBER",
              },
            ],
          })
        )
      )
    );
    render(<MentionTextarea />);
    type("@gabr");
    expect(await screen.findByText("Gabriel")).toBeTruthy();
  });
});
