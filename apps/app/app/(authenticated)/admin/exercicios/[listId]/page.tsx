import { ContentStatus, database } from "@repo/database";
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
  saveExerciseQuestion,
  setExerciseListStatus,
} from "../../../exercicios/actions";

interface AdminExerciseListPageProperties {
  readonly params: Promise<{ readonly listId: string }>;
  readonly searchParams: Promise<{ readonly resultado?: string }>;
}

const labels = ["A", "B", "C", "D", "E"];

const statusLabel = (status: string) => {
  if (status === ContentStatus.PUBLISHED) {
    return "Publicado";
  }
  if (status === ContentStatus.ARCHIVED) {
    return "Arquivado";
  }
  return "Rascunho";
};

const AdminExerciseListPage = async ({
  params,
  searchParams,
}: AdminExerciseListPageProperties) => {
  await requireStaff();
  const [{ listId }, query] = await Promise.all([params, searchParams]);
  const exerciseList = await database.exerciseList.findUnique({
    where: { id: listId },
    select: {
      id: true,
      title: true,
      description: true,
      coverUrl: true,
      status: true,
      bank: { select: { id: true, title: true, status: true } },
      items: {
        orderBy: { position: "asc" },
        take: 250,
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
      },
    },
  });
  if (!exerciseList) {
    notFound();
  }
  let result: string | null = null;
  if (query.resultado === "questao-salva") {
    result =
      "A questão foi salva como uma nova versão; sessões anteriores continuam preservadas.";
  } else if (query.resultado === "invalid") {
    result =
      "Revise as alternativas: escolha única exige uma correta; múltipla escolha exige pelo menos duas corretas e uma incorreta.";
  } else if (query.resultado === "referencias-invalidas") {
    result =
      "A explicação menciona letras sem alternativa preenchida. Confira as referências às opções antes de salvar.";
  }

  return (
    <main className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
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
            {exerciseList.items.length} questões ·{" "}
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
      {result && (
        <output className="mt-6 block rounded-md border bg-card p-4 text-sm">
          {result}
        </output>
      )}
      <section
        aria-label="Status da lista"
        className="mt-6 flex flex-wrap gap-2"
      >
        {[
          ContentStatus.DRAFT,
          ContentStatus.PUBLISHED,
          ContentStatus.ARCHIVED,
        ].map((status) => (
          <form action={setExerciseListStatus} key={status}>
            <input name="listId" type="hidden" value={exerciseList.id} />
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

      <section aria-labelledby="exercise-questions-title" className="mt-10">
        <h2 className="font-display text-3xl" id="exercise-questions-title">
          Questões da lista
        </h2>
        <div className="mt-5 grid gap-5">
          {exerciseList.items.map((item, index) => (
            <article
              className="rounded-xl border bg-card p-5 sm:p-7"
              key={item.id}
            >
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Questão {index + 1}</Badge>
                  <Badge variant="secondary">
                    Versão {item.questionVersion.version}
                  </Badge>
                  <Badge variant="outline">
                    {statusLabel(item.question.status)}
                  </Badge>
                </div>
                <span className="text-muted-foreground text-xs">
                  {item.question.category?.title || "Sem categoria"}
                </span>
              </div>
              <SingleFlightForm
                action={saveExerciseQuestion}
                className="grid gap-4"
              >
                <input name="listId" type="hidden" value={exerciseList.id} />
                <input
                  name="questionId"
                  type="hidden"
                  value={item.question.id}
                />
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
                  <span className="font-medium">
                    Tags (separadas por vírgula)
                  </span>
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
                    Para destacar uma fonte ao aluno, acrescente no fim:
                    Referência: Nome da obra — https://...
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
            </article>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="append-question-title"
        className="mt-12 rounded-xl border bg-card p-5 sm:p-7"
      >
        <h2 className="font-display text-3xl" id="append-question-title">
          Adicionar questão
        </h2>
        <SingleFlightForm
          action={saveExerciseQuestion}
          className="mt-5 grid gap-4"
        >
          <input name="listId" type="hidden" value={exerciseList.id} />
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
      </section>
    </main>
  );
};

export default AdminExerciseListPage;
