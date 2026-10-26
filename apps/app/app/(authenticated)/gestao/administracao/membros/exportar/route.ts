import { requireGestaoAdmin } from "@/lib/gestao-authorization";
import { getGestaoMembers } from "@/lib/gestao-members";
import {
  memberRoleLabels,
  memberSituations,
} from "@/lib/gestao-members-domain";

const formulaPrefix = /^[=+\-@\t\r]/u;
const csvCell = (value: string | number | null) => {
  const text = String(value ?? "");
  const safe = formulaPrefix.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

export const GET = async (request: Request) => {
  await requireGestaoAdmin();
  const params = new URL(request.url).searchParams;
  const { rows } = await getGestaoMembers({
    page: "1",
    query: params.get("q") ?? undefined,
    role: params.get("papel") ?? undefined,
    situation: params.get("situacao") ?? undefined,
  });
  const header = [
    "Nome",
    "E-mail",
    "Papel",
    "Turmas",
    "Situação",
    "Último estudo",
    "Acessos diretos",
    "Conta criada em",
  ];
  const lines = rows.map((row) =>
    [
      row.displayName ?? "",
      row.email ?? "",
      memberRoleLabels[row.role],
      row.cohorts.join("; "),
      memberSituations.find(([key]) => key === row.situation)?.[1] ?? "",
      row.lastStudyAt?.toISOString() ?? "",
      row.directAccess,
      row.createdAt.toISOString(),
    ]
      .map(csvCell)
      .join(",")
  );
  return new Response(
    `﻿${[header.map(csvCell).join(","), ...lines].join("\r\n")}\r\n`,
    {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": 'attachment; filename="membros.csv"',
        "Content-Type": "text/csv; charset=utf-8",
      },
    }
  );
};
