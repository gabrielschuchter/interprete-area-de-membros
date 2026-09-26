import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { TextareaHTMLAttributes } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CommentComposer } from "./comment-composer";

const failureMessage = /Falha ao enviar/;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("./mention-textarea", () => ({
  MentionTextarea: (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...props} />
  ),
}));

const response = () =>
  new Response(JSON.stringify({ ok: true, commentId: "comment-1" }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });

describe("CommentComposer", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("keeps one request in flight when submit fires repeatedly", async () => {
    let resolveRequest: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve;
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<CommentComposer postId="post-1" spaceSlug="" />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Minha leitura." } });
    const form = textarea.closest("form");
    if (!form) {
      throw new Error("Composer form not found");
    }

    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button")).toHaveProperty("disabled", true);
    expect(screen.getAllByText("Enviando…").length).toBeGreaterThan(0);

    resolveRequest?.(response());
    await waitFor(() =>
      expect(screen.getByText("Comentário publicado")).toBeTruthy()
    );
  });

  test("retries the same logical attempt with the same idempotency key", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network failure"))
      .mockResolvedValueOnce(response());
    vi.stubGlobal("fetch", fetchMock);

    render(<CommentComposer postId="post-1" spaceSlug="" />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Tentar novamente." } });
    const form = textarea.closest("form");
    if (!form) {
      throw new Error("Composer form not found");
    }

    fireEvent.submit(form);
    await waitFor(() => expect(screen.getByText(failureMessage)).toBeTruthy());
    expect(screen.getByRole("textbox")).toHaveProperty(
      "value",
      "Tentar novamente."
    );
    fireEvent.submit(form);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const firstBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    const secondBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);
    expect(firstBody.idempotencyKey).toBe(secondBody.idempotencyKey);
    await waitFor(() =>
      expect(screen.getByText("Comentário publicado")).toBeTruthy()
    );
  });
});
