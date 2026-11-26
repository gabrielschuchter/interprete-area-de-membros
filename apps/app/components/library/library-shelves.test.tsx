import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@repo/design-system/lib/toast", () => ({
  toast: { library: vi.fn() },
}));

vi.mock("@/app/(authenticated)/biblioteca/actions", () => ({
  toggleLearningBookmark: vi.fn(),
  toggleLibraryBookmark: vi.fn(),
}));

import {
  groupLibraryShelves,
  type LibraryShelfItem,
} from "@/lib/library-shelves";
import { LibraryShelves } from "./library-shelves";

const item = (
  id: string,
  overrides: Partial<LibraryShelfItem> = {}
): LibraryShelfItem => ({
  accessType: "FREE_TO_READ",
  authors: "Sterne JAC; Savović J",
  category: "Risco de viés",
  coverUrl: null,
  description: "Ferramenta para avaliar risco de viés.",
  difficulty: "ADVANCED",
  id,
  isBookmarked: false,
  kind: "GUIDE",
  language: "en",
  tags: ["risco de viés", "ecr"],
  title: `Material ${id}`,
  titlePt: `Material em português ${id}`,
  version: null,
  year: 2019,
  ...overrides,
});

const shelves = groupLibraryShelves([
  item("um"),
  item("dois"),
  item("tres", { category: "Fundamentos da PBE" }),
]);

describe("LibraryShelves", () => {
  afterEach(cleanup);

  test("mostra uma estante por categoria com o título impresso na capa", () => {
    render(<LibraryShelves shelves={shelves} translateTitles={false} />);

    expect(
      screen.getByRole("heading", { name: "Fundamentos da PBE" })
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Risco de viés" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Material um, Guia, 2019" })
    ).toBeTruthy();
  });

  test("abre o card de detalhes ao clicar no livro", () => {
    render(<LibraryShelves shelves={shelves} translateTitles={false} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Material um, Guia, 2019" })
    );

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Material um" })
    ).toBeTruthy();
    const open = within(dialog).getByRole("link", {
      name: "Abrir material: Material um, em nova aba",
    });
    expect(open.getAttribute("href")).toBe("/biblioteca/abrir/um");
    expect(open.getAttribute("target")).toBe("_blank");
  });

  test("card do livro não mostra etiquetas nem outros livros da estante", () => {
    render(<LibraryShelves shelves={shelves} translateTitles={false} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Material um, Guia, 2019" })
    );
    const dialog = within(screen.getByRole("dialog"));

    expect(dialog.queryByText("Na mesma estante")).toBeNull();
    expect(dialog.queryByText("ecr")).toBeNull();
    expect(dialog.queryByRole("button", { name: "Material dois" })).toBeNull();
  });

  test("usa o título em português quando pedido", () => {
    render(<LibraryShelves shelves={shelves} translateTitles />);

    expect(
      screen.getByRole("button", {
        name: "Material em português um, Guia, 2019",
      })
    ).toBeTruthy();
  });
});
