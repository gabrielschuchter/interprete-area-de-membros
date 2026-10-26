"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { GestaoIcon } from "../../../../gestao-icon";
import {
  addGestaoCohortMembers,
  createGestaoCohortInvite,
  importGestaoCohortMembers,
} from "../../actions";
import { type ParsedEmails, parseEmails } from "../../cohort-wizard-model";

export type AddTab = "existentes" | "planilha" | "convite";

export interface AddableStudent {
  readonly displayName: string | null;
  readonly email: string | null;
  readonly id: string;
  readonly otherCohortCount: number;
}

const tabs = [
  ["existentes", "Membros existentes"],
  ["planilha", "Importar planilha"],
  ["convite", "Convidar"],
] as const;
const whitespacePattern = /\s+/;
const initialsOf = (name: string) =>
  name
    .split(whitespacePattern)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("pt-BR") || "?";

const addLabel = (count: number, pending: boolean) => {
  if (pending) {
    return "Adicionando…";
  }
  if (count === 0) {
    return "Adicionar alunos";
  }
  return `Adicionar ${count} ${count === 1 ? "aluno" : "alunos"}`;
};

const ExistingTab = ({
  addable,
  cohortId,
  entry,
  onDone,
  query,
}: {
  readonly addable: readonly AddableStudent[];
  readonly cohortId: string;
  readonly entry: string;
  readonly onDone: () => void;
  readonly query: string;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = useRef(crypto.randomUUID());
  const [value, setValue] = useState(query);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    []
  );
  const search = (next: string) => {
    setValue(next);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.trim()) {
        params.set("addq", next.trim());
      } else {
        params.delete("addq");
      }
      router.replace(`${pathname}?${params}`, { scroll: false });
    }, 250);
  };
  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await addGestaoCohortMembers({
        cohortId,
        memberIds: selected,
        idempotencyKey: key.current,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
      onDone();
    });
  return (
    <>
      <div className="gk-drawer-body">
        <span className="gk-field">
          <GestaoIcon name="search" size={16} />
          <input
            aria-label="Buscar por nome ou e-mail"
            autoComplete="off"
            className="gk-input"
            id="gk-drawer-first"
            onChange={(event) => search(event.target.value)}
            placeholder="Buscar por nome ou e-mail"
            type="search"
            value={value}
          />
        </span>
        {addable.length ? (
          <ul className="gk-pick-list">
            {addable.map((member) => {
              const name = member.displayName ?? member.email ?? "Aluno";
              return (
                <li key={member.id}>
                  <label>
                    <input
                      checked={selected.includes(member.id)}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked
                            ? [...current, member.id]
                            : current.filter((id) => id !== member.id)
                        )
                      }
                      type="checkbox"
                    />
                    <span
                      aria-hidden="true"
                      className="gk-avatar gk-avatar--lg"
                    >
                      {initialsOf(name)}
                    </span>
                    <span className="gk-row-copy">
                      <strong>{name}</strong>
                      <small>
                        {member.email ?? "e-mail indisponível"} ·{" "}
                        {member.otherCohortCount
                          ? `também em ${member.otherCohortCount} turma(s)`
                          : "sem turma"}
                      </small>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="gk-empty">
            {query
              ? "Nenhum aluno encontrado para essa busca."
              : "Todos os alunos cadastrados já estão nesta turma."}
          </p>
        )}
        <div className="gk-info-box">
          <GestaoIcon name="check-circle" size={20} />
          <div>
            <strong>Ao entrar, cada aluno passa a ver:</strong>
            <span>{entry}</span>
          </div>
        </div>
        {error ? (
          <p className="gk-error-box" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <div className="gk-drawer-foot">
        <button
          className="gk-btn gk-btn--primary"
          disabled={pending || selected.length === 0}
          onClick={submit}
          type="button"
        >
          {addLabel(selected.length, pending)}
        </button>
        <button className="gk-btn" onClick={onDone} type="button">
          Cancelar
        </button>
      </div>
    </>
  );
};

const SheetTab = ({
  cohortId,
  onDone,
}: {
  readonly cohortId: string;
  readonly onDone: () => void;
}) => {
  const router = useRouter();
  const key = useRef(crypto.randomUUID());
  const [parsed, setParsed] = useState<ParsedEmails | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    readonly added: number;
    readonly skipped: readonly string[];
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const submit = () =>
    startTransition(async () => {
      setError(null);
      const response = await importGestaoCohortMembers({
        cohortId,
        emails: parsed?.emails ?? [],
        idempotencyKey: key.current,
      });
      if (!response.ok) {
        setError(response.message);
        return;
      }
      router.refresh();
      setResult({
        added: response.invitedCount ?? 0,
        skipped: response.skippedEmails ?? [],
      });
    });
  if (result) {
    return (
      <>
        <div className="gk-drawer-body">
          <output className="gk-result">
            <strong>{result.added} aluno(s) adicionados à turma.</strong>
            {result.skipped.length ? (
              <span>
                {result.skipped.length} e-mail(s) não têm conta de aluno e
                ficaram de fora: {result.skipped.slice(0, 8).join(", ")}
                {result.skipped.length > 8 ? "…" : ""}. Use a aba Convidar para
                quem ainda não entrou.
              </span>
            ) : null}
          </output>
        </div>
        <div className="gk-drawer-foot">
          <button
            className="gk-btn gk-btn--primary"
            onClick={onDone}
            type="button"
          >
            Concluir
          </button>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="gk-drawer-body">
        <label className="gk-btn gk-btn--plain gk-btn--sm gk-btn--left">
          <GestaoIcon name="upload" size={16} />
          {fileName || "Selecionar arquivo CSV"}
          <input
            accept=".csv,text/csv"
            className="sr-only"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              setFileName(file?.name ?? "");
              setParsed(
                file
                  ? parseEmails((await file.text()).slice(0, 1_000_000))
                  : null
              );
            }}
            type="file"
          />
        </label>
        <p className="gk-hint">
          {parsed
            ? `${parsed.emails.length} e-mail(s) válido(s) em ${parsed.rows} linha(s)${
                parsed.invalid ? `; ${parsed.invalid} ignorada(s)` : ""
              }. Entram na hora os e-mails que já têm conta de aluno.`
            : "CSV com uma coluna email. O arquivo é lido no navegador e só os e-mails validados são enviados."}
        </p>
        {error ? (
          <p className="gk-error-box" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <div className="gk-drawer-foot">
        <button
          className="gk-btn gk-btn--primary"
          disabled={pending || !parsed?.emails.length}
          onClick={submit}
          type="button"
        >
          {pending ? "Importando…" : "Importar planilha"}
        </button>
        <button className="gk-btn" onClick={onDone} type="button">
          Cancelar
        </button>
      </div>
    </>
  );
};

const inviteLabel = (pending: boolean, hasLink: boolean) => {
  if (pending) {
    return "Criando…";
  }
  return hasLink ? "Criar outro link" : "Criar link de convite";
};

const InviteTab = ({
  cohortId,
  onDone,
}: {
  readonly cohortId: string;
  readonly onDone: () => void;
}) => {
  const router = useRouter();
  const key = useRef(crypto.randomUUID());
  const [email, setEmail] = useState("");
  const [uses, setUses] = useState(50);
  const [link, setLink] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const create = () =>
    startTransition(async () => {
      setStatus(null);
      const result = await createGestaoCohortInvite({
        cohortId,
        email,
        maxUses: email ? 1 : uses,
        expiresInDays: 14,
        idempotencyKey: key.current,
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
      key.current = crypto.randomUUID();
      setLink(`${window.location.origin}/convites/turma/${result.inviteToken}`);
      router.refresh();
    });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setStatus("Link copiado.");
    } catch {
      setStatus("Não foi possível copiar sozinho. Selecione e copie o link.");
    }
  };
  return (
    <>
      <div className="gk-drawer-body">
        <label className="gk-label">
          <span>
            E-mail específico <em>opcional</em>
          </span>
          <input
            autoComplete="email"
            className="gk-input gk-input--plain"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="aluno@exemplo.com"
            type="email"
            value={email}
          />
        </label>
        {email ? null : (
          <label className="gk-label">
            <span>Quantos alunos podem usar o link</span>
            <input
              className="gk-input gk-input--plain"
              max={500}
              min={1}
              onChange={(event) => setUses(Number(event.target.value) || 1)}
              type="number"
              value={uses}
            />
          </label>
        )}
        <p className="gk-hint">
          O link vale por 14 dias. Nenhum e-mail é enviado automaticamente: você
          copia o link e envia por onde preferir.
        </p>
        {link ? (
          <div className="gk-link-box">
            <input
              aria-label="Link do convite"
              className="gk-input gk-input--plain"
              onFocus={(event) => event.target.select()}
              readOnly
              value={link}
            />
            <button className="gk-btn gk-btn--sm" onClick={copy} type="button">
              Copiar link
            </button>
          </div>
        ) : null}
        {status ? <output className="gk-hint">{status}</output> : null}
      </div>
      <div className="gk-drawer-foot">
        <button
          className="gk-btn gk-btn--primary"
          disabled={pending}
          onClick={create}
          type="button"
        >
          {inviteLabel(pending, Boolean(link))}
        </button>
        <button className="gk-btn" onClick={onDone} type="button">
          Fechar
        </button>
      </div>
    </>
  );
};

export const AddStudentsDrawer = ({
  addable,
  addQuery,
  cohortId,
  cohortName,
  entry,
  studentCount,
  tab,
}: {
  readonly addable: readonly AddableStudent[];
  readonly addQuery: string;
  readonly cohortId: string;
  readonly cohortName: string;
  readonly entry: string;
  readonly studentCount: number;
  readonly tab: AddTab;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const go = (next: AddTab | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set("adicionar", next);
    } else {
      params.delete("adicionar");
      params.delete("addq");
    }
    router.replace(`${pathname}${params.size ? `?${params}` : ""}`, {
      scroll: false,
    });
  };
  const close = () => go(null);
  return (
    <Dialog onOpenChange={(open) => (open ? null : close())} open>
      <DialogContent
        className="gk-drawer"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById("gk-drawer-first")?.focus();
        }}
        overlayClassName="gk-modal-overlay"
        showCloseButton={false}
      >
        <div className="gk-modal-head">
          <div>
            <DialogTitle className="gk-modal-title">
              Adicionar alunos à turma
            </DialogTitle>
            <DialogDescription className="gk-modal-sub">
              {cohortName} · {studentCount}{" "}
              {studentCount === 1 ? "aluno" : "alunos"}
            </DialogDescription>
          </div>
          <button
            aria-label="Fechar"
            className="gk-modal-close"
            onClick={close}
            type="button"
          >
            <GestaoIcon name="x" size={18} />
          </button>
        </div>
        <fieldset className="gk-segmented gk-drawer-tabs">
          <legend className="sr-only">Como adicionar</legend>
          {tabs.map(([value, label]) => (
            <button
              aria-pressed={tab === value}
              key={value}
              onClick={() => go(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </fieldset>
        {tab === "existentes" ? (
          <ExistingTab
            addable={addable}
            cohortId={cohortId}
            entry={entry}
            onDone={close}
            query={addQuery}
          />
        ) : null}
        {tab === "planilha" ? (
          <SheetTab cohortId={cohortId} onDone={close} />
        ) : null}
        {tab === "convite" ? (
          <InviteTab cohortId={cohortId} onDone={close} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
