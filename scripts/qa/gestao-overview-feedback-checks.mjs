import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";

// Independent SQL oracle for the read-only dashboard-to-queue journey.
export const readOverviewExpected = async (client, actorId) => {
  const member = (
    await client.query(
      'SELECT role FROM "Member" WHERE id=$1 AND "deactivatedAt" IS NULL',
      [actorId]
    )
  ).rows[0];
  if (!(member && ["TEACHER", "ADMIN"].includes(member.role))) {
    throw new Error("Persisted staff fixture required");
  }
  const admin = member.role === "ADMIN";
  const cohorts = (
    await client.query(
      `SELECT c.id,c.name FROM "Cohort" c WHERE c."archivedAt" IS NULL AND ($2::boolean OR EXISTS(SELECT 1 FROM "CohortTeacher" t WHERE t."cohortId"=c.id AND t."memberId"=$1)) ORDER BY c.name,c.id LIMIT 30`,
      [actorId, admin]
    )
  ).rows;
  const counts = [];
  for (const cohort of [null, ...cohorts]) {
    const result = await client.query(
      `
      SELECT COUNT(*)::int AS count FROM "ActivitySubmission" s
      JOIN "Member" m ON m.id=s."memberId"
      WHERE s.status='SUBMITTED' AND s."submittedAt" IS NOT NULL AND m."deactivatedAt" IS NULL
      AND ($2::boolean OR EXISTS (
        SELECT 1 FROM "CohortMembership" cm JOIN "Cohort" c ON c.id=cm."cohortId"
        JOIN "CohortTeacher" t ON t."cohortId"=c.id AND t."memberId"=$1
        WHERE cm."memberId"=m.id AND cm.status='ACTIVE' AND cm."leftAt" IS NULL AND c."archivedAt" IS NULL
      ))
      AND ($3::text IS NULL OR EXISTS (
        SELECT 1 FROM "CohortMembership" cm JOIN "Cohort" c ON c.id=cm."cohortId"
        WHERE cm."memberId"=m.id AND cm."cohortId"=$3 AND cm.status='ACTIVE' AND cm."leftAt" IS NULL
        AND c."archivedAt" IS NULL AND ($2::boolean OR EXISTS(SELECT 1 FROM "CohortTeacher" t WHERE t."cohortId"=c.id AND t."memberId"=$1))
      ))`,
      [actorId, admin, cohort?.id ?? null]
    );
    counts.push({ cohort, count: result.rows[0].count });
  }
  return { actorId, cohorts, counts };
};

const verifyCount = (page, expected, hasCohorts) =>
  test("dashboard count matches scoped SQL", async () => {
    if (expected > 0) {
      await page
        .getByRole("heading", {
          name: `${expected} ${expected === 1 ? "entrega aguardando" : "entregas aguardando"} feedback`,
          exact: true,
        })
        .waitFor();
    } else {
      await page
        .getByRole("heading", {
          name: hasCohorts
            ? "Nenhuma entrega aguardando feedback."
            : "Suas turmas vão aparecer aqui.",
          exact: true,
        })
        .waitFor();
      assert.equal(
        await page.getByRole("link", { name: "Corrigir", exact: true }).count(),
        0
      );
    }
  });

const captureMatrix = (page, output, actorId) =>
  test("overview picker across six widths and two motion modes", async () => {
    for (const width of [1440, 1280, 1024, 820, 390, 320]) {
      for (const reducedMotion of ["no-preference", "reduce"]) {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion });
        const summary = page.locator(".go-cohort-filter summary");
        await summary.click();
        await page.locator(".go-cohort-filter[open]").waitFor();
        await page.getByRole("searchbox", { name: "Buscar turma" }).focus();
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth
          )
        );
        await page.screenshot({
          path: `${output}/${actorId}-${width}-${reducedMotion}.png`,
        });
        await page.keyboard.press("Escape");
        await page.locator(".go-cohort-filter:not([open])").waitFor();
        assert(
          await summary.evaluate(
            (element) => element === document.activeElement
          )
        );
      }
    }
  });

export const verifyOverviewFeedback = (page, expected) =>
  test(`Main feedback ${expected.actorId}`, async () => {
    const base = "http://localhost:3000";
    const errors = [];
    const recordError = (error) => errors.push(error.message);
    page.on("pageerror", recordError);
    const output = resolve("output/playwright/gestao-v2/overview-feedback");
    await mkdir(output, { recursive: true });
    await page.goto(`${base}/gestao`);
    await page
      .getByRole("heading", { name: "Visão geral", exact: true })
      .waitFor();
    await page.waitForLoadState("networkidle");
    await verifyCount(
      page,
      expected.counts[0].count,
      expected.cohorts.length > 0
    );
    await captureMatrix(page, output, expected.actorId);
    await page.setViewportSize({ width: 1440, height: 900 });
    const summary = page.locator(".go-cohort-filter summary");
    await summary.click();
    await page
      .getByRole("searchbox", { name: "Buscar turma" })
      .fill("sem-resultados-local-qa");
    await page
      .getByRole("button", { name: "Buscar turma", exact: true })
      .click();
    await page
      .getByText("Nenhuma turma encontrada.", { exact: true })
      .waitFor();
    await verifyCount(
      page,
      expected.counts[0].count,
      expected.cohorts.length > 0
    );
    await page
      .getByRole("button", { name: "Limpar busca", exact: true })
      .click();
    await page.waitForURL((url) => !url.searchParams.has("qTurmas"));
    await page.keyboard.press("Escape");
    const results = [];
    for (const entry of expected.counts) {
      if (entry.cohort) {
        await summary.click();
        await page
          .locator(".go-cohort-options fieldset")
          .getByRole("button", { name: entry.cohort.name, exact: true })
          .click();
        await page.waitForURL(
          (url) => url.searchParams.get("turma") === entry.cohort.id
        );
      }
      await page.reload();
      await verifyCount(page, entry.count, expected.cohorts.length > 0);
      assert.equal(
        new URL(page.url()).searchParams.get("turma"),
        entry.cohort?.id ?? null
      );
      if (entry.count > 0) {
        await page.getByRole("link", { name: "Corrigir", exact: true }).click();
      } else {
        const params = new URLSearchParams({ estado: "PENDING" });
        if (entry.cohort) {
          params.set("turma", entry.cohort.id);
        }
        await page.goto(`${base}/gestao/alunos/correcoes?${params}`);
      }
      await page
        .getByRole("heading", { name: "Correções", exact: true })
        .waitFor();
      await page
        .getByRole("link", { name: `Pendentes · ${entry.count}`, exact: true })
        .waitFor();
      assert.equal(
        await page
          .getByRole("combobox", { name: "Filtrar por turma" })
          .inputValue(),
        entry.cohort?.id ?? ""
      );
      results.push({
        cohortId: entry.cohort?.id ?? null,
        count: entry.count,
        queue: "MATCH",
        reload: "PASS",
      });
      await page.goto(
        `${base}/gestao${entry.cohort ? `?turma=${entry.cohort.id}` : ""}`
      );
      await page
        .getByRole("heading", { name: "Visão geral", exact: true })
        .waitFor();
    }
    await writeFile(
      `${output}/${expected.actorId}.json`,
      JSON.stringify({ results }, null, 2)
    );
    page.off("pageerror", recordError);
    assert.deepEqual(errors, []);
  });
