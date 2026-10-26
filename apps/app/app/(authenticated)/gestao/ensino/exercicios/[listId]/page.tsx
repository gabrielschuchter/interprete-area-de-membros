import { ContentStatus, database, type Prisma } from "@repo/database";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { GestaoCrumbTail } from "../../../gestao-crumbs";
import { GestaoIcon } from "../../../gestao-icon";
import {
  EditListDialog,
  ListMenu,
  type ReusableQuestion,
  ReuseQuestionDialog,
} from "./list-dialogs";
import { QuestionListPanel, type QuestionRow } from "./question-table";

const pageSize = 25;
const statuses = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

const statusNames = {
  ARCHIVED: "Arquivado",
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
} as const;

const statusIcons = {
  ARCHIVED: "archive",
  DRAFT: "pencil",
  PUBLISHED: "check-circle",
} as const;

const resultNames: Record<string, string> = {
  "questao-reordenada": "A ordem da lista foi atualizada.",
  "questao-reutilizada": "Questão adicionada à lista com a versão atual.",
  "questao-salva":
    "Questão salva como nova versão. As tentativas antigas continuam ligadas à versão em que foram feitas.",
  invalid: "Não foi possível concluir. Revise os dados e tente de novo.",
};

interface Properties {
  readonly params: Promise<{ readonly listId: string }>;
  readonly searchParams: Promise<{
    readonly acao?: string;
    readonly busca?: string;
    readonly categoria?: string;
    readonly estado?: string;
    readonly pagina?: string;
    readonly q?: string;
    readonly resultado?: string;
  }>;
}

const shortLabel = (value: string) =>
  value.length > 26 ? `${value.slice(0, 25).trim()}…` : value;

const dateLabel = (value: Date | null) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "numeric",
        month: "short",
        timeZone: "America/Sao_Paulo",
      })
        .format(value)
        .replace(".", "")
    : null;

const formatOf = (
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE",
  options: readonly { readonly content: string }[]
) => {
  if (type === "MULTIPLE_CHOICE") {
    return "Múltipla escolha";
  }
  const labels = options.map((option) => option.content.trim().toLowerCase());
  return labels.length === 2 &&
    labels.includes("verdadeiro") &&
    labels.includes("falso")
    ? "Verdadeiro ou falso"
    : "Escolha única";
};

const loadStats = async (listId: string) => {
  const [answers, correct, members, published] = await Promise.all([
    database.exerciseAnswer.count({
      where: { sessionQuestion: { session: { listId } } },
    }),
    database.exerciseAnswer.count({
      where: { isCorrect: true, sessionQuestion: { session: { listId } } },
    }),
    database.exerciseSession.groupBy({
      by: ["memberId"],
      where: { listId },
    }),
    database.exerciseListItem.count({
      where: { listId, question: { status: ContentStatus.PUBLISHED } },
    }),
  ]);
  return { answers, correct, members: members.length, published };
};

const loadReusable = async (
  list: { id: string; bankId: string; status: ContentStatus },
  search: string
): Promise<readonly ReusableQuestion[]> => {
  const rows = await database.exerciseQuestion.findMany({
    where: {
      bankId: list.bankId,
      listItems: { none: { listId: list.id } },
      status:
        list.status === ContentStatus.PUBLISHED
          ? ContentStatus.PUBLISHED
          : { not: ContentStatus.ARCHIVED },
      ...(search
        ? {
            versions: {
              some: { statement: { contains: search, mode: "insensitive" } },
            },
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: 30,
    select: {
      id: true,
      category: { select: { title: true } },
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        select: { statement: true },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    category: row.category?.title ?? null,
    statement: row.versions[0]?.statement.slice(0, 180) ?? "Sem versão",
  }));
};

const loadListPage = async (
  listId: string,
  query: Awaited<Properties["searchParams"]>
) => {
  const list = await database.exerciseList.findUnique({
    where: { id: listId },
    select: {
      id: true,
      bankId: true,
      title: true,
      description: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
      bank: { select: { id: true, title: true, status: true } },
      _count: { select: { items: true, sessions: true } },
    },
  });
  if (!list) {
    notFound();
  }
  const search = (query.q ?? "").trim().slice(0, 120);
  const categoryFilter = query.categoria?.trim() ?? "";
  const statusFilter = statuses.includes(query.estado as never)
    ? (query.estado as ContentStatus)
    : null;
  const where: Prisma.ExerciseListItemWhereInput = {
    listId,
    ...(search
      ? {
          questionVersion: {
            is: { statement: { contains: search, mode: "insensitive" } },
          },
        }
      : {}),
    ...(categoryFilter || statusFilter
      ? {
          question: {
            is: {
              ...(categoryFilter ? { categoryId: categoryFilter } : {}),
              ...(statusFilter ? { status: statusFilter } : {}),
            },
          },
        }
      : {}),
  };
  const filteredCount = await database.exerciseListItem.count({ where });
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
  const page = Math.min(
    totalPages,
    Math.max(1, Math.trunc(Number(query.pagina) || 1))
  );
  const [items, categories, stats] = await Promise.all([
    database.exerciseListItem.findMany({
      where,
      orderBy: [{ position: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        question: {
          select: {
            id: true,
            status: true,
            category: { select: { title: true } },
          },
        },
        questionVersion: {
          select: {
            type: true,
            version: true,
            statement: true,
            options: { select: { content: true } },
          },
        },
      },
    }),
    database.exerciseCategory.findMany({
      where: { bankId: list.bankId },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
    loadStats(listId),
  ]);
  const rows: QuestionRow[] = items.map((item) => ({
    id: item.id,
    questionId: item.question.id,
    category: item.question.category?.title ?? null,
    statement: item.questionVersion.statement,
    format: formatOf(item.questionVersion.type, item.questionVersion.options),
    status: item.question.status,
    version: item.questionVersion.version,
  }));
  return {
    categories,
    categoryFilter,
    filteredCount,
    hasFilters: Boolean(search || categoryFilter || statusFilter),
    list,
    page,
    rows,
    search,
    stats,
    statusFilter,
    totalPages,
  };
};

type LoadedList = Awaited<ReturnType<typeof loadListPage>>;

const ListStats = ({ data }: { readonly data: LoadedList }) => {
  const { list, stats } = data;
  const accuracy = stats.answers
    ? `${Math.round((stats.correct / stats.answers) * 100)}%`
    : "—";
  return (
    <div className="gk-stats">
      <article>
        <span>Questões</span>
        <strong>{list._count.items}</strong>
        <small>{stats.published} publicadas</small>
      </article>
      <article>
        <span>Tentativas</span>
        <strong>{list._count.sessions}</strong>
        <small>
          {stats.members} {stats.members === 1 ? "aluno" : "alunos"}
        </small>
      </article>
      <article>
        <span>Acerto médio</span>
        <strong>{accuracy}</strong>
        <small>
          {stats.answers
            ? `${stats.answers} respostas registradas`
            : "Sem respostas ainda"}
        </small>
      </article>
      <article>
        <span>Publicação</span>
        <strong>{statusNames[list.status]}</strong>
        <small>
          {list.publishedAt
            ? `publicada em ${dateLabel(list.publishedAt)}`
            : `editada em ${dateLabel(list.updatedAt)}`}
        </small>
      </article>
    </div>
  );
};

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

const ListPager = ({
  firstNumber,
  hrefFor,
  total,
  data,
}: {
  readonly data: LoadedList;
  readonly firstNumber: number;
  readonly hrefFor: (page: number) => string;
  readonly total: number;
}) => (
  <nav aria-label="Paginação das questões" className="gk-pager">
    <span>
      {total === 0
        ? "0 questões"
        : `${firstNumber} a ${Math.min(data.page * pageSize, total)} de ${total}`}
    </span>
    <div>
      <PagerButton
        href={data.page > 1 ? hrefFor(data.page - 1) : null}
        label="Anterior"
      />
      <PagerButton
        href={data.page < data.totalPages ? hrefFor(data.page + 1) : null}
        label="Próxima"
      />
    </div>
  </nav>
);

const GestaoExerciseListPage = async ({ params, searchParams }: Properties) => {
  await requireGestaoAction("content.manage");
  const [{ listId }, query] = await Promise.all([params, searchParams]);
  const data = await loadListPage(listId, query);
  const { list, page } = data;
  const base = `/gestao/ensino/exercicios/${listId}`;
  const keep = new URLSearchParams();
  for (const key of ["q", "categoria", "estado", "pagina"] as const) {
    if (query[key]) {
      keep.set(key, query[key] as string);
    }
  }
  const closeHref = `${base}${keep.size ? `?${keep}` : ""}`;
  const reusable =
    query.acao === "reutilizar"
      ? await loadReusable(list, (query.busca ?? "").trim().slice(0, 120))
      : null;
  const firstNumber = (page - 1) * pageSize + 1;
  const resultMessage = query.resultado
    ? (resultNames[query.resultado] ?? null)
    : null;

  return (
    <section className="gt-page gk-exercises">
      <GestaoCrumbTail
        items={[{ label: shortLabel(list.bank.title) }, { label: "Lista" }]}
      />
      <header className="gk-list-head">
        <div className="gk-list-title">
          <h1>{list.title}</h1>
          <span
            className="gk-chip"
            data-tone={list.status === "PUBLISHED" ? "active" : "neutral"}
          >
            <GestaoIcon name={statusIcons[list.status]} size={12} />
            {statusNames[list.status]}
          </span>
          <ListMenu
            editHref={`${base}?acao=editar`}
            listId={list.id}
            status={list.status}
          />
        </div>
        <p>{list.bank.title}</p>
        <div className="gk-head-actions gk-head-actions--left">
          <Link
            className="gk-btn"
            href={`${base}?acao=reutilizar`}
            prefetch={false}
            scroll={false}
          >
            Reutilizar questão do banco
          </Link>
          <Link
            className="gk-btn gk-btn--primary"
            href={`${base}/questoes/nova`}
            prefetch={false}
          >
            Nova questão
          </Link>
        </div>
      </header>

      {resultMessage ? (
        <output className="gk-result">{resultMessage}</output>
      ) : null}

      <ListStats data={data} />

      <QuestionListPanel
        canReorder={!data.hasFilters}
        categories={data.categories}
        category={data.categoryFilter}
        firstNumber={firstNumber}
        hasFilters={data.hasFilters}
        listId={list.id}
        query={data.search}
        rows={data.rows}
        status={data.statusFilter ?? ""}
      />

      <ListPager
        data={data}
        firstNumber={firstNumber}
        hrefFor={(target) => {
          const next = new URLSearchParams(keep);
          next.set("pagina", String(target));
          return `${base}?${next}`;
        }}
        total={data.filteredCount}
      />

      {reusable ? (
        <ReuseQuestionDialog
          closeHref={closeHref}
          key={`reuse-${query.busca ?? ""}`}
          listId={list.id}
          questions={reusable}
          search={(query.busca ?? "").trim()}
        />
      ) : null}
      {query.acao === "editar" ? (
        <EditListDialog
          closeHref={closeHref}
          description={list.description ?? ""}
          listId={list.id}
          title={list.title}
        />
      ) : null}
    </section>
  );
};

export default GestaoExerciseListPage;
