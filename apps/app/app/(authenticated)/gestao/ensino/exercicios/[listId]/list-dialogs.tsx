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
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import {
  attachExerciseQuestionToList,
  setExerciseListStatus,
} from "../../../../exercicios/actions";
import { GestaoIcon } from "../../../gestao-icon";
import { updateGestaoExerciseList } from "../list-actions";

export interface ReusableQuestion {
  readonly category: string | null;
  readonly id: string;
  readonly statement: string;
}

const Head = ({
  onClose,
  sub,
  title,
}: {
  readonly onClose: () => void;
  readonly sub: string;
  readonly title: string;
}) => (
  <div className="gk-modal-head">
    <div>
      <DialogTitle className="gk-modal-title">{title}</DialogTitle>
      <DialogDescription className="gk-modal-sub">{sub}</DialogDescription>
    </div>
    <button
      aria-label="Fechar"
      className="gk-modal-close"
      onClick={onClose}
      type="button"
    >
      <GestaoIcon name="x" size={18} />
    </button>
  </div>
);

export const ReuseQuestionDialog = ({
  closeHref,
  listId,
  questions,
  search,
}: {
  readonly closeHref: string;
  readonly listId: string;
  readonly questions: readonly ReusableQuestion[];
  readonly search: string;
}) => {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [picked, setPicked] = useState("");
  const close = () => {
    setOpen(false);
    router.replace(closeHref, { scroll: false });
  };
  return (
    <Dialog onOpenChange={(next) => (next ? null : close())} open={open}>
      <DialogContent
        className="gk-modal"
        overlayClassName="gk-modal-overlay"
        showCloseButton={false}
      >
        <Head
          onClose={close}
          sub="Escolha uma questão já cadastrada neste banco. A lista passa a apontar para a versão atual; tentativas já iniciadas preservam a versão em que foram feitas."
          title="Reutilizar questão do banco"
        />
        <form className="gk-modal-body" method="get">
          <div className="gk-field gk-field--full">
            <GestaoIcon name="search" size={16} />
            <input
              aria-label="Buscar questões do banco"
              className="gk-input"
              defaultValue={search}
              name="busca"
              placeholder="Buscar no enunciado"
              type="search"
            />
            <input name="acao" type="hidden" value="reutilizar" />
          </div>
        </form>
        <form action={attachExerciseQuestionToList}>
          <input name="gestaoReturn" type="hidden" value="GESTAO" />
          <input name="listId" type="hidden" value={listId} />
          <input name="questionId" type="hidden" value={picked} />
          <ul className="gk-pick-list gk-pick-list--questions">
            {questions.length === 0 ? (
              <li className="gk-empty-cell">
                {search
                  ? "Nenhuma questão corresponde à busca."
                  : "Todas as questões deste banco já estão na lista."}
              </li>
            ) : (
              questions.map((question) => (
                <li key={question.id}>
                  <label>
                    <input
                      checked={picked === question.id}
                      name="pick"
                      onChange={() => setPicked(question.id)}
                      type="radio"
                    />
                    <span>
                      <strong>{question.statement}</strong>
                      <small>{question.category ?? "Sem categoria"}</small>
                    </span>
                  </label>
                </li>
              ))
            )}
          </ul>
          <div className="gk-modal-foot">
            <span className="gk-spacer" />
            <button className="gk-btn" onClick={close} type="button">
              Cancelar
            </button>
            <button
              className="gk-btn gk-btn--primary"
              disabled={!picked}
              type="submit"
            >
              Adicionar à lista
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const EditListDialog = ({
  closeHref,
  description,
  listId,
  title,
}: {
  readonly closeHref: string;
  readonly description: string;
  readonly listId: string;
  readonly title: string;
}) => {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const close = () => {
    setOpen(false);
    router.replace(closeHref, { scroll: false });
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateGestaoExerciseList(data);
      if (result.ok) {
        close();
      } else {
        setError(result.message);
      }
    });
  };
  return (
    <Dialog onOpenChange={(next) => (next ? null : close())} open={open}>
      <DialogContent
        className="gk-modal"
        overlayClassName="gk-modal-overlay"
        showCloseButton={false}
      >
        <form onSubmit={submit}>
          <Head
            onClose={close}
            sub="Título e descrição aparecem para o aluno na lista de exercícios."
            title="Editar lista"
          />
          <div className="gk-modal-body">
            <input name="listId" type="hidden" value={listId} />
            <div className="gk-label">
              <label htmlFor="list-edit-title">Título da lista</label>
              <input
                autoFocus
                className="gk-input"
                defaultValue={title}
                id="list-edit-title"
                maxLength={160}
                name="title"
                required
              />
            </div>
            <div className="gk-label">
              <label htmlFor="list-edit-description">
                Descrição (opcional)
              </label>
              <textarea
                className="gk-input gk-textarea"
                defaultValue={description}
                id="list-edit-description"
                maxLength={2000}
                name="description"
                rows={3}
              />
            </div>
            {error ? (
              <p className="gk-error-box" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <div className="gk-modal-foot">
            <span className="gk-spacer" />
            <button className="gk-btn" onClick={close} type="button">
              Cancelar
            </button>
            <button
              className="gk-btn gk-btn--primary"
              disabled={pending}
              type="submit"
            >
              {pending ? "Salvando…" : "Salvar lista"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const stateActions = {
  ARCHIVED: [["DRAFT", "Reativar como rascunho"]],
  DRAFT: [
    ["PUBLISHED", "Publicar lista"],
    ["ARCHIVED", "Arquivar lista"],
  ],
  PUBLISHED: [
    ["DRAFT", "Voltar para rascunho"],
    ["ARCHIVED", "Arquivar lista"],
  ],
} as const;

export const ListMenu = ({
  editHref,
  listId,
  status,
}: {
  readonly editHref: string;
  readonly listId: string;
  readonly status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}) => {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Mais ações da lista"
          className="gk-icon-btn"
          type="button"
        >
          <GestaoIcon name="dots" size={18} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="gk-menu">
        <DropdownMenuItem onSelect={() => router.push(editHref)}>
          Editar título e descrição
        </DropdownMenuItem>
        {stateActions[status].map(([next, label]) => (
          <DropdownMenuItem asChild key={next}>
            <form action={setExerciseListStatus}>
              <input name="gestaoReturn" type="hidden" value="GESTAO" />
              <input name="listId" type="hidden" value={listId} />
              <input name="status" type="hidden" value={next} />
              <button className="gk-menu-form-btn" type="submit">
                {label}
              </button>
            </form>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
