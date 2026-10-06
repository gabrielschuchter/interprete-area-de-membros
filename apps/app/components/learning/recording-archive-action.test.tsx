import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    readonly children: ReactNode;
    readonly href: string;
  }) => (
    <a {...props} href={href}>
      {children}
    </a>
  ),
}));

import { RecordingArchiveAction } from "./recording-archive-action";

describe("RecordingArchiveAction", () => {
  afterEach(() => {
    cleanup();
  });

  test("shows the unavailable source and no dead link for an unconfigured video", () => {
    render(
      <RecordingArchiveAction
        assetId="asset-1"
        isVideo
        mediaProvider="YOUTUBE"
      />
    );

    expect(screen.getByRole("status").textContent).toContain(
      "fonte do vídeo original ainda não está associada"
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("keeps the player link when a valid YouTube source is configured", () => {
    render(
      <RecordingArchiveAction
        assetId="asset-1"
        isVideo
        mediaExternalId="abcdefghijk"
        mediaProvider="YOUTUBE"
      />
    );

    expect(
      screen.getByRole("link", { name: "Abrir gravação" }).getAttribute("href")
    ).toBe("/encontros/gravacoes?asset=asset-1#asset-asset-1");
  });
});
