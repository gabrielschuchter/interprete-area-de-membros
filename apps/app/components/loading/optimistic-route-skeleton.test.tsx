import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  OptimisticRouteSkeleton,
  skeletonForPath,
} from "./optimistic-route-skeleton";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("skeletonForPath", () => {
  test.each([
    "/estudar",
    "/cursos",
    "/biblioteca",
    "/comunidade/grupos",
    "/encontros/gravacoes",
    "/perfil",
    "/membros",
    "/notificacoes",
    "/configuracoes",
    "/rota-desconhecida",
  ])("returns a placeholder for %s", (pathname) => {
    const { container } = render(skeletonForPath(pathname));

    expect(container.querySelector("[data-route-loading]")).not.toBeNull();
    expect(container.querySelector("[data-slot='skeleton']")).not.toBeNull();
  });
});

describe("OptimisticRouteSkeleton", () => {
  test("is hidden from assistive technology and covers the stage", () => {
    const { container } = render(
      <OptimisticRouteSkeleton onSettled={vi.fn()} targetPath="/cursos" />
    );

    const cover = container.querySelector("[data-optimistic-skeleton]");
    expect(cover?.getAttribute("aria-hidden")).toBe("true");
    expect(cover?.className).toContain("absolute");
  });

  test("releases itself after eight seconds if the navigation never lands", () => {
    vi.useFakeTimers();
    const onSettled = vi.fn();
    render(
      <OptimisticRouteSkeleton onSettled={onSettled} targetPath="/cursos" />
    );

    vi.advanceTimersByTime(7999);
    expect(onSettled).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });
});
