import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const configPath = process.env.COMMUNITY_V2_LOCAL_QA_CONFIG;
if (process.platform !== "win32" || !configPath) {
  throw new Error(
    "Pass a Windows DPAPI local QA config; remote targets are forbidden."
  );
}
const unwrap = spawnSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    "Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String([Console]::In.ReadLine()); [Console]::Out.Write([Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))",
  ],
  {
    input: `${fs.readFileSync(configPath).toString("base64")}\n`,
    encoding: "utf8",
    windowsHide: true,
  }
);
if (unwrap.status !== 0) {
  throw new Error("Local QA credentials could not be unwrapped.");
}
const config = JSON.parse(
  Buffer.from(unwrap.stdout.trim(), "base64").toString("utf8")
);
if (
  config.host !== "127.0.0.1" ||
  config.port !== 54_325 ||
  config.database !== "interprete_community_v2_qa" ||
  config.user !== "community_qa"
) {
  throw new Error("Local QA target guard failed; no connection was opened.");
}
const connection = new URL(
  "postgresql://127.0.0.1:54325/interprete_community_v2_qa"
);
connection.username = config.user;
connection.password = config.password;
connection.searchParams.set("connection_limit", "2");
process.env.DATABASE_URL = connection.toString();
process.env.DIRECT_URL = connection.toString();
process.env.DATABASE_CA_CERT_PATH = config.caPath;
process.env.NODE_ENV = "test";
process.env.OUTBOX_QUEUE_NAMESPACE = "";
process.env.VERCEL_ENV = "preview";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);
const { database } = await import(
  pathToFileURL(path.join(root, "packages/database/index.ts"))
);
const { enqueueDomainEvent } = await import(
  pathToFileURL(path.join(root, "packages/member-domain/src/events.ts"))
);
const { processOutboxBatch } = await import(
  pathToFileURL(path.join(root, "packages/member-domain/src/outbox-worker.ts"))
);
const { notificationOutboxConsumer } = await import(
  pathToFileURL(
    path.join(
      root,
      "packages/member-domain/src/notification-outbox-consumer.ts"
    )
  )
);
const mode = process.argv[2];
const productionNamespaceError = /cannot be used in Production/;
const previewAudienceError = /authorized QA audience/;
const consumerKey = "notifications.create.v1";
const scopedKey = `preview.${consumerKey}`;
const runId = ["--crash", "--work"].includes(mode)
  ? process.argv[3]
  : randomUUID();
const workerId = `community-v2-local-${runId}`;
const receiptKey = (job) => `qa.receipt:${job.idempotencyKey}`;
const consumer = {
  handle: async (transaction, event, job) => {
    await transaction.domainEvent.upsert({
      where: { idempotencyKey: receiptKey(job) },
      create: {
        eventType: "qa.foundation.processed",
        aggregateType: "qa.foundation",
        aggregateId: event.id,
        idempotencyKey: receiptKey(job),
        payload: {},
        occurredAt: new Date(),
      },
      update: {},
    });
  },
};
const batch = (handler = consumer, id = workerId, batchSize = 25) =>
  processOutboxBatch(
    database,
    { [consumerKey]: handler },
    {
      workerId: id,
      batchSize,
      leaseMilliseconds: 5000,
    }
  );
const scope = (environment) => {
  process.env.VERCEL_ENV = environment;
  process.env.OUTBOX_QUEUE_NAMESPACE = "";
};
const enqueue = (label) =>
  database.$transaction((transaction) =>
    enqueueDomainEvent(transaction, {
      eventType: "qa.foundation.requested",
      aggregateType: "qa.foundation",
      aggregateId: runId,
      idempotencyKey: `qa.foundation:${runId}:${label}`,
      payload: { label },
      occurredAt: new Date(),
      consumers: [consumerKey],
    })
  );
const child = (mode) =>
  new Promise((resolve, reject) => {
    const processHandle = spawn(
      process.execPath,
      [
        "--conditions=react-server",
        "--no-env-file",
        fileURLToPath(import.meta.url),
        mode,
        runId,
      ],
      { env: process.env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }
    );
    let stdout = "";
    let stderr = "";
    processHandle.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    processHandle.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    processHandle.on("error", reject);
    processHandle.on("close", (code) => resolve({ code, stdout, stderr }));
  });
if (mode === "--crash") {
  await batch(
    {
      handle: () => {
        process.exit(87);
      },
    },
    `${workerId}-crashed`,
    1
  );
  throw new Error("Fault injection did not claim a job.");
}
if (mode === "--work") {
  const result = await batch(consumer, `${workerId}-${randomUUID()}`, 2);
  await database.$disconnect();
  console.log(JSON.stringify(result));
  process.exit(0);
}

await test("outbox isolation and recovery against local PostgreSQL", async () => {
  try {
    const tls = await database.$queryRawUnsafe(
      "SELECT ssl,version FROM pg_stat_ssl WHERE pid=pg_backend_pid()"
    );
    assert.equal(tls[0]?.ssl, true);
    const pendingBefore = await database.outboxJob.count({
      where: { status: { in: ["PENDING", "RETRY", "PROCESSING"] } },
    });
    assert.equal(pendingBefore, 0, "Use a quiescent local recovery database.");

    scope("production");
    const production = await enqueue("production");
    scope("preview");
    const preview = await enqueue("preview");
    scope("production");
    assert.equal((await batch()).succeeded, 1);
    const untouched = await database.outboxJob.findUnique({
      where: {
        eventId_consumerKey: { eventId: preview.id, consumerKey: scopedKey },
      },
    });
    assert.equal(untouched.status, "PENDING");
    assert.equal(untouched.attemptCount, 0);
    scope("preview");
    assert.equal((await batch()).succeeded, 1);
    assert.equal(
      (
        await database.outboxJob.findUnique({
          where: {
            eventId_consumerKey: { eventId: production.id, consumerKey },
          },
        })
      ).attemptCount,
      1
    );

    const retry = await enqueue("retry");
    const failed = await batch({
      handle: async (...args) => {
        await consumer.handle(...args);
        throw new Error("Intentional local transaction failure");
      },
    });
    assert.equal(failed.retried, 1);
    const retryJob = await database.outboxJob.findUnique({
      where: {
        eventId_consumerKey: { eventId: retry.id, consumerKey: scopedKey },
      },
    });
    assert.equal(retryJob.status, "RETRY");
    assert.equal(
      await database.domainEvent.count({
        where: { idempotencyKey: receiptKey(retryJob) },
      }),
      0,
      "Failed consumer effects must roll back."
    );
    assert.equal((await batch()).claimed, 0, "Retry must honor availableAt.");
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Math.max(0, retryJob.availableAt.getTime() - Date.now()) + 50
      )
    );
    assert.equal((await batch()).succeeded, 1);
    assert.equal(
      (await database.outboxJob.findUnique({ where: { id: retryJob.id } }))
        .attemptCount,
      2
    );

    const crashed = await enqueue("crash");
    const crashedProcess = await child("--crash");
    assert.equal(
      crashedProcess.code,
      87,
      "Crash must occur after a real durable claim."
    );
    const crashedJob = await database.outboxJob.findUnique({
      where: {
        eventId_consumerKey: { eventId: crashed.id, consumerKey: scopedKey },
      },
    });
    assert.equal(crashedJob.status, "PROCESSING");
    assert.equal(crashedJob.attemptCount, 1);
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Math.max(0, crashedJob.leaseExpiresAt.getTime() - Date.now()) + 50
      )
    );
    assert.equal((await batch()).succeeded, 1);
    assert.equal(
      (await database.outboxJob.findUnique({ where: { id: crashedJob.id } }))
        .attemptCount,
      2
    );

    const duplicate = await enqueue("idempotency");
    assert.equal((await enqueue("idempotency")).id, duplicate.id);
    assert.equal(
      await database.outboxJob.count({ where: { eventId: duplicate.id } }),
      1
    );
    assert.equal((await batch()).succeeded, 1);
    assert.equal((await batch()).claimed, 0);

    const concurrent = await Promise.all(
      ["a", "b", "c", "d"].map((label) => enqueue(`concurrent-${label}`))
    );
    const workers = await Promise.all([child("--work"), child("--work")]);
    for (const worker of workers) {
      assert.equal(worker.code, 0, "Concurrent worker failed.");
    }
    assert.equal(
      workers.reduce(
        (total, worker) => total + JSON.parse(worker.stdout.trim()).claimed,
        0
      ),
      4
    );
    const concurrentJobs = await database.outboxJob.findMany({
      where: { eventId: { in: concurrent.map((event) => event.id) } },
    });
    assert.equal(concurrentJobs.length, 4);
    for (const job of concurrentJobs) {
      assert.equal(job.status, "SUCCEEDED");
      assert.equal(job.attemptCount, 1);
      assert.equal(
        await database.domainEvent.count({
          where: { idempotencyKey: receiptKey(job) },
        }),
        1
      );
    }

    scope("preview");
    process.env.OUTBOX_PREVIEW_MEMBER_IDS = "qa_actor,qa_recipient";
    const notificationCount = await database.notification.count();
    const forbiddenInput = {
      eventType: "notifications.batch_requested",
      actorId: "qa_actor",
      aggregateType: "qa.foundation",
      aggregateId: runId,
      idempotencyKey: `qa.foundation:${runId}:forbidden-audience`,
      payload: {
        notifications: [
          {
            recipientId: "outside_qa",
            type: "MENTION",
            dedupeKey: `qa.forbidden:${runId}`,
          },
        ],
      },
      occurredAt: new Date(),
      consumers: [consumerKey],
    };
    await assert.rejects(
      database.$transaction((transaction) =>
        enqueueDomainEvent(transaction, forbiddenInput)
      ),
      previewAudienceError
    );
    assert.equal(
      await database.domainEvent.count({
        where: { idempotencyKey: forbiddenInput.idempotencyKey },
      }),
      0
    );
    const { consumers: unusedConsumers, ...forgedData } = forbiddenInput;
    const forgedEvent = await database.domainEvent.create({
      data: {
        ...forgedData,
        idempotencyKey: `qa.foundation:${runId}:forged-audience`,
      },
    });
    await database.outboxJob.create({
      data: {
        eventId: forgedEvent.id,
        consumerKey: scopedKey,
        idempotencyKey: `${forgedEvent.id}:${scopedKey}`,
      },
    });
    const rejectedAudience = await processOutboxBatch(
      database,
      { [consumerKey]: notificationOutboxConsumer },
      { workerId: `${workerId}-audience`, maxAttempts: 1 }
    );
    assert.equal(rejectedAudience.dead, 1);
    assert.equal(await database.notification.count(), notificationCount);

    scope("production");
    process.env.OUTBOX_QUEUE_NAMESPACE = "preview";
    await assert.rejects(batch(), productionNamespaceError);
    await assert.rejects(
      enqueue("forbidden-production-namespace"),
      productionNamespaceError
    );
    const report = {
      database: "local PostgreSQL 17, TLS verified",
      checks: [
        "Production and Preview claims remain disjoint",
        "failed transaction effects roll back before retry",
        "retry waits until availableAt and then persists once",
        "process crash leaves a durable lease and is recovered after expiry",
        "duplicate enqueue creates one event/job",
        "two processes claim four jobs once with SKIP LOCKED",
        "Preview producer refuses an unauthorized audience before persistence",
        "forged Preview job is dead-lettered without writing Notification",
        "Production rejects a Preview namespace before persistence",
      ],
      cloudWrites: false,
      notificationDeliveryVerified: false,
    };
    console.log(JSON.stringify(report));
  } finally {
    await database.$disconnect();
  }
});
