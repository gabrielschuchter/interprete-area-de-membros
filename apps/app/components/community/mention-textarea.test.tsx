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

describe("MentionTextarea repeated triggers", () => {
  const people = {
    items: [
      {
        avatarUrl: null,
        displayName: "Gabriel",
        id: "u1",
        kind: "USER",
        role: "MEMBER",
        username: "gabriel",
      },
    ],
  };

  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        addEventListener: vi.fn(),
        matches: false,
        removeEventListener: vi.fn(),
      }))
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json(people)))
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const textarea = () => screen.getByRole("textbox") as HTMLTextAreaElement;

  test("opens again for a second @ after a confirmed mention", async () => {
    render(<MentionTextarea />);
    type("@gab");
    fireEvent.mouseDown(await screen.findByRole("option"));
    expect(screen.queryByRole("option")).toBeNull();
    type(`${textarea().value}e @`);
    expect(await screen.findByRole("option")).toBeTruthy();
  });

  test("opens for a new @ after an abandoned @", async () => {
    render(<MentionTextarea />);
    type("@gab");
    expect(await screen.findByRole("option")).toBeTruthy();
    // A pessoa desiste: apaga o texto da busca e segue escrevendo.
    type("@ ");
    expect(screen.queryByRole("option")).toBeNull();
    type("@ olá @");
    expect(await screen.findByRole("option")).toBeTruthy();
  });

  test("closes with Escape without erasing text, and every next @ opens again", async () => {
    render(<MentionTextarea />);
    type("oi @gab");
    expect(await screen.findByRole("option")).toBeTruthy();
    fireEvent.keyDown(textarea(), { key: "Escape" });
    expect(screen.queryByRole("option")).toBeNull();
    expect(textarea().value).toBe("oi @gab");
    // Digitar mais depois do Esc não reabre o mesmo @...
    type("oi @gabr");
    expect(screen.queryByRole("option")).toBeNull();
    // ...mas outro @ abre de novo.
    type("oi @gabr e @");
    expect(await screen.findByRole("option")).toBeTruthy();
  });

  test("does not treat an @ glued to a word as a trigger", () => {
    render(<MentionTextarea />);
    type("contato@gab");
    expect(screen.queryByRole("option")).toBeNull();
  });
});
