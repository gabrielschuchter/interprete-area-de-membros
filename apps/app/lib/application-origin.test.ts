import {
  resolveApplicationAuthOrigins,
  resolveApplicationOrigin,
} from "@repo/next-config/application-origin";
import { expect, test } from "vitest";

const canonicalOrigin = "https://membros.escolainterprete.com.br";

test("uses the configured HTTPS origin in Production", () => {
  expect(
    resolveApplicationOrigin({
      applicationUrl: `${canonicalOrigin}/ignored/path`,
      environment: "production",
      nodeEnvironment: "production",
    })
  ).toBe(canonicalOrigin);
  expect(
    resolveApplicationAuthOrigins({
      applicationUrl: canonicalOrigin,
      environment: "production",
      nodeEnvironment: "production",
    })
  ).toEqual([canonicalOrigin]);
});

test("fails closed when a deployed origin is missing or not HTTPS", () => {
  expect(() =>
    resolveApplicationOrigin({
      applicationUrl: "http://membros.escolainterprete.com.br",
      environment: "production",
      nodeEnvironment: "production",
    })
  ).toThrow("NEXT_PUBLIC_APP_URL must be a valid HTTPS URL");
  expect(() =>
    resolveApplicationOrigin({
      applicationUrl: "",
      environment: "production",
      nodeEnvironment: "production",
    })
  ).toThrow("NEXT_PUBLIC_APP_URL must be a valid HTTPS URL");
});

test("Preview public links and auth origins stay on the current branch", () => {
  const branchOrigin =
    "https://interprete-area-de-membro-git-domains-gabrielschuchters-projects.vercel.app";
  const deploymentOrigin =
    "https://interprete-area-de-membros-app-abc123-gabrielschuchters-projects.vercel.app";
  const configuration = {
    applicationUrl: canonicalOrigin,
    environment: "preview",
    branchUrl: branchOrigin.slice("https://".length),
    deploymentUrl: deploymentOrigin.slice("https://".length),
    nodeEnvironment: "production",
  };

  expect(resolveApplicationOrigin(configuration)).toBe(branchOrigin);
  expect(resolveApplicationAuthOrigins(configuration)).toEqual([
    branchOrigin,
    deploymentOrigin,
  ]);
});

test("Preview uses its deployment URL when no branch alias exists", () => {
  expect(
    resolveApplicationOrigin({
      applicationUrl: canonicalOrigin,
      environment: "preview",
      deploymentUrl:
        "interprete-area-de-membros-app-abc123-gabrielschuchters-projects.vercel.app",
      nodeEnvironment: "production",
    })
  ).toBe(
    "https://interprete-area-de-membros-app-abc123-gabrielschuchters-projects.vercel.app"
  );
});

test("Preview never falls back to the Production origin", () => {
  expect(() =>
    resolveApplicationOrigin({
      applicationUrl: canonicalOrigin,
      environment: "preview",
      branchUrl: "",
      deploymentUrl: "",
      nodeEnvironment: "production",
    })
  ).toThrow("Vercel Preview requires VERCEL_BRANCH_URL or VERCEL_URL");
  expect(() =>
    resolveApplicationOrigin({
      applicationUrl: canonicalOrigin,
      environment: "preview",
      branchUrl: "http://preview.example.vercel.app",
      deploymentUrl: "",
      nodeEnvironment: "production",
    })
  ).toThrow("Vercel Preview requires VERCEL_BRANCH_URL or VERCEL_URL");
});

test("local development and tests accept localhost and have a local fallback", () => {
  expect(
    resolveApplicationOrigin({
      applicationUrl: "http://localhost:3101/some-path",
      environment: "development",
      nodeEnvironment: "development",
    })
  ).toBe("http://localhost:3101");
  expect(
    resolveApplicationOrigin({
      applicationUrl: "",
      environment: "development",
      nodeEnvironment: "development",
    })
  ).toBe("http://localhost:3000");
  expect(
    resolveApplicationOrigin({
      applicationUrl: "",
      environment: "",
      nodeEnvironment: "test",
    })
  ).toBe("http://localhost:3000");
});

test("local development rejects insecure non-loopback application origins", () => {
  expect(() =>
    resolveApplicationOrigin({
      applicationUrl: "http://preview.example.vercel.app",
      environment: "development",
      nodeEnvironment: "development",
    })
  ).toThrow("valid HTTPS URL");
});
