// Explicit, bounded recovery using the product consumer. Never emails or deletes.
const url = new URL(process.env.DATABASE_URL ?? "http://invalid.local");
if (
  process.env.NODE_ENV !== "development" ||
  process.env.QA_NOTIFICATION_WORKER !== "true" ||
  url.hostname !== "127.0.0.1" ||
  url.port !== "55433" ||
  url.pathname !== "/interprete_gestao_qa_20261012" ||
  !process.env.DATABASE_CA_CERT_PATH
) {
  throw new Error("Explicit functional loopback QA and verified CA required");
}
const { database } = await import("../../packages/database");
const { notificationOutboxConsumer } = await import(
  "../../packages/member-domain/notification-consumer"
);
const { processOutboxBatch, notificationOutboxConsumerKey } = await import(
  "../../packages/member-domain/server"
);
try {
  const settings = await database.$queryRaw<
    { timezone: string; ssl: boolean }[]
  >`SELECT current_setting('TimeZone') AS timezone, ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()`;
  if (settings[0]?.timezone !== "UTC" || !settings[0]?.ssl) {
    throw new Error("UTC and TLS are required by this QA worker");
  }
  const result = await processOutboxBatch(
    database,
    { [notificationOutboxConsumerKey]: notificationOutboxConsumer },
    { batchSize: 5, workerId: "gestao-local-qa-feedback-20261013" }
  );
  console.log(JSON.stringify(result));
} finally {
  await database.$disconnect();
}
export {};
