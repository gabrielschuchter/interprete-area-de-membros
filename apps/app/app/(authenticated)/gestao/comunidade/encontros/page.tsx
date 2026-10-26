import Link from "next/link";
import { forbidden } from "next/navigation";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import {
  type GestaoMeetingRow,
  getGestaoMeetingList,
} from "@/lib/gestao-meetings";
import {
  type GestaoMeetingTab,
  gestaoMeetingStateLabels,
  gestaoMeetingTabFromParam,
  gestaoMeetingTabs,
} from "@/lib/gestao-meetings-domain";
import { publishDueGestaoMeetings } from "@/lib/gestao-meetings-schedule";
import { GestaoIcon, type GestaoIconName } from "../../gestao-icon";
import { setGestaoMeetingState } from "./actions";

const base = "/gestao/comunidade/encontros";

const resultMessages: Record<string, string> = {
  agendado: "Encontro agendado. Ele aparece para os alunos na data escolhida.",
  archive: "Encontro arquivado.",
  invalido: "Essa operação não cabe no estado atual do encontro.",
  publicado: "Encontro publicado. Ele já aparece para os alunos.",
  publish: "Encontro publicado. Ele já aparece para os alunos.",
  rascunho: "Rascunho salvo. Nada aparece para os alunos antes de publicar.",
  reopen: "Encontro reaberto como rascunho.",
  salvo: "Alterações salvas.",
};

const tabTitles: Record<GestaoMeetingTab, string> = {
  agenda: "Próximos encontros",
  drafts: "Rascunhos",
  past: "Passados",
  published: "Publicados",
};

const emptyMessages: Record<GestaoMeetingTab, string> = {
  agenda: "Nenhum encontro à vista. Use “Novo encontro” para criar o primeiro.",
  drafts: "Nenhum rascunho. Encontros ainda não publicados aparecem aqui.",
  past: "Nenhum encontro passado.",
  published: "Nenhum encontro publicado à frente.",
};

const stateChips: Record<
  GestaoMeetingRow["state"],
  readonly [GestaoIconName, string]
> = {
  archived: ["archive", "muted"],
  draft: ["pencil", "neutral"],
  published: ["check-circle", "active"],
  scheduled: ["clock", "active"],
};

const OperationButton = ({
  id,
  label,
  operation,
}: {
  readonly id: string;
  readonly label: string;
  readonly operation: string;
}) => (
  <form action={setGestaoMeetingState}>
    <input name="id" type="hidden" value={id} />
    <input name="operation" type="hidden" value={operation} />
    <button className="gk-btn gk-btn--primary" type="submit">
      {label}
    </button>
  </form>
);

const Row = ({ row }: { readonly row: GestaoMeetingRow }) => {
  const [icon, tone] = stateChips[row.state];
  return (
    <div className="gk-meetrow">
      <span aria-hidden="true" className="gk-datetile">
        <span>{row.month}</span>
        <b>{row.day}</b>
      </span>
      <div className="gk-meetrow-copy">
        <Link className="gk-qtitle" href={`${base}/${row.id}`} prefetch={false}>
          {row.title}
        </Link>
        <small>{row.subline}</small>
      </div>
      <span className="gk-chip" data-tone={tone}>
        <GestaoIcon name={icon} size={12} />
        {gestaoMeetingStateLabels[row.state]}
      </span>
      <Link className="gk-btn" href={`${base}/${row.id}`} prefetch={false}>
        Editar
      </Link>
      {row.state === "draft" ? (
        <OperationButton id={row.id} label="Publicar" operation="publish" />
      ) : null}
      {row.state === "archived" ? (
        <OperationButton id={row.id} label="Reabrir" operation="reopen" />
      ) : null}
    </div>
  );
};

const GestaoMeetingsPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const params = await searchParams;
  if (Object.values(params).some(Array.isArray)) {
    forbidden();
  }
  const read = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : undefined;
  await requireGestaoAction("community.moderate");
  await publishDueGestaoMeetings();
  const tab = gestaoMeetingTabFromParam(read("aba"));
  const list = await getGestaoMeetingList(tab);
  const message = resultMessages[read("resultado") ?? ""];

  return (
    <section className="gt-page gk-assignments">
      <header className="gk-head">
        <div className="gk-head-copy">
          <h1>Encontros</h1>
          <p>
            Agenda editorial. Rascunhos ficam separados dos encontros
            publicados.
          </p>
        </div>
        <div className="gk-head-actions">
          <Link
            className="gk-btn gk-btn--primary gk-btn--wide"
            href={`${base}/novo`}
            prefetch={false}
          >
            Novo encontro
          </Link>
        </div>
      </header>

      {message ? <output className="gk-result">{message}</output> : null}

      <nav aria-label="Encontros" className="gk-tabs">
        {gestaoMeetingTabs.map(([key, label]) => (
          <Link
            aria-current={tab === key ? "page" : undefined}
            className="gk-tab"
            href={key === "agenda" ? base : `${base}?aba=${key}`}
            key={key}
            prefetch={false}
          >
            {label}
            {key === "drafts" && list.drafts > 0 ? ` · ${list.drafts}` : ""}
          </Link>
        ))}
      </nav>

      <div className="gk-cols">
        <section className="gk-card gk-meetlist">
          <h2>{tabTitles[tab]}</h2>
          {list.rows.length ? (
            <div className="gk-meetrows">
              {list.rows.map((row) => (
                <Row key={row.id} row={row} />
              ))}
            </div>
          ) : (
            <p className="gk-empty-note">{emptyMessages[tab]}</p>
          )}
        </section>
        <aside className="gk-stack">
          <section className="gk-card">
            <h2>Passados sem gravação</h2>
            {list.withoutRecording > 0 ? (
              <>
                <p className="gk-hint">
                  {list.withoutRecording}{" "}
                  {list.withoutRecording === 1
                    ? "encontro ainda não tem gravação associada."
                    : "encontros ainda não têm gravação associada."}
                </p>
                <Link
                  className="gk-btn gk-btn--wide"
                  href={`${base}?aba=past`}
                  prefetch={false}
                >
                  Associar gravações
                </Link>
              </>
            ) : (
              <p className="gk-hint">
                Todos os encontros passados têm gravação associada.
              </p>
            )}
          </section>
          <section className="gk-card">
            <h2>Calendário</h2>
            <p className="gk-hint">
              Os encontros publicados aparecem no Planejamento de cada aluno.
            </p>
          </section>
        </aside>
      </div>
    </section>
  );
};

export default GestaoMeetingsPage;
