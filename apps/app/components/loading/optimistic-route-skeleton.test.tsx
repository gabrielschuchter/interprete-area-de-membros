import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { PortalTransition } from "@/app/(authenticated)/components/member-navigation-context";
import {
  OptimisticCover,
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

const pending = (targetPath: string): PortalTransition => ({
  corridor: null,
  direction: "enter",
  durationMs: 220,
  exitDurationMs: 0,
  href: targetPath,
  id: 1,
  kind: "std",
  phase: "committing",
  startedAt: 0,
  targetPath,
  vector: null,
});

describe("OptimisticCover", () => {
  test("covers the stage only when the route has not committed after 80 ms", () => {
    vi.useFakeTimers();
    window.history.pushState({}, "", "/estudar");
    const { container, rerender } = render(
      <OptimisticCover failed={false} pathname="/estudar" transition={null} />
    );

    rerender(
      <OptimisticCover
        failed={false}
        pathname="/estudar"
        transition={pending("/cursos")}
      />
    );
    act(() => vi.advanceTimersByTime(79));
    expect(container.querySelector("[data-optimistic-skeleton]")).toBeNull();

    act(() => vi.advanceTimersByTime(1));
    expect(
      container.querySelector("[data-optimistic-skeleton]")
    ).not.toBeNull();

    rerender(
      <OptimisticCover failed={false} pathname="/cursos" transition={null} />
    );
    expect(container.querySelector("[data-optimistic-skeleton]")).toBeNull();
  });

  test("stays hidden when the destination commits within 80 ms", () => {
    vi.useFakeTimers();
    window.history.pushState({}, "", "/estudar");
    const { container, rerender } = render(
      <OptimisticCover
        failed={false}
        pathname="/estudar"
        transition={pending("/cursos")}
      />
    );

    window.history.pushState({}, "", "/cursos");
    rerender(
      <OptimisticCover failed={false} pathname="/cursos" transition={null} />
    );
    act(() => vi.advanceTimersByTime(200));

    expect(container.querySelector("[data-optimistic-skeleton]")).toBeNull();
  });
});
