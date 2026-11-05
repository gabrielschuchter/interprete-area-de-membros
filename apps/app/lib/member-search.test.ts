import { describe, expect, test } from "vitest";
import {
  foldForSearch,
  memberSearchTerm,
  rankMemberMatches,
} from "./member-search";

const people = [
  { displayName: "Ana Beatriz", headline: null, username: "ana-beatriz" },
  { displayName: "João Silva", headline: "Nutrição clínica", username: "joao" },
  { displayName: "Maria João", headline: null, username: "mariaj" },
  { displayName: null, headline: null, username: "gabriel" },
];

describe("member search", () => {
  test("drops the leading @ and trims", () => {
    expect(memberSearchTerm("  @@gabriel ")).toBe("gabriel");
    expect(memberSearchTerm("@")).toBe("");
  });

  test("folds accents and case", () => {
    expect(foldForSearch("João")).toBe("joao");
  });

  test("matches with or without @ and accents, prefix matches first", () => {
    const withAt = rankMemberMatches(people, "@joao").map((p) => p.username);
    const plain = rankMemberMatches(people, "João").map((p) => p.username);
    expect(withAt).toEqual(["joao", "mariaj"]);
    expect(plain).toEqual(withAt);
  });

  test("requires every typed word and searches the headline", () => {
    expect(
      rankMemberMatches(people, "joao nutricao").map((p) => p.username)
    ).toEqual(["joao"]);
    expect(rankMemberMatches(people, "joao zzz")).toEqual([]);
  });

  test("an empty search keeps everyone in the given order", () => {
    expect(rankMemberMatches(people, "@")).toHaveLength(4);
  });

  test("finds a profile without display name by username", () => {
    expect(rankMemberMatches(people, "@gab").map((p) => p.username)).toEqual([
      "gabriel",
    ]);
  });
});
