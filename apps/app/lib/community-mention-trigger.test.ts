import { describe, expect, test } from "vitest";
import {
  detectMentionTrigger,
  isDismissedMention,
  mentionAtomPlaceholder,
} from "./community-mention-trigger";

describe("mention trigger", () => {
  test("opens at the start of the text and after whitespace", () => {
    expect(detectMentionTrigger("@")).toEqual({ query: "", start: 0 });
    expect(detectMentionTrigger("oi @ga")).toEqual({ query: "ga", start: 3 });
    expect(detectMentionTrigger("linha\n@")).toEqual({ query: "", start: 6 });
  });

  test("does not open inside a word or an e-mail", () => {
    expect(detectMentionTrigger("fulano@dominio")).toBeNull();
    expect(detectMentionTrigger("fulano@")).toBeNull();
    expect(detectMentionTrigger("@@")).toBeNull();
  });

  test("an abandoned @ is plain text and the next @ opens again", () => {
    expect(detectMentionTrigger("@tte ")).toBeNull();
    expect(detectMentionTrigger("@tte @")).toEqual({ query: "", start: 5 });
    expect(detectMentionTrigger("@tte\n\n@")).toEqual({ query: "", start: 6 });
  });

  test("a second @ after a confirmed mention opens the list", () => {
    const mention = mentionAtomPlaceholder;
    expect(detectMentionTrigger(`${mention} e @`)).toEqual({
      query: "",
      start: 4,
    });
    expect(detectMentionTrigger(`${mention} ${mention} @ra`)).toEqual({
      query: "ra",
      start: 4,
    });
  });

  test("an @ glued to a confirmed mention is not a trigger", () => {
    expect(detectMentionTrigger(`${mentionAtomPlaceholder}@`)).toBeNull();
  });

  test("keeps accents, dots, dashes and underscores in the query", () => {
    expect(detectMentionTrigger("@joão.silva-2_x")?.query).toBe(
      "joão.silva-2_x"
    );
  });

  test("Esc dismisses one @ only", () => {
    expect(isDismissedMention(3, 3)).toBe(true);
    expect(isDismissedMention(9, 3)).toBe(false);
    expect(isDismissedMention(null, 3)).toBe(false);
    expect(isDismissedMention(3, null)).toBe(false);
  });
});
