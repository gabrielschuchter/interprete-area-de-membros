import { spawn } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import {
  loadQaLedger,
  recordQaFixtures,
  writeProtectedJson,
} from "./green-qa-ledger.mjs";
import { greenLocalEnvironment } from "./run-green-local.mjs";

const ORIGIN = "http://localhost:3104";
const ROOT = path.resolve(import.meta.dirname, "../..");
const { Client } = createRequire(
  path.join(ROOT, "packages/database/package.json")
)("pg");
const main = async () => {
  const { env, appRoot } = greenLocalEnvironment("api");
  const secret = randomBytes(32);
  env.CLERK_WEBHOOK_SIGNING_SECRET = `whsec_${secret.toString("base64")}`;
  env.CRON_SECRET = randomBytes(32).toString("hex");
  env.NODE_ENV = "production";
  const sql = new Client({
    connectionString: env.DIRECT_URL,
    ssl: {
      rejectUnauthorized: true,
      ca: fs.readFileSync(env.DATABASE_CA_CERT_PATH, "utf8"),
    },
  });
  await sql.connect();
  const ledger = loadQaLedger();
  if (!ledger?.memberId) {
    throw new Error("Explicit green QA identity is absent.");
  }
  await recordQaFixtures(sql, ledger.memberId);
  const member = (
    await sql.query(
      'SELECT id,"displayName",email,"avatarUrl",role FROM public."Member" WHERE id=$1',
      [ledger.memberId]
    )
  ).rows[0];
  if (member?.role !== "MEMBER") {
    throw new Error("QA identity must be MEMBER.");
  }
  const jobs = (
    await sql.query(
      "SELECT count(*)::int count FROM public.\"OutboxJob\" WHERE status IN ('PENDING','PROCESSING','RETRY')"
    )
  ).rows[0].count;
  if (jobs !== 0) {
    throw new Error("Worker test refuses runnable jobs.");
  }
  const child = spawn(
    process.execPath,
    [
      "--use-system-ca",
      path.join(appRoot, "node_modules/next/dist/bin/next"),
      "start",
      "-H",
      "localhost",
      "-p",
      "3104",
    ],
    { cwd: appRoot, env, windowsHide: true, stdio: "ignore" }
  );
  const report = {
    projectRef: "qffqhilydtnrggbcnogh",
    environment: "local-isolated-api",
    remoteConfigurationsChanged: false,
    secretsPersisted: false,
    checks: [],
  };
  const check = (name, pass, status) =>
    report.checks.push({ name, pass, status });
  try {
    let health;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        health = await fetch(`${ORIGIN}/health?deep=1`);
        if (health.ok) {
          break;
        }
      } catch {
        /* Wait only for local process startup. */
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    const runtime = await health?.json();
    if (!health?.ok || runtime.databaseProjectRef !== report.projectRef) {
      throw new Error("API runtime did not attest green before QA mutation.");
    }
    check("API Prisma health attests green", true, health.status);
    const missing = await fetch(`${ORIGIN}/webhooks/auth`, {
      method: "POST",
      body: "{}",
    });
    check(
      "Missing webhook signature denied",
      missing.status === 400,
      missing.status
    );
    const body = JSON.stringify({
      type: "user.updated",
      object: "event",
      data: {
        id: member.id,
        first_name: member.displayName,
        last_name: null,
        email_addresses: member.email ? [{ email_address: member.email }] : [],
        image_url: member.avatarUrl,
        username: "qa-migracao-green",
        phone_numbers: [],
        created_at: Date.now(),
        public_metadata: { role: "ADMIN" },
      },
    });
    const messageId = `msg_qa_green_${randomBytes(8).toString("hex")}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = `v1,${createHmac("sha256", secret).update(`${messageId}.${timestamp}.${body}`).digest("base64")}`;
    const headers = {
      "Content-Type": "application/json",
      "svix-id": messageId,
      "svix-timestamp": timestamp,
      "svix-signature": signature,
    };
    const invalid = await fetch(`${ORIGIN}/webhooks/auth`, {
      method: "POST",
      body,
      headers: { ...headers, "svix-signature": "v1,invalid" },
    });
    check(
      "Invalid webhook signature denied",
      invalid.status === 400,
      invalid.status
    );
    const valid = await fetch(`${ORIGIN}/webhooks/auth`, {
      method: "POST",
      body,
      headers,
    });
    const repeat = await fetch(`${ORIGIN}/webhooks/auth`, {
      method: "POST",
      body,
      headers,
    });
    check(
      "Signed identity webhook accepted",
      valid.status === 201,
      valid.status
    );
    check(
      "Identity webhook replay accepted idempotently",
      repeat.status === 200,
      repeat.status
    );
    const identity = (
      await sql.query(
        'SELECT (SELECT count(*)::int FROM public."Member" WHERE id=$1) members,(SELECT count(*)::int FROM public."Profile" WHERE "clerkUserId"=$1) profiles,(SELECT role FROM public."Member" WHERE id=$1) role,(SELECT count(*)::int FROM public."ClerkWebhookReceipt" WHERE id=$2) receipts',
        [member.id, messageId]
      )
    ).rows[0];
    check(
      "Webhook preserves unique identity and ignores public role metadata",
      identity.members === 1 &&
        identity.profiles === 1 &&
        identity.role === "MEMBER" &&
        identity.receipts === 1
    );
    const unauthorized = await fetch(`${ORIGIN}/cron/outbox`);
    check(
      "Cron without secret denied",
      unauthorized.status === 401,
      unauthorized.status
    );
    const authorized = await fetch(`${ORIGIN}/cron/outbox`, {
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    });
    check(
      "Authenticated outbox worker handles green queue without runnable jobs",
      authorized.status === 200,
      authorized.status
    );
    report.ok = report.checks.every((c) => c.pass);
    writeProtectedJson(
      path.join(
        process.env.LOCALAPPDATA,
        "Codex/migrations/interprete-supabase/green-api-qa-report.dpapi"
      ),
      report
    );
    process.stdout.write(`${JSON.stringify(report)}\n`);
    if (!report.ok) {
      process.exitCode = 1;
    }
  } finally {
    child.kill();
    secret.fill(0);
    await recordQaFixtures(sql, ledger.memberId);
    await sql.end();
  }
};
main().catch((error) => {
  process.stderr.write(
    `${JSON.stringify({ ok: false, error: error.message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[URI redacted]") })}\n`
  );
  process.exitCode = 2;
});
