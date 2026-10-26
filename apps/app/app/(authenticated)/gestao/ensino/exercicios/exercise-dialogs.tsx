"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createExerciseBank,
  createExerciseList,
  setExerciseBankStatus,
  updateExerciseBank,
} from "../../../exercicios/actions";
import { GestaoIcon } from "../../gestao-icon";

export interface ExerciseDialogBank {
  readonly description: string | null;
  readonly id: string;
  readonly status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  readonly title: string;
}

type Mode = "novo-banco" | "nova-lista" | "editar-banco";

const statusActions = {
  DRAFT: [
    ["PUBLISHED", "Publicar banco", true],
    ["ARCHIVED", "Arquivar banco", false],
  ],
  PUBLISHED: [
    ["DRAFT", "Voltar para rascunho", false],
    ["ARCHIVED", "Arquivar banco", false],
  ],
  ARCHIVED: [["DRAFT", "Reativar como rascunho", false]],
} as const;

const Field = ({
  children,
  id,
  label,
}: {
  readonly children: React.ReactNode;
  readonly id: string;
  readonly label: string;
}) => (
  <div className="gk-label">
    <label htmlFor={id}>{label}</label>
    {children}
  </div>
);

const DialogHead = ({
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

const BankForm = ({
  bank,
  onClose,
}: {
  readonly bank: ExerciseDialogBank | null;
  readonly onClose: () => void;
}) => (
  <form action={bank ? updateExerciseBank : createExerciseBank}>
    <input name="gestaoReturn" type="hidden" value="GESTAO" />
    {bank ? <input name="bankId" type="hidden" value={bank.id} /> : null}
    <DialogHead
      onClose={onClose}
      sub={
        bank
          ? "Nome e descrição ficam visíveis só para a equipe."
          : "Bancos agrupam listas por assunto. Ele nasce como rascunho."
      }
      title={bank ? "Editar banco" : "Novo banco"}
    />
    <div className="gk-modal-body">
      <Field id="bank-title" label="Nome do banco">
        <input
          autoFocus
          className="gk-input"
          defaultValue={bank?.title ?? ""}
          id="bank-title"
          maxLength={160}
          name="title"
          required
        />
      </Field>
      <Field id="bank-description" label="Descrição (opcional)">
        <textarea
          className="gk-input gk-textarea"
          defaultValue={bank?.description ?? ""}
          id="bank-description"
          maxLength={2000}
          name="description"
          rows={3}
        />
      </Field>
    </div>
    <div className="gk-modal-foot">
      <span className="gk-spacer" />
      <button className="gk-btn" onClick={onClose} type="button">
        Cancelar
      </button>
      <button className="gk-btn gk-btn--primary" type="submit">
        {bank ? "Salvar banco" : "Criar banco"}
      </button>
    </div>
  </form>
);

const BankStatus = ({ bank }: { readonly bank: ExerciseDialogBank }) => (
  <div className="gk-modal-body gk-exercise-status">
    <p className="gk-modal-sub">
      Estado atual: <strong>{labelFor(bank.status)}</strong>. Banco arquivado
      some das listas dos alunos, mas nada é apagado.
    </p>
    <div className="gk-exercise-status-actions">
      {statusActions[bank.status].map(([next, label, primary]) => (
        <form action={setExerciseBankStatus} key={next}>
          <input name="gestaoReturn" type="hidden" value="GESTAO" />
          <input name="bankId" type="hidden" value={bank.id} />
          <input name="status" type="hidden" value={next} />
          <button
            className={primary ? "gk-btn gk-btn--primary" : "gk-btn"}
            type="submit"
          >
            {label}
          </button>
        </form>
      ))}
    </div>
  </div>
);

const labelFor = (status: ExerciseDialogBank["status"]) => {
  if (status === "PUBLISHED") {
    return "publicado";
  }
  return status === "ARCHIVED" ? "arquivado" : "rascunho";
};

const ListForm = ({
  banks,
  bankId,
  onClose,
}: {
  readonly bankId: string;
  readonly banks: readonly ExerciseDialogBank[];
  readonly onClose: () => void;
}) => (
  <form action={createExerciseList}>
    <input name="gestaoReturn" type="hidden" value="GESTAO" />
    <DialogHead
      onClose={onClose}
      sub="Listas reúnem as questões que o aluno resolve. Ela nasce como rascunho."
      title="Nova lista"
    />
    <div className="gk-modal-body">
      <Field id="list-bank" label="Banco">
        <select
          className="gk-select gk-select--plain"
          defaultValue={bankId}
          id="list-bank"
          name="bankId"
          required
        >
          {banks
            .filter((bank) => bank.status !== "ARCHIVED")
            .map((bank) => (
              <option key={bank.id} value={bank.id}>
                {bank.title}
              </option>
            ))}
        </select>
      </Field>
      <Field id="list-title" label="Título da lista">
        <input
          autoFocus
          className="gk-input"
          id="list-title"
          maxLength={160}
          name="title"
          required
        />
      </Field>
      <Field id="list-description" label="Descrição (opcional)">
        <textarea
          className="gk-input gk-textarea"
          id="list-description"
          maxLength={2000}
          name="description"
          rows={3}
        />
      </Field>
    </div>
    <div className="gk-modal-foot">
      <span className="gk-spacer" />
      <button className="gk-btn" onClick={onClose} type="button">
        Cancelar
      </button>
      <button className="gk-btn gk-btn--primary" type="submit">
        Criar lista
      </button>
    </div>
  </form>
);

export const ExerciseDialog = ({
  bank,
  banks,
  closeHref,
  mode,
}: {
  readonly bank: ExerciseDialogBank | null;
  readonly banks: readonly ExerciseDialogBank[];
  readonly closeHref: string;
  readonly mode: Mode;
}) => {
  const router = useRouter();
  const [open, setOpen] = useState(true);
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
        {mode === "nova-lista" ? (
          <ListForm
            bankId={bank?.id ?? banks[0]?.id ?? ""}
            banks={banks}
            onClose={close}
          />
        ) : (
          <BankForm
            bank={mode === "editar-banco" ? bank : null}
            onClose={close}
          />
        )}
        {mode === "editar-banco" && bank ? <BankStatus bank={bank} /> : null}
      </DialogContent>
    </Dialog>
  );
};
