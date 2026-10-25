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
import { useActionState, useState } from "react";
import { GestaoIcon } from "../../gestao-icon";
import {
  type AudienceMode,
  AudienceStep,
  type CohortOption,
  type StudentOption,
} from "../atribuicoes/nova/assignment-wizard-steps";
import {
  archiveGestaoTask,
  changeGestaoCampaign,
  createGestaoCampaign,
  createGestaoTask,
} from "./actions";

const recurrenceOptions = [
  ["ONCE", "Uma vez"],
  ["DAILY", "Diária"],
  ["WEEKLY", "Semanal"],
  ["MONTHLY", "Mensal"],
] as const;

const ModalHead = ({
  onClose,
  subtitle,
  title,
}: {
  readonly onClose: () => void;
  readonly subtitle: string;
  readonly title: string;
}) => (
  <div className="gk-modal-head">
    <div>
      <DialogTitle className="gk-modal-title">{title}</DialogTitle>
      <DialogDescription className="gk-modal-sub">{subtitle}</DialogDescription>
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

const TaskForm = ({
  cohorts,
  onClose,
}: {
  readonly cohorts: readonly CohortOption[];
  readonly onClose: () => void;
}) => {
  const [state, formAction, pending] = useActionState(createGestaoTask, {
    error: null,
  });
  const [mode, setMode] = useState<AudienceMode>("cohorts");
  const [cohortIds, setCohortIds] = useState<readonly string[]>([]);
  const [students, setStudents] = useState<readonly StudentOption[]>([]);
  return (
    <form action={formAction} id="gk-task-form">
      <ModalHead
        onClose={onClose}
        subtitle="Uma ação com prazo ou frequência. Aparece no Planejamento do aluno."
        title="Nova tarefa"
      />
      <div className="gk-modal-body">
        <div className="gk-form-stack">
          <label className="gk-label">
            <span>Título</span>
            <input
              autoComplete="off"
              className="gk-input"
              maxLength={180}
              name="title"
              placeholder="Ex.: Registrar uma dúvida do dia"
              required
            />
          </label>
          <label className="gk-label">
            <span>
              Descrição <em>opcional</em>
            </span>
            <textarea
              className="gk-input gk-textarea"
              maxLength={2000}
              name="description"
              rows={3}
            />
          </label>
          <div className="gk-form-grid gk-form-grid--three">
            <label className="gk-label">
              <span>Frequência</span>
              <select
                className="gk-select"
                defaultValue="ONCE"
                name="recurrence"
              >
                {recurrenceOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="gk-label">
              <span>
                Começa em <em>opcional</em>
              </span>
              <input className="gk-input" name="startsAt" type="date" />
            </label>
            <label className="gk-label">
              <span>
                Prazo <em>opcional</em>
              </span>
              <input className="gk-input" name="dueAt" type="date" />
            </label>
          </div>
          <AudienceStep
            cohorts={cohorts}
            heading={null}
            mode={mode}
            onCohorts={setCohortIds}
            onMode={setMode}
            onStudents={setStudents}
            selectedCohorts={cohortIds}
            selectedStudents={students}
          />
          {cohortIds.map((id) => (
            <input key={id} name="cohortIds" type="hidden" value={id} />
          ))}
          {students.map((student) => (
            <input
              key={student.id}
              name="memberIds"
              type="hidden"
              value={student.id}
            />
          ))}
          {state.error ? (
            <p className="gk-error-box" role="alert">
              {state.error}
            </p>
          ) : null}
        </div>
      </div>
      <div className="gk-modal-foot">
        <span className="gk-spacer" />
        <button className="gk-link-btn" onClick={onClose} type="button">
          Cancelar
        </button>
        <button
          className="gk-btn gk-btn--primary gk-btn--wide"
          disabled={pending}
          type="submit"
        >
          {pending ? "Enviando…" : "Enviar tarefa"}
        </button>
      </div>
    </form>
  );
};

const GoalForm = ({ onClose }: { readonly onClose: () => void }) => {
  const [state, formAction, pending] = useActionState(createGestaoCampaign, {
    error: null,
  });
  return (
    <form action={formAction}>
      <ModalHead
        onClose={onClose}
        subtitle="Mede o esforço da turma em horas de estudo ativo. O painel mostra só o agregado."
        title="Nova meta coletiva"
      />
      <div className="gk-modal-body">
        <div className="gk-form-stack">
          <label className="gk-label">
            <span>Título</span>
            <input
              autoComplete="off"
              className="gk-input"
              maxLength={180}
              name="title"
              placeholder="Ex.: 200 horas de estudo em outubro"
              required
            />
          </label>
          <label className="gk-label">
            <span>
              Descrição <em>opcional</em>
            </span>
            <textarea
              className="gk-input gk-textarea"
              maxLength={2000}
              name="description"
              rows={3}
            />
          </label>
          <div className="gk-form-grid gk-form-grid--three">
            <label className="gk-label">
              <span>Objetivo em horas</span>
              <input
                className="gk-input"
                inputMode="decimal"
                name="targetHours"
                placeholder="200"
                required
              />
            </label>
            <label className="gk-label">
              <span>Início · Brasília</span>
              <input
                className="gk-input"
                name="startsAt"
                required
                type="datetime-local"
              />
            </label>
            <label className="gk-label">
              <span>Fim · Brasília</span>
              <input
                className="gk-input"
                name="endsAt"
                required
                type="datetime-local"
              />
            </label>
          </div>
          <label className="gk-check">
            <input name="published" type="checkbox" value="true" />
            <span>Publicar agora para todos os alunos</span>
          </label>
          {state.error ? (
            <p className="gk-error-box" role="alert">
              {state.error}
            </p>
          ) : null}
        </div>
      </div>
      <div className="gk-modal-foot">
        <span className="gk-spacer" />
        <button className="gk-link-btn" onClick={onClose} type="button">
          Cancelar
        </button>
        <button
          className="gk-btn gk-btn--primary gk-btn--wide"
          disabled={pending}
          type="submit"
        >
          {pending ? "Salvando…" : "Salvar meta"}
        </button>
      </div>
    </form>
  );
};

const FormDialog = ({
  children,
  onClose,
}: {
  readonly children: React.ReactNode;
  readonly onClose: () => void;
}) => (
  <Dialog onOpenChange={(open) => (open ? null : onClose())} open>
    <DialogContent
      className="gk-modal"
      onEscapeKeyDown={(event) => {
        // Esc fecha primeiro a lista do seletor de pessoas, depois o diálogo.
        if (document.getElementById("assignment-audience-menu")) {
          event.preventDefault();
        }
      }}
      overlayClassName="gk-modal-overlay"
      showCloseButton={false}
    >
      {children}
    </DialogContent>
  </Dialog>
);

export const NewTaskButton = ({
  cohorts,
}: {
  readonly cohorts: readonly CohortOption[];
}) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="gk-btn gk-btn--primary gk-btn--wide"
        onClick={() => setOpen(true)}
        type="button"
      >
        Nova tarefa
      </button>
      {open ? (
        <FormDialog onClose={() => setOpen(false)}>
          <TaskForm cohorts={cohorts} onClose={() => setOpen(false)} />
        </FormDialog>
      ) : null}
    </>
  );
};

export const NewGoalButton = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="gk-btn gk-btn--wide"
        onClick={() => setOpen(true)}
        type="button"
      >
        Nova meta coletiva
      </button>
      {open ? (
        <FormDialog onClose={() => setOpen(false)}>
          <GoalForm onClose={() => setOpen(false)} />
        </FormDialog>
      ) : null}
    </>
  );
};

const ConfirmDialog = ({
  action,
  confirmLabel,
  description,
  fields,
  onClose,
  title,
}: {
  readonly action: (formData: FormData) => Promise<void>;
  readonly confirmLabel: string;
  readonly description: string;
  readonly fields: Record<string, string>;
  readonly onClose: () => void;
  readonly title: string;
}) => (
  <Dialog onOpenChange={(open) => (open ? null : onClose())} open>
    <DialogContent
      className="gk-modal gk-modal--narrow"
      overlayClassName="gk-modal-overlay"
      showCloseButton={false}
    >
      <form action={action}>
        {Object.entries(fields).map(([name, value]) => (
          <input key={name} name={name} type="hidden" value={value} />
        ))}
        <div className="gk-modal-head">
          <div>
            <DialogTitle className="gk-modal-title">{title}</DialogTitle>
            <DialogDescription className="gk-modal-sub">
              {description}
            </DialogDescription>
          </div>
        </div>
        <div className="gk-modal-foot">
          <span className="gk-spacer" />
          <button className="gk-btn" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="gk-btn gk-btn--primary" type="submit">
            {confirmLabel}
          </button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
);

const MenuTrigger = ({ label }: { readonly label: string }) => (
  <DropdownMenuTrigger asChild>
    <button
      aria-label={`Mais ações para ${label}`}
      className="gk-icon-btn gk-icon-btn--bare"
      type="button"
    >
      <GestaoIcon name="dots" size={18} />
    </button>
  </DropdownMenuTrigger>
);

export const TaskRowMenu = ({
  canArchive,
  taskId,
  title,
}: {
  readonly canArchive: boolean;
  readonly taskId: string;
  readonly title: string;
}) => {
  const [confirming, setConfirming] = useState(false);
  if (!canArchive) {
    return null;
  }
  return (
    <>
      <DropdownMenu>
        <MenuTrigger label={title} />
        <DropdownMenuContent align="end" className="gk-menu">
          <DropdownMenuItem onSelect={() => setConfirming(true)}>
            Arquivar tarefa
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {confirming ? (
        <ConfirmDialog
          action={archiveGestaoTask}
          confirmLabel="Arquivar tarefa"
          description={`“${title}” deixa de aparecer no Planejamento dos alunos. O histórico de conclusões continua registrado.`}
          fields={{ taskId }}
          onClose={() => setConfirming(false)}
          title="Arquivar esta tarefa?"
        />
      ) : null}
    </>
  );
};

export const GoalMenu = ({
  archived,
  campaignId,
  published,
  title,
}: {
  readonly archived: boolean;
  readonly campaignId: string;
  readonly published: boolean;
  readonly title: string;
}) => {
  const [archiving, setArchiving] = useState(false);
  return (
    <>
      <DropdownMenu>
        <MenuTrigger label={title} />
        <DropdownMenuContent align="end" className="gk-menu">
          <DropdownMenuItem asChild>
            <form action={changeGestaoCampaign}>
              <input name="campaignId" type="hidden" value={campaignId} />
              <input
                name="operation"
                type="hidden"
                value={published && !archived ? "unpublish" : "publish"}
              />
              <button className="gk-menu-form-btn" type="submit">
                {published && !archived
                  ? "Retirar da publicação"
                  : "Publicar meta"}
              </button>
            </form>
          </DropdownMenuItem>
          {archived ? null : (
            <DropdownMenuItem onSelect={() => setArchiving(true)}>
              Arquivar meta
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {archiving ? (
        <ConfirmDialog
          action={changeGestaoCampaign}
          confirmLabel="Arquivar meta"
          description={`“${title}” deixa de aparecer para os alunos. Você pode publicá-la de novo depois.`}
          fields={{ campaignId, operation: "archive" }}
          onClose={() => setArchiving(false)}
          title="Arquivar esta meta?"
        />
      ) : null}
    </>
  );
};
