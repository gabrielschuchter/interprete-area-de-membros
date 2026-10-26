import { describe, expect, it } from "vitest";
import {
  autoPortalNote,
  parseCursosBlocks,
  parsePortalNote,
} from "./personalization-domain";

describe("personalização", () => {
  it("completa e ordena blocos salvos sem confiar neles", () => {
    const blocks = parseCursosBlocks([
      { enabled: false, id: "collections", title: " Curadoria " },
      { id: "desconhecido" },
      { id: "collections" },
      { id: "resume", enabled: true },
    ]);
    expect(blocks.map((block) => block.id)).toEqual([
      "resume",
      "collections",
      "recordings",
    ]);
    expect(blocks[1]).toMatchObject({ enabled: false, title: "Curadoria" });
  });

  it("volta ao padrão quando o valor salvo está corrompido", () => {
    expect(parseCursosBlocks("quebrado").map((block) => block.id)).toEqual([
      "resume",
      "recordings",
      "collections",
    ]);
    expect(parsePortalNote(null)).toEqual({
      enabled: false,
      mode: "auto",
      text: "",
    });
  });

  it("limita a nota manual a 140 caracteres", () => {
    const note = parsePortalNote({
      enabled: true,
      mode: "manual",
      text: "a".repeat(400),
    });
    expect(note.text).toHaveLength(140);
  });

  it("monta a nota automática de hoje e de amanhã", () => {
    const now = new Date("2026-10-26T15:00:00Z");
    expect(
      autoPortalNote(
        { startsAt: new Date("2026-10-26T22:30:00Z"), title: "Mentoria" },
        now
      )
    ).toBe("Encontro hoje, 19h30.");
    expect(
      autoPortalNote(
        { startsAt: new Date("2026-10-27T22:30:00Z"), title: "Mentoria" },
        now
      )
    ).toBe("Encontro amanhã, 19h30.");
    expect(
      autoPortalNote(
        { startsAt: new Date("2026-10-30T22:30:00Z"), title: "Mentoria" },
        now
      )
    ).toBeNull();
  });
});
