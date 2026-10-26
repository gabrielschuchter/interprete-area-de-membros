import { ContentStatus, database } from "@repo/database";
import { BookOpenTextIcon } from "lucide-react";
import Link from "next/link";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { GestaoIcon } from "../../gestao-icon";
import { GestaoListFilters } from "../../gestao-list-filters";
import { ExerciseDialog } from "./exercise-dialogs";

const pageSize = 18;
const statuses = ["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"] as const;
type StatusFilter = (typeof statuses)[number];

const statusNames: Record<ContentStatus, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  ARCHIVED: "Arquivado",
};

const resultNames: Record<string, string> = {
  "bank-created": "Banco criado como rascunho.",
  "bank-updated": "Banco atualizado.",
  "bank-status-updated": "Estado do banco atualizado.",
  "bank-invalid": "Informe um título válido para o banco.",
  "list-created": "Lista criada como rascunho.",
  "list-invalid": "Confira o banco, o título e o endereço da capa.",
  created: "Banco, lista e primeira questão salvos.",
  invalid:
    "Revise enunciado, alternativas e gabarito antes de salvar a questão.",
  "referencias-invalidas":
    "Confira as referências às alternativas antes de salvar.",
};

const normalizeStatus = (value: string | undefined): StatusFilter =>
  statuses.includes(value as StatusFilter) ? (value as StatusFilter) : "ALL";

const exerciseStatusWhere = (status: StatusFilter) =>
  status === "ALL" ? {} : { status: status as ContentStatus };

interface GestaoExercisesPageProperties {
  readonly searchParams: Promise<{
    readonly q?: string;
    readonly estado?: string;
    readonly pagina?: string;
    readonly resultado?: string;
    readonly acao?: string;
    readonly banco?: string;
  }>;
}

const statusIcons = {
  ARCHIVED: "archive",
  DRAFT: "pencil",
  PUBLISHED: "check-circle",
} as const;

const StatusChip = ({ status }: { readonly status: ContentStatus }) => (
  <span
    className="gk-chip"
    data-tone={status === ContentStatus.PUBLISHED ? "active" : "neutral"}
  >
    <GestaoIcon name={statusIcons[status]} size={12} />
    {statusNames[status]}
  </span>
);

const bankSearchWhere = (query: string) => {
  if (!query) {
    return {};
  }
  const contains = { contains: query, mode: "insensitive" as const };
  return {
    OR: [
      { title: contains },
      {
        lists: {
          some: {
            OR: [
              { title: contains },
              {
                items: {
                  some: { questionVersion: { is: { statement: contains } } },
                },
              },
            ],
          },
        },
      },
    ],
  };
};

const resolveDialogMode = (action: string | undefined, hasBank: boolean) => {
  if (action === "novo-banco" || action === "nova-lista") {
    return action;
  }
  return action === "editar-banco" && hasBank ? action : null;
};

const filterQuery = (query: string, status: StatusFilter) => {
  const search = new URLSearchParams();
  if (query) {
    search.set("q", query);
  }
  if (status !== "ALL") {
    search.set("estado", status);
  }
  return search.toString();
};

const pagerHref = (query: string, status: StatusFilter, page: number) =>
  `/gestao/ensino/exercicios?q=${encodeURIComponent(query)}&estado=${status}&pagina=${page}`;

const dialogHref = (mode: string, bankId = "") =>
  `/gestao/ensino/exercicios?${new URLSearchParams({ acao: mode, ...(bankId ? { banco: bankId } : {}) })}`;

const PagerButton = ({
  href,
  label,
}: {
  readonly href: string | null;
  readonly label: string;
}) =>
  href ? (
    <Link className="gk-btn" href={href}>
      {label}
    </Link>
  ) : (
    <span aria-disabled="true" className="gk-btn" data-disabled="true">
      {label}
    </span>
  );

const GestaoExercisesPage = async ({
  searchParams,
}: GestaoExercisesPageProperties) => {
  await requireGestaoAction("content.manage");
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 120);
  const status = normalizeStatus(params.estado);
  const requestedPage = Math.max(1, Math.trunc(Number(params.pagina) || 1));
  const where = {
    ...exerciseStatusWhere(status),
    ...bankSearchWhere(query),
  };
  const totalCount = await database.exerciseBank.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const banks = await database.exerciseBank.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }, { title: "asc" }, { id: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      updatedAt: true,
      lists: {
        orderBy: [{ position: "asc" }, { title: "asc" }, { id: "asc" }],
        take: 20,
        select: {
          id: true,
          title: true,
          status: true,
          _count: { select: { items: true, sessions: true } },
        },
      },
      _count: { select: { lists: true } },
    },
  });
  const resultMessage = params.resultado
    ? (resultNames[params.resultado] ?? null)
    : null;

  const allBanks = await database.exerciseBank.findMany({
    orderBy: [{ title: "asc" }],
    select: { id: true, title: true, description: true, status: true },
  });
  const action = params.acao;
  const dialogBank = allBanks.find((item) => item.id === params.banco) ?? null;
  const dialogMode = resolveDialogMode(action, dialogBank !== null);
  const filters = filterQuery(query, status);
  const closeHref = `/gestao/ensino/exercicios${filters ? `?${filters}` : ""}`;

  return (
    <section className="gt-page gk-exercises">
      <header className="gk-head">
        <div className="gk-head-copy">
          <h1>Exercícios</h1>
          <p>
            Bancos agrupam listas por assunto. Listas reúnem as questões que o
            aluno resolve.
          </p>
        </div>
        <div className="gk-head-actions">
          <Link
            className="gk-btn"
            href={dialogHref("novo-banco")}
            prefetch={false}
            scroll={false}
          >
            Novo banco
          </Link>
          <Link
            aria-disabled={allBanks.length === 0}
            className="gk-btn gk-btn--primary gk-btn--wide"
            href={dialogHref("nova-lista")}
            prefetch={false}
            scroll={false}
          >
            Nova lista
          </Link>
        </div>
      </header>

      {resultMessage ? (
        <output className="gk-result">{resultMessage}</output>
      ) : null}

      <div className="gk-toolbar">
        <GestaoListFilters
          options={[
            ["DRAFT", "Rascunho"],
            ["PUBLISHED", "Publicado"],
            ["ARCHIVED", "Arquivado"],
          ]}
          param="estado"
          placeholder="Buscar bancos, listas e questões"
          query={query}
          selected={status === "ALL" ? "" : status}
          selectLabel="Estado"
        />
      </div>

      {banks.length ? (
        <div className="gk-bank-grid">
          {banks.map((bank) => (
            <article className="gk-bank" key={bank.id}>
              <header>
                <div>
                  <h2>{bank.title}</h2>
                  <p>
                    Banco · {bank._count.lists}{" "}
                    {bank._count.lists === 1 ? "lista(s)" : "lista(s)"}
                  </p>
                </div>
                <StatusChip status={bank.status} />
              </header>
              {bank.lists.length ? (
                <ul className="gk-bank-lists">
                  {bank.lists.map((list) => (
                    <li key={list.id}>
                      <span aria-hidden="true" className="gk-course-kind">
                        <GestaoIcon name="checklist" size={18} />
                      </span>
                      <div className="gk-bank-list-copy">
                        <strong>{list.title}</strong>
                        <small>
                          {list._count.items}{" "}
                          {list._count.items === 1 ? "questão" : "questões"} ·{" "}
                          {list._count.sessions}{" "}
                          {list._count.sessions === 1
                            ? "tentativa"
                            : "tentativas"}
                        </small>
                      </div>
                      <StatusChip status={list.status} />
                      <Link
                        className="gk-btn gk-btn--sm"
                        href={`/gestao/ensino/exercicios/${list.id}`}
                        prefetch={false}
                      >
                        Gerenciar
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="gk-empty">
                  Nenhuma lista ainda. Use “Nova lista” para começar.
                </p>
              )}
              <footer>
                <Link
                  className="gk-edit-link"
                  href={dialogHref("nova-lista", bank.id)}
                  prefetch={false}
                  scroll={false}
                >
                  <GestaoIcon name="plus" size={14} /> Nova lista
                </Link>
                <Link
                  className="gk-edit-link gk-edit-link--muted"
                  href={dialogHref("editar-banco", bank.id)}
                  prefetch={false}
                  scroll={false}
                >
                  <GestaoIcon name="pencil" size={14} /> Editar banco
                </Link>
                {bank._count.lists > bank.lists.length ? (
                  <Link
                    className="gk-edit-link gk-edit-link--muted"
                    href={`/gestao/ensino/exercicios/bancos/${encodeURIComponent(bank.id)}`}
                    prefetch={false}
                  >
                    Ver todas as listas
                  </Link>
                ) : null}
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <div className="gestao-exercise-empty">
          <BookOpenTextIcon aria-hidden="true" />
          <h2>{query ? "Nenhum resultado" : "Nenhum banco de exercícios"}</h2>
          <p>
            {query
              ? "Tente outro termo ou remova o filtro para ver o acervo."
              : "Crie um banco para organizar listas e questões por assunto."}
          </p>
        </div>
      )}

      <nav aria-label="Paginação dos bancos de exercícios" className="gk-pager">
        <span>
          {totalCount === 0
            ? "0 bancos"
            : `${(page - 1) * pageSize + 1} a ${Math.min(page * pageSize, totalCount)} de ${totalCount}`}
        </span>
        <div>
          <PagerButton
            href={page > 1 ? pagerHref(query, status, page - 1) : null}
            label="Anterior"
          />
          <PagerButton
            href={page < totalPages ? pagerHref(query, status, page + 1) : null}
            label="Próxima"
          />
        </div>
      </nav>
      {dialogMode ? (
        <ExerciseDialog
          bank={dialogBank}
          banks={allBanks}
          closeHref={closeHref}
          key={`${dialogMode}-${dialogBank?.id ?? ""}`}
          mode={dialogMode}
        />
      ) : null}
    </section>
  );
};

export default GestaoExercisesPage;
