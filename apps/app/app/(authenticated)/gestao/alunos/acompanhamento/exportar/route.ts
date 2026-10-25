import { requireGestaoAction } from "@/lib/gestao-authorization";
import {
  parseSituation,
  queryStudentTracking,
  situationLabels,
} from "@/lib/gestao-student-tracking";

// Spreadsheet formulas typed by a student into a display name must not run
// when staff open the export.
const formulaPrefix = /^[=+\-@\t\r]/u;
const csvCell = (value: string | number | null) => {
  const text = String(value ?? "");
  const safe = formulaPrefix.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

export const GET = async (request: Request) => {
  const { actor } = await requireGestaoAction("students.read");
  const url = new URL(request.url);
  const { rows } = await queryStudentTracking(actor, {
    cohortId: url.searchParams.get("turma") ?? undefined,
    courseId: url.searchParams.get("curso") ?? undefined,
    query: url.searchParams.get("q") ?? undefined,
    situation: parseSituation(url.searchParams.get("situacao") ?? undefined),
    detail: true,
    limit: 5000,
  });
  const header = [
    "Aluno",
    "E-mail",
    "Turmas",
    "Aulas concluídas",
    "Aulas liberadas",
    "Atividades entregues",
    "Atividades atribuídas",
    "Último estudo",
    "Dias sem estudar",
    "Estudo nos últimos 7 dias (min)",
    "Entregas atrasadas",
    "Situação",
  ];
  const lines = rows.map((row) =>
    [
      row.displayName,
      row.email,
      row.cohorts.join("; "),
      row.lessonsDone,
      row.lessonsTotal,
      row.activitiesDone,
      row.activitiesTotal,
      row.lastStudyAt?.toISOString() ?? "",
      row.daysSinceActivity,
      Math.round(row.studySecondsLast7Days / 60),
      row.overdueDeliveries,
      situationLabels[row.situation],
    ]
      .map(csvCell)
      .join(",")
  );
  return new Response(
    `﻿${[header.map(csvCell).join(","), ...lines].join("\r\n")}\r\n`,
    {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition":
          'attachment; filename="acompanhamento-alunos.csv"',
        "Content-Type": "text/csv; charset=utf-8",
      },
    }
  );
};
