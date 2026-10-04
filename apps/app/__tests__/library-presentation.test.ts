import { describe, expect, it } from "vitest";
import {
  libraryAccessLabel,
  libraryDifficultyLabel,
  libraryLanguageLabel,
} from "../lib/library-presentation";

describe("rótulos dos materiais da biblioteca", () => {
  it("apresenta idiomas mistos sem perder códigos desconhecidos", () => {
    expect(libraryLanguageLabel("en,pt/xx")).toBe("English · Português · xx");
    expect(libraryLanguageLabel(null)).toBe("Idioma não informado");
  });

  it("distingue acesso aberto, leitura e ferramentas gratuitas", () => {
    expect(libraryAccessLabel("OPEN_ACCESS")).toBe("Acesso aberto");
    expect(libraryAccessLabel("FREE_TO_READ")).toBe("Leitura gratuita");
    expect(libraryAccessLabel("FREE_TOOL")).toBe("Ferramenta gratuita");
    expect(libraryDifficultyLabel("ADVANCED")).toBe("Avançado");
    expect(libraryDifficultyLabel(null)).toBe("Nível não informado");
  });
});
