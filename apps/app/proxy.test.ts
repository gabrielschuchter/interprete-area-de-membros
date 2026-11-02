import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  canEnter: vi.fn(),
  authentication: Object.assign(vi.fn(), { protect: vi.fn() }),
  env: {
    APP_WRITE_FREEZE: "false",
    GESTAO_V2_ENABLED: "true",
    NEXT_PUBLIC_APP_URL: "https://membros.escolainterprete.com.br",
  },
}));
vi.mock("./lib/gestao-route-authorization", () => ({
  canEnterGestaoRoute: boundary.canEnter,
}));

vi.mock("@repo/auth/proxy", () => ({
  authMiddleware:
    (
      handler: (
        auth: typeof boundary.authentication,
        request: NextRequest
      ) => Promise<Response>
    ) =>
    (request: NextRequest) =>
      handler(boundary.authentication, request),
}));
vi.mock("@repo/security/proxy", () => ({
  noseconeOptions: {},
  securityMiddleware: () => async () =>
    NextResponse.next({ headers: { "X-Frame-Options": "DENY" } }),
}));
vi.mock("@/env", () => ({ env: boundary.env }));

import proxy from "./proxy";

const routes = [
  "/estudar",
  "/exercicios/favoritas",
  "/ferramentas?view=notes",
  "/planejamento?view=tasks",
  "/salvos",
  "/tarefas",
  "/gestao",
  "/gestao/alunos/turmas?busca=qa",
  "/professor/conteudo?aba=rascunhos",
];
const auth = boundary.authentication;
const protect = auth.protect;
const run = proxy as unknown as (request: NextRequest) => Promise<Response>;

beforeEach(() => {
  vi.clearAllMocks();
  boundary.env.GESTAO_V2_ENABLED = "true";
  boundary.canEnter.mockResolvedValue(true);
  auth.mockResolvedValue({
    sessionStatus: "active",
    isAuthenticated: true,
    userId: "qa-current",
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test.each(routes)("protects member route %s", async (route) => {
  const response = await run(new NextRequest(`https://example.test${route}`));
  expect(protect).toHaveBeenCalledOnce();
  expect(response.status).toBe(200);
});

test.each(routes)("resumes a pending Clerk task before %s", async (route) => {
  auth.mockResolvedValue({ sessionStatus: "pending", isAuthenticated: false });
  const response = await run(new NextRequest(`https://example.test${route}`));
  const location = new URL(response.headers.get("location") as string);
  expect(location.pathname).toBe("/session-tasks");
  expect(location.searchParams.get("redirect_url")).toBe(route);
  expect(protect).not.toHaveBeenCalled();
});

test.each(
  routes
)("preserves the unauthenticated destination for %s", async (route) => {
  auth.mockResolvedValue({ sessionStatus: null, isAuthenticated: false });
  const response = await run(new NextRequest(`https://example.test${route}`));
  const location = new URL(response.headers.get("location") as string);
  expect(location.pathname).toBe("/sign-in");
  expect(location.searchParams.get("redirect_url")).toBe(route);
  expect(protect).not.toHaveBeenCalled();
});

test("keeps public health checks outside member protection", async () => {
  await run(new NextRequest("https://example.test/health"));
  expect(auth).not.toHaveBeenCalled();
  expect(protect).not.toHaveBeenCalled();
});

test("sets a private 403 before a denied page starts streaming", async () => {
  boundary.canEnter.mockResolvedValue(false);
  const response = await run(
    new NextRequest("https://example.test/gestao/administracao")
  );
  expect(response.status).toBe(403);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("x-frame-options")).toBe("DENY");
  expect(response.headers.get("x-middleware-next")).toBe("1");
  expect(boundary.canEnter).toHaveBeenCalledWith(
    "qa-current",
    "/gestao/administracao",
    undefined
  );
});

test("denies a write before dispatch and without rendering a protected page", async () => {
  boundary.canEnter.mockResolvedValue(false);
  const response = await run(
    new NextRequest("https://example.test/gestao/administracao", {
      method: "POST",
    })
  );
  expect(response.status).toBe(403);
  expect(response.headers.get("x-middleware-next")).toBeNull();
  expect(await response.json()).toEqual({
    error: "Você não tem mais acesso a esta área.",
  });
});

test("does not load Gestão role data when the release flag is off", async () => {
  boundary.env.GESTAO_V2_ENABLED = "false";
  await run(new NextRequest("https://example.test/gestao"));
  expect(boundary.canEnter).not.toHaveBeenCalled();
});

test("rejects repeated cohort selectors before a page can stream a widened result", async () => {
  const response = await run(
    new NextRequest("https://example.test/gestao?turma=own&turma=foreign")
  );
  expect(response.status).toBe(403);
  expect(boundary.canEnter).not.toHaveBeenCalled();
});

test("redirects old Production aliases to the canonical HTTPS origin", async () => {
  vi.stubEnv("VERCEL_ENV", "production");
  const response = await run(
    new NextRequest(
      "https://interprete-area-de-membros.vercel.app/comunidade?aba=grupos"
    )
  );

  expect(response.status).toBe(308);
  expect(response.headers.get("location")).toBe(
    "https://membros.escolainterprete.com.br/comunidade?aba=grupos"
  );
});

test("rejects writes to legacy Production aliases without replaying their bodies", async () => {
  vi.stubEnv("VERCEL_ENV", "production");
  const response = await run(
    new NextRequest(
      "https://interprete-area-de-membros.vercel.app/comunidade/actions",
      { method: "POST", body: "payload" }
    )
  );

  expect(response.status).toBe(421);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(auth).not.toHaveBeenCalled();
});
