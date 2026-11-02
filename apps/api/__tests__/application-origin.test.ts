import { expect, test } from "vitest";
import { resolveApiOrigin } from "../lib/application-origin";

test("Production metadata uses the API project's own hostname", () => {
  expect(
    resolveApiOrigin({
      environment: "production",
      productionUrl: "interprete-area-de-membros-api.vercel.app",
      nodeEnvironment: "production",
    })
  ).toBe("https://interprete-area-de-membros-api.vercel.app");
});

test("Production can use an explicit API origin and fails closed without one", () => {
  expect(
    resolveApiOrigin({
      environment: "production",
      configuredUrl: "https://api.escolainterprete.com.br/v1",
      nodeEnvironment: "production",
    })
  ).toBe("https://api.escolainterprete.com.br");
  expect(() =>
    resolveApiOrigin({
      environment: "production",
      nodeEnvironment: "production",
    })
  ).toThrow("VERCEL_PROJECT_PRODUCTION_URL or NEXT_PUBLIC_API_URL");
});

test("Preview metadata stays on its API branch or immutable deployment", () => {
  expect(
    resolveApiOrigin({
      environment: "preview",
      productionUrl: "interprete-area-de-membros-api.vercel.app",
      branchUrl: "api-git-domain-fix.vercel.app",
      deploymentUrl: "api-8f31a.vercel.app",
      nodeEnvironment: "production",
    })
  ).toBe("https://api-git-domain-fix.vercel.app");
  expect(
    resolveApiOrigin({
      environment: "preview",
      deploymentUrl: "api-8f31a.vercel.app",
      nodeEnvironment: "production",
    })
  ).toBe("https://api-8f31a.vercel.app");
});

test("Preview fails closed when no API Preview origin is supplied", () => {
  expect(() =>
    resolveApiOrigin({
      environment: "preview",
      productionUrl: "interprete-area-de-membros-api.vercel.app",
      nodeEnvironment: "production",
    })
  ).toThrow("Vercel Preview requires VERCEL_BRANCH_URL or VERCEL_URL");
});

test("local API metadata uses its own loopback origin", () => {
  expect(
    resolveApiOrigin({
      environment: "development",
      nodeEnvironment: "development",
    })
  ).toBe("http://localhost:3002");
});
