import { ContentStatus, database, type Prisma } from "@repo/database";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SingleFlightForm,
  SingleFlightSubmit,
} from "@/components/mutations/single-flight-form";
import {
  exerciseBankListPageSize,
  exerciseBankListsHref,
  resolveExercisePage,
} from "@/lib/exercise-management";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { createExerciseList } from "../../../../../exercicios/actions";
import { GestaoPageHeading } from "../../../../gestao-shell";

const statusValues = ["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"] as const;
type StatusFilter = (typeof statusValues)[number];

const statusLabels: Record<ContentStatus, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  ARCHIVED: "Arquivado",
};

const normalizeStatus = (value: string | undefined): StatusFilter =>
  statusValues.includes(value as StatusFilter)
    ? (value as StatusFilter)
    : "ALL";

const firstQueryValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const BankExerciseListsPage = async ({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly bankId: string }>;
  readonly searchParams: Promise<{
    readonly estado?: string | string[];
    readonly pagina?: string | string[];
    readonly q?: string | string[];
    readonly resultado?: string | string[];
  }>;
}) => {
  await requireGestaoAction("content.manage");
  const [{ bankId }, query] = await Promise.all([params, searchParams]);
  if (bankId.length > 128) {
    notFound();
  }
  const bank = await database.exerciseBank.findUnique({
    where: { id: bankId },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      updatedAt: true,
      _count: { select: { lists: true } },
    },
  });
  if (!bank) {
    notFound();
  }

  const searchText = (firstQueryValue(query.q) ?? "").trim().slice(0, 120);
  const status = normalizeStatus(firstQueryValue(query.estado));
  const where: Prisma.ExerciseListWhereInput = {
    bankId: bank.id,
    ...(status === "ALL" ? {} : { status: status as ContentStatus }),
    ...(searchText
      ? {
          title: { contains: searchText, mode: "insensitive" },
        }
      : {}),
  };
  const totalCount = await database.exerciseList.count({ where });
  const { page, totalPages } = resolveExercisePage(
    firstQueryValue(query.pagina),
    totalCount,
    exerciseBankListPageSize
  );
  const lists = await database.exerciseList.findMany({
    where,
    orderBy: [{ position: "asc" }, { title: "asc" }, { id: "asc" }],
    skip: (page - 1) * exerciseBankListPageSize,
    take: exerciseBankListPageSize,
    select: {
      id: true,
      title: true,
      status: true,
      updatedAt: true,
      _count: { select: { items: true, sessions: true } },
    },
  });
  const resultMessages: Record<string, string> = {
    "list-created": "Lista criada como rascunho.",
    "list-invalid":
      "Confira o título e a capa HTTPS antes de tentar novamente.",
  };
  const result = firstQueryValue(query.resultado);
  const resultMessage = result ? (resultMessages[result] ?? null) : null;

  return (
    <section className="gestao-page-content gestao-exercise-detail">
      <GestaoPageHeading
        description={bank.description || "Listas e questões deste banco."}
        eyebrow="Gestão · Ensino · Exercícios"
        title={bank.title}
      >
        <Badge
          variant={
            bank.status === ContentStatus.PUBLISHED ? "default" : "secondary"
          }
        >
          {statusLabels[bank.status]}
        </Badge>
        <Button asChild variant="outline">
          <Link href="/gestao/ensino/exercicios">Voltar aos bancos</Link>
        </Button>
      </GestaoPageHeading>

      {resultMessage ? (
        <output aria-live="polite" className="gestao-exercise-result">
          {resultMessage}
        </output>
      ) : null}

      <section
        aria-label="Gerenciar listas"
        className="gestao-exercise-metrics"
      >
        <article>
          <span>Listas neste banco</span>
          <strong>{bank._count.lists}</strong>
          <small>{totalCount} correspondem aos filtros atuais</small>
        </article>
        <article>
          <span>Estado</span>
          <strong>{statusLabels[bank.status]}</strong>
          <small>
            {bank.status === ContentStatus.ARCHIVED
              ? "Reative o banco no catálogo para criar novas listas."
              : "Novas listas começam como rascunho."}
          </small>
        </article>
        {bank.status !== ContentStatus.ARCHIVED ? (
          <details className="gestao-exercise-create">
            <summary className="gestao-exercise-button">
              Criar lista neste banco
            </summary>
            <SingleFlightForm
              action={createExerciseList}
              className="gestao-exercise-popover"
            >
              <input name="gestaoReturn" type="hidden" value="GESTAO" />
              <input name="returnToBank" type="hidden" value="BANK" />
              <input name="bankId" type="hidden" value={bank.id} />
              <h2>Nova lista</h2>
              <label htmlFor="new-exercise-list-title">
                <span>Nome da lista</span>
                <Input
                  id="new-exercise-list-title"
                  maxLength={160}
                  name="title"
                  required
                />
              </label>
              <label htmlFor="new-exercise-list-description">
                <span>Descrição (opcional)</span>
                <Input
                  id="new-exercise-list-description"
                  maxLength={2000}
                  name="description"
                />
              </label>
              <label htmlFor="new-exercise-list-cover">
                <span>Capa por URL HTTPS (opcional)</span>
                <Input
                  id="new-exercise-list-cover"
                  name="coverUrl"
                  type="url"
                />
              </label>
              <SingleFlightSubmit pendingLabel="Criando lista…">
                Criar lista
              </SingleFlightSubmit>
            </SingleFlightForm>
          </details>
        ) : null}
      </section>

      <form
        action={`/gestao/ensino/exercicios/bancos/${encodeURIComponent(bank.id)}`}
        className="gestao-exercise-list-filters"
        method="get"
      >
        <label htmlFor="bank-list-search">
          <span className="sr-only">Buscar listas deste banco</span>
          <Input
            defaultValue={searchText}
            id="bank-list-search"
            maxLength={120}
            name="q"
            placeholder="Buscar listas deste banco"
          />
        </label>
        <label htmlFor="bank-list-status">
          <span className="sr-only">Filtrar listas por estado</span>
          <select defaultValue={status} id="bank-list-status" name="estado">
            <option value="ALL">Estado · todos</option>
            <option value="DRAFT">Rascunho</option>
            <option value="PUBLISHED">Publicado</option>
            <option value="ARCHIVED">Arquivado</option>
          </select>
        </label>
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>

      {lists.length ? (
        <ul className="gestao-exercise-list-items">
          {lists.map((list) => (
            <li key={list.id}>
              <div className="gestao-exercise-list-copy">
                <h2>{list.title}</h2>
                <p>
                  {list._count.items} questões · {list._count.sessions}{" "}
                  tentativas
                </p>
              </div>
              <Badge
                variant={
                  list.status === ContentStatus.PUBLISHED
                    ? "default"
                    : "secondary"
                }
              >
                {statusLabels[list.status]}
              </Badge>
              <Button asChild variant="outline">
                <Link
                  href={`/gestao/ensino/exercicios/${list.id}`}
                  prefetch={false}
                >
                  Gerenciar
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="gestao-exercise-empty-list">
          {searchText || status !== "ALL"
            ? "Nenhuma lista corresponde aos filtros atuais."
            : "Este banco ainda não tem listas."}
        </p>
      )}

      <nav
        aria-label="Paginação das listas deste banco"
        className="gestao-exercise-pagination"
      >
        <span>
          {totalCount === 0
            ? "0 listas"
            : String((page - 1) * exerciseBankListPageSize + 1) +
              "–" +
              String(Math.min(page * exerciseBankListPageSize, totalCount)) +
              " de " +
              String(totalCount)}
        </span>
        <div>
          {page > 1 ? (
            <Button asChild variant="outline">
              <Link
                href={exerciseBankListsHref({
                  bankId: bank.id,
                  page: page - 1,
                  query: searchText,
                  status,
                })}
              >
                Anterior
              </Link>
            </Button>
          ) : (
            <Button disabled variant="outline">
              Anterior
            </Button>
          )}
          {page < totalPages ? (
            <Button asChild variant="outline">
              <Link
                href={exerciseBankListsHref({
                  bankId: bank.id,
                  page: page + 1,
                  query: searchText,
                  status,
                })}
              >
                Próxima
              </Link>
            </Button>
          ) : (
            <Button disabled variant="outline">
              Próxima
            </Button>
          )}
        </div>
      </nav>
    </section>
  );
};

export default BankExerciseListsPage;
