#!/usr/bin/env node
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { greenBrowserContext } from "./green-preview-browser.mjs";
import { recordQaFixtures, writeProtectedJson } from "./green-qa-ledger.mjs";
import { validateGreenFlows } from "./qa-green-flows.mjs";
import { greenLocalEnvironment } from "./run-green-local.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const APP_ORIGIN = process.env.GREEN_QA_APP_ORIGIN ?? "http://localhost:3100";
const databaseRequire = createRequire(
  path.join(ROOT, "packages/database/package.json")
);
const playwrightRequire = createRequire(
  path.join(
    process.env.APPDATA,
    "npm/node_modules/@playwright/cli/package.json"
  )
);
const { chromium } = playwrightRequire("playwright");
const { Client } = databaseRequire("pg");
const ONBOARDING_ACTION =
  /^(Começar|Continuar|Guardar preferências|Entrar no Interprete)$/;
const PREVIEW_HOST =
  /^interprete-area-de-membros-[a-z0-9]{9}-gabrielschuchters-projects\.vercel\.app$/;

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Sequential integration gates deliberately share one authenticated browser and guarded database connection.
const main = async () => {
  let previewBypass;
  const origin = new URL(APP_ORIGIN);
  if (
    APP_ORIGIN !== "http://localhost:3100" &&
    !(
      origin.protocol === "https:" &&
      PREVIEW_HOST.test(origin.hostname) &&
      origin.pathname === "/"
    )
  ) {
    throw new Error("QA refuses Production or an unknown origin.");
  }
  if (origin.protocol === "https:") {
    const authFile = JSON.parse(
      fs.readFileSync(
        path.join(process.env.APPDATA, "com.vercel.cli/Data/auth.json")
      )
    );
    const response = await fetch(
      `https://api.vercel.com/v13/deployments/${origin.hostname}?teamId=team_CCjIuZlYnLPF0Bjgc74lGy9H`,
      { headers: { Authorization: `Bearer ${authFile.token}` } }
    );
    const deployment = await response.json();
    if (
      !response.ok ||
      deployment.target !== null ||
      deployment.projectId !== "prj_bwG8vDd4x2flyPaRMq8HEvi7t5Lj" ||
      deployment.meta.githubCommitRef !==
        "codex/interprete-member-area-release-2026-10-04"
    ) {
      throw new Error(
        "QA requires the independently verified Preview deployment."
      );
    }
    const projectResponse = await fetch(
      "https://api.vercel.com/v9/projects/prj_bwG8vDd4x2flyPaRMq8HEvi7t5Lj?teamId=team_CCjIuZlYnLPF0Bjgc74lGy9H",
      { headers: { Authorization: `Bearer ${authFile.token}` } }
    );
    const project = await projectResponse.json();
    if (!projectResponse.ok) {
      throw new Error("Cannot inspect existing Preview access.");
    }
    previewBypass = Object.keys(project.protectionBypass ?? {})[0];
  }
  const health = await fetch(`${APP_ORIGIN}/health`, {
    redirect: "manual",
    headers: previewBypass
      ? { "x-vercel-protection-bypass": previewBypass }
      : {},
  });
  if (!health.headers.get("content-type")?.includes("application/json")) {
    throw new Error(
      `Preview health did not return JSON (HTTP ${health.status}).`
    );
  }
  const healthState = await health.json();
  if (!health.ok || healthState.databaseProjectRef !== "qffqhilydtnrggbcnogh") {
    throw new Error("Runtime did not attest green before any QA mutation.");
  }
  const { env } = greenLocalEnvironment("app");
  const headers = {
    Authorization: `Bearer ${env.CLERK_SECRET_KEY}`,
    "Content-Type": "application/json",
  };
  const response = await fetch("https://api.clerk.com/v1/users?limit=100", {
    headers,
  });
  const users = await response.json();
  if (!(response.ok && Array.isArray(users)) || users.length !== 1) {
    throw new Error("Expected the one existing isolated Development identity.");
  }
  const user = users[0];
  const sql = new Client({
    connectionString: env.DIRECT_URL,
    ssl: {
      rejectUnauthorized: true,
      ca: fs.readFileSync(env.DATABASE_CA_CERT_PATH, "utf8"),
    },
  });
  await sql.connect();
  await recordQaFixtures(sql, user.id);
  const ticketResponse = await fetch(
    "https://api.clerk.com/v1/sign_in_tokens",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ user_id: user.id, expires_in_seconds: 60 }),
    }
  );
  const ticket = await ticketResponse.json();
  if (!(ticketResponse.ok && ticket.token)) {
    throw new Error(
      `Development sign-in token failed: HTTP ${ticketResponse.status}.`
    );
  }
  const browser = await chromium.launch({ headless: true });
  const context = await greenBrowserContext(
    browser,
    {
      viewport: { width: 1440, height: 1000 },
    },
    APP_ORIGIN,
    previewBypass
  );
  const page = await context.newPage();
  const faults = [];
  page.on("pageerror", (error) => faults.push(error.name));
  const requests = new Set();
  page.on("request", (request) => {
    if (request.url().includes("wkclodjbrynerfgufmyb.supabase.co")) {
      faults.push("Legacy Supabase request from green QA");
    }
    if (request.url().includes("supabase.co")) {
      requests.add(new URL(request.url()).hostname);
    }
  });
  page.on("websocket", (socket) => {
    if (socket.url().includes("supabase.co")) {
      requests.add(new URL(socket.url()).hostname);
    }
  });
  const report = {
    environment: origin.protocol === "https:" ? "preview" : "local",
    origin: APP_ORIGIN,
    projectRef: "qffqhilydtnrggbcnogh",
    productionChanged: false,
    sourceWrites: 0,
    checks: [],
    browserErrors: faults,
  };
  try {
    const initial = await sql.query(
      'SELECT count(*)::int AS count FROM public."Member" WHERE id=$1',
      [user.id]
    );
    report.developmentIdentityAlreadyInGreen = initial.rows[0].count > 0;
    await page.goto(`${APP_ORIGIN}/sign-in`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.Clerk?.loaded, { timeout: 60_000 });
    const result = await page.evaluate(async (token) => {
      const attempt = await window.Clerk.client.signIn.create({
        strategy: "ticket",
        ticket: token,
      });
      if (attempt.status !== "complete") {
        return { status: attempt.status };
      }
      await window.Clerk.setActive({ session: attempt.createdSessionId });
      return { status: "complete", active: !!window.Clerk.session };
    }, ticket.token);
    ticket.token = "";
    report.checks.push({
      name: "Clerk Development authentication",
      pass: result.status === "complete" && result.active,
    });
    await page.goto(APP_ORIGIN, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    report.landingPath = new URL(page.url()).pathname;
    report.memberAndProfile = (
      await sql.query(
        'SELECT (SELECT count(*)::int FROM public."Member" WHERE id=$1) AS members,(SELECT count(*)::int FROM public."Profile" WHERE "clerkUserId"=$1) AS profiles',
        [user.id]
      )
    ).rows[0];
    report.checks.push({
      name: "Clerk identity persisted only in green",
      pass:
        report.memberAndProfile.members === 1 &&
        report.memberAndProfile.profiles === 1,
    });
    if (report.landingPath === "/onboarding") {
      for (let step = 0; step < 7; step++) {
        if (
          await page.getByLabel("Nome de exibição", { exact: true }).count()
        ) {
          await page
            .getByLabel("Nome de exibição", { exact: true })
            .fill("QA Migração Green");
          await page.locator("#onboarding-username").fill("qa-migracao-green");
        }
        const next = page.getByRole("button", {
          name: ONBOARDING_ACTION,
        });
        if (!(await next.count())) {
          break;
        }
        await next.click();
        await page.waitForTimeout(1200);
        if (new URL(page.url()).pathname !== "/onboarding") {
          break;
        }
      }
    }
    const member = (
      await sql.query(
        'SELECT "onboardingStatus",role FROM public."Member" WHERE id=$1',
        [user.id]
      )
    ).rows[0];
    report.checks.push({
      name: "Onboarding UI persisted",
      pass: member.onboardingStatus === "COMPLETED",
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    report.checks.push({
      name: "Onboarding survives reload",
      pass: new URL(page.url()).pathname !== "/onboarding",
    });
    for (const route of [
      "/aprender",
      "/atividades",
      "/comunidade",
      "/biblioteca",
      "/membros/qa-migracao-green",
      "/configuracoes",
      "/encontros/gravacoes",
    ]) {
      const routeResponse = await page.goto(`${APP_ORIGIN}${route}`, {
        waitUntil: "domcontentloaded",
      });
      report.checks.push({
        name: `Member route ${route}`,
        pass:
          routeResponse.status() === 200 &&
          !(await page.getByText("Algo deu errado", { exact: true }).count()),
        status: routeResponse.status(),
      });
    }
    const prefResult = await context.request.put(
      `${APP_ORIGIN}/api/notifications/preferences`,
      { data: { mentions: false } }
    );
    const pref = (
      await sql.query(
        'SELECT mentions FROM public."NotificationPreference" WHERE "memberId"=$1',
        [user.id]
      )
    ).rows[0];
    report.checks.push({
      name: "API write persisted in green",
      pass: prefResult.status() === 200 && pref?.mentions === false,
      status: prefResult.status(),
    });
    for (const route of [
      "/api/notifications",
      "/api/notifications/preferences",
      "/api/search?q=curso",
      "/api/members/search?q=QA",
    ]) {
      const apiResponse = await context.request.get(`${APP_ORIGIN}${route}`);
      report.checks.push({
        name: `Authenticated API ${route.split("?")[0]}`,
        pass: apiResponse.status() === 200,
        status: apiResponse.status(),
      });
    }
    const unauth = await greenBrowserContext(
      browser,
      {},
      APP_ORIGIN,
      previewBypass
    );
    const rejected = await unauth.request.get(
      `${APP_ORIGIN}/api/notifications`
    );
    report.checks.push({
      name: "Unauthenticated API denied",
      pass: rejected.status() === 401,
      status: rejected.status(),
    });
    await unauth.close();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP_ORIGIN}/comunidade`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(1000);
    report.checks.push({
      name: "Mobile no horizontal overflow",
      pass: await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1
      ),
    });
    await validateGreenFlows({
      sql,
      context,
      page,
      userId: user.id,
      env,
      report,
    });
    await page.goto(`${APP_ORIGIN}/configuracoes`, {
      waitUntil: "domcontentloaded",
    });
    await page
      .getByRole("button", { name: "Sair da conta", exact: true })
      .click();
    await page.waitForURL(`${APP_ORIGIN}/sign-in`, { timeout: 30_000 });
    const afterLogout = await context.request.get(
      `${APP_ORIGIN}/api/notifications/preferences`
    );
    report.checks.push({
      name: "UI logout revokes authenticated API",
      pass: afterLogout.status() === 401,
      status: afterLogout.status(),
    });
    const newTicketResponse = await fetch(
      "https://api.clerk.com/v1/sign_in_tokens",
      {
        method: "POST",
        headers,
        body: JSON.stringify({ user_id: user.id, expires_in_seconds: 60 }),
      }
    );
    const newTicket = await newTicketResponse.json();
    if (!(newTicketResponse.ok && newTicket.token)) {
      throw new Error("Second isolated sign-in token failed.");
    }
    const freshContext = await greenBrowserContext(
      browser,
      {
        viewport: { width: 1440, height: 1000 },
      },
      APP_ORIGIN,
      previewBypass
    );
    const fresh = await freshContext.newPage();
    await fresh.goto(`${APP_ORIGIN}/sign-in`, {
      waitUntil: "domcontentloaded",
    });
    await fresh.waitForFunction(() => window.Clerk?.loaded, {
      timeout: 60_000,
    });
    await fresh.evaluate(async (token) => {
      const result = await window.Clerk.client.signIn.create({
        strategy: "ticket",
        ticket: token,
      });
      if (result.status !== "complete") {
        throw new Error("Sign-in incomplete");
      }
      await window.Clerk.setActive({ session: result.createdSessionId });
    }, newTicket.token);
    newTicket.token = "";
    await fresh.goto(`${APP_ORIGIN}/configuracoes`, {
      waitUntil: "domcontentloaded",
    });
    const persistent = await freshContext.request.get(
      `${APP_ORIGIN}/api/notifications/preferences`
    );
    const preferences = await persistent.json();
    report.checks.push({
      name: "New browser session retains green preference write",
      pass:
        persistent.status() === 200 &&
        preferences.preferences?.mentions === false,
    });
    await freshContext.close();
    const artifact = path.join(
      os.tmpdir(),
      "interprete-green-qa-onboarding.png"
    );
    await page.screenshot({ path: artifact, fullPage: true });
    report.screenshot = artifact;
    report.supabaseRequestHosts = [...requests];
    report.retainedQaFixtures = await recordQaFixtures(sql, user.id);
    report.ok =
      report.checks.every((check) => check.pass) && faults.length === 0;
    writeProtectedJson(
      path.join(
        process.env.LOCALAPPDATA,
        `Codex/migrations/interprete-supabase/green-${report.environment}-qa-report.dpapi`
      ),
      report
    );
    process.stdout.write(`${JSON.stringify(report)}\n`);
    if (!report.ok) {
      process.exitCode = 1;
    }
  } finally {
    await recordQaFixtures(sql, user.id);
    await browser.close();
    await sql.end();
  }
};

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      sqlstate: error?.code ?? null,
      error: String(error.message)
        .replace(/postgres(?:ql)?:\/\/\S+/gi, "[URI redacted]")
        .replace(/sb_secret_\S+/g, "[key redacted]")
        .slice(0, 600),
    })}\n`
  );
  process.exitCode = 2;
});
