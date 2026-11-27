import { describe, expect, it } from "vitest";
import { timerCompletionCopy } from "./focus-timer-audio";

describe("timerCompletionCopy", () => {
  it("avisa foco concluído e manda para a pausa", () => {
    const copy = timerCompletionCopy("FOCUS");
    expect(copy.title).toBe("Foco concluído");
    expect(copy.body).toContain("pausa");
  });

  it("avisa pausa concluída para pausa curta e longa", () => {
    expect(timerCompletionCopy("SHORT_BREAK").title).toBe("Pausa concluída");
    expect(timerCompletionCopy("LONG_BREAK").title).toBe("Pausa concluída");
  });

  it("usa texto neutro para cronômetro livre ou modo desconhecido", () => {
    expect(timerCompletionCopy("STOPWATCH").title).toBe("Sessão concluída");
    expect(timerCompletionCopy(undefined).title).toBe("Sessão concluída");
  });
});
