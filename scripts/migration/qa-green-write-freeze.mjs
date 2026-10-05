#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { writeProtectedJson } from "./green-qa-ledger.mjs";
import { greenLocalEnvironment } from "./run-green-local.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const APP_ORIGIN_HOST = "localhost";
const databaseRequire = createRequire(
  path.join(ROOT, "packages/database/package.json")
);
const { Client } = databaseRequire("pg");
const playwrightRequire = createRequire(
  path.join(
    process.env.APPDATA,
    "npm/node_modules/@playwright/cli/package.json"
  )
);
const { chromium } = playwrightRequire("playwright");
const stage = (name) => process.stdout.write(`QA_STAGE ${name}\n`);
const secretName = /SECRET|TOKEN|PASSWORD|DATABASE_URL|DIRECT_URL|POSTGRES/i;
const sensitiveUri = /postgres(?:ql)?:\/\/[^\s]+/gi;
const sensitiveKey = /(?:sb_secret_|sk_(?:test|live)_)[A-Za-z0-9_-]+/g;

const sanitize = (value, env) => {
  let safe = value;
  for (const [name, secret] of Object.entries(env)) {
    if (secretName.test(name) && secret.length > 5) {
      safe = safe.replaceAll(secret, "[redacted]");
    }
  }
  return safe
    .replace(sensitiveUri, "[database URI redacted]")
    .replace(sensitiveKey, "[secret key redacted]");
};

const assertPortFree = (port) =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(port, APP_ORIGIN_HOST, () => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

const startServer = async ({ app, port, freeze, uploadsPaused }) => {
  await assertPortFree(port);
  const { env, appRoot } = greenLocalEnvironment(app);
  env.APP_WRITE_FREEZE = freeze ? "true" : "false";
  if (app === "app") {
    env.UPLOADS_PAUSED_FOR_ROLLBACK = uploadsPaused ? "true" : "false";
    env.NEXT_PUBLIC_APP_URL = `http://${APP_ORIGIN_HOST}:${port}`;
  }
  env.NODE_ENV = "production";
  const child = spawn(
    process.execPath,
    [
      "--use-system-ca",
      path.join(appRoot, "node_modules/next/dist/bin/next"),
      "start",
      "-H",
      APP_ORIGIN_HOST,
      "-p",
      String(port),
    ],
    { cwd: appRoot, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }
  );
  let output = "";
  const capture = (chunk) => {
    output = `${output}${sanitize(chunk.toString("utf8"), env)}`.slice(-3000);
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(
        `Isolated ${app} server exited during startup. ${output.slice(-1200)}`
      );
    }
    try {
      const readinessPath = app === "app" ? "/icon.png" : "/health";
      const response = await fetch(
        `http://${APP_ORIGIN_HOST}:${port}${readinessPath}`,
        { signal: AbortSignal.timeout(1000) }
      );
      if (response.ok) {
        return {
          child,
          env,
          appRoot,
          origin: `http://${APP_ORIGIN_HOST}:${port}`,
        };
      }
    } catch {
      /* Wait only for the isolated local process to start. */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  child.kill();
  throw new Error(
    `Isolated ${app} server did not become healthy. ${output.slice(-1200)}`
  );
};

const stopServer = async (child) => {
  if (!child || child.exitCode !== null) {
    return;
  }
  child.kill();
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 5000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
};

const createSignInTicket = async (secretKey, userId) => {
  const response = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId, expires_in_seconds: 60 }),
  });
  const ticket = await response.json();
  if (!(response.ok && ticket.token)) {
    throw new Error(
      "Could not obtain a short-lived Development sign-in ticket."
    );
  }
  return ticket.token;
};

const authenticateBrowserPage = async (page, origin, token) => {
  await page.goto(`${origin}/sign-in`, { waitUntil: "domcontentloaded" });
  stage("sign-in-page-loaded");
  await page.waitForFunction(() => window.Clerk?.loaded, { timeout: 30_000 });
  stage("clerk-js-loaded");
  const authenticated = await page.evaluate(async (ticket) => {
    const result = await window.Clerk.client.signIn.create({
      strategy: "ticket",
      ticket,
    });
    if (result.status !== "complete") {
      return false;
    }
    await window.Clerk.setActive({ session: result.createdSessionId });
    return Boolean(window.Clerk.session);
  }, token);
  if (!authenticated) {
    throw new Error(
      "Clerk Development browser authentication did not complete."
    );
  }
};

const main = async () => {
  const { env: appEnv } = greenLocalEnvironment("app");
  const sql = new Client({
    connectionString: appEnv.DIRECT_URL,
    ssl: {
      rejectUnauthorized: true,
      ca: fs.readFileSync(appEnv.DATABASE_CA_CERT_PATH, "utf8"),
    },
  });
  await sql.connect();
  stage("green-database-connected");

  let browser;
  let context;
  let appChild;
  let apiChild;
  let secondAppChild;
  let finalAppChild;
  const report = {
    projectRef: "qffqhilydtnrggbcnogh",
    productionChanged: false,
    blueWrites: 0,
    testIdentity: "existing Clerk Development QA account; identifier omitted",
    checks: [],
  };
  const check = (name, pass, status) =>
    report.checks.push({ name, pass, status });

  try {
    const usersResponse = await fetch(
      "https://api.clerk.com/v1/users?limit=100",
      {
        headers: { Authorization: `Bearer ${appEnv.CLERK_SECRET_KEY}` },
      }
    );
    const users = await usersResponse.json();
    stage("clerk-development-account-read");
    if (!(usersResponse.ok && Array.isArray(users) && users.length === 1)) {
      throw new Error(
        "Expected the existing isolated Clerk Development QA account."
      );
    }
    const user = users[0];
    const member = (
      await sql.query('SELECT id,role FROM public."Member" WHERE id=$1', [
        user.id,
      ])
    ).rows[0];
    const profile = (
      await sql.query('SELECT 1 FROM public."Profile" WHERE "clerkUserId"=$1', [
        user.id,
      ])
    ).rowCount;
    const preference = (
      await sql.query(
        'SELECT * FROM public."NotificationPreference" WHERE "memberId"=$1',
        [user.id]
      )
    ).rows[0];
    if (!(member && profile === 1 && preference)) {
      throw new Error(
        "The isolated QA identity needs its existing green rows before this test."
      );
    }
    const originalMentions = preference.mentions;
    const searchRowsBefore = (
      await sql.query(
        'SELECT "windowStart",count,"updatedAt" FROM public."MutationRateLimit" WHERE "memberId"=$1 AND action=$2 ORDER BY "windowStart"',
        [user.id, "member.search"]
      )
    ).rows;
    const searchFingerprintBefore = JSON.stringify(searchRowsBefore);

    const firstPort = 3100;
    stage("starting-app-freeze-off");
    const first = await startServer({
      app: "app",
      port: firstPort,
      freeze: false,
      uploadsPaused: false,
    });
    appChild = first.child;
    stage("app-freeze-off-ready");
    let ticket = await createSignInTicket(appEnv.CLERK_SECRET_KEY, user.id);
    stage("clerk-sign-in-ticket-created");
    browser = await chromium.launch({ headless: true });
    stage("browser-launched");
    context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await context.route("**/*", (route) => {
      if (route.request().url().includes("wkclodjbrynerfgufmyb.supabase.co")) {
        return route.abort("blockedbyclient");
      }
      return route.continue();
    });
    const page = await context.newPage();
    await authenticateBrowserPage(page, first.origin, ticket);
    ticket = "";
    stage("browser-session-established");
    check("Clerk login works with freeze OFF", true, "authenticated");

    const updatePreference = (mentions) =>
      context.request.put(`${first.origin}/api/notifications/preferences`, {
        data: { mentions },
      });
    const writeBeforeFreeze = await updatePreference(!originalMentions);
    const afterWrite = (
      await sql.query(
        'SELECT mentions FROM public."NotificationPreference" WHERE "memberId"=$1',
        [user.id]
      )
    ).rows[0];
    check(
      "Authenticated write persists in green with freeze OFF",
      writeBeforeFreeze.status() === 200 &&
        afterWrite?.mentions === !originalMentions,
      writeBeforeFreeze.status()
    );
    const restorePreference = await updatePreference(originalMentions);
    check(
      "QA preference restored after freeze OFF write test",
      restorePreference.status() === 200,
      restorePreference.status()
    );
    await stopServer(appChild);
    appChild = undefined;
    stage("freeze-off-write-tested");

    const apiPort = 3102;
    const apiStarted = await startServer({
      app: "api",
      port: apiPort,
      freeze: true,
      uploadsPaused: false,
    });
    apiChild = apiStarted.child;
    stage("api-freeze-on-ready");
    const apiOrigin = apiStarted.origin;
    const appFreezePort = 3100;
    const appStarted = await startServer({
      app: "app",
      port: appFreezePort,
      freeze: true,
      uploadsPaused: true,
    });
    secondAppChild = appStarted.child;
    stage("app-freeze-on-ready");
    const appOrigin = appStarted.origin;

    const health = await fetch(`${appOrigin}/health`);
    check(
      "App health read remains available during freeze",
      health.status === 200,
      health.status
    );
    const protectedPage = await page.goto(`${appOrigin}/comunidade`, {
      waitUntil: "domcontentloaded",
    });
    check(
      "Authenticated protected read remains available during freeze",
      protectedPage?.status() === 200 &&
        (await page.locator("main").count()) > 0,
      protectedPage?.status()
    );
    const search = await context.request.get(`${appOrigin}/api/search?q=curso`);
    check(
      "Authenticated search GET remains available",
      search.status() === 200,
      search.status()
    );
    const preferenceRead = await context.request.get(
      `${appOrigin}/api/notifications/preferences`
    );
    check(
      "Preference GET remains read-only and available",
      preferenceRead.status() === 200,
      preferenceRead.status()
    );
    check(
      "Clerk session authorizes protected page and API reads during freeze",
      protectedPage?.status() === 200 && preferenceRead.status() === 200
    );
    const prefBlocked = await context.request.put(
      `${appOrigin}/api/notifications/preferences`,
      { data: { mentions: !originalMentions } }
    );
    check(
      "API write is blocked with retryable 503 during freeze",
      prefBlocked.status() === 503 &&
        (await prefBlocked.json()).code === "WRITE_FREEZE",
      prefBlocked.status()
    );
    const actionBlocked = await context.request.post(
      `${appOrigin}/comunidade`,
      {
        data: { title: "freeze-probe" },
      }
    );
    check(
      "Server Action POST is blocked before route execution",
      actionBlocked.status() === 503,
      actionBlocked.status()
    );
    const appCronBlocked = await fetch(
      `${appOrigin}/api/cron/activity-deadlines`
    );
    check(
      "App GET Cron is blocked during freeze",
      appCronBlocked.status === 503,
      appCronBlocked.status
    );
    const apiHealth = await fetch(`${apiOrigin}/health`);
    check(
      "API health read remains available during freeze",
      apiHealth.status === 200,
      apiHealth.status
    );
    for (const [pathName, method] of [
      ["/cron/outbox", "GET"],
      ["/cron/outbox", "POST"],
      ["/webhooks/auth", "GET"],
      ["/webhooks/auth", "POST"],
    ]) {
      const response = await fetch(`${apiOrigin}${pathName}`, { method });
      check(
        `API ${method} ${pathName} blocked during freeze`,
        response.status === 503,
        response.status
      );
    }
    const searchRowsDuring = (
      await sql.query(
        'SELECT "windowStart",count,"updatedAt" FROM public."MutationRateLimit" WHERE "memberId"=$1 AND action=$2 ORDER BY "windowStart"',
        [user.id, "member.search"]
      )
    ).rows;
    check(
      "Search GET does not persist rate-limit rows during freeze",
      JSON.stringify(searchRowsDuring) === searchFingerprintBefore
    );
    const unchangedPreference = (
      await sql.query(
        'SELECT mentions FROM public."NotificationPreference" WHERE "memberId"=$1',
        [user.id]
      )
    ).rows[0];
    check(
      "Blocked API write leaves green row unchanged",
      unchangedPreference?.mentions === originalMentions
    );

    await stopServer(secondAppChild);
    secondAppChild = undefined;
    await stopServer(apiChild);
    apiChild = undefined;
    stage("freeze-on-reads-and-writes-tested");
    const finalPort = 3100;
    const final = await startServer({
      app: "app",
      port: finalPort,
      freeze: false,
      uploadsPaused: true,
    });
    finalAppChild = final.child;
    stage("app-freeze-off-again-ready");
    const writeAfterFreeze = await context.request.put(
      `${final.origin}/api/notifications/preferences`,
      { data: { mentions: !originalMentions } }
    );
    const afterFreezeWrite = (
      await sql.query(
        'SELECT mentions FROM public."NotificationPreference" WHERE "memberId"=$1',
        [user.id]
      )
    ).rows[0];
    check(
      "Write resumes after freeze OFF",
      writeAfterFreeze.status() === 200 &&
        afterFreezeWrite?.mentions === !originalMentions,
      writeAfterFreeze.status()
    );
    const uploadPaused = await context.request.post(
      `${final.origin}/api/member-assets`,
      { multipart: { assetType: "avatar", entityId: user.id } }
    );
    check(
      "New upload remains intentionally paused during rollback window",
      uploadPaused.status() === 503 &&
        (await uploadPaused.json()).code === "UPLOADS_PAUSED",
      uploadPaused.status()
    );
    const restored = await context.request.put(
      `${final.origin}/api/notifications/preferences`,
      { data: { mentions: originalMentions } }
    );
    const finalPreference = (
      await sql.query(
        'SELECT mentions FROM public."NotificationPreference" WHERE "memberId"=$1',
        [user.id]
      )
    ).rows[0];
    check(
      "QA preference restored after freeze OFF again",
      restored.status() === 200 &&
        finalPreference?.mentions === originalMentions,
      restored.status()
    );

    report.ok = report.checks.every((entry) => entry.pass);
    stage("all-freeze-checks-complete");
    report.remoteConfigurationsChanged = false;
    report.secureReport = path.join(
      process.env.LOCALAPPDATA,
      "Codex/migrations/interprete-supabase/green-write-freeze-qa-report.dpapi"
    );
    writeProtectedJson(report.secureReport, report);
    process.stdout.write(`${JSON.stringify(report)}\n`);
    if (!report.ok) {
      process.exitCode = 1;
    }
  } finally {
    try {
      await Promise.all(
        [appChild, apiChild, secondAppChild, finalAppChild]
          .filter(Boolean)
          .map(stopServer)
      );
    } finally {
      if (context) {
        await context.close();
      }
      if (browser) {
        await browser.close();
      }
      await sql.end();
    }
  }
};

main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      error: String(error?.message ?? "Unknown error")
        .replace(/postgres(?:ql)?:\/\/\S+/gi, "[database URI redacted]")
        .replace(/(?:SECRET|TOKEN|PASSWORD)=[^\s&]+/gi, "[secret redacted]")
        .replace(/sb_secret_[A-Za-z0-9_-]+/g, "[secret key redacted]")
        .slice(0, 400),
    })}\n`
  );
  process.exitCode = 2;
});
