#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const APP_PACKAGE = path.join(ROOT, "apps/app/package.json");
const DATABASE_PACKAGE = path.join(ROOT, "packages/database/package.json");
const SOURCE_ENV_FILE = path.join(ROOT, "apps/api/.env.local");
const SOURCE_REF = "wkclodjbrynerfgufmyb";
const GREEN_REF = "qffqhilydtnrggbcnogh";
const BUCKET = "learning-assets";
const EXPECTED_OBJECTS = 15;
const EXPECTED_BYTES = 10_117_711;
const MAX_TOTAL_READBACK_BYTES = 100 * 1024 * 1024;
const MAX_TOTAL_SOURCE_READ_BYTES = EXPECTED_BYTES * 2;
const GREEN_BUCKET_MAX_BYTES = 20 * 1024 * 1024;
const APP_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
];
const STORAGE_STAGE_DIRECTORY = path.join(
  process.env.LOCALAPPDATA ?? "",
  "Codex/migrations/interprete-supabase/storage-stage"
);
const GREEN_KEY_FILE = path.join(
  process.env.LOCALAPPDATA ?? "",
  "Codex/migrations/interprete-supabase/green-storage-secret-key.dpapi"
);
const MANIFEST_FORMAT = "INTERPRETE-SUPABASE-SOURCE-SNAPSHOT-V1";
const CHECKPOINT_FORMAT = "INTERPRETE-SUPABASE-STORAGE-CHECKPOINT-V1";
const TIMESTAMP_SEPARATORS = /[-:]/g;
const TIMESTAMP_MILLISECONDS = /\.\d{3}Z$/;
const INVALID_PATH_SEGMENT = /(^|\/)(\.|\.\.)(\/|$)/;
const VIDEO_FILE_EXTENSION = /\.(mp4|mov|m4v|webm|mkv|ts|m4s|mpd)$/i;
const VIDEO_MIME = /^video\//i;
const PLAYLIST_EXTENSION = /\.m3u8$/i;
const SAFE_MIME = /^[\w.+-]+\/[\w.+-]+$/;
const WINDOWS_SID = /S-1-[0-9-]+/i;
const CHECKPOINT_FILE = /^checkpoint-\d{8}T\d{6}Z-[0-9a-f]{8}\.json\.dpapi$/;

const fail = (message) => {
  throw new Error(message);
};

const sha256 = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");

const protectWithDpapi = (bytes) => {
  const command =
    "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; " +
    "$b=[Convert]::FromBase64String([Console]::In.ReadLine()); " +
    "$p=[Security.Cryptography.ProtectedData]::Protect($b,$null," +
    "[Security.Cryptography.DataProtectionScope]::CurrentUser); " +
    "[Console]::Out.Write([Convert]::ToBase64String($p))";
  return runDpapi(command, bytes);
};

const unprotectWithDpapi = (bytes) => {
  const command =
    "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; " +
    "$b=[Convert]::FromBase64String([Console]::In.ReadLine()); " +
    "$p=[Security.Cryptography.ProtectedData]::Unprotect($b,$null," +
    "[Security.Cryptography.DataProtectionScope]::CurrentUser); " +
    "[Console]::Out.Write([Convert]::ToBase64String($p))";
  return runDpapi(command, bytes);
};

function runDpapi(command, bytes) {
  const result = spawnSync(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command],
    {
      input: Buffer.from(`${bytes.toString("base64")}\n`),
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 24 * 1024 * 1024,
    }
  );
  if (result.status !== 0 || !result.stdout?.trim()) {
    fail(
      "Current-user DPAPI could not protect or open a Storage migration artifact."
    );
  }
  return Buffer.from(result.stdout.trim(), "base64");
}

const protectDirectory = (directory) => {
  const sidText = spawnSync("whoami.exe", ["/user", "/fo", "csv", "/nh"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const sid = sidText.stdout?.match(WINDOWS_SID)?.[0];
  if (!sid) {
    fail("Could not resolve the current Windows user SID.");
  }
  const result = spawnSync(
    "icacls.exe",
    [directory, "/inheritance:r", "/grant:r", `*${sid}:(OI)(CI)(F)`],
    { encoding: "utf8", windowsHide: true }
  );
  if (result.status !== 0) {
    fail(
      "Could not restrict access to the encrypted Storage migration staging directory."
    );
  }
};

const writeDpapiFile = (filePath, bytes) => {
  const protectedBytes = protectWithDpapi(bytes);
  const temporaryPath = `${filePath}.${crypto.randomBytes(8).toString("hex")}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, protectedBytes, {
      flag: "wx",
      mode: 0o600,
    });
    protectDirectory(path.dirname(temporaryPath));
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    fs.rmSync(temporaryPath, { force: true });
    throw error;
  }
};

const loadProtectedSnapshot = (manifestPath) => {
  const bytes = unprotectWithDpapi(fs.readFileSync(manifestPath));
  const snapshot = JSON.parse(bytes.toString("utf8"));
  bytes.fill(0);
  if (
    snapshot.format !== MANIFEST_FORMAT ||
    snapshot.sourceProjectRef !== SOURCE_REF ||
    !snapshot.connection.sharedSnapshot
  ) {
    fail(
      "The Storage source manifest does not match the audited blue project snapshot."
    );
  }
  const objects = snapshot.storage.objects;
  const totalBytes = objects.reduce(
    (sum, object) => sum + (object.sizeBytes ?? 0),
    0
  );
  if (
    snapshot.storage.objectCount !== EXPECTED_OBJECTS ||
    objects.length !== EXPECTED_OBJECTS ||
    totalBytes !== EXPECTED_BYTES ||
    objects.some(
      (object) =>
        object.bucket !== BUCKET ||
        object.migrateAllowlist !== true ||
        !object.path ||
        INVALID_PATH_SEGMENT.test(object.path) ||
        !Number.isInteger(object.sizeBytes) ||
        object.sizeBytes <= 0
    )
  ) {
    fail(
      "The Storage manifest object count, byte budget, bucket, or paths changed; refusing upload."
    );
  }
  return objects;
};

const loadSourceCredentials = () => {
  if (!fs.existsSync(SOURCE_ENV_FILE)) {
    fail(
      "The ignored API environment file with the existing blue Storage credentials is missing."
    );
  }
  const require = createRequire(DATABASE_PACKAGE);
  const dotenv = require("dotenv");
  const env = dotenv.parse(fs.readFileSync(SOURCE_ENV_FILE));
  const sourceUrl = new URL(env.SUPABASE_URL ?? "");
  const sourceKey =
    env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (sourceUrl.hostname !== `${SOURCE_REF}.supabase.co` || !sourceKey) {
    fail(
      "Source Storage project guard failed or its server-side API key is unavailable."
    );
  }
  return { sourceKey, sourceUrl: sourceUrl.toString() };
};

const loadGreenSecretKey = () => {
  if (!(process.platform === "win32" && process.env.LOCALAPPDATA)) {
    fail(
      "This Storage migrator requires the Windows user profile used for DPAPI."
    );
  }
  if (!fs.existsSync(GREEN_KEY_FILE)) {
    fail("The protected green Storage Secret API key is missing.");
  }
  const bytes = unprotectWithDpapi(fs.readFileSync(GREEN_KEY_FILE));
  const key = bytes.toString("utf8");
  bytes.fill(0);
  if (!key.startsWith("sb_secret_")) {
    fail("The protected green credential is not a Supabase Secret API key.");
  }
  return key;
};

const loadCheckpoint = (snapshotHash) => {
  const checkpoints = fs
    .readdirSync(STORAGE_STAGE_DIRECTORY)
    .filter((name) => CHECKPOINT_FILE.test(name))
    .sort();
  if (checkpoints.length === 0) {
    return {
      format: CHECKPOINT_FORMAT,
      sourceSnapshotIdSha256: snapshotHash,
      sourceProjectRef: SOURCE_REF,
      greenProjectRef: GREEN_REF,
      objects: {},
      sourceReadReservedBytes: 0,
      destinationReadbackReservedBytes: 0,
      completedAt: null,
    };
  }
  const latest = unprotectWithDpapi(
    fs.readFileSync(path.join(STORAGE_STAGE_DIRECTORY, checkpoints.at(-1)))
  );
  const checkpoint = JSON.parse(latest.toString("utf8"));
  latest.fill(0);
  if (
    checkpoint.format !== CHECKPOINT_FORMAT ||
    checkpoint.sourceSnapshotIdSha256 !== snapshotHash ||
    checkpoint.sourceProjectRef !== SOURCE_REF ||
    checkpoint.greenProjectRef !== GREEN_REF
  ) {
    fail(
      "The encrypted Storage checkpoint belongs to another source snapshot or destination."
    );
  }
  checkpoint.sourceReadReservedBytes ??= 0;
  checkpoint.destinationReadbackReservedBytes ??= 0;
  if (
    !Number.isSafeInteger(checkpoint.sourceReadReservedBytes) ||
    checkpoint.sourceReadReservedBytes < 0 ||
    !Number.isSafeInteger(checkpoint.destinationReadbackReservedBytes) ||
    checkpoint.destinationReadbackReservedBytes < 0 ||
    checkpoint.sourceReadReservedBytes > MAX_TOTAL_SOURCE_READ_BYTES ||
    checkpoint.destinationReadbackReservedBytes > MAX_TOTAL_READBACK_BYTES
  ) {
    fail(
      "The encrypted Storage checkpoint exceeds a cumulative bandwidth budget; no API request was made."
    );
  }
  return checkpoint;
};

const saveCheckpoint = (checkpoint) => {
  const stamp = new Date()
    .toISOString()
    .replace(TIMESTAMP_SEPARATORS, "")
    .replace(TIMESTAMP_MILLISECONDS, "Z");
  const filePath = path.join(
    STORAGE_STAGE_DIRECTORY,
    `checkpoint-${stamp}-${crypto.randomBytes(4).toString("hex")}.json.dpapi`
  );
  writeDpapiFile(filePath, Buffer.from(JSON.stringify(checkpoint), "utf8"));
};

const reserveBandwidthBytes = (checkpoint, field, budget, bytes, label) => {
  const current = checkpoint[field] ?? 0;
  if (current + bytes > budget) {
    fail(
      `The cumulative ${label} budget would be exceeded; no request was made.`
    );
  }
  checkpoint[field] = current + bytes;
  saveCheckpoint(checkpoint);
};

const stageFilePath = (bucket, objectPath) =>
  path.join(
    STORAGE_STAGE_DIRECTORY,
    `object-${sha256(Buffer.from(`${bucket}/${objectPath}`, "utf8"))}.dpapi`
  );

const loadStagedObject = (object, state) => {
  const filePath = stageFilePath(object.bucket, object.path);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const bytes = unprotectWithDpapi(fs.readFileSync(filePath));
  if (
    bytes.length !== object.sizeBytes ||
    (state?.sourceSha256 && sha256(bytes) !== state.sourceSha256)
  ) {
    bytes.fill(0);
    fail(
      "An encrypted staged object does not match its size or checkpoint hash."
    );
  }
  return bytes;
};

const downloadObject = async (client, object) => {
  const { data, error } = await client.storage
    .from(BUCKET)
    .download(object.path);
  if (error || !data) {
    const message = error?.message ?? "Storage returned no object body";
    fail(
      `Source Storage object read failed (HTTP ${error?.statusCode ?? "unknown"}); no destination writes were started. ${message}`
    );
  }
  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.length !== object.sizeBytes) {
    bytes.fill(0);
    fail(
      "A source Storage object's downloaded byte count differs from its protected manifest."
    );
  }
  if (
    object.mimeType &&
    data.type &&
    data.type.toLowerCase() !== object.mimeType.toLowerCase()
  ) {
    bytes.fill(0);
    fail(
      "A source Storage object's MIME type differs from its protected manifest."
    );
  }
  if (
    VIDEO_FILE_EXTENSION.test(object.path) ||
    VIDEO_MIME.test(object.mimeType ?? "")
  ) {
    bytes.fill(0);
    fail("Video media is explicitly excluded from Supabase Storage migration.");
  }
  if (PLAYLIST_EXTENSION.test(object.path) && object.sizeBytes > 30_000) {
    bytes.fill(0);
    fail(
      "The only approved HLS object is the inventoried small playlist; larger playlists are rejected."
    );
  }
  return bytes;
};

const readObject = async (client, object) => {
  const { data, error } = await client.storage
    .from(BUCKET)
    .download(object.path);
  if (error || !data) {
    fail(
      `Destination Storage readback failed for one object (HTTP ${error?.statusCode ?? "unknown"}).`
    );
  }
  return Buffer.from(await data.arrayBuffer());
};

const fileOptions = (object) => {
  const metadata = object.metadata ?? {};
  const mimeType = object.mimeType ?? metadata.mimetype ?? metadata.mimeType;
  if (!SAFE_MIME.test(mimeType)) {
    fail(
      "A Storage object's MIME type is invalid or missing from the source metadata."
    );
  }
  const options = {
    contentType: mimeType,
    upsert: false,
  };
  if (metadata.cacheControl !== undefined) {
    options.cacheControl = String(metadata.cacheControl);
  }
  if (object.userMetadata && Object.keys(object.userMetadata).length > 0) {
    options.metadata = object.userMetadata;
  }
  return options;
};

const stableJson = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

const metadataMatches = (actualMetadata, actualUserMetadata, object) => {
  const expectedMime =
    object.mimeType ?? object.metadata?.mimetype ?? object.metadata?.mimeType;
  const actualMime = actualMetadata?.mimetype ?? actualMetadata?.mimeType;
  const expectedCacheControl =
    object.metadata?.cacheControl == null
      ? null
      : String(object.metadata.cacheControl);
  const actualCacheControl =
    actualMetadata?.cacheControl == null
      ? null
      : String(actualMetadata.cacheControl);
  const userMetadataMatches = Object.entries(object.userMetadata ?? {}).every(
    ([key, value]) =>
      stableJson(actualUserMetadata?.[key]) === stableJson(value)
  );
  return Boolean(
    expectedMime &&
      actualMime?.toLowerCase() === expectedMime.toLowerCase() &&
      actualCacheControl === expectedCacheControl &&
      userMetadataMatches
  );
};

const objectKey = (object) => `${object.bucket}/${object.path}`;

const destinationObjectInfo = async (client, object) => {
  const { data, error } = await client.storage.from(BUCKET).info(object.path);
  if (
    error &&
    !["404", "NotFound"].includes(String(error.statusCode ?? error.name))
  ) {
    fail(
      `Destination Storage object lookup failed (HTTP ${error.statusCode ?? "unknown"}).`
    );
  }
  return data ?? null;
};

const verifyExistingObject = async (
  client,
  object,
  expectedSha256,
  existing
) => {
  const bytes = await readObject(client, object);
  const actualSha256 = sha256(bytes);
  const readbackBytes = bytes.length;
  bytes.fill(0);
  if (actualSha256 !== expectedSha256) {
    fail(
      "A destination Storage path already exists with different bytes; upsert is disabled."
    );
  }
  if (!metadataMatches(existing.metadata, existing.user_metadata, object)) {
    fail(
      "An existing destination Storage object has different content metadata."
    );
  }
  return { sha256: actualSha256, readbackBytes, uploadedBytes: 0 };
};

const uploadAndVerifyObject = async (
  client,
  object,
  sourceBytes,
  expectedSha256
) => {
  const { error } = await client.storage
    .from(BUCKET)
    .upload(object.path, sourceBytes, fileOptions(object));
  if (error) {
    fail(
      `Destination Storage upload failed (HTTP ${error.statusCode ?? "unknown"}).`
    );
  }
  const uploadedBytes = sourceBytes.length;
  const readback = await readObject(client, object);
  const actualSha256 = sha256(readback);
  const readbackBytes = readback.length;
  readback.fill(0);
  if (actualSha256 !== expectedSha256) {
    fail("Destination Storage readback hash differs from the source bytes.");
  }
  const info = await destinationObjectInfo(client, object);
  if (!(info && metadataMatches(info.metadata, info.user_metadata, object))) {
    fail(
      "Destination Storage content metadata differs from the source manifest."
    );
  }
  return { sha256: actualSha256, readbackBytes, uploadedBytes };
};

const recordVerifiedObject = (checkpoint, key, state, object, sha256Value) => {
  state.destinationSha256 = sha256Value;
  state.destinationBytes = object.sizeBytes;
  state.verified = true;
  state.verifiedAt = new Date().toISOString();
  checkpoint.objects[key] = state;
  saveCheckpoint(checkpoint);
};

const prepareStaging = async (sourceClient, objects, checkpoint) => {
  let stagedBytes = 0;
  for (const object of objects) {
    const key = `${object.bucket}/${object.path}`;
    const state = checkpoint.objects[key] ?? {};
    let bytes = loadStagedObject(object, state);
    if (!bytes) {
      reserveBandwidthBytes(
        checkpoint,
        "sourceReadReservedBytes",
        MAX_TOTAL_SOURCE_READ_BYTES,
        object.sizeBytes,
        "source Storage read"
      );
      bytes = await downloadObject(sourceClient, object);
      writeDpapiFile(stageFilePath(object.bucket, object.path), bytes);
    }
    const sourceSha256 = sha256(bytes);
    if (state.sourceSha256 && state.sourceSha256 !== sourceSha256) {
      bytes.fill(0);
      fail(
        "A staged Storage object differs from its existing checkpoint hash."
      );
    }
    if (!state.staged || state.sourceSha256 !== sourceSha256) {
      state.sourceSha256 = sourceSha256;
      state.sourceBytes = bytes.length;
      state.sourceMimetype = object.mimeType;
      state.staged = true;
      checkpoint.objects[key] = state;
      saveCheckpoint(checkpoint);
    }
    stagedBytes += bytes.length;
    bytes.fill(0);
  }
  if (stagedBytes !== EXPECTED_BYTES) {
    fail(
      "The staged Storage byte total differs from the audited 15-object budget."
    );
  }
  return stagedBytes;
};

const copyAndVerify = async (destinationClient, objects, checkpoint) => {
  let uploadedBytes = 0;
  let readbackBytes = 0;
  for (const object of objects) {
    const key = objectKey(object);
    const state = checkpoint.objects[key];
    const sourceBytes = loadStagedObject(object, state);
    if (!sourceBytes) {
      fail("A staged Storage object disappeared before destination upload.");
    }
    const sourceSha256 = sha256(sourceBytes);
    if (sourceSha256 !== state.sourceSha256) {
      sourceBytes.fill(0);
      fail(
        "A staged Storage object no longer matches the source hash checkpoint."
      );
    }

    let verification;
    try {
      const existing = await destinationObjectInfo(destinationClient, object);
      reserveBandwidthBytes(
        checkpoint,
        "destinationReadbackReservedBytes",
        MAX_TOTAL_READBACK_BYTES,
        object.sizeBytes,
        "destination Storage readback"
      );
      verification = existing
        ? await verifyExistingObject(
            destinationClient,
            object,
            sourceSha256,
            existing
          )
        : await uploadAndVerifyObject(
            destinationClient,
            object,
            sourceBytes,
            sourceSha256
          );
    } finally {
      sourceBytes.fill(0);
    }
    uploadedBytes += verification.uploadedBytes;
    readbackBytes += verification.readbackBytes;
    recordVerifiedObject(checkpoint, key, state, object, verification.sha256);
    if (readbackBytes > MAX_TOTAL_READBACK_BYTES) {
      fail(
        "Destination Storage readback exceeded its independent 100 MiB migration budget."
      );
    }
  }
  const verifiedCount = Object.values(checkpoint.objects).filter(
    (state) => state.verified
  ).length;
  if (verifiedCount !== EXPECTED_OBJECTS) {
    fail("The destination readback has not verified all 15 source objects.");
  }
  checkpoint.completedAt = new Date().toISOString();
  saveCheckpoint(checkpoint);
  return { uploadedBytes, readbackBytes, verifiedCount };
};

const ensureGreenBucket = async (destinationClient, objects) => {
  const { data: existing, error } =
    await destinationClient.storage.getBucket(BUCKET);
  if (!error && existing) {
    const fileSizeLimit = Number(existing.file_size_limit);
    const allowed = existing.allowed_mime_types ?? [];
    if (
      existing.name !== BUCKET ||
      existing.public !== false ||
      fileSizeLimit <= 0 ||
      fileSizeLimit > GREEN_BUCKET_MAX_BYTES ||
      allowed.length === 0 ||
      allowed.some((mimeType) => VIDEO_MIME.test(mimeType)) ||
      objects.some((object) => !allowed.includes(object.mimeType)) ||
      APP_UPLOAD_MIME_TYPES.some((mimeType) => !allowed.includes(mimeType))
    ) {
      fail(
        "The existing green bucket has configuration or contents requiring review; it was not changed."
      );
    }
    return {
      created: false,
      fileSizeLimit,
      allowedMimeTypeCount: allowed.length,
    };
  }
  if (
    error &&
    !["404", "NotFound"].includes(String(error.statusCode ?? error.name))
  ) {
    fail(
      `Green Storage bucket lookup failed (HTTP ${error.statusCode ?? "unknown"}).`
    );
  }

  const allowedMimeTypes = [
    ...new Set([
      ...APP_UPLOAD_MIME_TYPES,
      ...objects.map((object) => object.mimeType),
    ]),
  ];
  if (
    allowedMimeTypes.some((mimeType) => !mimeType || VIDEO_MIME.test(mimeType))
  ) {
    fail(
      "The audited object list contains a missing or video MIME type; refusing to create a bucket."
    );
  }
  const { data: created, error: createError } =
    await destinationClient.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: GREEN_BUCKET_MAX_BYTES,
      allowedMimeTypes,
    });
  if (createError || !created) {
    fail(
      `Could not create the private green Storage bucket (HTTP ${createError?.statusCode ?? "unknown"}).`
    );
  }
  const { data: verified, error: verifyError } =
    await destinationClient.storage.getBucket(BUCKET);
  if (
    verifyError ||
    !verified ||
    verified.public !== false ||
    Number(verified.file_size_limit) !== GREEN_BUCKET_MAX_BYTES ||
    APP_UPLOAD_MIME_TYPES.some(
      (mimeType) => !verified.allowed_mime_types?.includes(mimeType)
    )
  ) {
    fail("The newly created green bucket failed its configuration readback.");
  }
  return {
    created: true,
    fileSizeLimit: Number(verified.file_size_limit),
    allowedMimeTypeCount: verified.allowed_mime_types.length,
  };
};

const main = async () => {
  if (!(process.platform === "win32" && process.env.LOCALAPPDATA)) {
    fail(
      "This resumable Storage migration helper requires the Windows user profile used for DPAPI."
    );
  }
  const manifestPath = process.argv[2];
  if (!manifestPath) {
    fail("Pass the paired DPAPI-protected source snapshot manifest.");
  }
  if (!fs.existsSync(GREEN_KEY_FILE)) {
    fail(
      "Store the green project's Secret API key with set-supabase-green-storage-key.ps1 before starting the Storage stage."
    );
  }
  fs.mkdirSync(STORAGE_STAGE_DIRECTORY, { recursive: true });
  protectDirectory(STORAGE_STAGE_DIRECTORY);
  const objects = loadProtectedSnapshot(manifestPath);
  const sourceSnapshotBytes = unprotectWithDpapi(fs.readFileSync(manifestPath));
  const sourceSnapshot = JSON.parse(sourceSnapshotBytes.toString("utf8"));
  sourceSnapshotBytes.fill(0);
  const checkpoint = loadCheckpoint(sourceSnapshot.connection.snapshotIdSha256);

  const require = createRequire(APP_PACKAGE);
  const { createClient } = require("@supabase/supabase-js");
  const { sourceKey, sourceUrl } = loadSourceCredentials();
  const greenKey = loadGreenSecretKey();
  const sourceClient = createClient(sourceUrl, sourceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const destinationClient = createClient(
    `https://${GREEN_REF}.supabase.co`,
    greenKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const stagedBytes = await prepareStaging(sourceClient, objects, checkpoint);
  const bucket = await ensureGreenBucket(destinationClient, objects);
  const copied = await copyAndVerify(destinationClient, objects, checkpoint);
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      sourceProjectRef: SOURCE_REF,
      destinationProjectRef: GREEN_REF,
      bucket: BUCKET,
      bucketCreated: bucket.created,
      bucketFileSizeLimit: bucket.fileSizeLimit,
      bucketAllowedMimeTypeCount: bucket.allowedMimeTypeCount,
      objectsExpected: EXPECTED_OBJECTS,
      objectsVerified: copied.verifiedCount,
      stagedBytes,
      uploadedBytes: copied.uploadedBytes,
      destinationReadbackBytes: copied.readbackBytes,
      cumulativeSourceReadBudgetReservedBytes:
        checkpoint.sourceReadReservedBytes,
      cumulativeDestinationReadbackBudgetReservedBytes:
        checkpoint.destinationReadbackReservedBytes,
      videosCopied: 0,
      checkpointProtectedBy: "Windows DPAPI CurrentUser",
      plaintextPersisted: false,
    })}\n`
  );
};

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Unknown Storage migration error";
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      error: message
        .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[connection URI redacted]")
        .replace(/sb_secret_[A-Za-z0-9_-]+/g, "[Secret API key redacted]")
        .replace(/password\s*[:=]\s*[^\s]+/gi, "password=[redacted]")
        .slice(0, 1200),
    })}\n`
  );
  process.exitCode = 2;
});
