import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  search: { current: "" },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(mocks.search.current),
}));

vi.mock("@repo/design-system/components/ui/sidebar", () => ({
  useSidebar: () => ({ isMobile: false, state: "expanded" }),
}));

import {
  LibraryExperience,
  type LibraryFilterValues,
} from "./library-experience";

const FILTERS: LibraryFilterValues = {
  category: "",
  difficulty: "",
  kind: "",
  language: "",
  q: "",
  sort: "recent",
  titulos: "",
};

const renderLibrary = (initial = FILTERS) =>
  render(
    <LibraryExperience categories={[]} initialFilters={initial}>
      <p>resultados</p>
    </LibraryExperience>
  );

const panelSearch = () =>
  screen.getAllByPlaceholderText("Buscar por título, tema ou palavra…")[0];

describe("busca automática da Biblioteca", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.search.current = "";
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe = vi.fn();
        disconnect = vi.fn();
        unobserve = vi.fn();
      }
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("busca sozinha depois da pausa, sem empilhar histórico", () => {
    renderLibrary();
    fireEvent.change(panelSearch(), { target: { value: "grade" } });

    expect(mocks.replace).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(mocks.replace).toHaveBeenCalledTimes(1);
    expect(mocks.replace).toHaveBeenCalledWith("/biblioteca?q=grade", {
      scroll: false,
    });
    expect(mocks.push).not.toHaveBeenCalled();
  });

  test("digitar em sequência gera uma busca só", () => {
    renderLibrary();
    for (const value of ["gr", "gra", "grad", "grade"]) {
      fireEvent.change(panelSearch(), { target: { value } });
      act(() => {
        vi.advanceTimersByTime(150);
      });
    }
    expect(mocks.replace).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(mocks.replace).toHaveBeenCalledTimes(1);
    expect(mocks.replace).toHaveBeenCalledWith("/biblioteca?q=grade", {
      scroll: false,
    });
  });

  test("uma letra só não busca", () => {
    renderLibrary();
    fireEvent.change(panelSearch(), { target: { value: "g" } });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  test("mantém filtros aplicados e o botão de títulos em português", () => {
    mocks.search.current = "kind=PDF&titulos=pt";
    renderLibrary({ ...FILTERS, kind: "PDF", titulos: "pt" });
    fireEvent.change(panelSearch(), { target: { value: "prisma" } });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(mocks.replace).toHaveBeenCalledWith(
      "/biblioteca?q=prisma&kind=PDF&titulos=pt",
      { scroll: false }
    );
  });

  test("apagar o campo volta para a lista completa", () => {
    mocks.search.current = "q=grade";
    renderLibrary({ ...FILTERS, q: "grade" });
    fireEvent.change(panelSearch(), { target: { value: "" } });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(mocks.replace).toHaveBeenCalledWith("/biblioteca", {
      scroll: false,
    });
  });

  test("o botão Filtrar continua buscando na hora", () => {
    renderLibrary();
    fireEvent.change(panelSearch(), { target: { value: "grade" } });
    fireEvent.submit(panelSearch().closest("form") as HTMLFormElement);

    expect(mocks.push).toHaveBeenCalledWith("/biblioteca?q=grade", {
      scroll: false,
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
