import Link from "next/link";
import { requireGestaoAdmin } from "@/lib/gestao-authorization";
import { getGestaoMemberDetail, getGestaoMembers } from "@/lib/gestao-members";
import {
  inactiveAfterDays,
  type MemberSituation,
  memberRoleLabels,
  memberRoleTabLabels,
  memberSituations,
} from "@/lib/gestao-members-domain";
import { GestaoCrumbTail } from "../../gestao-crumbs";
import { GestaoFilterBar } from "../../gestao-filter-bar";
import { GestaoIcon } from "../../gestao-icon";
import { MemberDrawer } from "./member-drawer";

const base = "/gestao/administracao/membros";
const whitespace = /\s+/;

const monthYear = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  timeZone: "America/Sao_Paulo",
  year: "numeric",
});
const shortWhen = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: "America/Sao_Paulo",
});

const messages: Record<string, string> = {
  changed: "Papel alterado e registrado no histórico.",
  invalid: "Não foi possível alterar: o papel atual mudou. Reabra o membro.",
  "last-admin": "Não é possível rebaixar o último administrador ativo.",
  unchanged: "O papel já era esse.",
};

const situationChips: Record<MemberSituation, readonly [string, string]> = {
  active: ["check-circle", "active"],
  deactivated: ["x", "muted"],
  inactive: ["clock", "muted"],
};

const initials = (name: string) =>
  name
    .split(whitespace)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

const lastStudy = (date: Date | null, now: Date) => {
  if (!date) {
    return "Nunca estudou";
  }
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (days <= 0) {
    return "hoje";
  }
  return days === 1 ? "ontem" : `há ${days} dias`;
};

type Row = Awaited<ReturnType<typeof getGestaoMembers>>["rows"][number];

const MemberRow = ({ now, row }: { readonly now: Date; readonly row: Row }) => {
  const [icon, tone] = situationChips[row.situation];
  const name = row.displayName?.trim() || "Sem nome de exibição";
  return (
    <tr>
      <td>
        <div className="gk-person">
          <span aria-hidden="true" className="gk-avatar gk-avatar--lg">
            {initials(name)}
          </span>
          <div>
            <Link
              className="gk-qtitle"
              href={`${base}?membro=${row.id}`}
              prefetch={false}
              scroll={false}
            >
              {name}
            </Link>
            {row.displayName?.trim() ? null : (
              <span className="gk-tag gk-tag--danger">Falta o nome</span>
            )}
            <small className="gk-qsub">{row.email ?? "Sem e-mail"}</small>
          </div>
        </div>
      </td>
      <td>
        <span className="gk-rolechip" data-role={row.role}>
          {memberRoleLabels[row.role]}
        </span>
      </td>
      <td>
        {row.cohorts.length ? (
          <span className="gk-cohortpill" title={row.cohorts.join(", ")}>
            <GestaoIcon name="users" size={14} />
            <span>{row.cohorts[0]}</span>
            {row.cohorts.length > 1 ? <em>+{row.cohorts.length - 1}</em> : null}
          </span>
        ) : (
          <span className="gk-dash">—</span>
        )}
      </td>
      <td>
        <span className="gk-chip" data-tone={tone}>
          <GestaoIcon name={icon as "check-circle"} size={12} />
          {memberSituations.find(([key]) => key === row.situation)?.[1]}
        </span>
      </td>
      <td>{lastStudy(row.lastStudyAt, now)}</td>
      <td>
        {row.directAccess > 0 ? (
          row.directAccess
        ) : (
          <span className="gk-dash">—</span>
        )}
      </td>
      <td className="gk-col-menu">
        <Link
          aria-label={`Abrir ${name}`}
          className="gk-icon-btn gk-icon-btn--bare"
          href={`${base}?membro=${row.id}`}
          prefetch={false}
          scroll={false}
        >
          <GestaoIcon name="dots" size={18} />
        </Link>
      </td>
    </tr>
  );
};

const historyText = (entry: {
  readonly payload: unknown;
  readonly type: string;
  readonly actor: string;
}) => {
  const payload =
    typeof entry.payload === "object" && entry.payload !== null
      ? (entry.payload as Record<string, unknown>)
      : {};
  if (entry.type === "gestao.member.role_changed") {
    const from =
      memberRoleLabels[payload.from as keyof typeof memberRoleLabels];
    const to = memberRoleLabels[payload.to as keyof typeof memberRoleLabels];
    return `Papel alterado de ${from ?? "?"} para ${to ?? "?"} por ${entry.actor}`;
  }
  return `${entry.type.replace("gestao.", "").replaceAll(".", " ")} por ${entry.actor}`;
};

const GestaoMembersPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) => {
  const params = await searchParams;
  const actor = await requireGestaoAdmin();
  const list = await getGestaoMembers({
    page: params.pagina,
    query: params.q,
    role: params.papel,
    situation: params.situacao,
  });
  const detail = params.membro
    ? await getGestaoMemberDetail(params.membro)
    : null;
  const now = new Date();
  const total = list.counts.ADMIN + list.counts.TEACHER + list.counts.MEMBER;
  const hrefFor = (overrides: Record<string, string | null>) => {
    const next = new URLSearchParams();
    const current: Record<string, string | null> = {
      papel: list.role,
      pagina: null,
      q: list.query || null,
      situacao: list.situation,
      ...overrides,
    };
    for (const [key, value] of Object.entries(current)) {
      if (value) {
        next.set(key, value);
      }
    }
    return `${base}${next.size ? `?${next}` : ""}`;
  };
  const exportHref = hrefFor({ pagina: null }).replace(
    base,
    `${base}/exportar`
  );
  const first = list.total === 0 ? 0 : (list.page - 1) * list.pageSize + 1;
  const last = Math.min(list.page * list.pageSize, list.total);
  const tabs = [
    [null, `Todos · ${total}`],
    ["TEACHER", `${memberRoleTabLabels.TEACHER} · ${list.counts.TEACHER}`],
    ["ADMIN", `${memberRoleTabLabels.ADMIN} · ${list.counts.ADMIN}`],
    ["MEMBER", `${memberRoleTabLabels.MEMBER} · ${list.counts.MEMBER}`],
  ] as const;

  return (
    <section className="gt-page gk-members">
      <GestaoCrumbTail
        items={detail ? [{ label: detail.displayName ?? "Membro" }] : []}
      />
      <header className="gk-head">
        <div className="gk-head-copy">
          <h1>Membros e papéis</h1>
          <p>
            Contas da escola, papéis e situação. O acompanhamento pedagógico
            fica em Alunos.
          </p>
        </div>
        <div className="gk-head-actions">
          <a className="gk-btn gk-btn--wide" href={exportHref}>
            Exportar (.csv)
          </a>
          <Link
            className="gk-btn gk-btn--primary gk-btn--wide"
            href="/gestao/alunos/turmas"
            prefetch={false}
          >
            Convidar membro
          </Link>
        </div>
      </header>

      {params.resultado && messages[params.resultado] ? (
        <output className="gk-result">{messages[params.resultado]}</output>
      ) : null}

      <nav aria-label="Papéis" className="gk-tabs">
        {tabs.map(([key, label]) => (
          <Link
            aria-current={list.role === key ? "page" : undefined}
            className="gk-tab"
            href={hrefFor({ papel: key })}
            key={label}
            prefetch={false}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="gk-toolbar">
        <GestaoFilterBar
          placeholder="Buscar por nome ou e-mail"
          query={list.query}
          selects={[
            {
              label: "Papel",
              options: Object.entries(memberRoleLabels),
              param: "papel",
              value: list.role ?? "",
            },
            {
              label: "Situação",
              options: memberSituations.map(([key, label]) => [key, label]),
              param: "situacao",
              value: list.situation ?? "",
            },
          ]}
        />
      </div>

      <div className="gk-table-card">
        <table className="gk-table gk-qtable">
          <thead>
            <tr>
              <th>Membro</th>
              <th>Papel</th>
              <th>Turmas</th>
              <th>Situação</th>
              <th>Último estudo</th>
              <th>Acessos diretos</th>
              <th className="gk-col-menu" />
            </tr>
          </thead>
          <tbody>
            {list.rows.length ? (
              list.rows
                .slice(
                  (list.page - 1) * list.pageSize,
                  list.page * list.pageSize
                )
                .map((row) => <MemberRow key={row.id} now={now} row={row} />)
            ) : (
              <tr>
                <td className="gk-empty-cell" colSpan={7}>
                  Nenhum membro com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="gk-hint">
        “Inativo” = aluno sem estudar há {inactiveAfterDays} dias ou mais.
      </p>

      <nav aria-label="Paginação dos membros" className="gk-pager">
        <span>
          {list.total === 0
            ? "0 membros"
            : `${first} a ${last} de ${list.total}`}
        </span>
        <div>
          {list.page > 1 ? (
            <Link
              className="gk-btn"
              href={hrefFor({ pagina: String(list.page - 1) })}
              prefetch={false}
            >
              Anterior
            </Link>
          ) : (
            <span aria-disabled="true" className="gk-btn" data-disabled="true">
              Anterior
            </span>
          )}
          {list.page < list.pageCount ? (
            <Link
              className="gk-btn"
              href={hrefFor({ pagina: String(list.page + 1) })}
              prefetch={false}
            >
              Próxima
            </Link>
          ) : (
            <span aria-disabled="true" className="gk-btn" data-disabled="true">
              Próxima
            </span>
          )}
        </div>
      </nav>

      {detail ? (
        <MemberDrawer
          closeHref={hrefFor({})}
          member={{
            email: detail.email,
            history: detail.history.map((entry) => ({
              at: shortWhen.format(entry.at),
              text: historyText(entry),
            })),
            id: detail.id,
            initials: initials(detail.displayName ?? "Membro"),
            isSelf: detail.id === actor.userId,
            name: detail.displayName?.trim() || "Sem nome de exibição",
            role: detail.role,
            since: monthYear.format(detail.createdAt),
            situationLabel: detail.deactivatedAt ? "Desativado" : "Ativo",
          }}
        />
      ) : null}
    </section>
  );
};

export default GestaoMembersPage;
