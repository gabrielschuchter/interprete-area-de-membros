#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { parseGreenSessionPoolerUrl } from "../lib/supabase-green-connection.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SECURE = path.join(
  process.env.LOCALAPPDATA ?? "",
  "Codex/migrations/interprete-supabase"
);
const GREEN = "qffqhilydtnrggbcnogh";
const require = createRequire(
  path.join(ROOT, "packages/database/package.json")
);
const dotenv = require("dotenv");
const SECRET_PATTERN =
  /(?:SECRET|TOKEN|PASSWORD|DATABASE_URL|DIRECT_URL|POSTGRES_)/;
const URI_PATTERN = /postgres(?:ql)?:\/\/[^\s]+/gi;
const API_KEY_PATTERN = /(?:sb_secret_|sk_(?:test|live)_)[A-Za-z0-9_-]+/g;
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

const unprotect = (name) => {
  const bytes = fs.readFileSync(path.join(SECURE, name));
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; " +
        "$b=[Convert]::FromBase64String([Console]::In.ReadLine()); " +
        "$p=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); " +
        "[Console]::Out.Write([Convert]::ToBase64String($p))",
    ],
    {
      input: `${bytes.toString("base64")}\n`,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    }
  );
  if (result.status !== 0) {
    throw new Error("Protected green credential could not be opened.");
  }
  const plain = Buffer.from(result.stdout.trim(), "base64");
  const value = plain.toString("utf8");
  plain.fill(0);
  return value;
};

export const greenLocalEnvironment = (app) => {
  if (!["app", "api"].includes(app)) {
    throw new Error("Select app or api.");
  }
  const appRoot = path.join(ROOT, "apps", app);
  const local = dotenv.parse(fs.readFileSync(path.join(appRoot, ".env.local")));
  const env = { ...process.env, ...local };
  if (
    !(
      env.CLERK_SECRET_KEY?.startsWith("sk_test_") &&
      env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")
    )
  ) {
    throw new Error(
      "Isolated QA requires the existing Clerk Development keys."
    );
  }
  const sessionUri = unprotect("green-session-pooler-uri.dpapi");
  const session = parseGreenSessionPoolerUrl(sessionUri);
  const runtime = new URL(session);
  runtime.port = "6543";
  runtime.searchParams.set("pgbouncer", "true");
  runtime.searchParams.set("connection_limit", "1");
  env.DIRECT_URL = sessionUri;
  env.DATABASE_URL = runtime.toString();
  env.POSTGRES_PRISMA_URL = env.DATABASE_URL;
  env.POSTGRES_URL_NON_POOLING = sessionUri;
  env.DATABASE_CA_CERT_PATH = path.join(
    ROOT,
    "packages/database/certs/supabase-prod-ca-2021.crt"
  );
  env.SUPABASE_URL = `https://${GREEN}.supabase.co`;
  env.NEXT_PUBLIC_SUPABASE_URL = env.SUPABASE_URL;
  env.SUPABASE_STORAGE_BUCKET = "learning-assets";
  env.SUPABASE_SECRET_KEY = unprotect("green-storage-secret-key.dpapi");
  env.SUPABASE_SERVICE_ROLE_KEY = "";
  env.SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_VT9_CT9-BgKvWVpXltmGMg_uJB9iw8S";
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = env.SUPABASE_PUBLISHABLE_KEY;
  env.SUPABASE_ANON_KEY = "";
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "";
  env.NEXT_PUBLIC_APP_URL = "http://localhost:3100";
  env.NEXT_PUBLIC_API_URL = "http://localhost:3102";
  for (const name of [
    "CLERK_PROXY_URL",
    "NEXT_PUBLIC_CLERK_PROXY_URL",
    "CLERK_FAPI",
    "NEXT_PUBLIC_CLERK_FAPI",
    "RESEND_TOKEN",
    "RESEND_FROM",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "SVIX_TOKEN",
    "CRON_SECRET",
    "SENTRY_AUTH_TOKEN",
    "NEXT_PUBLIC_SENTRY_DSN",
    "BETTERSTACK_API_KEY",
    "ARCJET_KEY",
    "NEXT_PUBLIC_POSTHOG_KEY",
    "NEXT_PUBLIC_GA_MEASUREMENT_ID",
  ]) {
    env[name] = "";
  }
  env.SKIP_ENV_VALIDATION = "false";
  env.NODE_USE_SYSTEM_CA = "1";
  env.NODE_OPTIONS = "--use-system-ca";
  env.NODE_ENV = "development";
  return { env, appRoot };
};

const main = () => {
  const [app, mode = "dev"] = process.argv.slice(2);
  if (!["dev", "build", "start"].includes(mode)) {
    throw new Error("Select dev, build, or start.");
  }
  const { env, appRoot } = greenLocalEnvironment(app);
  if (mode !== "dev") {
    env.NODE_ENV = "production";
  }
  const privateValues = Object.entries(env)
    .filter(([name, value]) => SECRET_PATTERN.test(name) && value.length > 5)
    .map(([, value]) => value);
  const sanitize = (value) => {
    let text = value;
    for (const secret of privateValues) {
      text = text.replaceAll(secret, "[redacted]");
    }
    return text
      .replace(URI_PATTERN, "[database URI redacted]")
      .replace(API_KEY_PATTERN, "[API key redacted]")
      .replace(JWT_PATTERN, "[JWT redacted]");
  };
  const port = app === "app" ? "3100" : "3102";
  const args = [
    "--use-system-ca",
    path.join(appRoot, "node_modules/next/dist/bin/next"),
    mode,
  ];
  if (mode !== "build") {
    args.push("-p", port, "-H", "localhost");
  }
  const child = spawn(process.execPath, args, {
    cwd: appRoot,
    env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (bytes) =>
    process.stdout.write(sanitize(bytes.toString("utf8")))
  );
  child.stderr.on("data", (bytes) =>
    process.stderr.write(sanitize(bytes.toString("utf8")))
  );
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
  child.on("error", () => {
    process.stderr.write("Could not start the isolated local runtime.\n");
    process.exitCode = 1;
  });
  process.on("SIGINT", () => child.kill());
  process.stdout.write(
    `${JSON.stringify({
      app,
      mode,
      projectRef: GREEN,
      port,
      productionChanged: false,
      externalEffects: "disabled",
    })}\n`
  );
};

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
) {
  try {
    main();
  } catch {
    process.stderr.write(
      "Isolated green runtime configuration failed; sensitive diagnostics suppressed.\n"
    );
    process.exitCode = 2;
  }
}
