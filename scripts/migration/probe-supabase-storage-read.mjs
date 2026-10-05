#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);
const DATABASE_PACKAGE = path.join(ROOT, "packages/database/package.json");
const ENV_FILE = path.join(ROOT, "apps/api/.env.local");
const SOURCE_REF = "wkclodjbrynerfgufmyb";
const PROBE_BUCKET = "learning-assets";
const PROBE_OBJECT =
  "kiwify-hls/lesson-katia-paschoalino-7-4bcbf0d4-32c4-48be-8999-36eb94802781/index.m3u8";
const EXPECTED_BYTES = 29_680;

const fail = (message) => {
  throw new Error(message);
};

const main = async () => {
  if (!fs.existsSync(ENV_FILE)) {
    fail("Ignored API env file is missing.");
  }
  const require = createRequire(DATABASE_PACKAGE);
  const dotenv = require("dotenv");
  const env = dotenv.parse(fs.readFileSync(ENV_FILE));
  const sourceUrl = new URL(env.SUPABASE_URL ?? "");
  if (sourceUrl.hostname !== `${SOURCE_REF}.supabase.co`) {
    fail("Source project guard failed; refusing to request an unexpected URL.");
  }
  const apiKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey) {
    fail(
      "A source server-side Supabase key is missing from the ignored API env file."
    );
  }

  const encodedPath = PROBE_OBJECT.split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  const objectUrl = new URL(
    `/storage/v1/object/authenticated/${encodeURIComponent(PROBE_BUCKET)}/${encodedPath}`,
    sourceUrl
  );
  const response = await fetch(objectUrl, {
    method: "GET",
    headers: { apikey: apiKey, authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (!response.ok) {
    await response.body?.cancel();
    process.stdout.write(
      `${JSON.stringify({
        ok: false,
        capability: "source Storage object download",
        httpStatus: response.status,
        objectBytesDownloaded: 0,
      })}\n`
    );
    process.exitCode = 3;
    return;
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== EXPECTED_BYTES) {
    fail(
      "The Storage probe object's content length differs from its SQL metadata."
    );
  }
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      capability: "source Storage object download",
      httpStatus: response.status,
      objectBytesDownloaded: bytes.length,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      objectPath: PROBE_OBJECT,
      outputPersisted: false,
    })}\n`
  );
};

main().catch((error) => {
  const causeCode =
    error && typeof error === "object" && "cause" in error
      ? error.cause?.code
      : undefined;
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      capability: "source Storage object download",
      error: error instanceof Error ? error.message : "unknown error",
      errorCode: causeCode,
    })}\n`
  );
  process.exitCode = 2;
});
