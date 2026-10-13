// Existing local QA preview only. Reads never provision preferences. Optional
// explicit starts preserve their timer records; never review(false) or delete.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { defaultTimerSettings } from "../../apps/app/lib/focus-timer-settings.ts";

const memberPattern = /^gestao_qa_functional_student_\d{2}$/u;
const memberId = process.env.QA_TIMER_MEMBER_ID;
const base = "http://localhost:3000";
const output = resolve("output/playwright/gestao-v2/timer-preferences");
const { default: pg } = await import(
  pathToFileURL(resolve("packages/database/node_modules/pg/lib/index.js")).href
);

const readState = async (client) => {
  const preferences = await client.query(
    'SELECT * FROM "PlannerPreferences" WHERE "memberId"=$1',
    [memberId]
  );
  const active = await client.query(
    'SELECT id FROM "FocusTimerSession" WHERE "memberId"=$1 AND "endedAt" IS NULL',
    [memberId]
  );
  return { preferences: preferences.rows, active: active.rows };
};

const burst = (offset) =>
  Promise.all(
    Array.from({ length: 8 }, async (_, index) => {
      const compact = (offset + index) % 2 === 0;
      const start = performance.now();
      const response = await fetch(
        `${base}/api/focus-timer${compact ? "?compact=1" : ""}`
      );
      return {
        status: response.status,
        cache: response.headers.get("cache-control"),
        milliseconds: performance.now() - start,
        compact,
        state: await response.json(),
      };
    })
  );

const post = async (body) => {
  const response = await fetch(`${base}/api/focus-timer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  return { status: response.status, state: payload.result ?? payload };
};

await test("first timer reads do not provision preferences under concurrency", async () => {
  assert(
    memberPattern.test(memberId ?? ""),
    "Explicit functional student fixture required"
  );
  await mkdir(output, { recursive: true });
  const client = new pg.Client({
    host: "127.0.0.1",
    port: 55_433,
    user: "postgres",
    database: "interprete_gestao_qa_20261012",
    ssl: {
      ca: readFileSync(
        resolve(
          process.env.TEMP,
          "interprete-gestao-qa-20261012/local-qa-ca.crt"
        ),
        "utf8"
      ),
      rejectUnauthorized: true,
    },
  });
  await client.connect();
  try {
    const tls = await client.query(
      "SELECT current_database() AS db, ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()"
    );
    assert.equal(tls.rows[0].db, "interprete_gestao_qa_20261012");
    assert.equal(tls.rows[0].ssl, true);
    const before = await readState(client);
    assert.deepEqual(
      before.preferences,
      [],
      "Choose an existing fixture without preferences; do not delete rows"
    );
    assert.deepEqual(before.active, [], "Do not disturb an existing timer");
    const page = await fetch(`${base}/biblioteca`);
    assert(
      (await page.text()).includes(memberId),
      "Preview must use this persisted actor"
    );
    const responses = [];
    for (let batch = 0; batch < 5; batch++) {
      responses.push(...(await burst(batch * 8)));
    }
    for (const response of responses) {
      assert.equal(response.status, 200);
      assert(response.cache.includes("no-store"));
      assert.deepEqual(response.state.settings, defaultTimerSettings);
      assert.equal(response.state.active, null);
    }
    const after = await readState(client);
    assert.deepEqual(after, before, "GET must not provision a row or timer");
    await writeFile(
      `${output}/reads.json`,
      JSON.stringify(
        {
          actor: memberId,
          tls: true,
          count: responses.length,
          preferencesBefore: 0,
          preferencesAfter: 0,
          responses: responses.map(({ state: _state, ...result }) => result),
        },
        null,
        2
      )
    );
    if (process.env.QA_TIMER_WRITE === "true") {
      await verifyExplicitStarts(client);
    }
  } finally {
    await client.end();
  }
});

function verifyExplicitStarts(client) {
  return test("explicit concurrent starts provision once and preserve timer history", async () => {
    const starts = await Promise.all(
      Array.from({ length: 2 }, () =>
        post({
          action: "start",
          clientId: randomUUID(),
          mode: "STOPWATCH",
          title: "QA local — timer preferences concurrency 20261013",
        })
      )
    );
    const successful = starts.filter((result) => result.status === 200);
    const state = await readState(client);
    // Stop only the session just created by this harness. Keep its review pending
    // and record preserved: review(saveStudy=false) would delete, which is forbidden.
    const owned = successful.find(
      (result) => result.state.id === state.active[0]?.id
    );
    if (owned && state.active.length === 1) {
      const stopped = await post({ action: "stop" });
      assert.equal(stopped.status, 200);
    }
    assert.equal(successful.length, 1);
    assert(
      starts.every((result) => result.status === 200 || result.status === 409)
    );
    assert.equal(state.preferences.length, 1);
    assert.equal(state.active.length, 1);
    const afterStop = await readState(client);
    assert.deepEqual(afterStop.active, []);
    await writeFile(
      `${output}/explicit-starts.json`,
      JSON.stringify(
        {
          actor: memberId,
          statuses: starts.map((result) => result.status),
          preferenceRows: state.preferences.length,
          activeBeforeStop: state.active.length,
          activeAfterStop: 0,
          preservedTimerId: owned.state.id,
          reviewPending: true,
        },
        null,
        2
      )
    );
  });
}
