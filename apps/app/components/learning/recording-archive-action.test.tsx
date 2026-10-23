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

const roomFlag = vi.hoisted(() => ({ value: "false" }));
vi.mock("@/env", () => ({
  env: {
    get ROOM_V2_ENABLED() {
      return roomFlag.value;
    },
  },
}));

import { RecordingArchiveAction } from "./recording-archive-action";

describe("RecordingArchiveAction", () => {
  afterEach(() => {
    cleanup();
    roomFlag.value = "false";
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

  test("opens every video in the room when it is on, even without a source", () => {
    roomFlag.value = "true";
    render(
      <RecordingArchiveAction
        assetId="asset 1"
        isVideo
        mediaProvider="YOUTUBE"
      />
    );

    expect(
      screen.getByRole("link", { name: "Abrir gravação" }).getAttribute("href")
    ).toBe("/encontros/gravacoes/asset%201");
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("keeps documents as direct downloads when the room is on", () => {
    roomFlag.value = "true";
    render(<RecordingArchiveAction assetId="doc-1" isVideo={false} />);

    expect(
      screen.getByRole("link", { name: "Abrir material" }).getAttribute("href")
    ).toBe("/api/learning/assets/doc-1");
  });
});
