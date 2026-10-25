"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type DragEvent, useRef, useState, useTransition } from "react";
import { GestaoIcon } from "../../../gestao-icon";
import { MenuNote } from "../../cursos/[id]/structure-controls";
import {
  type ExerciseListResult,
  removeExerciseListItems,
  reorderExerciseListItems,
  setExerciseQuestionState,
} from "../list-actions";
import { QuestionFilters } from "./question-filters";

export interface QuestionRow {
  readonly category: string | null;
  readonly format: string;
  readonly id: string;
  readonly questionId: string;
  readonly statement: string;
  readonly status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  readonly version: number;
}

interface PanelProperties {
  readonly canReorder: boolean;
  readonly categories: readonly {
    readonly id: string;
    readonly title: string;
  }[];
  readonly category: string;
  readonly firstNumber: number;
  readonly hasFilters: boolean;
  readonly listId: string;
  readonly query: string;
  readonly rows: readonly QuestionRow[];
  readonly status: string;
}

const statusNames = {
  ARCHIVED: "Arquivado",
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
} as const;

const statusIcons = {
  ARCHIVED: "archive",
  DRAFT: "pencil",
  PUBLISHED: "check-circle",
} as const;

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
};

const rowOf = (target: EventTarget | null) =>
  target instanceof Element
    ? target.closest<HTMLElement>("tr[data-row-id]")
    : null;

const ConfirmRemove = ({
  count,
  onCancel,
  onConfirm,
  pending,
}: {
  readonly count: number;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly pending: boolean;
}) => (
  <Dialog onOpenChange={(open) => (open ? null : onCancel())} open>
    <DialogContent
      className="gk-modal gk-modal--narrow"
      overlayClassName="gk-modal-overlay"
      showCloseButton={false}
    >
      <div className="gk-modal-head">
        <div>
          <DialogTitle className="gk-modal-title">
            Remover {count === 1 ? "questão" : `${count} questões`} da lista?
          </DialogTitle>
          <DialogDescription className="gk-modal-sub">
            A questão continua no banco e pode voltar depois. As tentativas já
            feitas pelos alunos não são apagadas.
          </DialogDescription>
        </div>
      </div>
      <div className="gk-modal-foot">
        <span className="gk-spacer" />
        <button className="gk-btn" onClick={onCancel} type="button">
          Cancelar
        </button>
        <button
          className="gk-btn gk-btn--primary"
          disabled={pending}
          onClick={onConfirm}
          type="button"
        >
          {pending ? "Removendo…" : "Remover da lista"}
        </button>
      </div>
    </DialogContent>
  </Dialog>
);

const RowMenu = ({
  canMoveDown,
  canMoveUp,
  disabled,
  listId,
  onMove,
  onRemove,
  onState,
  row,
}: {
  readonly canMoveDown: boolean;
  readonly canMoveUp: boolean;
  readonly disabled: boolean;
  readonly listId: string;
  readonly onMove: (direction: -1 | 1) => void;
  readonly onRemove: () => void;
  readonly onState: (status: "DRAFT" | "PUBLISHED" | "ARCHIVED") => void;
  readonly row: QuestionRow;
}) => {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`Mais ações da questão ${row.statement.slice(0, 40)}`}
          className="gk-icon-btn gk-icon-btn--bare"
          type="button"
        >
          <GestaoIcon name="dots" size={18} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="gk-menu">
        <DropdownMenuItem
          onSelect={() =>
            router.push(
              `/gestao/ensino/exercicios/${listId}/questoes/${row.questionId}`
            )
          }
        >
          Editar questão
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={disabled || !canMoveUp}
          onSelect={() => onMove(-1)}
        >
          Mover para cima
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={disabled || !canMoveDown}
          onSelect={() => onMove(1)}
        >
          Mover para baixo
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {row.status === "PUBLISHED" ? (
          <DropdownMenuItem onSelect={() => onState("DRAFT")}>
            Voltar para rascunho
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => onState("PUBLISHED")}>
            Publicar questão
          </DropdownMenuItem>
        )}
        {row.status === "ARCHIVED" ? null : (
          <DropdownMenuItem onSelect={() => onState("ARCHIVED")}>
            Arquivar questão
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onRemove}>
          Remover da lista
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const QuestionListPanel = ({
  canReorder,
  categories,
  category,
  firstNumber,
  hasFilters,
  listId,
  query,
  rows,
  status,
}: PanelProperties) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [reordering, setReordering] = useState(false);
  const [removal, setRemoval] = useState<readonly string[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const body = useRef<HTMLTableSectionElement | null>(null);

  const run = (
    action: (data: FormData) => Promise<ExerciseListResult>,
    fields: Record<string, string>,
    after?: () => void
  ) => {
    setNote(null);
    startTransition(async () => {
      const result = await action(form({ listId, ...fields }));
      if (result.ok) {
        after?.();
        router.refresh();
      } else {
        setNote(result.message);
      }
    });
  };

  const reorder = (ids: readonly string[]) =>
    run(reorderExerciseListItems, { ids: ids.join(",") });

  const move = (id: string, direction: -1 | 1) => {
    const ids = rows.map((row) => row.id);
    const from = ids.indexOf(id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= ids.length) {
      return;
    }
    [ids[from], ids[to]] = [ids[to] as string, ids[from] as string];
    reorder(ids);
  };

  const onDrop = (event: DragEvent) => {
    const target = rowOf(event.target);
    const draggedId = event.dataTransfer.getData("text/plain");
    for (const row of body.current?.querySelectorAll<HTMLElement>(
      "[data-drop]"
    ) ?? []) {
      delete row.dataset.drop;
    }
    if (!(target && draggedId && target.dataset.rowId !== draggedId)) {
      return;
    }
    event.preventDefault();
    const box = target.getBoundingClientRect();
    const before = event.clientY < box.top + box.height / 2;
    const ids = rows.map((row) => row.id).filter((id) => id !== draggedId);
    const index = ids.indexOf(target.dataset.rowId ?? "");
    ids.splice(before ? index : index + 1, 0, draggedId);
    reorder(ids);
  };

  const allSelected = rows.length > 0 && selected.length === rows.length;
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    );

  return (
    <>
      <div className="gk-toolbar">
        <QuestionFilters
          categories={categories}
          category={category}
          query={query}
          status={status}
        />
        <button
          aria-pressed={reordering}
          className="gk-link-btn"
          disabled={!canReorder}
          onClick={() => setReordering((value) => !value)}
          title={
            canReorder
              ? undefined
              : "Limpe os filtros para reordenar as questões."
          }
          type="button"
        >
          <GestaoIcon name="grip" size={14} />
          {reordering ? "Concluir reordenação" : "Reordenar questões"}
        </button>
      </div>
      {hasFilters ? (
        <p className="gk-hint">
          Filtros ativos. Limpe a busca, a categoria e o estado para reordenar
          as questões.
        </p>
      ) : null}
      {selected.length ? (
        <div className="gk-bulkbar">
          <strong>
            {selected.length}{" "}
            {selected.length === 1 ? "selecionada" : "selecionadas"}
          </strong>
          <button
            className="gk-btn gk-btn--sm"
            onClick={() => setRemoval(selected)}
            type="button"
          >
            Remover da lista
          </button>
          <button
            className="gk-bulkbar-clear"
            onClick={() => setSelected([])}
            type="button"
          >
            Limpar seleção
          </button>
        </div>
      ) : null}
      {note ? (
        <MenuNote message={note} onDismiss={() => setNote(null)} />
      ) : null}
      <div className="gk-table-card" data-pending={String(pending)}>
        <table className="gk-table gk-qtable" data-reordering={reordering}>
          <thead>
            <tr>
              <th className="gk-col-check">
                <input
                  aria-label="Selecionar todas as questões da página"
                  checked={allSelected}
                  onChange={() =>
                    setSelected(allSelected ? [] : rows.map((row) => row.id))
                  }
                  type="checkbox"
                />
              </th>
              <th className="gk-col-grip" />
              <th className="gk-col-num">#</th>
              <th>Questão</th>
              <th>Formato</th>
              <th>Versão</th>
              <th>Estado</th>
              <th className="gk-col-menu" />
            </tr>
          </thead>
          {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: arrastar é um atalho; o menu da linha oferece mover para cima e para baixo */}
          <tbody
            onDragLeave={() => {
              for (const row of body.current?.querySelectorAll<HTMLElement>(
                "[data-drop]"
              ) ?? []) {
                delete row.dataset.drop;
              }
            }}
            onDragOver={(event) => {
              const row = rowOf(event.target);
              if (!(reordering && row) || row.dataset.dragging === "true") {
                return;
              }
              event.preventDefault();
              for (const other of body.current?.querySelectorAll<HTMLElement>(
                "[data-drop]"
              ) ?? []) {
                delete other.dataset.drop;
              }
              const box = row.getBoundingClientRect();
              row.dataset.drop =
                event.clientY < box.top + box.height / 2 ? "before" : "after";
            }}
            onDrop={onDrop}
            ref={body}
          >
            {rows.length === 0 ? (
              <tr>
                <td className="gk-empty-cell" colSpan={8}>
                  {hasFilters
                    ? "Nenhuma questão corresponde aos filtros."
                    : "Esta lista ainda não tem questões. Use “Nova questão” ou “Reutilizar questão do banco”."}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  data-row-id={row.id}
                  data-selected={selected.includes(row.id)}
                  key={row.id}
                >
                  <td className="gk-col-check">
                    <input
                      aria-label={`Selecionar questão ${firstNumber + index}`}
                      checked={selected.includes(row.id)}
                      onChange={() => toggle(row.id)}
                      type="checkbox"
                    />
                  </td>
                  <td className="gk-col-grip">
                    <span
                      aria-hidden="true"
                      className="gk-grip"
                      data-active={reordering}
                      draggable={reordering}
                      onDragEnd={(event) => {
                        const tr = rowOf(event.currentTarget);
                        if (tr) {
                          delete tr.dataset.dragging;
                        }
                      }}
                      onDragStart={(event) => {
                        const tr = rowOf(event.currentTarget);
                        if (!tr) {
                          return;
                        }
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", row.id);
                        event.dataTransfer.setDragImage(tr, 24, 24);
                        tr.dataset.dragging = "true";
                      }}
                      title="Arrastar para reordenar"
                    >
                      <GestaoIcon name="grip" size={16} />
                    </span>
                  </td>
                  <td className="gk-col-num">{firstNumber + index}</td>
                  <td>
                    <Link
                      className="gk-qtitle"
                      href={`/gestao/ensino/exercicios/${listId}/questoes/${row.questionId}`}
                      prefetch={false}
                    >
                      {row.statement}
                    </Link>
                    <small className="gk-qsub">
                      {row.category ?? "Sem categoria"}
                    </small>
                  </td>
                  <td>{row.format}</td>
                  <td>v{row.version}</td>
                  <td>
                    <span
                      className="gk-chip"
                      data-tone={
                        row.status === "PUBLISHED" ? "active" : "neutral"
                      }
                    >
                      <GestaoIcon name={statusIcons[row.status]} size={12} />
                      {statusNames[row.status]}
                    </span>
                  </td>
                  <td className="gk-col-menu">
                    <RowMenu
                      canMoveDown={canReorder && index < rows.length - 1}
                      canMoveUp={canReorder && index > 0}
                      disabled={pending}
                      listId={listId}
                      onMove={(direction) => move(row.id, direction)}
                      onRemove={() => setRemoval([row.id])}
                      onState={(next) =>
                        run(setExerciseQuestionState, {
                          questionId: row.questionId,
                          status: next,
                        })
                      }
                      row={row}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {removal ? (
        <ConfirmRemove
          count={removal.length}
          onCancel={() => setRemoval(null)}
          onConfirm={() =>
            run(removeExerciseListItems, { ids: removal.join(",") }, () => {
              setRemoval(null);
              setSelected([]);
            })
          }
          pending={pending}
        />
      ) : null}
    </>
  );
};
