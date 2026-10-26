import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * "Ver como aluno": um cookie assinado, só para professor ou administrador,
 * que troca a identidade lida nas telas do aluno. Um segundo cookie, enviado
 * apenas sob /gestao, avisa que a Gestão deve continuar com a identidade real.
 */
export const previewCookieName = "gestao_preview";
export const previewRealCookieName = "gestao_preview_real";
export const previewLifetimeSeconds = 30 * 60;

export interface PreviewToken {
  /** Quem iniciou a prévia (membro real, sempre da equipe). */
  readonly actorId: string;
  readonly expiresAt: number;
  /** Texto da barra: "aluno da Turma X" ou o nome do aluno. */
  readonly label: string;
  /** Membro cuja visão é exibida. */
  readonly targetId: string;
}

const secret = () =>
  process.env.GESTAO_PREVIEW_SECRET ?? process.env.CLERK_SECRET_KEY ?? null;

const sign = (body: string, key: string) =>
  createHmac("sha256", key)
    .update(`gestao-preview.v1.${body}`)
    .digest("base64url");

export const isPreviewAvailable = () => Boolean(secret());

export const encodePreviewToken = (token: PreviewToken) => {
  const key = secret();
  if (!key) {
    return null;
  }
  const body = Buffer.from(JSON.stringify(token)).toString("base64url");
  return `${body}.${sign(body, key)}`;
};

export const decodePreviewToken = (
  value: string | undefined,
  now = Date.now()
): PreviewToken | null => {
  const key = secret();
  if (!(key && value) || value.length > 2000) {
    return null;
  }
  const [body, signature] = value.split(".");
  if (!(body && signature)) {
    return null;
  }
  const expected = sign(body, key);
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString());
    if (
      typeof parsed?.actorId === "string" &&
      typeof parsed?.targetId === "string" &&
      typeof parsed?.label === "string" &&
      typeof parsed?.expiresAt === "number" &&
      parsed.expiresAt > now
    ) {
      return parsed as PreviewToken;
    }
  } catch {
    return null;
  }
  return null;
};
