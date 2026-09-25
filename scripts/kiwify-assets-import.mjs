import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import {
  databaseSsl,
  normalizeRuntimeDatabaseUrl,
} from "../packages/database/ssl.ts";

const ENV_LINE_SPLIT = /\r?\n/;
const ENV_LINE_PATTERN = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/;
const PLACEHOLDER_PASSWORD =
  /replace-with|your-password|change[-_]?me|password/i;
const TRAILING_SLASH = /\/$/;
const REPOSITORY_ROOT = process.cwd();
const DEFAULT_INPUT = path.resolve(
  REPOSITORY_ROOT,
  "tmp/kiwify-migration/assets.json"
);
const ALLOWED_LOCAL_ROOTS = [
  path.resolve(REPOSITORY_ROOT, "tmp/kiwify-downloads"),
  path.resolve(REPOSITORY_ROOT, "tmp/kiwify-migration"),
];

const parseEnvironment = (contents) => {
  const values = {};
  for (const line of contents.split(ENV_LINE_SPLIT)) {
    const match = line.match(ENV_LINE_PATTERN);
    if (!match) {
      continue;
    }
    let value = match[2] ?? "";
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
};

const loadLocalEnvironment = async () => {
  for (const file of [
    ".env.local",
    "apps/app/.env.local",
    "apps/api/.env.local",
    "packages/database/.env",
  ]) {
    try {
      const contents = await readFile(
        path.resolve(REPOSITORY_ROOT, file),
        "utf8"
      );
      for (const [key, value] of Object.entries(parseEnvironment(contents))) {
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    } catch {
      // Optional local env files are intentionally ignored.
    }
  }
};

const failIfMissing = (name, value) => {
  if (!value || PLACEHOLDER_PASSWORD.test(value)) {
    throw new Error(
      `${name} is unavailable or still a placeholder; asset import was not started.`
    );
  }
};

const safeName = (value) =>
  String(value || "asset")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120) || "asset";

const mimeFromPath = (filePath) => {
  const values = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".zip": "application/zip",
    ".mp3": "audio/mpeg",
  };
  return (
    values[path.extname(filePath).toLowerCase()] ?? "application/octet-stream"
  );
};

const normalizeAssetKind = (value, filePath) => {
  if (["VIDEO", "PDF", "IMAGE", "AUDIO", "FILE", "OTHER"].includes(value)) {
    return value;
  }
  const mimeType = mimeFromPath(filePath);
  if (mimeType.startsWith("video/")) {
    return "VIDEO";
  }
  if (mimeType === "application/pdf") {
    return "PDF";
  }
  if (mimeType.startsWith("image/")) {
    return "IMAGE";
  }
  if (mimeType.startsWith("audio/")) {
    return "AUDIO";
  }
  return "FILE";
};

const ensureLocalPath = (inputPath) => {
  const absolutePath = path.resolve(REPOSITORY_ROOT, inputPath);
  const allowed = ALLOWED_LOCAL_ROOTS.some(
    (root) =>
      absolutePath === root || absolutePath.startsWith(`${root}${path.sep}`)
  );
  if (!allowed) {
    throw new Error(
      `Asset path must stay inside an ignored Kiwify workspace: ${inputPath}`
    );
  }
  return absolutePath;
};

const sha256 = async (filePath) => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
};

const encodeTusMetadata = (value) =>
  Buffer.from(String(value), "utf8").toString("base64");

const uploadPrivateObject = async ({
  bucket,
  objectPath,
  filePath,
  mimeType,
  secret,
  sizeBytes,
}) => {
  const supabaseUrl = process.env.SUPABASE_URL.replace(TRAILING_SLASH, "");
  const authorization = `Bearer ${secret}`;
  const createResponse = await fetch(
    `${supabaseUrl}/storage/v1/upload/resumable`,
    {
      method: "POST",
      headers: {
        Authorization: authorization,
        apikey: secret,
        "Tus-Resumable": "1.0.0",
        "Upload-Length": String(sizeBytes),
        "Upload-Metadata": [
          `bucketName ${encodeTusMetadata(bucket)}`,
          `objectName ${encodeTusMetadata(objectPath)}`,
          `contentType ${encodeTusMetadata(mimeType)}`,
          `cacheControl ${encodeTusMetadata("3600")}`,
        ].join(","),
        "x-upsert": "true",
      },
    }
  );
  if (!createResponse.ok) {
    const details = (await createResponse.text()).slice(0, 500);
    throw new Error(
      `Supabase resumable upload session failed (${createResponse.status}) for ${path.basename(filePath)}: ${details}`
    );
  }

  const location = createResponse.headers.get("location");
  if (!location) {
    throw new Error(
      "Supabase resumable upload did not return a session location."
    );
  }
  const sessionUrl = new URL(location, supabaseUrl).href;
  const chunkSize = 8 * 1024 * 1024;
  let offset = Number(createResponse.headers.get("upload-offset") ?? 0);

  while (offset < sizeBytes) {
    const end = Math.min(offset + chunkSize, sizeBytes) - 1;
    const patchResponse = await fetch(sessionUrl, {
      method: "PATCH",
      headers: {
        Authorization: authorization,
        apikey: secret,
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": String(offset),
        "Content-Type": "application/offset+octet-stream",
        "Content-Length": String(end - offset + 1),
      },
      body: createReadStream(filePath, { start: offset, end }),
      duplex: "half",
    });
    if (!patchResponse.ok) {
      const details = (await patchResponse.text()).slice(0, 500);
      throw new Error(
        `Supabase resumable upload chunk failed (${patchResponse.status}) at offset ${offset}: ${details}`
      );
    }
    const nextOffset = Number(
      patchResponse.headers.get("upload-offset") ?? end + 1
    );
    if (!Number.isFinite(nextOffset) || nextOffset <= offset) {
      throw new Error("Supabase resumable upload returned an invalid offset.");
    }
    offset = nextOffset;
  }
};

const storageObjectUrl = (bucket, objectPath) =>
  `${process.env.SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

const validateRemoteObject = async ({
  bucket,
  objectPath,
  secret,
  expectedSize,
}) => {
  const url = storageObjectUrl(bucket, objectPath);
  const headers = { Authorization: `Bearer ${secret}`, apikey: secret };
  const head = await fetch(url, { headers, method: "HEAD" });
  if (!head.ok) {
    throw new Error(`Remote object validation failed (${head.status})`);
  }

  const remoteLength = Number(head.headers.get("content-length") ?? "NaN");
  if (!Number.isFinite(remoteLength) || remoteLength !== expectedSize) {
    throw new Error(
      `Remote object size mismatch (expected ${expectedSize}, got ${remoteLength})`
    );
  }

  const probe = await fetch(url, {
    headers: { ...headers, Range: "bytes=0-0" },
  });
  if (!(probe.ok && (probe.status === 200 || probe.status === 206))) {
    throw new Error(`Remote object read validation failed (${probe.status})`);
  }
  await probe.body?.cancel();
};

const readInput = async () => {
  const inputPath = path.resolve(
    process.env.KIWIFY_ASSETS_MANIFEST ?? DEFAULT_INPUT
  );
  const parsed = JSON.parse(await readFile(inputPath, "utf8"));
  const assets = Array.isArray(parsed) ? parsed : parsed.assets;
  if (!Array.isArray(assets)) {
    throw new Error(
      "Asset manifest must be an array or an object with an assets array."
    );
  }
  return assets;
};

await loadLocalEnvironment();
failIfMissing("DATABASE_URL", process.env.DATABASE_URL);
failIfMissing("SUPABASE_URL", process.env.SUPABASE_URL);
failIfMissing(
  "SUPABASE_SECRET_KEY",
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
);

const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "learning-assets";
const secret =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const assets = await readInput();
const cleanupLocal = process.env.KIWIFY_CLEANUP_LOCAL === "true";

const { PrismaPg } = await import(
  "../packages/database/node_modules/@prisma/adapter-pg/dist/index.mjs"
);
const {
  AccessPermission,
  AccessResourceType,
  LessonAssetKind,
  LessonAssetScope,
  MigrationEntityType,
  MigrationStatus,
  PrismaClient,
} = await import("../packages/database/generated/client.ts");

const database = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: normalizeRuntimeDatabaseUrl(process.env.DATABASE_URL),
    max: 1,
    ssl: databaseSsl,
  }),
});

const sourcePlatform = "KIWIFY";
const results = { imported: 0, skipped: 0, failed: 0 };

try {
  for (const [index, asset] of assets.entries()) {
    const sourceId = asset.sourceId;
    try {
      if (
        !(sourceId && asset.lessonSourceId && asset.localPath && asset.title)
      ) {
        throw new Error(
          "sourceId, lessonSourceId, localPath and title are required"
        );
      }
      const localPath = ensureLocalPath(asset.localPath);
      await access(localPath);
      const fileInfo = await stat(localPath);
      if (!fileInfo.isFile()) {
        throw new Error("localPath is not a file");
      }

      const lessonRecord = await database.migrationRecord.findUnique({
        where: {
          sourcePlatform_entityType_sourceId: {
            sourcePlatform,
            entityType: MigrationEntityType.LESSON,
            sourceId: asset.lessonSourceId,
          },
        },
      });
      if (!lessonRecord?.targetId) {
        throw new Error("lessonSourceId has no imported lesson target");
      }

      const checksum = await sha256(localPath);
      const mimeType = asset.mimeType ?? mimeFromPath(localPath);
      const kind = normalizeAssetKind(asset.kind, localPath);
      const scope = asset.scope === "INDIVIDUAL" ? "INDIVIDUAL" : "GENERAL";
      const existingRecord = await database.migrationRecord.findUnique({
        where: {
          sourcePlatform_entityType_sourceId: {
            sourcePlatform,
            entityType: MigrationEntityType.ASSET,
            sourceId,
          },
        },
      });
      const existingAsset = existingRecord?.targetId
        ? await database.lessonAsset.findUnique({
            where: { id: existingRecord.targetId },
          })
        : await database.lessonAsset.findUnique({
            where: { sourcePlatform_sourceId: { sourcePlatform, sourceId } },
          });
      if (existingAsset?.checksum === checksum && existingAsset.storagePath) {
        await validateRemoteObject({
          bucket,
          objectPath: existingAsset.storagePath,
          secret,
          expectedSize: fileInfo.size,
        });
        if (cleanupLocal) {
          await rm(localPath, { force: false });
        }
        results.skipped += 1;
        continue;
      }

      const ownerStudent = asset.ownerStudentSourceId
        ? await database.migrationStudent.findUnique({
            where: {
              sourcePlatform_sourceId: {
                sourcePlatform,
                sourceId: asset.ownerStudentSourceId,
              },
            },
          })
        : null;
      const ownerMemberId = ownerStudent?.memberId ?? null;
      const aggregate = await database.lessonAsset.aggregate({
        where: { lessonId: lessonRecord.targetId },
        _max: { position: true },
      });
      const position =
        existingAsset?.position ?? (aggregate._max.position ?? -1) + 1;
      const objectPath = `kiwify/${lessonRecord.targetId}/${String(position).padStart(3, "0")}-${safeName(asset.originalTitle ?? asset.title)}`;

      await uploadPrivateObject({
        bucket,
        objectPath,
        filePath: localPath,
        mimeType,
        secret,
        sizeBytes: fileInfo.size,
      });

      await validateRemoteObject({
        bucket,
        objectPath,
        secret,
        expectedSize: fileInfo.size,
      });

      const data = {
        title: asset.title,
        kind: LessonAssetKind[kind],
        scope: LessonAssetScope[scope],
        storagePath: objectPath,
        externalUrl: null,
        mimeType,
        sizeBytes: BigInt(fileInfo.size),
        durationSeconds: asset.durationSeconds ?? null,
        checksum,
        sourcePlatform,
        sourceId,
        originalTitle: asset.originalTitle ?? asset.title,
        ownerMemberId,
        lessonId: lessonRecord.targetId,
        position,
      };
      const savedAsset = existingAsset
        ? await database.lessonAsset.update({
            where: { id: existingAsset.id },
            data,
          })
        : await database.lessonAsset.create({ data });

      await database.migrationRecord.upsert({
        where: {
          sourcePlatform_entityType_sourceId: {
            sourcePlatform,
            entityType: MigrationEntityType.ASSET,
            sourceId,
          },
        },
        update: {
          targetId: savedAsset.id,
          status: MigrationStatus.IMPORTED,
          checksum,
          metadata: {
            title: asset.title,
            lessonSourceId: asset.lessonSourceId,
            ownerStudentSourceId: asset.ownerStudentSourceId ?? null,
            storagePath: objectPath,
          },
          lastError: null,
        },
        create: {
          sourcePlatform,
          entityType: MigrationEntityType.ASSET,
          sourceId,
          targetId: savedAsset.id,
          status: MigrationStatus.IMPORTED,
          checksum,
          metadata: {
            title: asset.title,
            lessonSourceId: asset.lessonSourceId,
            ownerStudentSourceId: asset.ownerStudentSourceId ?? null,
            storagePath: objectPath,
          },
        },
      });

      if (scope === "INDIVIDUAL" && ownerMemberId) {
        await database.accessGrant.upsert({
          where: {
            memberId_resourceType_resourceId: {
              memberId: ownerMemberId,
              resourceType: AccessResourceType.ASSET,
              resourceId: savedAsset.id,
            },
          },
          update: {
            permission: AccessPermission.VIEW,
            sourcePlatform,
            sourceId,
          },
          create: {
            memberId: ownerMemberId,
            resourceType: AccessResourceType.ASSET,
            resourceId: savedAsset.id,
            permission: AccessPermission.VIEW,
            sourcePlatform,
            sourceId,
          },
        });
      }
      if (cleanupLocal) {
        await rm(localPath, { force: false });
      }
      results.imported += 1;
    } catch (error) {
      results.failed += 1;
      const message =
        error instanceof Error ? error.message : "Unknown asset import error";
      if (sourceId) {
        await database.migrationRecord.upsert({
          where: {
            sourcePlatform_entityType_sourceId: {
              sourcePlatform,
              entityType: MigrationEntityType.ASSET,
              sourceId,
            },
          },
          update: { status: MigrationStatus.FAILED, lastError: message },
          create: {
            sourcePlatform,
            entityType: MigrationEntityType.ASSET,
            sourceId,
            status: MigrationStatus.FAILED,
            lastError: message,
          },
        });
      }
      console.error(`Asset ${index + 1} failed: ${message}`);
    }
  }
  console.log(JSON.stringify({ ...results, total: assets.length }, null, 2));
  if (results.failed > 0) {
    process.exitCode = 1;
  }
} finally {
  await database.$disconnect();
}
