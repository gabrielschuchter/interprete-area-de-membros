"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import Link from "next/link";
import { useState } from "react";
import { GestaoIcon } from "../../../../gestao-icon";
import { RemoveMoveDialog, type RosterTarget } from "./remove-move-dialog";

export interface RosterTableRow {
  readonly activitiesDone: number;
  readonly activitiesTotal: number;
  readonly displayName: string;
  readonly email: string | null;
  readonly individualGrants: number;
  readonly joinedLabel: string;
  readonly memberId: string;
  readonly progress: number;
  readonly situation: "ON_TRACK" | "ATTENTION" | "INACTIVE" | null;
}

const whitespacePattern = /\s+/;
const initialsOf = (name: string) =>
  name
    .split(whitespacePattern)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("pt-BR") || "?";

const situationView = {
  ON_TRACK: { label: "Em ritmo", tone: "active", icon: "check-circle" },
  ATTENTION: { label: "Atenção", tone: "danger", icon: "alert-circle" },
  INACTIVE: { label: "Inativo", tone: "neutral", icon: "clock" },
} as const;

export const RosterTable = ({
  cohortId,
  cohortName,
  courseCount,
  rows,
  targets,
}: {
  readonly cohortId: string;
  readonly cohortName: string;
  readonly courseCount: number;
  readonly rows: readonly RosterTableRow[];
  readonly targets: readonly RosterTarget[];
}) => {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [dialog, setDialog] = useState<{
    readonly ids: readonly string[];
    readonly mode: "remove" | "move";
  } | null>(null);
  const allSelected = rows.length > 0 && selected.size === rows.length;
  const toggle = (id: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  const dialogRows = dialog
    ? rows.filter((row) => dialog.ids.includes(row.memberId))
    : [];

  return (
    <>
      {selected.size > 0 ? (
        <div aria-label="Ações em lote" className="gk-bulkbar" role="toolbar">
          <span>
            {selected.size}{" "}
            {selected.size === 1 ? "selecionado" : "selecionados"}
          </span>
          <button
            onClick={() => setDialog({ ids: [...selected], mode: "move" })}
            type="button"
          >
            <GestaoIcon name="arrow-right" size={14} />
            Mover para outra turma
          </button>
          <button
            onClick={() => setDialog({ ids: [...selected], mode: "remove" })}
            type="button"
          >
            <GestaoIcon name="trash" size={14} />
            Remover da turma
          </button>
          <button
            className="gk-bulkbar-clear"
            onClick={() => setSelected(new Set())}
            type="button"
          >
            Limpar seleção
          </button>
        </div>
      ) : null}
      <div className="gk-table-card">
        <table className="gk-table">
          <thead>
            <tr>
              <th className="gk-col-check">
                <input
                  aria-label="Selecionar todos os alunos da página"
                  checked={allSelected}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? new Set(rows.map((row) => row.memberId))
                        : new Set()
                    )
                  }
                  type="checkbox"
                />
              </th>
              <th>Aluno</th>
              <th>Entrou em</th>
              <th>Progresso</th>
              <th>Atividades</th>
              <th>Situação</th>
              <th aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const view = row.situation ? situationView[row.situation] : null;
              return (
                <tr
                  data-selected={String(selected.has(row.memberId))}
                  key={row.memberId}
                >
                  <td className="gk-col-check">
                    <input
                      aria-label={`Selecionar ${row.displayName}`}
                      checked={selected.has(row.memberId)}
                      onChange={(event) =>
                        toggle(row.memberId, event.target.checked)
                      }
                      type="checkbox"
                    />
                  </td>
                  <td>
                    <span className="gk-person">
                      <span
                        aria-hidden="true"
                        className="gk-avatar gk-avatar--lg"
                      >
                        {initialsOf(row.displayName)}
                      </span>
                      <span className="gk-row-copy">
                        <strong>{row.displayName}</strong>
                        <small>{row.email ?? "E-mail indisponível"}</small>
                      </span>
                    </span>
                  </td>
                  <td>{row.joinedLabel}</td>
                  <td>
                    <span className="gk-progress">
                      <span aria-hidden="true" className="gk-progress-track">
                        <span style={{ width: `${row.progress}%` }} />
                      </span>
                      <small>{row.progress}%</small>
                    </span>
                  </td>
                  <td>
                    {row.activitiesTotal
                      ? `${row.activitiesDone} de ${row.activitiesTotal}`
                      : "—"}
                  </td>
                  <td>
                    {view ? (
                      <span className="gk-chip" data-tone={view.tone}>
                        <GestaoIcon
                          name={view.icon}
                          size={12}
                          strokeWidth={1.8}
                        />
                        {view.label}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="gk-col-menu">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          aria-label={`Ações para ${row.displayName}`}
                          className="gk-icon-btn"
                          type="button"
                        >
                          <GestaoIcon name="dots" size={18} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="gestao-create-menu"
                      >
                        <DropdownMenuItem asChild>
                          <Link href={`/gestao/alunos/perfil/${row.memberId}`}>
                            Ver perfil
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            setDialog({ ids: [row.memberId], mode: "move" })
                          }
                        >
                          Mover para outra turma
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            setDialog({ ids: [row.memberId], mode: "remove" })
                          }
                        >
                          Remover da turma
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {dialog ? (
        <RemoveMoveDialog
          cohortId={cohortId}
          cohortName={cohortName}
          courseCount={courseCount}
          initialMode={dialog.mode}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            setSelected(new Set());
          }}
          students={dialogRows.map((row) => ({
            id: row.memberId,
            individualGrants: row.individualGrants,
            name: row.displayName,
          }))}
          targets={targets}
        />
      ) : null}
    </>
  );
};
