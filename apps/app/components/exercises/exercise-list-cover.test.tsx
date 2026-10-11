import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { ExerciseListCover } from "./exercise-list-cover";

afterEach(cleanup);

const referenceCovers = [
  {
    bankTitle: "Prática Baseada em Evidências — Fundamentos",
    expectedHash:
      "fc5d56e7b6f708fa5cbfe71da3dda14f3da60c979a43ad95d8a9795293ecf718",
    expectedSrc: "/exercises/covers/pratica-baseada-em-evidencias.svg",
    fileName: "pratica-baseada-em-evidencias.svg",
    listSlug: "pratica-baseada-em-evidencias",
    title: "Prática Baseada em Evidências | 10 questões fundamentais",
  },
  {
    bankTitle: "Bioestatística — Fundamentos",
    expectedHash:
      "3d3ad3e13e4a443bfe826a494a8f7d22a2377aef128bb99ddb226376f7716318",
    expectedSrc: "/exercises/covers/bioestatistica.svg",
    fileName: "bioestatistica.svg",
    listSlug: "bioestatistica-fundamentos",
    title: "Bioestatística | 10 questões fundamentais",
  },
  {
    bankTitle: "Epidemiologia — Fundamentos",
    expectedHash:
      "1519d2230894c93310419450c22acbc6a6ecaad1fa4d7625360f00d2161169a7",
    expectedSrc: "/exercises/covers/epidemiologia.svg",
    fileName: "epidemiologia.svg",
    listSlug: "epidemiologia-fundamentos",
    title: "Epidemiologia | 10 questões fundamentais",
  },
];

for (const cover of referenceCovers) {
  test(`uses the handoff SVG for ${cover.bankTitle}`, () => {
    render(
      <ExerciseListCover
        bankTitle={cover.bankTitle}
        coverUrl={null}
        listSlug={cover.listSlug}
        title={cover.title}
      />
    );

    const image = screen.getByRole("img", {
      name: `Capa da lista: ${cover.title}`,
    });
    expect(image.getAttribute("src")).toBe(cover.expectedSrc);
    expect(image.getAttribute("width")).toBe("320");
    expect(image.getAttribute("height")).toBe("112");

    const asset = readFileSync(
      resolve(process.cwd(), "public/exercises/covers", cover.fileName),
      "utf8"
    ).trimEnd();
    const hash = createHash("sha256").update(asset).digest("hex");
    expect(hash).toBe(cover.expectedHash);
  });
}

test("keeps the existing registered cover ahead of the handoff fallback", () => {
  const registeredCover = "https://cdn.example.test/covers/real-list.webp";
  render(
    <ExerciseListCover
      bankTitle="Bioestatística — Fundamentos"
      coverUrl={registeredCover}
      listSlug="bioestatistica-fundamentos"
      title="Bioestatística | 10 questões fundamentais"
    />
  );

  const image = screen.getByRole("img", {
    name: "Capa da lista: Bioestatística | 10 questões fundamentais",
  });
  expect(image.getAttribute("src")).toBe(registeredCover);
});
