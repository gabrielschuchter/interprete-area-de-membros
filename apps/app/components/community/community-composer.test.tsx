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
  updateDraft: vi.fn().mockResolvedValue({
    ok: true,
    postId: "qa-local",
    saved: true,
    spaceSlug: "",
    updatedAt: "2026-10-20T15:30:00.123Z",
  }),
  publishPost: vi.fn().mockResolvedValue({
    ok: true,
    href: "/comunidade/publicacoes/qa-local",
  }),
  updatePost: vi.fn().mockResolvedValue({
    ok: true,
    updatedAt: "2026-10-20T15:30:00.124Z",
  }),
  router: { push: vi.fn(), replace: vi.fn() },
}));
vi.mock("@/app/(authenticated)/comunidade/actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => actions.router }));
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
        idempotencyKey=""
        initialContent={{ type: "doc", content: [{ type: "paragraph" }] }}
        initialCoverUrl={null}
        initialSpaceId={null}
        initialSpaceSlug={null}
        initialSubtitle={null}
        initialTags={[]}
        initialTitle=""
        initialUpdatedAt="2026-10-20T15:30:00.122Z"
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

it("does not create a blank draft when a new editor is only opened", async () => {
  render(
    <CommunityComposer
      backHref="/comunidade"
      idempotencyKey="00000000-0000-4000-8000-000000000001"
      initialContent={{ type: "doc", content: [{ type: "paragraph" }] }}
      initialCoverUrl={null}
      initialSpaceId={null}
      initialSpaceSlug={null}
      initialSubtitle={null}
      initialTags={[]}
      initialTitle="Rascunho sem título"
      initialUpdatedAt={null}
      postId={null}
      spaces={[]}
      status="DRAFT"
    />
  );

  await act(async () => {
    await vi.advanceTimersByTimeAsync(800);
  });
  expect(actions.updateDraft).not.toHaveBeenCalled();
});

it("creates one canonical post on the first edit using the stable creation key", async () => {
  render(
    <CommunityComposer
      backHref="/comunidade"
      idempotencyKey="00000000-0000-4000-8000-000000000002"
      initialContent={{ type: "doc", content: [{ type: "paragraph" }] }}
      initialCoverUrl={null}
      initialSpaceId={null}
      initialSpaceSlug={null}
      initialSubtitle={null}
      initialTags={[]}
      initialTitle="Rascunho sem título"
      initialUpdatedAt={null}
      postId={null}
      spaces={[]}
      status="DRAFT"
    />
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Título" }), {
    target: { value: "Uma publicação" },
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(800);
  });

  const submittedForm = actions.updateDraft.mock.calls.at(-1)?.[0] as FormData;
  expect(submittedForm.get("idempotencyKey")).toBe(
    "00000000-0000-4000-8000-000000000002"
  );
  expect(submittedForm.get("postId")).toBeNull();
  expect(actions.router.replace).toHaveBeenCalledWith(
    "/comunidade/editor/qa-local?from=%2Fcomunidade",
    { scroll: false }
  );
});

it("offers an explicit conflict choice and retries against the current version", async () => {
  actions.updateDraft
    .mockResolvedValueOnce({
      code: "conflict",
      currentPostId: "qa-local",
      currentUpdatedAt: "2026-10-20T15:31:00.000Z",
      error: "Este rascunho mudou em outra aba.",
      ok: false,
    })
    .mockResolvedValueOnce({
      ok: true,
      postId: "qa-local",
      saved: true,
      spaceSlug: "",
      updatedAt: "2026-10-20T15:31:00.001Z",
    });
  render(
    <CommunityComposer
      backHref="/comunidade"
      idempotencyKey=""
      initialContent={{ type: "doc", content: [{ type: "paragraph" }] }}
      initialCoverUrl={null}
      initialSpaceId={null}
      initialSpaceSlug={null}
      initialSubtitle={null}
      initialTags={[]}
      initialTitle="Rascunho sem título"
      initialUpdatedAt="2026-10-20T15:30:00.000Z"
      postId="qa-local"
      spaces={[]}
      status="DRAFT"
    />
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Título" }), {
    target: { value: "Minha versão" },
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(800);
  });
  expect(screen.getByText("Este rascunho mudou em outra aba.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Manter minha versão" }));
  await act(async () => {
    await Promise.resolve();
  });
  expect(
    actions.updateDraft.mock.calls.at(-1)?.[0].get("expectedUpdatedAt")
  ).toBe("2026-10-20T15:31:00.000Z");
});

it("retries a transient autosave failure and reports success only after persistence", async () => {
  actions.updateDraft
    .mockRejectedValueOnce(new Error("network unavailable"))
    .mockResolvedValueOnce({
      ok: true,
      postId: "qa-local",
      saved: true,
      spaceSlug: "",
      updatedAt: "2026-10-20T15:32:00.001Z",
    });
  render(
    <CommunityComposer
      backHref="/comunidade"
      idempotencyKey=""
      initialContent={{ type: "doc", content: [{ type: "paragraph" }] }}
      initialCoverUrl={null}
      initialSpaceId={null}
      initialSpaceSlug={null}
      initialSubtitle={null}
      initialTags={[]}
      initialTitle="Rascunho sem título"
      initialUpdatedAt="2026-10-20T15:32:00.000Z"
      postId="qa-local"
      spaces={[]}
      status="DRAFT"
    />
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Título" }), {
    target: { value: "Salvar após reconexão" },
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2400);
  });

  expect(actions.updateDraft).toHaveBeenCalledTimes(2);
  expect(
    screen.getByText("Rascunho salvo · visível só para você")
  ).toBeTruthy();
});
