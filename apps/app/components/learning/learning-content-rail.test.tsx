import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

const scheduledCourseLinkName = /Curso programado/;

vi.mock("@/app/(authenticated)/biblioteca/actions", () => ({
  toggleLearningBookmark: vi.fn(),
}));

import { LearningContentRail } from "./learning-content-rail";

describe("LearningContentRail", () => {
  test("uses editorial covers by content type and falls back when a custom cover fails", async () => {
    const { container } = render(
      <LearningContentRail
        cards={[
          { href: "/recording", label: "Gravação", title: "Aula gravada" },
          {
            coverUrl: "https://cdn.example.test/exercises.png",
            href: "/exercises",
            label: "Exercícios",
            title: "Questões de PBE",
          },
          { href: "/library", label: "Biblioteca", title: "Material de apoio" },
        ]}
        headingId="rail-covers-title"
        title="Conteúdos com capa"
      />
    );

    const images = container.querySelectorAll("img");
    const imagePath = (index: number) => {
      const source = images[index]?.getAttribute("src");
      return source ? new URL(source, window.location.href).pathname : null;
    };
    expect(imagePath(0)).toBe("/brand/learning/evidence-screen.png");
    expect(images[1]?.getAttribute("src")).toBe(
      "https://cdn.example.test/exercises.png"
    );
    expect(imagePath(2)).toBe("/brand/library/study-books.png");

    const customCover = images[1];
    if (!customCover) {
      throw new Error(
        "A capa personalizada de Exercícios não foi renderizada."
      );
    }
    fireEvent.error(customCover);
    await waitFor(() =>
      expect(imagePath(1)).toBe("/brand/learning/reading-notes.png")
    );
  });

  test("shows arrows only in available directions and keeps them keyboard reachable", async () => {
    render(
      <LearningContentRail
        cards={[
          { href: "/a", title: "Aula A", progress: 25 },
          { href: "/b", title: "Aula B", meta: "0/2 aulas" },
        ]}
        headingId="rail-title"
        title="Fundamentos da PBE"
      />
    );

    const viewport = screen.getByRole("list", {
      name: "Conteúdos: Fundamentos da PBE",
    });
    const lessonProgress = screen.getByRole("progressbar", {
      name: "Progresso de Aula A",
    });
    expect(lessonProgress.getAttribute("aria-valuemin")).toBe("0");
    expect(lessonProgress.getAttribute("aria-valuemax")).toBe("100");
    expect(lessonProgress.getAttribute("aria-valuenow")).toBe("25");
    expect(lessonProgress.getAttribute("aria-valuetext")).toBe("25%");
    let scrollLeft = 48;
    viewport.style.paddingLeft = "48px";
    viewport.style.paddingRight = "48px";
    Object.defineProperties(viewport, {
      clientWidth: { configurable: true, value: 500 },
      scrollLeft: {
        configurable: true,
        get: () => scrollLeft,
      },
      scrollWidth: { configurable: true, value: 800 },
      scrollBy: { configurable: true, value: vi.fn() },
    });
    fireEvent(window, new Event("resize"));

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Mostrar próximos conteúdos em Fundamentos da PBE",
        })
      ).toBeDefined()
    );
    const nextButton = screen.getByRole("button", {
      name: "Mostrar próximos conteúdos em Fundamentos da PBE",
    });
    expect(nextButton.tabIndex).toBe(0);
    expect(nextButton.className).toContain("learning-rail-arrow");
    expect(
      screen.queryByRole("button", {
        name: "Mostrar conteúdos anteriores em Fundamentos da PBE",
      })
    ).toBeNull();
    expect(screen.getByText("Continuar")).toBeDefined();
    expect(screen.getByText("Começar")).toBeDefined();
    expect(viewport.className).toContain("learning-rail-viewport");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Mostrar próximos conteúdos em Fundamentos da PBE",
      })
    );
    expect(viewport.scrollBy).toHaveBeenCalledWith({
      behavior: "smooth",
      left: 410,
    });

    scrollLeft = 150;
    fireEvent.scroll(viewport);
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Mostrar conteúdos anteriores em Fundamentos da PBE",
        })
      ).toBeDefined()
    );
    expect(
      screen.getByRole("button", {
        name: "Mostrar próximos conteúdos em Fundamentos da PBE",
      })
    ).toBeDefined();

    scrollLeft = 252;
    fireEvent.scroll(viewport);
    await waitFor(() =>
      expect(
        screen.queryByRole("button", {
          name: "Mostrar próximos conteúdos em Fundamentos da PBE",
        })
      ).toBeNull()
    );
    expect(
      screen.getByRole("button", {
        name: "Mostrar conteúdos anteriores em Fundamentos da PBE",
      })
    ).toBeDefined();
  });

  test("keeps scheduled content visible without making it a dead link", () => {
    render(
      <LearningContentRail
        cards={[
          {
            actionLabel: "Aguarde a liberação",
            bookmark: {
              saved: false,
              targetId: "course-1",
              targetType: "COURSE",
            },
            disabled: true,
            href: "/aprender/cursos/curso-programado",
            meta: "Disponível em 6 out., 09:00",
            title: "Curso programado",
          },
        ]}
        headingId="scheduled-rail-title"
        title="Enviados para você"
      />
    );

    expect(
      screen.queryByRole("link", { name: scheduledCourseLinkName })
    ).toBeNull();
    expect(screen.getByText("Aguarde a liberação")).toBeDefined();
    expect(screen.getByText("Disponível em 6 out., 09:00")).toBeDefined();
    expect(
      screen.queryByRole("button", { name: "Salvar na biblioteca pessoal" })
    ).toBeNull();
  });
});
