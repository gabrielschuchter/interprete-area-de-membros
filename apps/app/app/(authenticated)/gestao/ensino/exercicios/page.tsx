import { ContentStatus, database } from "@repo/database";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { BookOpenTextIcon, ListChecksIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import {
  SingleFlightForm,
  SingleFlightSubmit,
} from "@/components/mutations/single-flight-form";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import {
  createExerciseBank,
  setExerciseBankStatus,
  updateExerciseBank,
} from "../../../exercicios/actions";
import { GestaoPageHeading } from "../../gestao-shell";

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
  }>;
}

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
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" as const } },
            {
              lists: {
                some: {
                  OR: [
                    {
                      title: { contains: query, mode: "insensitive" as const },
                    },
                    {
                      items: {
                        some: {
                          questionVersion: {
                            is: {
                              statement: {
                                contains: query,
                                mode: "insensitive" as const,
                              },
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        }
      : {}),
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

  return (
    <section className="gestao-page-content gestao-exercise-catalog">
      <GestaoPageHeading
        description="Bancos agrupam listas por assunto. Listas reúnem as questões que o aluno resolve."
        eyebrow="Gestão · Ensino"
        title="Exercícios"
      >
        <details className="gestao-exercise-create">
          <summary className="gestao-exercise-button gestao-exercise-button-outline">
            <PlusIcon aria-hidden="true" /> Novo banco
          </summary>
          <SingleFlightForm
            action={createExerciseBank}
            className="gestao-exercise-popover"
          >
            <input name="gestaoReturn" type="hidden" value="GESTAO" />
            <h2>Novo banco</h2>
            <label htmlFor="new-exercise-bank-title">
              <span>Nome do banco</span>
              <Input
                id="new-exercise-bank-title"
                maxLength={160}
                name="title"
                required
              />
            </label>
            <label htmlFor="new-exercise-bank-description">
              <span>Descrição (opcional)</span>
              <Textarea
                id="new-exercise-bank-description"
                maxLength={2000}
                name="description"
                rows={3}
              />
            </label>
            <SingleFlightSubmit pendingLabel="Criando banco…">
              Criar banco
            </SingleFlightSubmit>
          </SingleFlightForm>
        </details>
      </GestaoPageHeading>

      {resultMessage && (
        <output className="gestao-exercise-result">{resultMessage}</output>
      )}

      <form
        action="/gestao/ensino/exercicios"
        className="gestao-exercise-filters"
        method="get"
      >
        <label className="gestao-exercise-search" htmlFor="exercise-search">
          <span className="sr-only">Buscar bancos, listas e questões</span>
          <Input
            defaultValue={query}
            id="exercise-search"
            maxLength={120}
            name="q"
            placeholder="Buscar bancos, listas e questões"
          />
        </label>
        <label
          className="gestao-exercise-status"
          htmlFor="exercise-status-filter"
        >
          <span className="sr-only">Estado do banco</span>
          <select
            defaultValue={status}
            id="exercise-status-filter"
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

      {banks.length ? (
        <div className="gestao-exercise-bank-grid">
          {banks.map((bank) => (
            <article className="gestao-exercise-bank" key={bank.id}>
              <header className="gestao-exercise-bank-heading">
                <div>
                  <h2>{bank.title}</h2>
                  <p>
                    Banco · {bank._count.lists}{" "}
                    {bank._count.lists === 1 ? "lista" : "listas"}
                  </p>
                </div>
                <Badge
                  variant={
                    bank.status === ContentStatus.PUBLISHED
                      ? "default"
                      : "secondary"
                  }
                >
                  {statusNames[bank.status]}
                </Badge>
              </header>
              <Button asChild size="sm" variant="outline">
                <Link
                  href={`/gestao/ensino/exercicios/bancos/${encodeURIComponent(bank.id)}`}
                  prefetch={false}
                >
                  {bank._count.lists > 20
                    ? "Ver todas as listas"
                    : "Gerenciar listas"}
                  <span className="sr-only"> de {bank.title}</span>
                </Link>
              </Button>

              <fieldset className="gestao-exercise-bank-actions">
                <legend className="sr-only">
                  Ações de publicação para {bank.title}
                </legend>
                {bank.status === ContentStatus.DRAFT && (
                  <SingleFlightForm action={setExerciseBankStatus}>
                    <input name="gestaoReturn" type="hidden" value="GESTAO" />
                    <input name="bankId" type="hidden" value={bank.id} />
                    <input
                      name="status"
                      type="hidden"
                      value={ContentStatus.PUBLISHED}
                    />
                    <SingleFlightSubmit pendingLabel="Publicando…" size="sm">
                      Publicar banco
                    </SingleFlightSubmit>
                  </SingleFlightForm>
                )}
                {bank.status === ContentStatus.PUBLISHED && (
                  <SingleFlightForm action={setExerciseBankStatus}>
                    <input name="gestaoReturn" type="hidden" value="GESTAO" />
                    <input name="bankId" type="hidden" value={bank.id} />
                    <input
                      name="status"
                      type="hidden"
                      value={ContentStatus.DRAFT}
                    />
                    <SingleFlightSubmit
                      pendingLabel="Atualizando…"
                      size="sm"
                      variant="outline"
                    >
                      Voltar para rascunho
                    </SingleFlightSubmit>
                  </SingleFlightForm>
                )}
                {bank.status !== ContentStatus.ARCHIVED ? (
                  <SingleFlightForm action={setExerciseBankStatus}>
                    <input name="gestaoReturn" type="hidden" value="GESTAO" />
                    <input name="bankId" type="hidden" value={bank.id} />
                    <input
                      name="status"
                      type="hidden"
                      value={ContentStatus.ARCHIVED}
                    />
                    <SingleFlightSubmit
                      pendingLabel="Arquivando…"
                      size="sm"
                      variant="outline"
                    >
                      Arquivar banco
                    </SingleFlightSubmit>
                  </SingleFlightForm>
                ) : (
                  <SingleFlightForm action={setExerciseBankStatus}>
                    <input name="gestaoReturn" type="hidden" value="GESTAO" />
                    <input name="bankId" type="hidden" value={bank.id} />
                    <input
                      name="status"
                      type="hidden"
                      value={ContentStatus.DRAFT}
                    />
                    <SingleFlightSubmit
                      pendingLabel="Reativando…"
                      size="sm"
                      variant="outline"
                    >
                      Reativar como rascunho
                    </SingleFlightSubmit>
                  </SingleFlightForm>
                )}
              </fieldset>

              {bank.lists.length ? (
                <ul className="gestao-exercise-list-items">
                  {bank.lists.map((list) => (
                    <li key={list.id}>
                      <span
                        aria-hidden="true"
                        className="gestao-exercise-list-icon"
                      >
                        <ListChecksIcon />
                      </span>
                      <div className="gestao-exercise-list-copy">
                        <h3>{list.title}</h3>
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
                        {statusNames[list.status]}
                      </Badge>
                      <Button asChild variant="outline">
                        <Link href={`/gestao/ensino/exercicios/${list.id}`}>
                          Gerenciar
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="gestao-exercise-empty-list">
                  Nenhuma lista ainda. Use “Nova lista” para começar.
                </p>
              )}

              <details className="gestao-exercise-edit-bank">
                <summary>Editar banco</summary>
                <SingleFlightForm action={updateExerciseBank}>
                  <input name="gestaoReturn" type="hidden" value="GESTAO" />
                  <input name="bankId" type="hidden" value={bank.id} />
                  <label htmlFor={`edit-exercise-bank-title-${bank.id}`}>
                    <span>Nome</span>
                    <Input
                      defaultValue={bank.title}
                      id={`edit-exercise-bank-title-${bank.id}`}
                      maxLength={160}
                      name="title"
                      required
                    />
                  </label>
                  <label htmlFor={`edit-exercise-bank-description-${bank.id}`}>
                    <span>Descrição</span>
                    <Textarea
                      defaultValue={bank.description ?? ""}
                      id={`edit-exercise-bank-description-${bank.id}`}
                      maxLength={2000}
                      name="description"
                      rows={2}
                    />
                  </label>
                  <SingleFlightSubmit
                    pendingLabel="Salvando…"
                    size="sm"
                    variant="outline"
                  >
                    Salvar banco
                  </SingleFlightSubmit>
                </SingleFlightForm>
              </details>
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

      <nav
        aria-label="Paginação dos bancos de exercícios"
        className="gestao-exercise-pagination"
      >
        <span>
          {totalCount === 0
            ? "0 bancos"
            : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, totalCount)} de ${totalCount}`}
        </span>
        <div>
          {page <= 1 ? (
            <Button disabled variant="outline">
              Anterior
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link
                href={`/gestao/ensino/exercicios?q=${encodeURIComponent(query)}&estado=${status}&pagina=${page - 1}`}
              >
                Anterior
              </Link>
            </Button>
          )}
          {page >= totalPages ? (
            <Button disabled variant="outline">
              Próxima
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link
                href={`/gestao/ensino/exercicios?q=${encodeURIComponent(query)}&estado=${status}&pagina=${page + 1}`}
              >
                Próxima
              </Link>
            </Button>
          )}
        </div>
      </nav>
    </section>
  );
};

export default GestaoExercisesPage;
