import { describe, expect, test } from "vitest";
import { onlineMembersFromPresenceState } from "./community-presence";

describe("community presence", () => {
  test("deduplicates multiple tabs by the public username key", () => {
    const members = onlineMembersFromPresenceState({
      ana: [
        { displayName: "Ana", avatarUrl: null },
        { displayName: "Ana", avatarUrl: null },
      ],
    });

    expect(members).toEqual([
      { avatarUrl: null, displayName: "Ana", username: "ana" },
    ]);
  });

  test("keeps missing avatars and ignores unsafe presence payloads", () => {
    const members = onlineMembersFromPresenceState({
      "sem-avatar": [{ displayName: "Sem avatar", avatarUrl: null }],
      "com-avatar": [
        {
          displayName: "Com avatar",
          avatarUrl: "/api/member-assets?path=profile-assets/avatars/x.webp",
        },
      ],
      "avatar-inseguro": [
        { displayName: "Não usar", avatarUrl: "javascript:alert(1)" },
      ],
      "avatar-externo-relativo": [
        { displayName: "Não usar", avatarUrl: "//evil.example/avatar.png" },
      ],
      "chave inválida": [{ displayName: "Ignorar", avatarUrl: null }],
    });

    expect(members).toEqual([
      { avatarUrl: null, displayName: "Sem avatar", username: "sem-avatar" },
      {
        avatarUrl: "/api/member-assets?path=profile-assets/avatars/x.webp",
        displayName: "Com avatar",
        username: "com-avatar",
      },
      {
        avatarUrl: null,
        displayName: "Não usar",
        username: "avatar-inseguro",
      },
      {
        avatarUrl: null,
        displayName: "Não usar",
        username: "avatar-externo-relativo",
      },
    ]);
  });

  test("falls back to the username when the display name is missing", () => {
    expect(
      onlineMembersFromPresenceState({
        membro: [{ avatarUrl: null }],
      })
    ).toEqual([{ avatarUrl: null, displayName: "membro", username: "membro" }]);
  });

  test.each([
    0, 1, 5, 12,
  ])("maps the live count state with %i members", (count) => {
    const state = Object.fromEntries(
      Array.from({ length: count }, (_, index) => [
        ["membro", String(index)].join("-"),
        [{ displayName: ["Membro", String(index)].join(" "), avatarUrl: null }],
      ])
    );

    expect(onlineMembersFromPresenceState(state)).toHaveLength(count);
  });
});
