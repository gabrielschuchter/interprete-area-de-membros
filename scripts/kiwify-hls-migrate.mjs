import { appendFile, readFile, statfs, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  databaseSsl,
  normalizeRuntimeDatabaseUrl,
} from "../packages/database/ssl.ts";
import { manifest } from "./kiwify-manifest-data.mjs";

const repositoryRoot = process.cwd();
const sourcePlatform = "KIWIFY";
const inventoryPath = path.resolve(
  repositoryRoot,
  process.env.KIWIFY_MEDIA_INVENTORY ??
    "tmp/kiwify-migration/media-inventory.json"
);
const checkpointPath = path.resolve(
  repositoryRoot,
  process.env.KIWIFY_HLS_CHECKPOINT ??
    "tmp/kiwify-migration/hls-checkpoint.json"
);
const logPath = path.resolve(
  repositoryRoot,
  process.env.KIWIFY_HLS_LOG ?? "tmp/kiwify-migration/hls-migration.log"
);
const startIndex = Number(process.env.KIWIFY_START_INDEX ?? 1);
const endIndex = Number(
  process.env.KIWIFY_END_INDEX ?? Number.POSITIVE_INFINITY
);
const ENV_LINE_SPLIT = /\r?\n/;
const ENV_LINE_PATTERN = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/;
const HLS_RESOLUTION_PATTERN = /RESOLUTION=(\d+)x(\d+)/i;
const HLS_BANDWIDTH_PATTERN = /BANDWIDTH=(\d+)/i;
const HLS_DURATION_PATTERN = /#EXTINF:([0-9.]+)/;
const HLS_METHOD_PATTERN = /METHOD=([^,]+)/i;
const CONTENT_RANGE_SIZE_PATTERN = /\/(\d+)$/;
const DEFAULT_MIN_FREE_BYTES = 1 * 1024 * 1024 * 1024;
const configuredMinFreeBytes = Number(
  process.env.KIWIFY_MIN_FREE_BYTES ?? DEFAULT_MIN_FREE_BYTES
);
const minFreeBytes =
  Number.isFinite(configuredMinFreeBytes) && configuredMinFreeBytes > 0
    ? configuredMinFreeBytes
    : DEFAULT_MIN_FREE_BYTES;
const configuredSegmentConcurrency = Number(
  process.env.KIWIFY_SEGMENT_CONCURRENCY ?? 3
);
const segmentConcurrency =
  Number.isFinite(configuredSegmentConcurrency) &&
  configuredSegmentConcurrency > 0
    ? Math.min(3, Math.floor(configuredSegmentConcurrency))
    : 3;

class LowDiskSpaceError extends Error {}
class ProtectedMediaError extends Error {}

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

for (const envFile of [
  ".env.local",
  "apps/app/.env.local",
  "apps/api/.env.local",
  "packages/database/.env",
]) {
  try {
    const values = parseEnvironment(
      await readFile(path.resolve(repositoryRoot, envFile), "utf8")
    );
    for (const [key, value] of Object.entries(values)) {
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Local env files are optional in the repository.
  }
}

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const secret =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "learning-assets";
if (!(supabaseUrl && secret)) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SECRET_KEY are required for HLS migration."
  );
}

const safeName = (value) =>
  String(value || "asset")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120) || "asset";

const flatLessons = manifest.modules.flatMap((module, modulePosition) =>
  module.lessons.map((lesson, lessonPosition) => ({
    ...lesson,
    modulePosition,
    lessonPosition,
    module,
  }))
);

const storageObjectUrl = (objectPath) =>
  `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

const readJson = async (filePath, fallback) => {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
};

const writeJson = async (filePath, value) => {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const log = async (event) => {
  await appendFile(
    logPath,
    `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`,
    "utf8"
  );
};

const requestHeaders = {
  Referer: "https://members.kiwify.com/",
  Origin: "https://members.kiwify.com",
};
const storageHeaders = {
  Authorization: `Bearer ${secret}`,
  apikey: secret,
};

const freeBytes = async () => {
  try {
    const stats = await statfs(repositoryRoot);
    return Number(stats.bavail) * Number(stats.bsize);
  } catch {
    return Number.POSITIVE_INFINITY;
  }
};

const ensureFreeSpace = async () => {
  const available = await freeBytes();
  if (available < minFreeBytes) {
    throw new LowDiskSpaceError(
      `Local disk protection paused migration (${Math.round(available / 1024 / 1024)} MiB free; ${Math.round(minFreeBytes / 1024 / 1024)} MiB required).`
    );
  }
};

const fetchText = async (url) => {
  const response = await fetch(url, { headers: requestHeaders });
  if (!response.ok) {
    throw new Error(`Kiwify request failed (${response.status}).`);
  }
  return response.text();
};

const assertNoUnsupportedEncryption = (playlist) => {
  for (const line of playlist.split(ENV_LINE_SPLIT)) {
    if (!line.startsWith("#EXT-X-KEY:")) {
      continue;
    }
    const method = line.match(HLS_METHOD_PATTERN)?.[1]?.trim().toUpperCase();
    if (method && method !== "NONE") {
      throw new ProtectedMediaError(
        `BLOCKED_DRM: encrypted HLS playlist uses ${method}; extraction would require handling protected media.`
      );
    }
  }
};

const chooseVariant = async (masterUrl) => {
  const text = await fetchText(masterUrl);
  assertNoUnsupportedEncryption(text);
  if (!text.includes("#EXT-X-STREAM-INF")) {
    return masterUrl;
  }
  const lines = text.split(ENV_LINE_SPLIT);
  const variants = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].startsWith("#EXT-X-STREAM-INF:")) {
      continue;
    }
    const uri = lines
      .slice(index + 1)
      .find((line) => line && !line.startsWith("#"));
    if (!uri) {
      continue;
    }
    const resolution = lines[index].match(HLS_RESOLUTION_PATTERN);
    const bandwidth = Number(
      lines[index].match(HLS_BANDWIDTH_PATTERN)?.[1] ?? 0
    );
    variants.push({
      url: new URL(uri, masterUrl).href,
      pixels: resolution ? Number(resolution[1]) * Number(resolution[2]) : 0,
      bandwidth,
    });
  }
  variants.sort((a, b) => b.pixels - a.pixels || b.bandwidth - a.bandwidth);
  return variants[0]?.url ?? masterUrl;
};

const parseVariant = (text, variantUrl) => {
  const lines = text.split(ENV_LINE_SPLIT);
  const segments = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const durationLine = lines
      .slice(Math.max(0, index - 2), index)
      .reverse()
      .find((candidate) => candidate.startsWith("#EXTINF:"));
    segments.push({
      lineIndex: index,
      sourceUrl: new URL(line, variantUrl).href,
      durationSeconds: Number(
        durationLine?.match(HLS_DURATION_PATTERN)?.[1] ?? 0
      ),
      sourceName: line,
    });
  }
  return { lines, segments };
};

const validateRemoteObject = async (objectPath, expectedSize) => {
  const url = storageObjectUrl(objectPath);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const head = await fetch(url, { method: "HEAD", headers: storageHeaders });
    if (head.ok) {
      const remoteSize = Number(head.headers.get("content-length") ?? "NaN");
      if (Number.isFinite(remoteSize) && remoteSize === expectedSize) {
        return true;
      }

      // Supabase Storage can omit Content-Length on HEAD for small objects.
      // A one-byte range still exposes the complete size in Content-Range.
      const probe = await fetch(url, {
        headers: { ...storageHeaders, Range: "bytes=0-0" },
      });
      const contentRange = probe.headers.get("content-range") ?? "";
      const rangeSize = Number(
        contentRange.match(CONTENT_RANGE_SIZE_PATTERN)?.[1] ?? "NaN"
      );
      await probe.body?.cancel();
      if ((probe.ok || probe.status === 206) && rangeSize === expectedSize) {
        return true;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  return false;
};

const uploadObject = async (objectPath, body, sizeBytes, mimeType) => {
  const response = await fetch(storageObjectUrl(objectPath), {
    method: "POST",
    headers: {
      ...storageHeaders,
      "Content-Type": mimeType,
      "Content-Length": String(sizeBytes),
      "x-upsert": "true",
    },
    body,
    duplex: "half",
  });
  if (!response.ok) {
    const details = (await response.text()).slice(0, 500);
    throw new Error(`Storage upload failed (${response.status}): ${details}`);
  }
};

const uploadSegment = async (segment, objectPath) => {
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const upstream = await fetch(segment.sourceUrl, {
        headers: requestHeaders,
      });
      if (!(upstream.ok && upstream.body)) {
        throw new Error(`Segment request failed (${upstream.status}).`);
      }
      const headerSize = Number(
        upstream.headers.get("content-length") ?? "NaN"
      );
      if (Number.isFinite(headerSize)) {
        await uploadObject(objectPath, upstream.body, headerSize, "video/mp2t");
        return headerSize;
      }
      const bytes = new Uint8Array(await upstream.arrayBuffer());
      await uploadObject(objectPath, bytes, bytes.byteLength, "video/mp2t");
      return bytes.byteLength;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
    }
  }
  throw lastError ?? new Error("Segment upload failed after retries.");
};

const loadDatabase = async () => {
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
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }
  return {
    database: new PrismaClient({
      adapter: new PrismaPg({
        connectionString: normalizeRuntimeDatabaseUrl(process.env.DATABASE_URL),
        max: 1,
        ssl: databaseSsl,
      }),
    }),
    enums: {
      AccessPermission,
      AccessResourceType,
      LessonAssetKind,
      LessonAssetScope,
      MigrationEntityType,
      MigrationStatus,
    },
  };
};

const inventory = await readJson(inventoryPath, null);
if (!inventory) {
  throw new Error(`Media inventory not found: ${inventoryPath}`);
}
const entries = Array.isArray(inventory)
  ? inventory
  : (inventory.lessons ?? []);
const checkpoint = await readJson(checkpointPath, { version: 1, items: {} });
checkpoint.items ??= {};
await writeFile(logPath, "", { flag: "a" });

const { database, enums } = await loadDatabase();
let migrated = 0;
const skipped = 0;
let failed = 0;
let blocked = 0;
let pausedForLowDisk = false;

try {
  for (const entry of entries) {
    if (
      Number(entry.index) < startIndex ||
      Number(entry.index) > endIndex ||
      !entry.manifestUrl
    ) {
      continue;
    }
    const lesson = flatLessons[Number(entry.index) - 1];
    const key = `${sourcePlatform}:HLS_VIDEO:${entry.videoId ?? entry.lessonId}`;
    let item = checkpoint.items[key];
    if (!item) {
      item = {
        key,
        index: entry.index,
        status: "PENDING",
        segments: {},
      };
      checkpoint.items[key] = item;
    }
    try {
      if (!lesson || lesson.title !== entry.title) {
        throw new Error(
          "Inventory lesson does not match the reviewed manifest."
        );
      }
      const variantUrl = await chooseVariant(entry.manifestUrl);
      const variantText = await fetchText(variantUrl);
      assertNoUnsupportedEncryption(variantText);
      const parsed = parseVariant(variantText, variantUrl);
      if (parsed.segments.length === 0) {
        throw new Error("HLS playlist has no segments.");
      }
      const basePath = `kiwify-hls/${safeName(lesson.sourceId)}-${safeName(entry.videoId ?? entry.lessonId)}`;
      item.basePath = basePath;
      item.variantUrl = variantUrl;
      item.error = null;
      item.status = "DOWNLOADING";
      await writeJson(checkpointPath, checkpoint);
      await log({
        key,
        index: entry.index,
        status: item.status,
        segments: parsed.segments.length,
      });

      const playlistLines = [...parsed.lines];
      let totalBytes = 0;
      let totalDuration = 0;
      for (
        let batchStart = 0;
        batchStart < parsed.segments.length;
        batchStart += segmentConcurrency
      ) {
        const batch = parsed.segments.slice(
          batchStart,
          batchStart + segmentConcurrency
        );
        const results = await Promise.all(
          batch.map(async (segment, batchOffset) => {
            const segmentNumber = batchStart + batchOffset;
            const segmentName = `segment-${String(segmentNumber).padStart(6, "0")}.ts`;
            const objectPath = `${basePath}/${segmentName}`;
            let segmentState = item.segments[segmentNumber];
            if (!segmentState) {
              segmentState = {
                objectPath,
                sourceUrl: segment.sourceUrl,
                status: "PENDING",
              };
              item.segments[segmentNumber] = segmentState;
            }
            let segmentSize = Number(segmentState.sizeBytes ?? 0);
            let segmentIsValid = segmentState.status === "REMOTE_VALIDATED";
            if (!segmentIsValid && segmentSize > 0) {
              segmentIsValid = await validateRemoteObject(
                objectPath,
                segmentSize
              );
            }
            if (!segmentIsValid) {
              await ensureFreeSpace();
              segmentState.status = "UPLOADING";
              segmentSize = await uploadSegment(segment, objectPath);
              segmentState.sizeBytes = segmentSize;
              if (!(await validateRemoteObject(objectPath, segmentSize))) {
                throw new Error(
                  `Remote segment validation failed at ${segmentNumber}.`
                );
              }
              segmentState.status = "REMOTE_VALIDATED";
            }
            return {
              segment,
              segmentName,
              segmentNumber,
              segmentSize,
            };
          })
        );

        for (const result of results) {
          totalBytes += result.segmentSize;
          totalDuration += result.segment.durationSeconds;
          playlistLines[result.segment.lineIndex] = result.segmentName;
          await log({
            key,
            index: entry.index,
            status: "REMOTE_VALIDATED",
            segment: result.segmentNumber,
          });
        }
        await writeJson(checkpointPath, checkpoint);
      }

      const playlistPath = `${basePath}/index.m3u8`;
      const playlistBody = Buffer.from(`${playlistLines.join("\n")}\n`, "utf8");
      await uploadObject(
        playlistPath,
        playlistBody,
        playlistBody.byteLength,
        "application/vnd.apple.mpegurl"
      );
      if (
        !(await validateRemoteObject(playlistPath, playlistBody.byteLength))
      ) {
        throw new Error("Remote HLS playlist validation failed.");
      }

      const lessonRecord = await database.migrationRecord.findUnique({
        where: {
          sourcePlatform_entityType_sourceId: {
            sourcePlatform,
            entityType: enums.MigrationEntityType.LESSON,
            sourceId: lesson.sourceId,
          },
        },
      });
      if (!lessonRecord?.targetId) {
        throw new Error("Imported lesson target is missing.");
      }
      const ownerStudent = lesson.module.studentSourceId
        ? await database.migrationStudent.findUnique({
            where: {
              sourcePlatform_sourceId: {
                sourcePlatform,
                sourceId: lesson.module.studentSourceId,
              },
            },
          })
        : null;
      const sourceId = key;
      const existing = await database.lessonAsset.findUnique({
        where: { sourcePlatform_sourceId: { sourcePlatform, sourceId } },
      });
      const aggregate = await database.lessonAsset.aggregate({
        where: { lessonId: lessonRecord.targetId },
        _max: { position: true },
      });
      const savedAsset = existing
        ? await database.lessonAsset.update({
            where: { id: existing.id },
            data: {
              title: lesson.title,
              kind: enums.LessonAssetKind.VIDEO,
              scope: enums.LessonAssetScope.INDIVIDUAL,
              storagePath: playlistPath,
              externalUrl: null,
              mimeType: "application/vnd.apple.mpegurl",
              sizeBytes: BigInt(totalBytes),
              durationSeconds: Math.round(totalDuration),
              sourcePlatform,
              sourceId,
              originalTitle: `${lesson.title}.m3u8`,
              ownerMemberId: ownerStudent?.memberId ?? null,
              lessonId: lessonRecord.targetId,
            },
          })
        : await database.lessonAsset.create({
            data: {
              title: lesson.title,
              kind: enums.LessonAssetKind.VIDEO,
              scope: enums.LessonAssetScope.INDIVIDUAL,
              storagePath: playlistPath,
              mimeType: "application/vnd.apple.mpegurl",
              sizeBytes: BigInt(totalBytes),
              durationSeconds: Math.round(totalDuration),
              sourcePlatform,
              sourceId,
              originalTitle: `${lesson.title}.m3u8`,
              ownerMemberId: ownerStudent?.memberId ?? null,
              lessonId: lessonRecord.targetId,
              position: (aggregate._max.position ?? -1) + 1,
            },
          });
      await database.migrationRecord.upsert({
        where: {
          sourcePlatform_entityType_sourceId: {
            sourcePlatform,
            entityType: enums.MigrationEntityType.ASSET,
            sourceId,
          },
        },
        update: {
          targetId: savedAsset.id,
          status: enums.MigrationStatus.IMPORTED,
          metadata: {
            type: "HLS",
            lessonSourceId: lesson.sourceId,
            storagePath: playlistPath,
            segmentCount: parsed.segments.length,
            sizeBytes: totalBytes,
          },
          lastError: null,
        },
        create: {
          sourcePlatform,
          entityType: enums.MigrationEntityType.ASSET,
          sourceId,
          targetId: savedAsset.id,
          status: enums.MigrationStatus.IMPORTED,
          metadata: {
            type: "HLS",
            lessonSourceId: lesson.sourceId,
            storagePath: playlistPath,
            segmentCount: parsed.segments.length,
            sizeBytes: totalBytes,
          },
        },
      });
      if (ownerStudent?.memberId) {
        await database.accessGrant.upsert({
          where: {
            memberId_resourceType_resourceId: {
              memberId: ownerStudent.memberId,
              resourceType: enums.AccessResourceType.ASSET,
              resourceId: savedAsset.id,
            },
          },
          update: {
            permission: enums.AccessPermission.VIEW,
            sourcePlatform,
            sourceId,
          },
          create: {
            memberId: ownerStudent.memberId,
            resourceType: enums.AccessResourceType.ASSET,
            resourceId: savedAsset.id,
            permission: enums.AccessPermission.VIEW,
            sourcePlatform,
            sourceId,
          },
        });
      }
      item.status = "IMPORTED";
      item.lessonAssetId = savedAsset.id;
      item.playlistPath = playlistPath;
      item.totalBytes = totalBytes;
      item.durationSeconds = Math.round(totalDuration);
      await writeJson(checkpointPath, checkpoint);
      await log({
        key,
        index: entry.index,
        status: item.status,
        segments: parsed.segments.length,
      });
      migrated += 1;
    } catch (error) {
      if (error instanceof LowDiskSpaceError) {
        pausedForLowDisk = true;
        item.status = "PAUSED_LOW_DISK";
        item.error = error.message;
        await writeJson(checkpointPath, checkpoint);
        await log({
          key,
          index: entry.index,
          status: item.status,
          error: item.error,
        });
        break;
      }
      if (error instanceof ProtectedMediaError) {
        blocked += 1;
        item.status = "BLOCKED_DRM";
        item.error = error.message;
        await writeJson(checkpointPath, checkpoint);
        await log({
          key,
          index: entry.index,
          status: item.status,
          error: item.error,
        });
        continue;
      }
      failed += 1;
      item.status = "FAILED";
      item.error = (
        error instanceof Error ? error.message : String(error)
      ).slice(-2000);
      await writeJson(checkpointPath, checkpoint);
      await log({
        key,
        index: entry.index,
        status: item.status,
        error: item.error.slice(-500),
      });
      console.error(`HLS lesson ${entry.index} failed: ${item.error}`);
    }
  }
} finally {
  await database.$disconnect();
}

console.log(
  JSON.stringify(
    {
      total: entries.length,
      migrated,
      skipped,
      failed,
      blocked,
      pausedForLowDisk,
      checkpoint: path.relative(repositoryRoot, checkpointPath),
    },
    null,
    2
  )
);
if (failed > 0) {
  process.exitCode = 1;
}
