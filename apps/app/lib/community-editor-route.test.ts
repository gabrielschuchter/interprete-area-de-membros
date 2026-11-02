import { describe, expect, it } from "vitest";
import { isCommunityEditorRoute } from "./community-editor-route";

describe("isCommunityEditorRoute", () => {
  it("reconhece a criação e a edição de publicações", () => {
    expect(isCommunityEditorRoute("/comunidade/novo")).toBe(true);
    expect(isCommunityEditorRoute("/comunidade/editor/abc123")).toBe(true);
    expect(isCommunityEditorRoute("/comunidade/editor/abc123", null)).toBe(
      true
    );
  });

  it("mantém o shell na pré-visualização", () => {
    expect(isCommunityEditorRoute("/comunidade/editor/abc123", "1")).toBe(
      false
    );
  });

  it("não afeta outras rotas da Comunidade", () => {
    expect(isCommunityEditorRoute("/comunidade")).toBe(false);
    expect(isCommunityEditorRoute("/comunidade/grupos/novo")).toBe(false);
    expect(isCommunityEditorRoute("/comunidade/meus-topicos")).toBe(false);
    expect(isCommunityEditorRoute("/estudar")).toBe(false);
  });
});
