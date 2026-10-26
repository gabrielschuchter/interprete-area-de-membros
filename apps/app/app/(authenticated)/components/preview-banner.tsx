import { cookies } from "next/headers";
import {
  decodePreviewToken,
  previewCookieName,
  previewRealCookieName,
} from "@/lib/preview-session";

const css = `
body{padding-top:48px}
.gestao-preview-banner{position:fixed;inset:0 0 auto 0;z-index:2147483000;display:flex;gap:16px;align-items:center;justify-content:center;flex-wrap:wrap;min-height:48px;padding:8px 16px;font:500 14px/1.3 system-ui,sans-serif;color:#fff;background:#8c1432}
.gestao-preview-banner a{padding:6px 12px;font-weight:600;color:#fff;text-decoration:none;border:1px solid rgb(255 255 255 / 70%);border-radius:6px}
.gestao-preview-banner a.gestao-preview-banner__exit{color:#8c1432;background:#fff}
`;

/** Barra fixa das telas do aluno enquanto "Ver como aluno" está ativo. */
export const PreviewBanner = async () => {
  const jar = await cookies();
  // Sob /gestao o cookie-marcador existe: a Gestão usa a identidade real.
  if (jar.has(previewRealCookieName)) {
    return null;
  }
  const token = decodePreviewToken(jar.get(previewCookieName)?.value);
  if (!token) {
    return null;
  }
  return (
    <>
      <style>{css}</style>
      <output className="gestao-preview-banner">
        <span>
          Você está vendo como <strong>{token.label}</strong>. Nada aqui altera
          dados.
        </span>
        <a href="/gestao/previa">Trocar</a>
        <a className="gestao-preview-banner__exit" href="/gestao/previa/sair">
          Sair da prévia
        </a>
      </output>
    </>
  );
};
