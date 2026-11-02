import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { YouTubePlaylistImport } from "./youtube-playlist-import";

vi.mock("./youtube-playlist-import-dialog", () => ({
  YouTubePlaylistImportDialog: ({ open }: { readonly open: boolean }) =>
    open ? <div role="dialog">Importador carregado</div> : null,
}));

afterEach(cleanup);

test("loads the playlist importer only after the member opens it", async () => {
  render(
    <YouTubePlaylistImport
      courseId="course-1"
      courseStatus="DRAFT"
      initialIdempotencyKey="key-1"
      modules={[{ id: "module-1", status: "DRAFT", title: "Módulo 1" }]}
    />
  );

  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Importar lista do YouTube" })
  );

  expect(await screen.findByText("Importador carregado")).toBeTruthy();
});
