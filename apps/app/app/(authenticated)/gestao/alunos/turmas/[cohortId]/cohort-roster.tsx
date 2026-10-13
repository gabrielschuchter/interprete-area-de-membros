"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState, useTransition } from "react";
import {
  addGestaoCohortMembers,
  type CohortActionResult,
  createGestaoCohortInvite,
  importGestaoCohortMembers,
  moveGestaoCohortMembers,
  removeGestaoCohortMembers,
  revokeGestaoCohortInvite,
} from "../actions";

interface AddableStudent {
  readonly displayName: string | null;
  readonly email: string | null;
  readonly id: string;
  readonly otherCohortCount: number;
}
interface RosterStudent {
  readonly displayName: string | null;
  readonly email: string | null;
  readonly id: string;
  readonly joinedAt: Date;
}
interface PendingInvite {
  readonly createdAt: Date;
  readonly email: string | null;
  readonly expiresAt: Date;
  readonly id: string;
  readonly maxUses: number;
  readonly usedCount: number;
}
interface TargetCohort {
  readonly id: string;
  readonly name: string;
}

const whitespacePattern = /\s+/u;
const completedActionLabels = {
  add: "adicionados",
  move: "movidos",
  remove: "removidos",
} as const;
const initials = (name: string | null) =>
  name
    ?.trim()
    .split(whitespacePattern)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("pt-BR") || "I";
const joinDate = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
  timeZone: "America/Sao_Paulo",
});
const lineBreakPattern = /\r?\n/gu;
const byteOrderMarkPattern = /^\uFEFF/u;
const quotedFieldPattern = /^"(.*)"$/u;
const escapedQuotePattern = /""/gu;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

const SelectionToolbar = ({
  count,
  hasTargets,
  onMove,
  onRemove,
  onClear,
}: {
  readonly count: number;
  readonly hasTargets: boolean;
  readonly onMove: () => void;
  readonly onRemove: () => void;
  readonly onClear: () => void;
}) =>
  count ? (
    <div className="gt-selection-toolbar">
      <strong>
        {count} selecionado{count === 1 ? "" : "s"}
      </strong>
      {hasTargets ? (
        <button onClick={onMove} type="button">
          Mover para outra turma
        </button>
      ) : null}
      <button onClick={onRemove} type="button">
        Remover da turma
      </button>
      <button className="gt-clear-selection" onClick={onClear} type="button">
        Limpar seleção
      </button>
    </div>
  ) : null;

const RosterTable = ({
  students,
  selected,
  onSelectAll,
  onSelect,
}: {
  readonly students: readonly RosterStudent[];
  readonly selected: readonly string[];
  readonly onSelectAll: (checked: boolean) => void;
  readonly onSelect: (memberId: string, checked: boolean) => void;
}) =>
  students.length ? (
    <div className="gt-table-scroll">
      <table className="gt-table">
        <thead>
          <tr>
            <th>
              <span className="sr-only">Selecionar</span>
              <input
                aria-label="Selecionar todos os alunos desta página"
                checked={students.every((student) =>
                  selected.includes(student.id)
                )}
                onChange={(event) => onSelectAll(event.target.checked)}
                type="checkbox"
              />
            </th>
            <th>Aluno</th>
            <th>Entrou em</th>
            <th>Outras turmas</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr key={student.id}>
              <td>
                <input
                  aria-label={`Selecionar ${student.displayName ?? student.email ?? "aluno"}`}
                  checked={selected.includes(student.id)}
                  onChange={(event) =>
                    onSelect(student.id, event.target.checked)
                  }
                  type="checkbox"
                />
              </td>
              <td>
                <div className="gt-student-cell">
                  <span aria-hidden="true" className="gt-avatar">
                    {initials(student.displayName)}
                  </span>
                  <span>
                    <strong>{student.displayName ?? "Aluno sem nome"}</strong>
                    <small>{student.email ?? "E-mail indisponível"}</small>
                  </span>
                </div>
              </td>
              <td>{joinDate.format(student.joinedAt)}</td>
              <td>—</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div className="gt-panel-empty">
      Ainda não há alunos nesta turma. Busque membros já cadastrados ou crie um
      convite.
    </div>
  );

const RosterConfirmation = ({
  action,
  pending,
  targets,
  targetCohortId,
  preserveReadOnly,
  onTargetChange,
  onPreserveReadOnly,
  onConfirm,
  onCancel,
}: {
  readonly action: "move" | "remove" | null;
  readonly pending: boolean;
  readonly targets: readonly TargetCohort[];
  readonly targetCohortId: string;
  readonly preserveReadOnly: boolean;
  readonly onTargetChange: (value: string) => void;
  readonly onPreserveReadOnly: (value: boolean) => void;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) => {
  if (!action) {
    return null;
  }
  const title = action === "move" ? "Mover alunos" : "Remover alunos";
  const copy =
    action === "move"
      ? "A matrícula atual será encerrada e uma nova será criada na turma de destino. Envios individuais serão mantidos."
      : "A saída encerra o acesso herdado desta turma. Envios individuais e histórico continuam preservados.";
  let confirmLabel = "Confirmar remoção";
  if (pending) {
    confirmLabel = "Salvando…";
  } else if (action === "move") {
    confirmLabel = "Confirmar movimentação";
  }
  return (
    <fieldset className="gt-confirm-panel">
      <legend>{title}</legend>
      <p>{copy}</p>
      {action === "move" ? (
        <label className="gt-field">
          <span>Turma de destino</span>
          <select
            onChange={(event) => onTargetChange(event.target.value)}
            value={targetCohortId}
          >
            <option value="">Selecione uma turma</option>
            {targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="gt-inline-choice">
        <input
          checked={preserveReadOnly}
          onChange={(event) => onPreserveReadOnly(event.target.checked)}
          type="checkbox"
        />
        <span>Manter leitura do conteúdo atual por 30 dias</span>
      </label>
      <div>
        <Button
          disabled={pending || (action === "move" && !targetCohortId)}
          onClick={onConfirm}
          type="button"
        >
          {confirmLabel}
        </Button>
        <Button
          disabled={pending}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Cancelar
        </Button>
      </div>
    </fieldset>
  );
};

const AddablePanel = ({
  addable,
  onlyUnassigned,
  selected,
  pending,
  onToggle,
  onSubmit,
}: {
  readonly addable: readonly AddableStudent[];
  readonly onlyUnassigned: boolean;
  readonly selected: readonly string[];
  readonly pending: boolean;
  readonly onToggle: (memberId: string, checked: boolean) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) => (
  <section
    className="gt-panel"
    id={onlyUnassigned ? "alunos-disponiveis" : undefined}
  >
    <div className="gt-panel-heading">
      <div>
        <h2>
          {onlyUnassigned ? "Alunos sem turma" : "Adicionar membros existentes"}
        </h2>
        <p>
          {onlyUnassigned
            ? "Eles ainda não recebem cursos, atividades nem encontros por turma."
            : "Alunos de outras turmas podem participar desta também."}
        </p>
      </div>
    </div>
    {addable.length ? (
      <form className="gt-addable-list" onSubmit={onSubmit}>
        <div className="gt-addable-scroll">
          {addable.map((student) => (
            <label className="gt-addable-row" key={student.id}>
              <input
                checked={selected.includes(student.id)}
                onChange={(event) => onToggle(student.id, event.target.checked)}
                type="checkbox"
              />
              <span aria-hidden="true" className="gt-avatar">
                {initials(student.displayName)}
              </span>
              <span>
                <strong>{student.displayName ?? "Aluno sem nome"}</strong>
                <small>
                  {student.email ?? "E-mail indisponível"}
                  {student.otherCohortCount
                    ? ` · também em ${student.otherCohortCount} turma(s)`
                    : " · sem turma"}
                </small>
              </span>
            </label>
          ))}
        </div>
        <Button disabled={pending || selected.length === 0} type="submit">
          {pending
            ? "Adicionando…"
            : `Adicionar ${selected.length || "alunos"}`}
        </Button>
      </form>
    ) : (
      <p className="gt-panel-empty">Nenhum membro disponível para adicionar.</p>
    )}
  </section>
);

export const CohortRosterManager = ({
  cohortId,
  students,
  addable,
  targets,
  onlyUnassigned = false,
}: {
  readonly cohortId: string;
  readonly students: readonly RosterStudent[];
  readonly addable: readonly AddableStudent[];
  readonly targets: readonly TargetCohort[];
  readonly onlyUnassigned?: boolean;
}) => {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedAddable, setSelectedAddable] = useState<string[]>([]);
  const [targetCohortId, setTargetCohortId] = useState("");
  const [preserveReadOnly, setPreserveReadOnly] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"move" | "remove" | null>(
    null
  );
  const [message, setMessage] = useState<CohortActionResult | null>(null);
  const [completedAction, setCompletedAction] = useState<
    "add" | "move" | "remove"
  >("add");
  const [pending, startTransition] = useTransition();
  const addKey = useRef("");
  const addSelected = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedAddable.length) {
      return;
    }
    if (!addKey.current) {
      addKey.current = crypto.randomUUID();
    }
    startTransition(async () => {
      const result = await addGestaoCohortMembers({
        cohortId,
        memberIds: selectedAddable,
        idempotencyKey: addKey.current,
      });
      setMessage(result);
      setCompletedAction("add");
      if (result.ok) {
        setSelectedAddable([]);
        addKey.current = "";
        router.refresh();
      }
    });
  };
  const toggleSelected = (memberId: string, checked: boolean) =>
    setSelected((current) =>
      checked
        ? [...new Set([...current, memberId])]
        : current.filter((id) => id !== memberId)
    );
  const toggleAddable = (memberId: string, checked: boolean) =>
    setSelectedAddable((current) =>
      checked
        ? [...new Set([...current, memberId])]
        : current.filter((id) => id !== memberId)
    );
  const selectAll = (checked: boolean) =>
    setSelected(checked ? students.map((student) => student.id) : []);
  const runRosterAction = () => {
    if (
      !(selected.length && confirmAction) ||
      (confirmAction === "move" && !targetCohortId)
    ) {
      return;
    }
    const action = confirmAction;
    const key = crypto.randomUUID();
    startTransition(async () => {
      const result =
        action === "move"
          ? await moveGestaoCohortMembers({
              cohortId,
              targetCohortId,
              memberIds: selected,
              includePastReadOnly: preserveReadOnly,
              idempotencyKey: key,
            })
          : await removeGestaoCohortMembers({
              cohortId,
              memberIds: selected,
              includePastReadOnly: preserveReadOnly,
              idempotencyKey: key,
            });
      setMessage(result);
      setCompletedAction(action);
      setConfirmAction(null);
      if (result.ok) {
        setSelected([]);
        setPreserveReadOnly(false);
        router.refresh();
      }
    });
  };
  return (
    <div className="gt-roster-layout">
      <section className="gt-panel" id="alunos">
        <div className="gt-panel-heading">
          <div>
            <h2>Alunos da turma</h2>
            <p>
              Selecione alunos para mover ou remover. Os envios individuais
              permanecem com cada aluno.
            </p>
          </div>
        </div>
        <SelectionToolbar
          count={selected.length}
          hasTargets={targets.length > 0}
          onClear={() => setSelected([])}
          onMove={() => setConfirmAction("move")}
          onRemove={() => setConfirmAction("remove")}
        />
        <RosterTable
          onSelect={toggleSelected}
          onSelectAll={selectAll}
          selected={selected}
          students={students}
        />
        <RosterConfirmation
          action={confirmAction}
          onCancel={() => setConfirmAction(null)}
          onConfirm={runRosterAction}
          onPreserveReadOnly={setPreserveReadOnly}
          onTargetChange={setTargetCohortId}
          pending={pending}
          preserveReadOnly={preserveReadOnly}
          targetCohortId={targetCohortId}
          targets={targets}
        />
        {message?.ok === false ? (
          <p className="gt-error-summary" role="alert">
            {message.message}
          </p>
        ) : null}
        {message?.ok === true ? (
          <output className="gt-success-message">
            {message.invitedCount !== undefined
              ? `${message.invitedCount} aluno(s) ${completedActionLabels[completedAction]}.`
              : "Alteração salva."}
          </output>
        ) : null}
      </section>
      <AddablePanel
        addable={addable}
        onlyUnassigned={onlyUnassigned}
        onSubmit={addSelected}
        onToggle={toggleAddable}
        pending={pending}
        selected={selectedAddable}
      />
    </div>
  );
};
const parseCsvEmails = (text: string) => {
  const lines = text
    .replace(lineBreakPattern, "\n")
    .split("\n")
    .filter((line) => line.trim());
  const sample = lines[0] ?? "";
  const delimiters = [",", ";", "\t"];
  const delimiter =
    delimiters.sort(
      (left, right) => sample.split(right).length - sample.split(left).length
    )[0] ?? ",";
  const rows = lines.map((line) =>
    line
      .split(delimiter)
      .map((cell) =>
        cell
          .trim()
          .replace(byteOrderMarkPattern, "")
          .replace(quotedFieldPattern, "$1")
          .replace(escapedQuotePattern, '"')
      )
  );
  const header = rows[0]?.map((cell) => cell.toLocaleLowerCase("pt-BR")) ?? [];
  const emailColumn = header.findIndex((cell) =>
    ["email", "e-mail", "e_mail", "correo"].includes(cell)
  );
  const cells =
    emailColumn >= 0
      ? rows.slice(1).map((row) => row[emailColumn] ?? "")
      : rows.map((row) => row.find((cell) => emailPattern.test(cell)) ?? "");
  const validEmails = cells
    .filter((cell) => emailPattern.test(cell))
    .map((cell) => cell.toLocaleLowerCase("pt-BR"));
  return {
    emails: [...new Set(validEmails)],
    rowCount: cells.length,
    invalidCount: cells.filter((cell) => !emailPattern.test(cell)).length,
  };
};
export const CohortCsvImport = ({
  cohortId,
}: {
  readonly cohortId: string;
}) => {
  const router = useRouter();
  const [preview, setPreview] = useState<ReturnType<
    typeof parseCsvEmails
  > | null>(null);
  const [message, setMessage] = useState<CohortActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const key = useRef("");
  const onFile = async (file: File | undefined) => {
    if (!file) {
      setPreview(null);
      return;
    }
    const result = parseCsvEmails((await file.text()).slice(0, 1_000_000));
    setPreview(result);
    setMessage(null);
  };
  const importRows = () => {
    if (!preview?.emails.length) {
      return;
    }
    if (!key.current) {
      key.current = crypto.randomUUID();
    }
    startTransition(async () => {
      const result = await importGestaoCohortMembers({
        cohortId,
        emails: preview.emails,
        idempotencyKey: key.current,
      });
      setMessage(result);
      if (result.ok) {
        key.current = "";
        router.refresh();
      }
    });
  };
  const copyLinks = async () => {
    if (!(message?.ok && message.skippedEmails?.length)) {
      return;
    }
    const text = message.skippedEmails.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <section className="gt-panel gt-csv-panel">
      <div className="gt-panel-heading">
        <div>
          <h2>Importar planilha</h2>
          <p>
            CSV com uma coluna <code>email</code>. O arquivo é lido no navegador
            e só os e-mails validados são enviados.
          </p>
        </div>
      </div>
      <label className="gt-file-input">
        <span>Selecionar arquivo CSV</span>
        <input
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            onFile(file).catch(() =>
              setMessage({
                ok: false,
                code: "validation",
                message: "Não foi possível ler esse arquivo CSV.",
              })
            );
          }}
          type="file"
        />
      </label>
      {preview ? (
        <div className="gt-csv-preview">
          <strong>Prévia antes de confirmar</strong>
          <span>
            {preview.emails.length} e-mails válidos e únicos ·{" "}
            {preview.invalidCount} linha(s) sem e-mail válido
          </span>
          <Button
            disabled={pending || preview.emails.length === 0}
            onClick={importRows}
            type="button"
          >
            {pending
              ? "Importando…"
              : `Adicionar ${preview.emails.length} e-mails`}
          </Button>
        </div>
      ) : null}
      {message ? (
        <div
          className={message.ok ? "gt-success-message" : "gt-error-summary"}
          role={message.ok ? "status" : "alert"}
        >
          {message.ok ? (
            <>
              <p>{message.invitedCount ?? 0} contas existentes adicionadas.</p>
              {message.skippedEmails?.length ? (
                <>
                  <p>
                    {message.skippedEmails.length} e-mail(s) ainda não
                    correspondem a uma conta. Convites não foram enviados.
                  </p>
                  <Button onClick={copyLinks} type="button" variant="outline">
                    {copied
                      ? "E-mails copiados"
                      : "Copiar e-mails para convite"}
                  </Button>
                </>
              ) : null}
            </>
          ) : (
            message.message
          )}
        </div>
      ) : null}
    </section>
  );
};

export const CohortInviteManager = ({
  cohortId,
  invites,
}: {
  readonly cohortId: string;
  readonly invites: readonly PendingInvite[];
}) => {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState("");
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const createKey = useRef("");
  const createInvite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!createKey.current) {
      createKey.current = crypto.randomUUID();
    }
    startTransition(async () => {
      const result = await createGestaoCohortInvite({
        cohortId,
        email: String(form.get("email") ?? ""),
        maxUses: Number(form.get("maxUses") ?? 1),
        expiresInDays: 14,
        idempotencyKey: createKey.current,
      });
      if (!result.ok) {
        setStatus(result.message);
        return;
      }
      if (!result.inviteToken) {
        setStatus(
          "O convite já foi criado. Gere outro link para compartilhar."
        );
        return;
      }
      setToken(result.inviteToken);
      setInviteUrl(
        `${window.location.origin}/convites/turma/${result.inviteToken}`
      );
      createKey.current = "";
      setStatus("Link criado. Ele aparecerá apenas nesta tela até você sair.");
      router.refresh();
    });
  };
  const revoke = (inviteId: string) =>
    startTransition(async () => {
      const result = await revokeGestaoCohortInvite({
        cohortId,
        inviteId,
        idempotencyKey: crypto.randomUUID(),
      });
      setStatus(result.ok ? "Convite cancelado." : result.message);
      setConfirmId(null);
      if (result.ok) {
        router.refresh();
      }
    });
  const copyToken = async () => {
    if (!token) {
      return;
    }
    const link = `${window.location.origin}/convites/turma/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      setStatus("Link copiado.");
    } catch {
      setStatus(
        "Não foi possível copiar automaticamente. Selecione e copie o link exibido."
      );
    }
  };
  return (
    <section className="gt-panel gt-invite-panel">
      <div className="gt-panel-heading">
        <div>
          <h2>Convites</h2>
          <p>
            Convites expiram em 14 dias por padrão. Nenhum e-mail é enviado
            automaticamente.
          </p>
        </div>
      </div>
      <form className="gt-invite-form" onSubmit={createInvite}>
        <label className="gt-field">
          <span>
            E-mail específico <em>opcional</em>
          </span>
          <input
            autoComplete="email"
            name="email"
            placeholder="aluno@exemplo.com"
            type="email"
          />
        </label>
        <label className="gt-field">
          <span>Usos do link</span>
          <input
            defaultValue={1}
            max={500}
            min={1}
            name="maxUses"
            type="number"
          />
        </label>
        <Button disabled={pending} type="submit">
          {pending ? "Criando…" : "Criar convite"}
        </Button>
      </form>
      {token ? (
        <div className="gt-invite-link">
          <label className="gt-field">
            <span>Link do convite</span>
            <input readOnly value={inviteUrl} />
          </label>
          <Button onClick={copyToken} type="button" variant="outline">
            Copiar link
          </Button>
        </div>
      ) : null}
      {status ? <output className="gt-success-message">{status}</output> : null}
      {invites.length ? (
        <ul className="gt-invite-list">
          {invites.map((invite) => (
            <li key={invite.id}>
              <span>
                <strong>{invite.email ?? "Link aberto"}</strong>
                <small>
                  {invite.usedCount}/{invite.maxUses} uso(s) · expira em{" "}
                  {joinDate.format(invite.expiresAt)}
                </small>
              </span>
              {confirmId === invite.id ? (
                <span className="gt-invite-actions">
                  <button
                    disabled={pending}
                    onClick={() => revoke(invite.id)}
                    type="button"
                  >
                    Confirmar cancelamento
                  </button>
                  <button onClick={() => setConfirmId(null)} type="button">
                    Voltar
                  </button>
                </span>
              ) : (
                <button onClick={() => setConfirmId(invite.id)} type="button">
                  Cancelar
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="gt-panel-empty">Não há convites pendentes.</p>
      )}
    </section>
  );
};
