import { describe, expect, test } from "vitest";
import {
  type CommunityDraftSnapshot,
  communityDraftSnapshotsEqual,
  hasCommunityDraftContent,
  nextCommunityPostVersion,
} from "./community-draft-contract";

const emptySnapshot: CommunityDraftSnapshot = {
  content: "",
  contentJson: { type: "doc", content: [{ type: "paragraph" }] },
  coverUrl: null,
  spaceId: null,
  subtitle: null,
  tags: [],
  title: "Rascunho sem título",
};

describe("community draft persistence contract", () => {
  test("does not persist a draft when the editor is only opened", () => {
    expect(hasCommunityDraftContent(emptySnapshot)).toBe(false);
    expect(
      hasCommunityDraftContent({ ...emptySnapshot, spaceId: "group-1" })
    ).toBe(false);
  });

  test("persists the first actual title, body, subtitle, tag, or cover edit", () => {
    expect(
      hasCommunityDraftContent({ ...emptySnapshot, title: "Uma ideia" })
    ).toBe(true);
    expect(
      hasCommunityDraftContent({ ...emptySnapshot, content: "Texto" })
    ).toBe(true);
    expect(
      hasCommunityDraftContent({ ...emptySnapshot, subtitle: "Contexto" })
    ).toBe(true);
    expect(hasCommunityDraftContent({ ...emptySnapshot, tags: ["bio"] })).toBe(
      true
    );
    expect(
      hasCommunityDraftContent({ ...emptySnapshot, coverUrl: "/cover.webp" })
    ).toBe(true);
  });

  test("compares persisted snapshots independent of JSON object key order", () => {
    const saved = {
      ...emptySnapshot,
      content: "Texto",
      contentJson: { type: "doc", attrs: { align: "left", indent: 0 } },
      title: "Título",
    };
    const retried = {
      ...saved,
      contentJson: { attrs: { indent: 0, align: "left" }, type: "doc" },
    };

    expect(communityDraftSnapshotsEqual(saved, retried)).toBe(true);
    expect(
      communityDraftSnapshotsEqual(saved, { ...retried, title: "Outro" })
    ).toBe(false);
  });

  test("uses a strictly increasing updatedAt token when writes share a millisecond", () => {
    const expected = new Date("2026-10-20T15:30:00.123Z");

    expect(
      nextCommunityPostVersion(expected, expected.getTime()).getTime()
    ).toBe(expected.getTime() + 1);
    expect(
      nextCommunityPostVersion(expected, expected.getTime() + 20).getTime()
    ).toBe(expected.getTime() + 20);
  });
});
