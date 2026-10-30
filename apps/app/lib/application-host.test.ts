import { expect, test } from "vitest";
import { getLegacyApplicationRedirect } from "./application-host";

const canonicalOrigin = "https://membros.escolainterprete.com.br";

test("redirects the old public Vercel host and preserves path and query", () => {
  const redirect = getLegacyApplicationRedirect(
    "https://interprete-area-de-membros.vercel.app/comunidade?aba=grupos",
    canonicalOrigin
  );

  expect(redirect?.href).toBe(`${canonicalOrigin}/comunidade?aba=grupos`);
});

test("redirects the project alias and preserves the Clerk return path", () => {
  const oldReturnUrl = new URL(
    "https://interprete-area-de-membros.vercel.app/gestao?turma=abc"
  ).href;
  const legacyUrl = new URL(
    "https://interprete-area-de-membros-app.vercel.app/sign-in"
  );
  legacyUrl.searchParams.set("redirect_url", oldReturnUrl);

  const redirect = getLegacyApplicationRedirect(legacyUrl, canonicalOrigin);

  expect(redirect?.origin).toBe(canonicalOrigin);
  expect(redirect?.pathname).toBe("/sign-in");
  expect(redirect?.searchParams.get("redirect_url")).toBe(
    `${canonicalOrigin}/gestao?turma=abc`
  );
});

test("converges legacy login links directly on the canonical sign-in route", () => {
  const redirect = getLegacyApplicationRedirect(
    "https://interprete-area-de-membros.vercel.app/login?redirect_url=%2Fgestao",
    canonicalOrigin
  );

  expect(redirect?.href).toBe(
    `${canonicalOrigin}/sign-in?redirect_url=%2Fgestao`
  );
});

test("rewrites Clerk's camel-case redirectUrl parameter", () => {
  const redirect = getLegacyApplicationRedirect(
    "https://interprete-area-de-membros.vercel.app/sign-in?redirectUrl=https%3A%2F%2Finterprete-area-de-membros-app.vercel.app%2Fperfil",
    canonicalOrigin
  );

  expect(redirect?.searchParams.get("redirectUrl")).toBe(
    `${canonicalOrigin}/perfil`
  );
});

test("does not change unrelated external return URLs or invent a return path", () => {
  const externalReturnUrl = "https://example.org/continue";
  const external = getLegacyApplicationRedirect(
    `https://interprete-area-de-membros.vercel.app/sign-in?redirect_url=${encodeURIComponent(externalReturnUrl)}`,
    canonicalOrigin
  );
  const withoutReturnUrl = getLegacyApplicationRedirect(
    "https://interprete-area-de-membros.vercel.app/sign-in",
    canonicalOrigin
  );

  expect(external?.searchParams.get("redirect_url")).toBe(externalReturnUrl);
  expect(withoutReturnUrl?.searchParams.has("redirect_url")).toBe(false);
});

test("does not redirect unrelated hosts", () => {
  expect(
    getLegacyApplicationRedirect(
      "https://membros.escolainterprete.com.br/sign-in",
      canonicalOrigin
    )
  ).toBeNull();
});
