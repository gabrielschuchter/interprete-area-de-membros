"use client";

import { PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import "./evidence-tools.css";

export interface EvidenceListItem {
  readonly context: string | null;
  readonly id: string;
  readonly result: string | null;
  readonly title: string;
  readonly updatedAt: string;
}

export const evidenceHref = (view: "grade" | "rob2", id?: string) =>
  `/ferramentas?view=${view}${id ? `&avaliacao=${encodeURIComponent(id)}` : ""}`;

const updatedLabel = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));

export const EvidenceList = ({
  emptyText,
  items,
  resultLabel,
  selectedId,
  title,
  view,
}: {
  readonly emptyText: string;
  readonly items: readonly EvidenceListItem[];
  readonly resultLabel: (result: string | null) => string;
  readonly selectedId: string | null;
  readonly title: string;
  readonly view: "grade" | "rob2";
}) => (
  <nav aria-label={title} className="ev-list">
    <div className="ev-list__head">
      <h2 className="ev-list__title">{title}</h2>
      <Link
        className="ev-button"
        href={evidenceHref(view, "nova")}
        prefetch={false}
      >
        <PlusIcon aria-hidden="true" /> Nova
      </Link>
    </div>
    {items.length === 0 ? (
      <p className="ev-list__empty">{emptyText}</p>
    ) : (
      <ul className="ev-list__items">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              aria-current={selectedId === item.id ? "page" : undefined}
              className="ev-list__link"
              href={evidenceHref(view, item.id)}
              prefetch={false}
              scroll={false}
            >
              <span className="ev-list__name">{item.title}</span>
              <span className="ev-list__meta">
                {resultLabel(item.result)} · {updatedLabel(item.updatedAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    )}
  </nav>
);

const judgementSymbols: Record<string, string> = {
  HIGH: "×",
  LOW: "+",
  PENDING: "?",
  SOME_CONCERNS: "−",
};

export const JudgementDot = ({
  judgement,
}: {
  readonly judgement: string | null;
}) => (
  <span
    aria-hidden="true"
    className="ev-dot"
    data-judgement={judgement ?? "PENDING"}
  >
    {judgementSymbols[judgement ?? "PENDING"]}
  </span>
);

export const JudgementBadge = ({
  judgement,
  label,
}: {
  readonly judgement: string | null;
  readonly label: string;
}) => (
  <span className="ev-judgement" data-judgement={judgement ?? "PENDING"}>
    {judgement ? <JudgementDot judgement={judgement} /> : null}
    {label}
  </span>
);

export interface EvidenceStatus {
  readonly text: string;
  readonly tone: "error" | "info";
}

const DeleteControl = ({
  onDelete,
  pending,
}: {
  readonly onDelete: () => void;
  readonly pending: boolean;
}) => {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        className="ev-button ev-button--danger"
        onClick={() => setConfirming(true)}
        type="button"
      >
        <Trash2Icon aria-hidden="true" /> Excluir
      </button>
    );
  }
  return (
    <span className="ev-confirm">
      Excluir esta avaliação?
      <button
        className="ev-button ev-button--danger"
        disabled={pending}
        onClick={onDelete}
        type="button"
      >
        Excluir
      </button>
      <button
        className="ev-button"
        onClick={() => setConfirming(false)}
        type="button"
      >
        Cancelar
      </button>
    </span>
  );
};

/** Salvar, estado e exclusão com confirmação na própria página. */
export const EvidenceActionBar = ({
  idleText,
  onDelete,
  onSave,
  pending,
  status,
}: {
  readonly idleText: string;
  readonly onDelete?: () => void;
  readonly onSave: () => void;
  readonly pending: boolean;
  readonly status: EvidenceStatus | null;
}) => (
  <div className="ev-actions">
    <button
      className="ev-button ev-button--primary"
      disabled={pending}
      onClick={onSave}
      type="button"
    >
      <SaveIcon aria-hidden="true" />
      {pending ? "Salvando…" : "Salvar avaliação"}
    </button>
    <span
      aria-live="polite"
      className="ev-actions__status"
      data-tone={status?.tone}
    >
      {status?.text ?? idleText}
    </span>
    {onDelete ? <DeleteControl onDelete={onDelete} pending={pending} /> : null}
  </div>
);
