import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CommunityPostShareDialog } from "./community-post-share-dialog";

const shareUrl = `https://app.example.test/comunidade/compartilhar/${"a".repeat(43)}`;

describe("CommunityPostShareDialog", () => {
  const fetchMock = vi.fn();
  const clipboardWrite = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = true;
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = false;
        this.dispatchEvent(new Event("close"));
      },
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWrite },
    });
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    clipboardWrite.mockReset().mockResolvedValue(undefined);
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      if (String(input).startsWith("/api/community/post-shares?")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ links: [] }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({
          id: "share-link-12345678",
          url: shareUrl,
          createdAt: "2026-10-22T12:00:00.000Z",
        }),
      } as Response);
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("creates a persistent link, copies it, and confirms its access boundary", async () => {
    render(
      <CommunityPostShareDialog
        description="Uma prévia pública."
        postId="post-12345678"
        title="Uma publicação para compartilhar"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Compartilhar" }));
    const dialog = screen.getByRole("dialog", {
      name: "Compartilhar publicação",
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Gerar link e copiar" })
    );

    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith(shareUrl));
    expect(
      screen.getByRole("textbox", { name: "Link de compartilhamento" })
    ).toHaveProperty("value", shareUrl);
    expect(screen.getByRole("status").textContent).toContain("Link copiado.");
    expect(dialog.textContent).toContain(
      "Compartilhar o link não altera o acesso."
    );
    expect(dialog.textContent).toContain(
      "Quem não tiver permissão verá apenas uma página genérica."
    );
    expect(screen.getByText("E-mail indisponível")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/community/post-shares",
      expect.objectContaining({ method: "POST" })
    );
  });
});
