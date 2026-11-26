import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

const ABRIR = /Abrir material: Artigo X/;

vi.mock("@repo/design-system/lib/toast", () => ({
  toast: { info: vi.fn(), success: vi.fn() },
}));

const { OpenMaterialLink } = await import("./open-material-link");

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("abrir o material liga o cronômetro de leitura ligado ao item", () => {
  const fetchMock = vi.fn(() =>
    Promise.resolve(new Response("{}", { status: 200 }))
  );
  vi.stubGlobal("fetch", fetchMock);
  render(
    <OpenMaterialLink
      href="/biblioteca/abrir/lib1"
      itemId="lib1"
      title="Artigo X"
    />
  );
  const link = screen.getByRole("link", { name: ABRIR });
  expect(link.getAttribute("target")).toBe("_blank");
  fireEvent.click(link);
  const [url, init] = fetchMock.mock.calls[0] as unknown as [
    string,
    RequestInit,
  ];
  expect(url).toBe("/api/focus-timer");
  expect(init.keepalive).toBe(true);
  const body = JSON.parse(String(init.body));
  expect(body).toMatchObject({
    action: "start",
    mode: "STOPWATCH",
    linkedResourceType: "LIBRARY_ITEM",
    linkedResourceId: "lib1",
    title: "Leitura: Artigo X",
  });
});
