import { ContentStatus, database, type Prisma } from "@repo/database";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  SingleFlightForm,
  SingleFlightSubmit,
} from "@/components/mutations/single-flight-form";
import { requireStaff } from "@/lib/authorization";
import {
  attachExerciseQuestionToList,
  moveExerciseListQuestion,
  saveExerciseQuestion,
  setExerciseListStatus,
} from "../../../exercicios/actions";
import { GestaoPageHeading } from "../../../gestao/gestao-shell";

interface AdminExerciseListPageProperties {
  readonly gestao?: boolean;
  readonly params: Promise<{ readonly listId: string }>;
  readonly searchParams: Promise<{
    readonly categoria?: string;
    readonly estado?: string;
    readonly pagina?: string;
    readonly q?: string;
    readonly resultado?: string;
  }>;
}

const labels = ["A", "B", "C", "D", "E"];
const pageSize = 25;
const statusFilters = ["ALL", "DRAFT", "PUBLISHED", "ARCHIVED"] as const;
type ExerciseStatusFilter = (typeof statusFilters)[number];

const normalizeExerciseStatus = (value: string | undefined) =>
  statusFilters.includes(value as ExerciseStatusFilter)
    ? (value as ExerciseStatusFilter)
    : "ALL";

const statusLabel = (status: string) => {
  if (status === ContentStatus.PUBLISHED) {
    return "Publicado";
  }
  if (status === ContentStatus.ARCHIVED) {
    return "Arquivado";
  }
  return "Rascunho";
};

const resultMessages: Record<string, string> = {
  "questao-salva":
    "A questão foi salva como uma nova versão; sessões anteriores continuam preservadas.",
  invalid:
    "Revise as alternativas: escolha única exige uma correta; múltipla escolha exige pelo menos duas corretas e uma incorreta.",
  "referencias-invalidas":
    "A explicação menciona letras sem alternativa preenchida. Confira as referências às opções antes de salvar.",
  "questao-reutilizada":
    "Questão adicionada à lista com a versão mais recente.",
  "questao-reordenada": "A ordem da lista foi atualizada.",
};

const emptyQuestionLabel = (filteredCount: number, hasFilters: boolean) => {
  if (filteredCount > 0) {
    return "Não há mais questões nesta página.";
  }
  return hasFilters
    ? "Nenhuma questão corresponde aos filtros."
    : "Esta lista ainda não tem questões.";
};

const getExerciseListPageData = async (
  listId: string,
  query: Awaited<AdminExerciseListPageProperties["searchParams"]>
) => {
  const searchText = (query.q ?? "").trim().slice(0, 120);
  const categoryId = query.categoria?.trim().slice(0, 255) || "ALL";
  const questionStatus = normalizeExerciseStatus(query.estado);
  const requestedPage = Math.max(1, Math.trunc(Number(query.pagina) || 1));
  const exerciseList = await database.exerciseList.findUnique({
    where: { id: listId },
    select: {
      id: true,
      title: true,
      description: true,
      coverUrl: true,
      status: true,
      bank: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
      _count: { select: { items: true, sessions: true } },
    },
  });
  if (!exerciseList) {
    notFound();
  }
  const itemWhere: Prisma.ExerciseListItemWhereInput = {
    listId: exerciseList.id,
    ...(searchText
      ? {
          questionVersion: {
            is: {
              statement: { contains: searchText, mode: "insensitive" },
            },
          },
        }
      : {}),
    ...(categoryId !== "ALL" || questionStatus !== "ALL"
      ? {
          question: {
            is: {
              ...(categoryId !== "ALL" ? { categoryId } : {}),
              ...(questionStatus !== "ALL"
                ? { status: questionStatus as ContentStatus }
                : {}),
            },
          },
        }
      : {}),
  };
  const [filteredCount, categories, reusableQuestions] = await Promise.all([
    database.exerciseListItem.count({ where: itemWhere }),
    database.exerciseCategory.findMany({
      where: { bankId: exerciseList.bank.id },
      orderBy: [{ title: "asc" }, { id: "asc" }],
      take: 100,
      select: { id: true, title: true },
    }),
    database.exerciseQuestion.findMany({
      where: {
        bankId: exerciseList.bank.id,
        status:
          exerciseList.status === ContentStatus.PUBLISHED &&
          exerciseList.bank.status === ContentStatus.PUBLISHED
            ? ContentStatus.PUBLISHED
            : { not: ContentStatus.ARCHIVED },
        listItems: { none: { listId: exerciseList.id } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 100,
      select: {
        id: true,
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: { statement: true },
        },
      },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const items = await database.exerciseListItem.findMany({
    where: itemWhere,
    orderBy: [{ position: "asc" }, { id: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      position: true,
      question: {
        select: {
          id: true,
          status: true,
          tags: true,
          category: { select: { title: true } },
        },
      },
      questionVersion: {
        select: {
          type: true,
          version: true,
          statement: true,
          explanation: true,
          options: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              label: true,
              content: true,
              isCorrect: true,
            },
          },
        },
      },
    },
  });
  return {
    categories,
    categoryId,
    exerciseList,
    filteredCount,
    items,
    page,
    questionStatus,
    reusableQuestions,
    searchText,
    totalPages,
  };
};

type ExerciseListEditorItem = Awaited<
  ReturnType<typeof getExerciseListPageData>
>["items"][number];

interface ExerciseQuestionCardProperties {
  readonly canReorder: boolean;
  readonly gestao: boolean;
  readonly item: ExerciseListEditorItem;
  readonly listId: string;
  readonly listQuestionCount: number;
  readonly position: number;
}

const ExerciseQuestionCard = ({
  canReorder,
  item,
  listId,
  listQuestionCount,
  position,
  gestao,
}: ExerciseQuestionCardProperties) => (
  <article className="rounded-xl border bg-card p-5 sm:p-7" key={item.id}>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Questão {position + 1}</Badge>
        <Badge variant="secondary">Versão {item.questionVersion.version}</Badge>
        <Badge variant="outline">{statusLabel(item.question.status)}</Badge>
      </div>
      <span className="text-muted-foreground text-xs">
        {item.question.category?.title || "Sem categoria"}
      </span>
    </div>
    <div className="mb-4 flex justify-end gap-2">
      <SingleFlightForm action={moveExerciseListQuestion}>
        <input name="listId" type="hidden" value={listId} />
        <input name="itemId" type="hidden" value={item.id} />
        <input name="direction" type="hidden" value="UP" />
        {gestao && <input name="gestaoReturn" type="hidden" value="GESTAO" />}
        <SingleFlightSubmit
          aria-label={`Mover questão ${position + 1} para cima`}
          disabled={!canReorder || position === 0}
          size="sm"
          variant="ghost"
        >
          ↑ Subir
        </SingleFlightSubmit>
      </SingleFlightForm>
      <SingleFlightForm action={moveExerciseListQuestion}>
        <input name="listId" type="hidden" value={listId} />
        <input name="itemId" type="hidden" value={item.id} />
        <input name="direction" type="hidden" value="DOWN" />
        {gestao && <input name="gestaoReturn" type="hidden" value="GESTAO" />}
        <SingleFlightSubmit
          aria-label={`Mover questão ${position + 1} para baixo`}
          disabled={!canReorder || position >= listQuestionCount - 1}
          size="sm"
          variant="ghost"
        >
          ↓ Descer
        </SingleFlightSubmit>
      </SingleFlightForm>
    </div>
    <details className="gestao-exercise-question-editor" open={!gestao}>
      <summary>Editar questão · versão {item.questionVersion.version}</summary>
      <SingleFlightForm action={saveExerciseQuestion} className="grid gap-4">
        <input name="listId" type="hidden" value={listId} />
        {gestao && <input name="gestaoReturn" type="hidden" value="GESTAO" />}
        <input name="questionId" type="hidden" value={item.question.id} />
        <label
          className="grid gap-2 text-sm"
          htmlFor={`question-statement-${item.question.id}`}
        >
          <span className="font-medium">Enunciado</span>
          <Textarea
            defaultValue={item.questionVersion.statement}
            id={`question-statement-${item.question.id}`}
            maxLength={20_000}
            minLength={5}
            name="statement"
            required
            rows={5}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label
            className="grid gap-2 text-sm"
            htmlFor={`question-type-${item.question.id}`}
          >
            <span className="font-medium">Formato</span>
            <select
              className="h-10 rounded-md border bg-background px-3"
              defaultValue={item.questionVersion.type}
              id={`question-type-${item.question.id}`}
              name="questionType"
            >
              <option value="SINGLE_CHOICE">Escolha única</option>
              <option value="MULTIPLE_CHOICE">Múltipla escolha</option>
            </select>
          </label>
          <label
            className="grid gap-2 text-sm"
            htmlFor={`question-category-${item.question.id}`}
          >
            <span className="font-medium">Categoria</span>
            <Input
              defaultValue={item.question.category?.title ?? ""}
              id={`question-category-${item.question.id}`}
              maxLength={100}
              name="categoryTitle"
            />
          </label>
        </div>
        <label
          className="grid gap-2 text-sm"
          htmlFor={`question-tags-${item.question.id}`}
        >
          <span className="font-medium">Tags (separadas por vírgula)</span>
          <Input
            defaultValue={item.question.tags.join(", ")}
            id={`question-tags-${item.question.id}`}
            maxLength={1000}
            name="tags"
          />
        </label>
        <fieldset className="grid gap-3">
          <legend className="mb-1 font-medium text-sm">
            Alternativas e gabarito
          </legend>
          {labels.map((label) => {
            const option = item.questionVersion.options.find(
              (candidate) => candidate.label === label
            );
            return (
              <div
                className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)]"
                key={label}
              >
                <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <input
                    className="accent-primary"
                    defaultChecked={option?.isCorrect ?? false}
                    name="correctOption"
                    type="checkbox"
                    value={label}
                  />
                  Correta {label}
                </label>
                <Input
                  aria-label={`Alternativa ${label}`}
                  defaultValue={option?.content ?? ""}
                  maxLength={8000}
                  name={`option-${label}`}
                />
              </div>
            );
          })}
        </fieldset>
        <label
          className="grid gap-2 text-sm"
          htmlFor={`question-explanation-${item.question.id}`}
        >
          <span className="font-medium">
            Explicação e referência(s) (opcional)
          </span>
          <Textarea
            defaultValue={item.questionVersion.explanation ?? ""}
            id={`question-explanation-${item.question.id}`}
            maxLength={20_000}
            name="explanation"
            rows={3}
          />
          <span className="text-muted-foreground text-xs leading-5">
            Para destacar uma fonte ao aluno, acrescente no fim: Referência:
            Nome da obra — https://...
          </span>
        </label>
        <SingleFlightSubmit
          className="w-fit"
          pendingLabel="Salvando…"
          variant="outline"
        >
          Salvar nova versão
        </SingleFlightSubmit>
      </SingleFlightForm>
    </details>
  </article>
);

type ExerciseListSummary = Awaited<
  ReturnType<typeof getExerciseListPageData>
>["exerciseList"];

const ExerciseListHeading = ({
  exerciseList,
  gestao,
}: {
  readonly exerciseList: ExerciseListSummary;
  readonly gestao: boolean;
}) =>
  gestao ? (
    <GestaoPageHeading
      description={`Banco de ${exerciseList.bank.title} · ${exerciseList._count.sessions} tentativas`}
      eyebrow="Gestão · Ensino · Exercícios"
      title={exerciseList.title}
    >
      <Badge
        variant={
          exerciseList.status === ContentStatus.PUBLISHED
            ? "default"
            : "secondary"
        }
      >
        {statusLabel(exerciseList.status)}
      </Badge>
    </GestaoPageHeading>
  ) : (
    <>
      <Link
        className="text-muted-foreground text-sm underline underline-offset-4 hover:text-foreground"
        href="/admin/exercicios"
      >
        ← Bancos de exercícios
      </Link>
      <header className="mt-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="brand-eyebrow">{exerciseList.bank.title}</p>
          <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
            {exerciseList.title}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {exerciseList._count.items} questões ·{" "}
            {statusLabel(exerciseList.status)}
          </p>
        </div>
        <Badge
          variant={
            exerciseList.bank.status === ContentStatus.PUBLISHED
              ? "default"
              : "secondary"
          }
        >
          Banco: {statusLabel(exerciseList.bank.status)}
        </Badge>
      </header>
    </>
  );

interface ExerciseListPaginationProperties {
  readonly categoryId: string;
  readonly filteredCount: number;
  readonly gestao: boolean;
  readonly listId: string;
  readonly page: number;
  readonly questionStatus: ExerciseStatusFilter;
  readonly searchText: string;
  readonly totalPages: number;
}

const ExerciseListPagination = ({
  categoryId,
  filteredCount,
  gestao,
  listId,
  page,
  questionStatus,
  searchText,
  totalPages,
}: ExerciseListPaginationProperties) => {
  const basePath = gestao ? "/gestao/ensino/exercicios" : "/admin/exercicios";
  const pageHref = (targetPage: number) =>
    `${basePath}/${listId}?q=${encodeURIComponent(searchText)}&categoria=${encodeURIComponent(categoryId)}&estado=${questionStatus}&pagina=${targetPage}`;
  const pageLabel =
    filteredCount === 0
      ? "0 questões"
      : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filteredCount)} de ${filteredCount}`;

  return (
    <nav
      aria-label="Paginação das questões"
      className="gestao-exercise-pagination"
    >
      <span>{pageLabel}</span>
      <div>
        {page <= 1 ? (
          <Button disabled variant="outline">
            Anterior
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link href={pageHref(page - 1)}>Anterior</Link>
          </Button>
        )}
        {page >= totalPages ? (
          <Button disabled variant="outline">
            Próxima
          </Button>
        ) : (
          <Button asChild variant="outline">
            <Link href={pageHref(page + 1)}>Próxima</Link>
          </Button>
        )}
      </div>
    </nav>
  );
};

export const AdminExerciseListPage = async ({
  params,
  searchParams,
  gestao = false,
}: AdminExerciseListPageProperties) => {
  await requireStaff();
  const [{ listId }, query] = await Promise.all([params, searchParams]);
  const data = await getExerciseListPageData(listId, query);
  const {
    categories,
    categoryId,
    exerciseList,
    filteredCount,
    items,
    page,
    questionStatus,
    reusableQuestions,
    searchText,
    totalPages,
  } = data;
  const result = query.resultado
    ? (resultMessages[query.resultado] ?? null)
    : null;
  const hasFilters = Boolean(
    searchText || categoryId !== "ALL" || questionStatus !== "ALL"
  );

  return (
    <main
      className={
        gestao
          ? "gestao-page-content gestao-exercise-detail"
          : "mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14"
      }
    >
      <ExerciseListHeading exerciseList={exerciseList} gestao={gestao} />
      {gestao && (
        <section
          aria-label="Resumo da lista"
          className="gestao-exercise-metrics"
        >
          <article>
            <span>Questões</span>
            <strong>{exerciseList._count.items}</strong>
            <small>
              {filteredCount} no resultado · {items.length} nesta página
            </small>
          </article>
          <article>
            <span>Tentativas</span>
            <strong>{exerciseList._count.sessions}</strong>
            <small>Sessões registradas nesta lista</small>
          </article>
          <article>
            <span>Estado do banco</span>
            <strong>{statusLabel(exerciseList.bank.status)}</strong>
            <small>{exerciseList.bank.title}</small>
          </article>
        </section>
      )}
      {result && (
        <output
          className={
            gestao
              ? "gestao-exercise-result"
              : "mt-6 block rounded-md border bg-card p-4 text-sm"
          }
        >
          {result}
        </output>
      )}
      <section
        aria-label="Status da lista"
        className={
          gestao ? "gestao-exercise-publishing" : "mt-6 flex flex-wrap gap-2"
        }
      >
        {[
          ContentStatus.DRAFT,
          ContentStatus.PUBLISHED,
          ContentStatus.ARCHIVED,
        ].map((status) => (
          <form action={setExerciseListStatus} key={status}>
            <input name="listId" type="hidden" value={exerciseList.id} />
            {gestao && (
              <input name="gestaoReturn" type="hidden" value="GESTAO" />
            )}
            <input name="status" type="hidden" value={status} />
            <Button
              disabled={status === exerciseList.status}
              size="sm"
              type="submit"
              variant={
                status === ContentStatus.PUBLISHED ? "default" : "outline"
              }
            >
              {statusLabel(status)}
            </Button>
          </form>
        ))}
      </section>

      <section
        aria-labelledby="exercise-questions-title"
        className={gestao ? "gestao-exercise-questions" : "mt-10"}
      >
        <h2 className="font-display text-3xl" id="exercise-questions-title">
          Questões da lista
        </h2>
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
          <SingleFlightForm
            action={attachExerciseQuestionToList}
            className="flex flex-wrap items-end gap-3"
          >
            <input name="listId" type="hidden" value={exerciseList.id} />
            {gestao && (
              <input name="gestaoReturn" type="hidden" value="GESTAO" />
            )}
            <label
              className="grid min-w-64 gap-2 text-sm"
              htmlFor="reusable-question"
            >
              <span className="font-medium">
                Reutilizar questão deste banco
              </span>
              <select
                className="h-10 rounded-md border bg-background px-3"
                id="reusable-question"
                name="questionId"
                required
              >
                <option value="">Escolha uma questão</option>
                {reusableQuestions.map((question) => (
                  <option key={question.id} value={question.id}>
                    {question.versions[0]?.statement.slice(0, 120) ??
                      "Questão sem versão"}
                  </option>
                ))}
              </select>
            </label>
            <SingleFlightSubmit
              className="w-fit"
              pendingLabel="Adicionando…"
              variant="outline"
            >
              Reutilizar questão
            </SingleFlightSubmit>
          </SingleFlightForm>
          <p className="max-w-md text-muted-foreground text-xs leading-5">
            A lista passa a apontar para a versão atual; tentativas já iniciadas
            preservam suas versões.
          </p>
        </div>
        <form
          action={
            gestao
              ? `/gestao/ensino/exercicios/${exerciseList.id}`
              : `/admin/exercicios/${exerciseList.id}`
          }
          className="gestao-exercise-list-filters"
          method="get"
        >
          <label htmlFor="exercise-list-search">
            <span className="sr-only">Buscar nesta lista</span>
            <Input
              defaultValue={searchText}
              id="exercise-list-search"
              maxLength={120}
              name="q"
              placeholder="Buscar nesta lista"
            />
          </label>
          <label htmlFor="exercise-list-category">
            <span className="sr-only">Categoria</span>
            <select
              defaultValue={categoryId}
              id="exercise-list-category"
              name="categoria"
            >
              <option value="ALL">Categoria · todas</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.title}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="exercise-list-status">
            <span className="sr-only">Estado da questão</span>
            <select
              defaultValue={questionStatus}
              id="exercise-list-status"
              name="estado"
            >
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
        {hasFilters && (
          <p className="gestao-exercise-reorder-hint">
            Limpe os filtros para reordenar questões da lista.
          </p>
        )}
        <div className="mt-5 grid gap-5">
          {items.length === 0 ? (
            <p className="gestao-exercise-empty-list">
              {emptyQuestionLabel(filteredCount, hasFilters)}
            </p>
          ) : (
            items.map((item, index) => (
              <ExerciseQuestionCard
                canReorder={!hasFilters}
                gestao={gestao}
                item={item}
                key={item.id}
                listId={exerciseList.id}
                listQuestionCount={exerciseList._count.items}
                position={(page - 1) * pageSize + index}
              />
            ))
          )}
        </div>{" "}
        <ExerciseListPagination
          categoryId={categoryId}
          filteredCount={filteredCount}
          gestao={gestao}
          listId={exerciseList.id}
          page={page}
          questionStatus={questionStatus}
          searchText={searchText}
          totalPages={totalPages}
        />
      </section>

      <section
        aria-labelledby="append-question-title"
        className="mt-12 rounded-xl border bg-card p-5 sm:p-7"
      >
        <h2 className="font-display text-3xl" id="append-question-title">
          Adicionar questão
        </h2>
        <details className="gestao-exercise-new-question" open={!gestao}>
          <summary>Adicionar questão</summary>
          <SingleFlightForm
            action={saveExerciseQuestion}
            className="mt-5 grid gap-4"
          >
            <input name="listId" type="hidden" value={exerciseList.id} />
            {gestao && (
              <input name="gestaoReturn" type="hidden" value="GESTAO" />
            )}
            <label
              className="grid gap-2 text-sm"
              htmlFor="new-exercise-statement"
            >
              <span className="font-medium">Enunciado</span>
              <Textarea
                id="new-exercise-statement"
                maxLength={20_000}
                minLength={5}
                name="statement"
                required
                rows={5}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label
                className="grid gap-2 text-sm"
                htmlFor="new-exercise-question-type"
              >
                <span className="font-medium">Formato</span>
                <select
                  className="h-10 rounded-md border bg-background px-3"
                  id="new-exercise-question-type"
                  name="questionType"
                >
                  <option value="SINGLE_CHOICE">Escolha única</option>
                  <option value="MULTIPLE_CHOICE">Múltipla escolha</option>
                </select>
              </label>
              <label
                className="grid gap-2 text-sm"
                htmlFor="new-exercise-category"
              >
                <span className="font-medium">Categoria</span>
                <Input
                  id="new-exercise-category"
                  maxLength={100}
                  name="categoryTitle"
                />
              </label>
            </div>
            <label className="grid gap-2 text-sm" htmlFor="new-exercise-tags">
              <span className="font-medium">Tags</span>
              <Input id="new-exercise-tags" maxLength={1000} name="tags" />
            </label>
            <fieldset className="grid gap-3">
              <legend className="mb-1 font-medium text-sm">
                Alternativas e gabarito
              </legend>
              {labels.map((label) => (
                <div
                  className="grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)]"
                  key={label}
                >
                  <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <input
                      className="accent-primary"
                      name="correctOption"
                      type="checkbox"
                      value={label}
                    />
                    Correta {label}
                  </label>
                  <Input
                    aria-label={`Alternativa ${label}`}
                    id={`new-exercise-option-${label}`}
                    maxLength={8000}
                    name={`option-${label}`}
                  />
                </div>
              ))}
            </fieldset>
            <label
              className="grid gap-2 text-sm"
              htmlFor="new-exercise-explanation"
            >
              <span className="font-medium">
                Explicação e referência(s) (opcional)
              </span>
              <Textarea
                id="new-exercise-explanation"
                maxLength={20_000}
                name="explanation"
                rows={3}
              />
              <span className="text-muted-foreground text-xs leading-5">
                Para destacar uma fonte ao aluno, acrescente no fim: Referência:
                Nome da obra — https://...
              </span>
            </label>
            <SingleFlightSubmit className="w-fit" pendingLabel="Adicionando…">
              Adicionar à lista
            </SingleFlightSubmit>
          </SingleFlightForm>
        </details>
      </section>
    </main>
  );
};

export default AdminExerciseListPage;
