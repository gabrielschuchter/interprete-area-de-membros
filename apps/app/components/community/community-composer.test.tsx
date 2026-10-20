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
vi.mock("./topic-editor", () => ({
  TopicEditor: ({
    onDocumentChange,
  }: {
    onDocumentChange: (value: unknown) => void;
  }) => (
    <button
      onClick={() =>
        onDocumentChange({
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Texto" }] },
          ],
        })
      }
      type="button"
    >
      Inserir texto de teste
    </button>
  ),
}));

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
  fireEvent.click(
    screen.getByRole("button", { name: "Inserir texto de teste" })
  );
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

it("saves the cover alternative text with the same draft version", async () => {
  render(
    <CommunityComposer
      backHref="/comunidade/minhas-publicacoes?status=drafts"
      enableCoverAltText
      idempotencyKey=""
      initialContent={{ type: "doc", content: [{ type: "paragraph" }] }}
      initialCoverAltText="Uma capa antiga"
      initialCoverUrl="https://media.example/cover.webp"
      initialSpaceId={null}
      initialSpaceSlug={null}
      initialSubtitle={null}
      initialTags={[]}
      initialTitle="Publicação existente"
      initialUpdatedAt="2026-10-20T15:30:00.122Z"
      postId="qa-local"
      spaces={[]}
      status="DRAFT"
    />
  );

  fireEvent.change(
    screen.getByRole("textbox", { name: "Texto alternativo da capa" }),
    {
      target: { value: "Uma pessoa estudando ao lado da janela" },
    }
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(800);
  });

  const submittedForm = actions.updateDraft.mock.calls.at(-1)?.[0] as FormData;
  expect(submittedForm.get("coverAltText")).toBe(
    "Uma pessoa estudando ao lado da janela"
  );
});

it("offers a safe exit and persists a dirty draft before leaving", async () => {
  render(
    <CommunityComposer
      backHref="/comunidade/minhas-publicacoes?status=drafts"
      idempotencyKey=""
      initialContent={{ type: "doc", content: [{ type: "paragraph" }] }}
      initialCoverUrl={null}
      initialSpaceId={null}
      initialSpaceSlug={null}
      initialSubtitle={null}
      initialTags={[]}
      initialTitle="Rascunho sem título"
      initialUpdatedAt="2026-10-20T15:30:00.122Z"
      postId="qa-local"
      spaces={[]}
      status="DRAFT"
    />
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Título" }), {
    target: { value: "Alteração pendente" },
  });
  fireEvent.click(screen.getByRole("link", { name: "Voltar" }));
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Sair e manter rascunho" })
  );
  await act(async () => {
    await Promise.resolve();
  });

  expect(actions.updateDraft).toHaveBeenCalledTimes(1);
  expect(actions.router.push).toHaveBeenCalledWith(
    "/comunidade/minhas-publicacoes?status=drafts"
  );
});
