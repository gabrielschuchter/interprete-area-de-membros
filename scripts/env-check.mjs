import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const files = {
  app: resolve(root, "apps/app/.env.local"),
  api: resolve(root, "apps/api/.env.local"),
  database: resolve(root, "packages/database/.env"),
};
const lineBreakPattern = /\r?\n/;
const envLinePattern = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/;
const quotedValuePattern = /^("|')(.*)\1$/;
const placeholderPattern =
  /replace-with|your-password|your_password|\[YOUR|<[^>]+>|change-me|example\.com/i;

const parseEnv = (file) => {
  if (!existsSync(file)) {
    return new Map();
  }

  const values = new Map();
  for (const line of readFileSync(file, "utf8").split(lineBreakPattern)) {
    const match = line.match(envLinePattern);
    if (!match) {
      continue;
    }
    const value = match[2].replace(quotedValuePattern, "$2").trim();
    values.set(match[1], value);
  }
  return values;
};

const isPlaceholder = (value) => !value || placeholderPattern.test(value);

const statusFor = (name, value) => {
  if (value === undefined || value === "") {
    return "MISSING";
  }
  if (isPlaceholder(value)) {
    return "PLACEHOLDER";
  }

  if (name.endsWith("URL")) {
    try {
      const url = new URL(value);
      if (
        !(
          url.protocol === "http:" ||
          url.protocol === "https:" ||
          url.protocol === "postgresql:"
        )
      ) {
        return "INVALID";
      }
    } catch {
      return "INVALID";
    }
  }

  if (name === "CLERK_SECRET_KEY" && !value.startsWith("sk_")) {
    return "INVALID";
  }
  if (
    name === "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" &&
    !value.startsWith("pk_")
  ) {
    return "INVALID";
  }
  if (name === "CLERK_WEBHOOK_SIGNING_SECRET" && !value.startsWith("whsec_")) {
    return "INVALID";
  }
  return "OK";
};

const requirements = [
  ["app", "NEXT_PUBLIC_APP_URL", "core"],
  ["app", "DATABASE_URL", "core"],
  ["app", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "core"],
  ["app", "CLERK_SECRET_KEY", "core"],
  ["api", "NEXT_PUBLIC_APP_URL", "core"],
  ["api", "DATABASE_URL", "core"],
  ["api", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "core"],
  ["api", "CLERK_SECRET_KEY", "core"],
  ["api", "CLERK_WEBHOOK_SIGNING_SECRET", "feature"],
  ["database", "DATABASE_URL", "core"],
  ["database", "DIRECT_URL", "core"],
];

let hasFailure = false;
console.log("Interprete environment check (values redacted)\n");

for (const [scope, name, classification] of requirements) {
  const values = parseEnv(files[scope]);
  const status = statusFor(name, values.get(name));
  if (classification === "core" && status !== "OK") {
    hasFailure = true;
  }
  console.log(
    `${scope.padEnd(9)} ${name.padEnd(38)} ${status.padEnd(12)} ${classification}`
  );
}

const legacy = ["CLERK_WEBHOOK_SECRET", "CLERK_PUBLISHABLE_KEY"];
for (const [scope, file] of Object.entries(files)) {
  const values = parseEnv(file);
  for (const name of legacy) {
    if (values.has(name)) {
      console.log(`${scope.padEnd(9)} ${name.padEnd(38)} LEGACY       review`);
    }
  }
}

console.log(
  "\nOptional integrations are intentionally not required by this check."
);
console.log(
  hasFailure ? "Core environment: NOT READY" : "Core environment: READY"
);
process.exitCode = hasFailure ? 1 : 0;
