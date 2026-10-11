import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

vi.mock("@repo/auth/proxy", () => ({
  authMiddleware: (handler: unknown) => handler,
}));
vi.mock("@repo/auth/clerk-proxy", () => ({
  shouldProxyClerkFrontendApi: () => false,
}));
vi.mock("@repo/security/proxy", () => ({
  noseconeOptions: {},
  securityMiddleware: () => () => new Response(null, { status: 200 }),
}));
vi.mock("@/env", () => ({ env: { APP_WRITE_FREEZE: "false" } }));

import proxy from "./proxy";

const routes = [
  "/estudar",
  "/exercicios/favoritas",
  "/ferramentas?view=notes",
  "/planejamento?view=tasks",
  "/salvos",
  "/tarefas",
];
const protect = vi.fn();
const auth = Object.assign(vi.fn(), { protect });
const run = proxy as unknown as (
  authentication: typeof auth,
  request: NextRequest
) => Promise<Response>;

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ sessionStatus: "active", isAuthenticated: true });
});

test.each(routes)("protects member route %s", async (route) => {
  const response = await run(
    auth,
    new NextRequest(`https://example.test${route}`)
  );
  expect(protect).toHaveBeenCalledOnce();
  expect(response.status).toBe(200);
});

test.each(routes)("resumes a pending Clerk task before %s", async (route) => {
  auth.mockResolvedValue({ sessionStatus: "pending", isAuthenticated: false });
  const response = await run(
    auth,
    new NextRequest(`https://example.test${route}`)
  );
  const location = new URL(response.headers.get("location") as string);
  expect(location.pathname).toBe("/session-tasks");
  expect(location.searchParams.get("redirect_url")).toBe(route);
  expect(protect).not.toHaveBeenCalled();
});

test("keeps public health checks outside member protection", async () => {
  await run(auth, new NextRequest("https://example.test/health"));
  expect(auth).not.toHaveBeenCalled();
  expect(protect).not.toHaveBeenCalled();
});
