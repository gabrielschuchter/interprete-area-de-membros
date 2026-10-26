import { exportGestaoAudit } from "@/lib/gestao-audit";

const formulaPrefix = /^[=+\-@\t\r]/u;
const csvCell = (value: string | null) => {
  const text = value ?? "";
  const safe = formulaPrefix.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

export const GET = async (request: Request) => {
  const url = new URL(request.url);
  const rows = await exportGestaoAudit({
    action: url.searchParams.get("acao") ?? undefined,
    from: url.searchParams.get("de") ?? undefined,
    to: url.searchParams.get("ate") ?? undefined,
    query: url.searchParams.get("q") ?? undefined,
    actorId: url.searchParams.get("quem") ?? undefined,
    periodDays: Number(url.searchParams.get("periodo")) || null,
  });
  const lines = rows.map((row) =>
    [
      row.at.toISOString(),
      row.actor,
      row.label,
      row.eventType,
      row.object,
      row.details,
    ]
      .map(csvCell)
      .join(",")
  );
  const header = [
    "Quando (UTC)",
    "Quem",
    "Ação",
    "Evento",
    "Objeto",
    "Detalhes",
  ];
  return new Response(
    `﻿${[header.map(csvCell).join(","), ...lines].join("\r\n")}\r\n`,
    {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition":
          'attachment; filename="registro-de-atividades.csv"',
        "Content-Type": "text/csv; charset=utf-8",
      },
    }
  );
};
