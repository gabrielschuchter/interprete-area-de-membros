import { createRequire } from "node:module";
import path from "node:path";
import { validateGreenInteractions } from "./qa-green-interactions.mjs";

const ORIGIN = process.env.GREEN_QA_APP_ORIGIN ?? "http://localhost:3100";
const require = createRequire(
  path.resolve(import.meta.dirname, "../../apps/app/package.json")
);
const { createClient } = require("@supabase/supabase-js");
const check = (report, name, pass, details = {}) =>
  report.checks.push({ name, pass, ...details });

const validateRecording = async ({ context, sql, userId, report }) => {
  const asset = (
    await sql.query(
      'SELECT id FROM public."LessonAsset" WHERE kind=\'VIDEO\' AND "mediaProvider"=\'YOUTUBE\' AND "mediaExternalId" IS NULL LIMIT 1'
    )
  ).rows[0];
  if (!asset) {
    throw new Error("Expected inventoried video asset is absent.");
  }
  const endpoint = `${ORIGIN}/api/learning/assets/${encodeURIComponent(asset.id)}`;
  const pending = await context.request.get(endpoint);
  check(
    report,
    "Unmapped YouTube produces controlled pending state",
    pending.status() === 409,
    { status: pending.status() }
  );
  const progress = await context.request.put(`${endpoint}/progress`, {
    data: { positionSeconds: 12, durationSeconds: 600 },
  });
  const saved = (
    await sql.query(
      'SELECT "positionSeconds" FROM public."PlaybackProgress" WHERE "assetId"=$1 AND "memberId"=$2',
      [asset.id, userId]
    )
  ).rows[0];
  check(
    report,
    "Recording progress write persisted independently of playback",
    progress.status() === 200 && saved?.positionSeconds === 12,
    { status: progress.status() }
  );
};

const validateRoles = async ({ page, sql, userId, report, context }) => {
  try {
    for (const role of ["MEMBER", "TEACHER", "ADMIN"]) {
      await sql.query(
        'UPDATE public."Member" SET role=$2::public."MemberRole" WHERE id=$1',
        [userId, role]
      );
      const response = await page.goto(`${ORIGIN}/admin/learning`, {
        waitUntil: "domcontentloaded",
      });
      if (role === "MEMBER") {
        await page.waitForURL(`${ORIGIN}/`, { timeout: 10_000 });
      }
      const inside = new URL(page.url()).pathname.startsWith("/admin");
      check(
        report,
        `${role} staff permission`,
        role === "MEMBER"
          ? !inside
          : inside && (!response || response.status() === 200)
      );
      if (role === "ADMIN") {
        await validateRecording({ context, sql, userId, report });
      }
    }
  } finally {
    await sql.query("UPDATE public.\"Member\" SET role='MEMBER' WHERE id=$1", [
      userId,
    ]);
  }
};

const validateStorage = async ({ context, env, report }) => {
  const bytes = Buffer.from(
    "Interprete green QA: isolated asset, preserved.\n"
  );
  const response = await context.request.post(`${ORIGIN}/api/member-assets`, {
    multipart: {
      assetType: "community-attachment",
      file: {
        name: "qa-green-preserved.txt",
        mimeType: "text/plain",
        buffer: bytes,
      },
    },
  });
  check(report, "Application Storage upload", response.status() === 200, {
    status: response.status(),
  });
  if (response.status() !== 200) {
    return;
  }
  const uploaded = await response.json();
  const read = await context.request.get(`${ORIGIN}${uploaded.url}`);
  check(
    report,
    "Private asset application readback",
    read.status() === 200 && (await read.body()).equals(bytes),
    { status: read.status() }
  );
  const anonymous = await fetch(
    `${env.SUPABASE_URL}/storage/v1/object/public/learning-assets/${uploaded.path}`
  );
  check(report, "Private bucket public URL denied", !anonymous.ok, {
    status: anonymous.status,
  });
  const traversal = await context.request.get(
    `${ORIGIN}/api/member-assets?path=../${uploaded.path}`
  );
  check(report, "Asset path traversal denied", traversal.status() === 404, {
    status: traversal.status(),
  });
};

const validateComment = async ({ sql, context, userId, report }) => {
  const postId = "qa-green-preserved-post";
  await sql.query(
    'INSERT INTO public."CommunityPost" (id,"authorId",title,content,"updatedAt") VALUES($1,$2,\'QA migração green\',\'Registro explícito de QA, preservar.\',now()) ON CONFLICT(id) DO NOTHING',
    [postId, userId]
  );
  const body = {
    postId,
    content: "Comentário de QA persistido pelo endpoint real.",
    idempotencyKey: "8225f15b-0e9b-4545-b5dc-bf61348b26aa",
  };
  const first = await context.request.post(`${ORIGIN}/api/community/comments`, {
    data: body,
  });
  const repeat = await context.request.post(
    `${ORIGIN}/api/community/comments`,
    { data: body }
  );
  const rows = await sql.query(
    'SELECT count(*)::int count FROM public."CommunityComment" WHERE "postId"=$1 AND "authorId"=$2 AND "idempotencyKey"=$3',
    [postId, userId, body.idempotencyKey]
  );
  check(
    report,
    "Community comment persisted and repeated request idempotent",
    first.status() === 200 &&
      repeat.status() === 200 &&
      rows.rows[0].count === 1,
    { statuses: [first.status(), repeat.status()] }
  );
  const invalid = await context.request.post(
    `${ORIGIN}/api/community/comments`,
    { data: { postId, content: "" } }
  );
  check(report, "Invalid comment rejected", invalid.status() === 422, {
    status: invalid.status(),
  });
};

const validateActivity = async ({ sql, page, userId, report }) => {
  const activityId = "qa-green-preserved-activity";
  await sql.query(
    "INSERT INTO public.\"Activity\" (id,title,slug,prompt,status,\"createdBy\",\"updatedAt\") VALUES($1,'QA migração: submissão','qa-green-preserved-activity','Teste explícito de persistência no green.','PUBLISHED',$2,now()) ON CONFLICT(id) DO NOTHING",
    [activityId, userId]
  );
  await page.goto(`${ORIGIN}/atividades/qa-green-preserved-activity`, {
    waitUntil: "domcontentloaded",
  });
  await page
    .locator("#activity-response")
    .fill("Resposta QA persistida por Server Action no green.");
  const before = (
    await sql.query(
      'SELECT "submittedAt" FROM public."ActivitySubmission" WHERE "activityId"=$1 AND "memberId"=$2',
      [activityId, userId]
    )
  ).rows[0]?.submittedAt;
  const actionResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().startsWith(`${ORIGIN}/atividades/`),
    { timeout: 30_000 }
  );
  await page
    .getByRole("button", { name: "Enviar resposta", exact: true })
    .click();
  const response = await actionResponse;
  let result = [];
  for (let attempt = 0; attempt < 20; attempt++) {
    result = (
      await sql.query(
        'SELECT status,content,"submittedAt" FROM public."ActivitySubmission" WHERE "activityId"=$1 AND "memberId"=$2',
        [activityId, userId]
      )
    ).rows;
    if (result[0]?.submittedAt > (before ?? new Date(0))) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  check(
    report,
    "Activity submission persisted via actual form",
    response.ok() &&
      result.length === 1 &&
      result[0].submittedAt > (before ?? new Date(0)) &&
      result[0].status === "SUBMITTED" &&
      result[0].content ===
        "Resposta QA persistida por Server Action no green.",
    {
      actionStatus: response.status(),
      submissionStatus: result[0]?.status,
      submissionTimestampAdvanced:
        result[0]?.submittedAt > (before ?? new Date(0)),
      contentMatches:
        result[0]?.content ===
        "Resposta QA persistida por Server Action no green.",
    }
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  check(
    report,
    "Activity submission survives reload",
    (await page.locator("#activity-response").inputValue()) ===
      "Resposta QA persistida por Server Action no green."
  );
};

const validateRls = async ({ sql, userId, report }) => {
  await sql.query(
    "INSERT INTO public.\"Notification\" (id,\"memberId\",type,title) VALUES('qa-green-preserved-notification',$1,'qa','QA green') ON CONFLICT(id) DO NOTHING",
    [userId]
  );
  await sql.query("BEGIN READ ONLY");
  try {
    await sql.query("SELECT set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: userId, role: "authenticated" }),
    ]);
    await sql.query("SET LOCAL ROLE authenticated");
    const rows = await sql.query(
      'SELECT "memberId" FROM public."Notification"'
    );
    check(
      report,
      "RLS notification own row only",
      rows.rows.length >= 1 && rows.rows.every((row) => row.memberId === userId)
    );
  } finally {
    await sql.query("ROLLBACK");
  }
  await sql.query("BEGIN READ ONLY");
  try {
    await sql.query("SET LOCAL ROLE anon");
    let denied = false;
    try {
      await sql.query('SELECT * FROM public."Course" LIMIT 1');
    } catch (error) {
      denied = error.code === "42501";
    }
    check(report, "Anon cannot query Prisma-only domain", denied);
  } finally {
    await sql.query("ROLLBACK");
  }
};

const subscribe = async (channel) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve("TIMEOUT"), 15_000);
    channel.subscribe((status, error) => {
      if (["SUBSCRIBED", "CHANNEL_ERROR", "TIMED_OUT"].includes(status)) {
        clearTimeout(timer);
        resolve({
          status,
          error: error?.message
            ?.replace(/eyJ[\w.-]+/g, "[JWT redacted]")
            .slice(0, 200),
        });
      }
    });
  });

const validateRealtime = async ({ sql, context, userId, env, report }) => {
  const response = await context.request.get(
    `${ORIGIN}/api/notifications/realtime-token`
  );
  check(report, "Clerk native Realtime token", response.status() === 200, {
    status: response.status(),
  });
  if (response.status() !== 200) {
    return;
  }
  const { token } = await response.json();
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    accessToken: async () => token,
    realtime: { params: { eventsPerSecond: 2 } },
  });
  await client.realtime.setAuth(token);
  const own = client.channel(`member-notifications:${userId}`, {
    config: { private: true },
  });
  let received = false;
  own.on("broadcast", { event: "notification.invalidate" }, (message) => {
    received =
      message.payload?.notificationId === "qa-green-preserved-notification";
  });
  try {
    const state = await subscribe(own);
    check(
      report,
      "Realtime own private channel",
      state.status === "SUBSCRIBED",
      {
        state: state.status,
        error: state.error,
      }
    );
    if (state.status !== "SUBSCRIBED") {
      return;
    }
    await sql.query(
      "UPDATE public.\"Notification\" SET title='QA broadcast green' WHERE id='qa-green-preserved-notification'"
    );
    for (let attempt = 0; attempt < 20 && !received; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    check(
      report,
      "Notification SQL trigger delivered real broadcast",
      received
    );
    const foreign = client.channel(
      "member-notifications:qa-nonexistent-other",
      { config: { private: true } }
    );
    const denied = await subscribe(foreign);
    check(
      report,
      "Realtime foreign private channel denied",
      denied.status === "CHANNEL_ERROR",
      { state: denied.status, error: denied.error }
    );
  } finally {
    await client.removeAllChannels();
  }
};

export const validateGreenFlows = async (input) => {
  await validateRoles(input);
  await validateStorage(input);
  await validateComment(input);
  await validateActivity(input);
  await validateGreenInteractions(input);
  await validateRls(input);
  await validateRealtime(input);
};
