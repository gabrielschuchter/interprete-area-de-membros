import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SECURE = path.join(
  process.env.LOCALAPPDATA ?? "",
  "Codex/migrations/interprete-supabase"
);
export const QA_LEDGER = path.join(SECURE, "green-qa-fixtures.dpapi");
const OWNER_COLUMNS = {
  Member: "id",
  Profile: "clerkUserId",
  NotificationPreference: "memberId",
  MutationRateLimit: "memberId",
  PlaybackProgress: "memberId",
  LessonProgress: "memberId",
  Notification: "memberId",
  CommunityPost: "authorId",
  CommunityComment: "authorId",
  CommunityBookmark: "memberId",
  PostVote: "memberId",
  CommentVote: "memberId",
  TopicFollow: "userId",
  LibraryBookmark: "memberId",
  ActivitySubmission: "memberId",
  Activity: "createdBy",
  Feedback: "teacherId",
  StudyTrackingSession: "memberId",
  StudyActivityInterval: "memberId",
  BadgeAward: "memberId",
  BadgeEvaluationState: "memberId",
  StudyGoalAchievement: "memberId",
  Enrollment: "memberId",
  AccessGrant: "memberId",
};
const hash = (text) => crypto.createHash("sha256").update(text).digest("hex");

const dpapi = (bytes, operation) => {
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; " +
        "$b=[Convert]::FromBase64String([Console]::In.ReadLine()); " +
        `$p=[Security.Cryptography.ProtectedData]::${operation}($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); ` +
        "[Console]::Out.Write([Convert]::ToBase64String($p))",
    ],
    {
      input: `${bytes.toString("base64")}\n`,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
    }
  );
  if (result.status !== 0) {
    throw new Error("QA artifact DPAPI operation failed.");
  }
  return Buffer.from(result.stdout.trim(), "base64");
};

export const readProtectedJson = (file) => {
  const plain = dpapi(fs.readFileSync(file), "Unprotect");
  try {
    return JSON.parse(plain.toString("utf8"));
  } finally {
    plain.fill(0);
  }
};

export const writeProtectedJson = (file, value) => {
  const plain = Buffer.from(JSON.stringify(value));
  try {
    fs.writeFileSync(file, dpapi(plain, "Protect"));
  } finally {
    plain.fill(0);
  }
};

export const recordQaFixtures = async (client, memberId) => {
  const sourceFile = path.join(
    SECURE,
    "source-snapshot-20261004T142529Z.json.dpapi"
  );
  const source = readProtectedJson(sourceFile);
  const identityHash = hash(JSON.stringify([memberId]));
  const members = source.database.rowSnapshots.find(
    (t) => t.schema === "public" && t.table === "Member"
  );
  if (members.perRowHashes.some((row) => row.identitySha256 === identityHash)) {
    throw new Error("QA must never mutate a source identity.");
  }
  const tables = {};
  for (const [table, column] of Object.entries(OWNER_COLUMNS)) {
    const columns = (
      await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",
        [table]
      )
    ).rows.map((row) => row.column_name);
    if (!columns.includes(column)) {
      continue;
    }
    const rows = (
      await client.query(
        `SELECT jsonb_build_array(id)::text AS identity FROM public."${table}" WHERE "${column}"=$1`,
        [memberId]
      )
    ).rows;
    tables[`public.${table}`] = rows.map((row) => hash(row.identity));
  }
  const events = (
    await client.query(
      'SELECT jsonb_build_array(d.id)::text AS identity FROM public."DomainEvent" d WHERE d."aggregateType"=\'BADGE_AWARD\' AND EXISTS (SELECT 1 FROM public."BadgeAward" a WHERE a."memberId"=$1 AND d."aggregateId"=a."memberId"||\':\'||a."badgeId")',
      [memberId]
    )
  ).rows;
  tables["public.DomainEvent"] = events.map((row) => hash(row.identity));
  const jobs = (
    await client.query(
      'SELECT jsonb_build_array(j.id)::text AS identity FROM public."OutboxJob" j JOIN public."DomainEvent" d ON d.id=j."eventId" WHERE d."aggregateType"=\'BADGE_AWARD\' AND EXISTS (SELECT 1 FROM public."BadgeAward" a WHERE a."memberId"=$1 AND d."aggregateId"=a."memberId"||\':\'||a."badgeId")',
      [memberId]
    )
  ).rows;
  tables["public.OutboxJob"] = jobs.map((row) => hash(row.identity));
  const ledger = {
    format: "INTERPRETE-GREEN-QA-FIXTURES-V1",
    projectRef: "qffqhilydtnrggbcnogh",
    sourceSnapshot: "source-snapshot-20261004T142529Z",
    memberId,
    tables,
    updatedAt: new Date().toISOString(),
    retained: true,
    storageObjects: (
      await client.query(
        "SELECT bucket_id,name,metadata->>'size' AS bytes FROM storage.objects WHERE bucket_id='learning-assets' AND position($1 in name)>0",
        [memberId]
      )
    ).rows,
  };
  const plain = Buffer.from(JSON.stringify(ledger));
  try {
    fs.writeFileSync(QA_LEDGER, dpapi(plain, "Protect"));
  } finally {
    plain.fill(0);
  }
  return Object.fromEntries(
    Object.entries(tables)
      .filter(([, ids]) => ids.length)
      .map(([table, ids]) => [table, ids.length])
  );
};

export const loadQaLedger = () => {
  if (!fs.existsSync(QA_LEDGER)) {
    return null;
  }
  const ledger = readProtectedJson(QA_LEDGER);
  if (
    ledger.format !== "INTERPRETE-GREEN-QA-FIXTURES-V1" ||
    ledger.projectRef !== "qffqhilydtnrggbcnogh"
  ) {
    throw new Error("Invalid protected QA ledger.");
  }
  return ledger;
};
