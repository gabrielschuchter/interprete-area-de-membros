import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const token = {
  actorId: "prof",
  expiresAt: Date.now() + 60_000,
  label: "aluno da Turma X",
  targetId: "aluno",
};

describe("sessão de prévia", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.GESTAO_PREVIEW_SECRET = "segredo-de-teste";
  });

  it("aceita um token assinado e dentro do prazo", async () => {
    const { decodePreviewToken, encodePreviewToken } = await import(
      "./preview-session"
    );
    const encoded = encodePreviewToken(token);
    expect(decodePreviewToken(encoded ?? undefined)).toEqual(token);
  });

  it("recusa token adulterado, vencido ou assinado com outra chave", async () => {
    const { decodePreviewToken, encodePreviewToken } = await import(
      "./preview-session"
    );
    const encoded = encodePreviewToken(token) ?? "";
    const [body, signature] = encoded.split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...token, targetId: "outro" })
    ).toString("base64url");
    expect(decodePreviewToken(`${forged}.${signature}`)).toBeNull();
    expect(decodePreviewToken(encoded, token.expiresAt + 1)).toBeNull();
    process.env.GESTAO_PREVIEW_SECRET = "outra-chave";
    expect(decodePreviewToken(`${body}.${signature}`)).toBeNull();
  });

  it("não funciona sem segredo", async () => {
    process.env.GESTAO_PREVIEW_SECRET = "";
    Reflect.deleteProperty(process.env, "GESTAO_PREVIEW_SECRET");
    Reflect.deleteProperty(process.env, "CLERK_SECRET_KEY");
    const { encodePreviewToken } = await import("./preview-session");
    expect(encodePreviewToken(token)).toBeNull();
  });
});
