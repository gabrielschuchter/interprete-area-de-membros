import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  libraryToast: vi.fn(),
  push: vi.fn(),
  toggleLearningBookmark: vi.fn(),
  toggleLibraryBookmark: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@repo/design-system/lib/toast", () => ({
  toast: { library: mocks.libraryToast },
}));

vi.mock("@/app/(authenticated)/biblioteca/actions", () => ({
  toggleLearningBookmark: mocks.toggleLearningBookmark,
  toggleLibraryBookmark: mocks.toggleLibraryBookmark,
}));

import { LibraryBookmarkButton } from "./library-bookmark-button";

const submittedFields = (formData: FormData) =>
  Object.fromEntries(formData.entries());

describe("LibraryBookmarkButton", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("confirms a saved bookmark only after persistence and can undo it", async () => {
    mocks.toggleLibraryBookmark
      .mockResolvedValueOnce({ ok: true, saved: true })
      .mockResolvedValueOnce({ ok: true, saved: false });

    render(
      <LibraryBookmarkButton targetId="material-1" targetType="LIBRARY_ITEM" />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Salvar na biblioteca" })
    );

    await screen.findByRole("button", { name: "Remover dos salvos" });
    expect(mocks.toggleLibraryBookmark).toHaveBeenCalledTimes(1);
    expect(
      submittedFields(mocks.toggleLibraryBookmark.mock.calls[0]?.[0])
    ).toEqual({
      desired: "on",
      itemId: "material-1",
    });
    expect(mocks.libraryToast).toHaveBeenCalledTimes(1);
    expect(mocks.libraryToast.mock.calls[0]?.[0]).toBe(
      "Salvo na biblioteca pessoal."
    );

    const undo = mocks.libraryToast.mock.calls[0]?.[1]?.[0]?.onSelect;
    expect(undo).toBeTypeOf("function");
    await act(async () => {
      await undo?.();
    });

    await screen.findByRole("button", { name: "Salvar na biblioteca" });
    expect(mocks.toggleLibraryBookmark).toHaveBeenCalledTimes(2);
    expect(
      submittedFields(mocks.toggleLibraryBookmark.mock.calls[1]?.[0])
    ).toEqual({
      desired: "off",
      itemId: "material-1",
    });
    expect(mocks.libraryToast.mock.calls[1]?.[0]).toBe("Removido dos salvos.");
  });

  test("rolls back a failed save and retries the same idempotent intent", async () => {
    mocks.toggleLearningBookmark
      .mockRejectedValueOnce(new Error("temporarily unavailable"))
      .mockResolvedValueOnce({ ok: true, saved: true });

    render(<LibraryBookmarkButton targetId="lesson-1" targetType="LESSON" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Salvar na biblioteca" })
    );

    await screen.findByRole("button", { name: "Salvar na biblioteca" });
    await waitFor(() => expect(mocks.libraryToast).toHaveBeenCalledTimes(1));
    expect(mocks.libraryToast.mock.calls[0]?.[0]).toBe(
      "Não foi possível salvar. Tente novamente."
    );
    expect(mocks.libraryToast.mock.calls[0]?.[2]).toBe("error");
    expect(
      submittedFields(mocks.toggleLearningBookmark.mock.calls[0]?.[0])
    ).toEqual({
      desired: "on",
      targetId: "lesson-1",
      targetType: "LESSON",
    });

    const retry = mocks.libraryToast.mock.calls[0]?.[1]?.[0]?.onSelect;
    expect(retry).toBeTypeOf("function");
    await act(async () => {
      await retry?.();
    });

    await screen.findByRole("button", { name: "Remover dos salvos" });
    expect(mocks.toggleLearningBookmark).toHaveBeenCalledTimes(2);
    expect(
      submittedFields(mocks.toggleLearningBookmark.mock.calls[1]?.[0])
    ).toEqual({
      desired: "on",
      targetId: "lesson-1",
      targetType: "LESSON",
    });
    expect(mocks.libraryToast.mock.calls[1]?.[0]).toBe(
      "Salvo na biblioteca pessoal."
    );
  });
});
