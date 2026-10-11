import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CommunityComposer } from "./community-composer";

const actions = vi.hoisted(() => ({
  updateDraft: vi.fn().mockResolvedValue({ ok: true, spaceSlug: "qa" }),
  publishPost: vi.fn().mockResolvedValue({ ok: true }),
  updatePost: vi.fn(),
}));
vi.mock("@/app/(authenticated)/comunidade/actions", () => actions);
vi.mock("./topic-editor", () => ({ TopicEditor: () => null }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = vi.fn();
      disconnect = vi.fn();
    }
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("keeps autosave and publish active after StrictMode effect replay", async () => {
  render(
    <StrictMode>
      <CommunityComposer
        backHref="/comunidade/meus-topicos"
        initialContent={{ type: "doc", content: [{ type: "paragraph" }] }}
        initialCoverUrl={null}
        initialSpaceId={null}
        initialSpaceSlug={null}
        initialSubtitle={null}
        initialTags={[]}
        initialTitle=""
        postId="qa-local"
        spaces={[]}
        status="DRAFT"
      />
    </StrictMode>
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Título" }), {
    target: { value: "QA local" },
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(800);
  });
  expect(actions.updateDraft).toHaveBeenCalledTimes(1);
  expect(actions.updateDraft.mock.calls[0][0].get("title")).toBe("QA local");
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }));
    await Promise.resolve();
  });
  expect(actions.publishPost).toHaveBeenCalledTimes(1);
});
