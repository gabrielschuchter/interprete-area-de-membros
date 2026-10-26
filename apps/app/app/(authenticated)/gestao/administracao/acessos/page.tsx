import { database } from "@repo/database";
import Link from "next/link";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import {
  getContentAccessRows,
  getGrantTree,
  getMemberAccessRows,
  listAccessMembers,
} from "@/lib/gestao-member-access";
import { GestaoIcon } from "../../gestao-icon";
import { GrantButton, RevokeButton } from "./access-client";

const base = "/gestao/administracao/acessos";
const whitespace = /\s+/;

const messages: Record<string, string> = {
  concedido: "Acesso concedido e registrado.",
  "ja-existia": "Esse membro já tinha todos os acessos escolhidos.",
  indisponivel: "Essa concessão não está mais disponível. Atualize a página.",
  revogado: "Concessão revogada. Outros acessos válidos continuam.",
};

const originName: Record<string, string> = {
  DIRECT: "Direta",
  LEGACY_GRANT: "Legada",
};

const initials = (name: string) =>
  name
    .split(whitespace)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

const typeIcon = (type: string) => {
  if (type === "LESSON" || type === "RECORDING") {
    return "play" as const;
  }
  return type === "ACTIVITY" ? ("inbox" as const) : ("book" as const);
};

const MemberPane = async ({ memberId }: { readonly memberId: string }) => {
  const data = await getMemberAccessRows(memberId);
  if (!data) {
    return <p className="gk-hint">Membro não encontrado.</p>;
  }
  const name = data.member.displayName ?? "Aluno";
  return (
    <div className="gk-access-pane">
      <header className="gk-access-head">
        <span aria-hidden="true" className="gk-avatar gk-avatar--xl">
          {initials(name)}
        </span>
        <div>
          <h2>{name}</h2>
          <p>
            {data.rows.length}{" "}
            {data.rows.length === 1 ? "acesso efetivo" : "acessos efetivos"}
          </p>
        </div>
      </header>
      <div className="gk-table-card">
        <table className="gk-table gk-qtable">
          <thead>
            <tr>
              <th>Recurso</th>
              <th>Origem</th>
              <th>Vigência</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.rows.length ? (
              data.rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="gk-person">
                      <span aria-hidden="true" className="gk-kindtile">
                        <GestaoIcon
                          name={typeIcon(row.resourceType)}
                          size={18}
                        />
                      </span>
                      <div>
                        <span className="gk-qtitle">{row.title}</span>
                        <small className="gk-qsub">{row.subtitle}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="gk-origin" data-origin={row.origin}>
                      {row.originLabel}
                    </span>
                  </td>
                  <td>{row.validity}</td>
                  <td className="gk-access-action">
                    {row.kind ? (
                      <RevokeButton
                        grantId={row.id}
                        kind={row.kind}
                        memberId={memberId}
                        title={row.title}
                      />
                    ) : (
                      <small>{row.hint}</small>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="gk-empty-cell" colSpan={4}>
                  Este membro ainda não tem acessos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="gk-hint">
        Revogar uma concessão direta não remove acessos que continuam válidos
        por outras origens (turma, matrícula ou atribuição).
      </p>
    </div>
  );
};

const ContentPane = async ({ courseId }: { readonly courseId: string }) => {
  const data = await getContentAccessRows(courseId);
  if (!data.course) {
    return <p className="gk-hint">Curso não encontrado.</p>;
  }
  return (
    <div className="gk-access-pane">
      <header className="gk-access-head">
        <div>
          <h2>{data.course.title}</h2>
          <p>Quem acessa este curso, e por quê.</p>
        </div>
      </header>
      <div className="gk-table-card">
        <table className="gk-table gk-qtable">
          <thead>
            <tr>
              <th>Quem</th>
              <th>Origem</th>
              <th>Vigência</th>
            </tr>
          </thead>
          <tbody>
            {data.cohorts.map(({ cohort }) => (
              <tr key={cohort.id}>
                <td>
                  <Link
                    className="gk-qtitle"
                    href={`/gestao/alunos/turmas/${cohort.id}/conteudo`}
                    prefetch={false}
                  >
                    {cohort.name}
                  </Link>
                  <small className="gk-qsub">
                    {cohort._count.memberships} alunos
                  </small>
                </td>
                <td>
                  <span className="gk-origin" data-origin="COHORT">
                    Turma
                  </span>
                </td>
                <td>Enquanto estiver na turma</td>
              </tr>
            ))}
            {[
              ...data.sources.map((source) => ({
                key: `s-${source.subjectMember?.id}-${source.origin}-${source.validUntil?.getTime() ?? 0}`,
                id: source.subjectMember?.id,
                name: source.subjectMember?.displayName,
                origin: source.origin,
                until: source.validUntil,
              })),
              ...data.legacy.map((grant) => ({
                key: `l-${grant.member.id}-${grant.expiresAt?.getTime() ?? 0}`,
                id: grant.member.id,
                name: grant.member.displayName,
                origin: "LEGACY_GRANT",
                until: grant.expiresAt,
              })),
            ].map((row) => (
              <tr key={row.key}>
                <td>
                  <Link
                    className="gk-qtitle"
                    href={`${base}?membro=${row.id}`}
                    prefetch={false}
                  >
                    {row.name ?? "Aluno"}
                  </Link>
                </td>
                <td>
                  <span className="gk-origin" data-origin={row.origin}>
                    {originName[row.origin] ?? row.origin}
                  </span>
                </td>
                <td>
                  {row.until
                    ? `até ${row.until.toLocaleDateString("pt-BR")}`
                    : "Sem expiração"}
                </td>
              </tr>
            ))}
            {data.cohorts.length + data.sources.length + data.legacy.length ===
            0 ? (
              <tr>
                <td className="gk-empty-cell" colSpan={3}>
                  Ninguém tem acesso a este curso ainda.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const GestaoAccessPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | undefined>>;
}) => {
  const params = await searchParams;
  await requireGestaoAction("access.manage");
  const byContent = params.aba === "conteudo";
  const [members, tree, courses] = await Promise.all([
    listAccessMembers(params.q ?? ""),
    getGrantTree(),
    byContent
      ? database.course.findMany({
          orderBy: [{ position: "asc" }, { title: "asc" }],
          take: 150,
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
  ]);
  const selectedId = params.membro ?? members[0]?.id ?? null;
  const selectedMember =
    members.find((member) => member.id === selectedId) ?? null;
  const courseId = params.curso ?? courses[0]?.id ?? null;
  const message = params.resultado ? messages[params.resultado] : null;

  return (
    <section className="gt-page gk-access">
      <header className="gk-head">
        <div className="gk-head-copy">
          <h1>Acessos</h1>
          <p>
            Quem pode estudar o quê, e por quê. Revogar atua só sobre a
            concessão escolhida.
          </p>
        </div>
        <div className="gk-head-actions">
          <GrantButton
            initialMember={
              selectedMember
                ? {
                    id: selectedMember.id,
                    name: selectedMember.displayName ?? "Aluno",
                  }
                : null
            }
            tree={tree}
          />
        </div>
      </header>

      {message ? <output className="gk-result">{message}</output> : null}

      <nav aria-label="Visões" className="gk-tabs">
        <Link
          aria-current={byContent ? undefined : "page"}
          className="gk-tab"
          href={base}
          prefetch={false}
        >
          Por membro
        </Link>
        <Link
          aria-current={byContent ? "page" : undefined}
          className="gk-tab"
          href={`${base}?aba=conteudo`}
          prefetch={false}
        >
          Por conteúdo
        </Link>
      </nav>

      {byContent ? (
        <div className="gk-access-grid">
          <aside className="gk-access-list">
            <ul>
              {courses.map((course) => (
                <li
                  aria-current={course.id === courseId ? "true" : undefined}
                  key={course.id}
                >
                  <Link
                    href={`${base}?aba=conteudo&curso=${course.id}`}
                    prefetch={false}
                  >
                    <span>{course.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
          {courseId ? <ContentPane courseId={courseId} /> : null}
        </div>
      ) : (
        <div className="gk-access-grid">
          <aside className="gk-access-list">
            <form action={base} method="get">
              <label className="gk-field">
                <GestaoIcon name="search" size={16} />
                <input
                  aria-label="Buscar membro"
                  className="gk-input"
                  defaultValue={params.q ?? ""}
                  name="q"
                  placeholder="Buscar membro"
                />
              </label>
            </form>
            <ul>
              {members.map((member) => (
                <li
                  aria-current={member.id === selectedId ? "true" : undefined}
                  key={member.id}
                >
                  <Link
                    href={`${base}?membro=${member.id}${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`}
                    prefetch={false}
                  >
                    <span
                      aria-hidden="true"
                      className="gk-avatar gk-avatar--lg"
                    >
                      {initials(member.displayName ?? "Aluno")}
                    </span>
                    <span>{member.displayName ?? "Aluno"}</span>
                    {member.directCount > 0 ? (
                      <small title="Concessões diretas">
                        {member.directCount}
                      </small>
                    ) : null}
                  </Link>
                </li>
              ))}
              {members.length === 0 ? (
                <li className="gk-pickmenu-empty">Nenhum aluno encontrado.</li>
              ) : null}
            </ul>
          </aside>
          {selectedId ? <MemberPane memberId={selectedId} /> : null}
        </div>
      )}
    </section>
  );
};

export default GestaoAccessPage;
