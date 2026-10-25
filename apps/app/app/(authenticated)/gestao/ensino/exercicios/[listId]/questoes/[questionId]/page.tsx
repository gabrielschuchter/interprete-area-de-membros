import { database } from "@repo/database";
import { notFound } from "next/navigation";
import { parseExerciseExplanation } from "@/lib/exercise-references";
import { requireGestaoAction } from "@/lib/gestao-authorization";
import { GestaoCrumbTail } from "../../../../../gestao-crumbs";
import {
  type EditorOption,
  QuestionEditorForm,
  type QuestionFormat,
} from "./question-editor-form";

interface Properties {
  readonly params: Promise<{
    readonly listId: string;
    readonly questionId: string;
  }>;
  readonly searchParams: Promise<{ readonly resultado?: string }>;
}

const resultNames: Record<string, string> = {
  invalid:
    "Revise as alternativas: escolha única exige uma correta; múltipla escolha exige pelo menos duas corretas e uma incorreta, e o enunciado precisa ter ao menos cinco caracteres.",
  "questao-salva":
    "Questão salva como nova versão. As tentativas antigas continuam ligadas à versão em que foram feitas.",
  "referencias-invalidas":
    "A explicação menciona letras sem alternativa preenchida. Confira as referências às alternativas antes de salvar.",
};

const dateLabel = (value: Date) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "short",
    timeZone: "America/Sao_Paulo",
  })
    .format(value)
    .replace(".", "");

const formatOf = (
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE",
  options: readonly EditorOption[]
): QuestionFormat => {
  if (type === "MULTIPLE_CHOICE") {
    return "MULTIPLE_CHOICE";
  }
  const contents = options.map((option) => option.content.trim().toLowerCase());
  return contents.length === 2 &&
    contents.includes("verdadeiro") &&
    contents.includes("falso")
    ? "TRUE_FALSE"
    : "SINGLE_CHOICE";
};

const emptyOptions: readonly EditorOption[] = Array.from({ length: 4 }, () => ({
  content: "",
  correct: false,
}));

const versionState = (
  isLatest: boolean,
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
) => {
  if (!isLatest) {
    return "substituída";
  }
  if (status === "PUBLISHED") {
    return "publicada";
  }
  return status === "ARCHIVED" ? "arquivada" : "rascunho";
};

const loadQuestion = async (listId: string, questionId: string) => {
  const item = await database.exerciseListItem.findFirst({
    where: { listId, questionId },
    select: {
      position: true,
      question: {
        select: {
          id: true,
          status: true,
          tags: true,
          latestVersion: true,
          category: { select: { title: true } },
          versions: {
            orderBy: { version: "desc" },
            select: {
              version: true,
              createdAt: true,
              type: true,
              statement: true,
              explanation: true,
              options: {
                orderBy: { position: "asc" },
                select: { content: true, isCorrect: true },
              },
            },
          },
        },
      },
    },
  });
  if (!item) {
    notFound();
  }
  return item;
};

const VersionHistory = ({
  latest,
  status,
  versions,
}: {
  readonly latest: number;
  readonly status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  readonly versions: readonly { version: number; createdAt: Date }[];
}) => (
  <section className="gk-card">
    <h2>Histórico de versões</h2>
    <ul className="gk-versions">
      {versions.map((entry) => (
        <li key={entry.version}>
          <span>
            <strong>v{entry.version}</strong> ·{" "}
            {versionState(entry.version === latest, status)}
          </span>
          <time dateTime={entry.createdAt.toISOString()}>
            {dateLabel(entry.createdAt)}
          </time>
        </li>
      ))}
    </ul>
  </section>
);

const GestaoQuestionEditorPage = async ({
  params,
  searchParams,
}: Properties) => {
  await requireGestaoAction("content.manage");
  const [{ listId, questionId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const isNew = questionId === "nova";
  const list = await database.exerciseList.findUnique({
    where: { id: listId },
    select: {
      id: true,
      title: true,
      bankId: true,
      bank: { select: { title: true } },
      _count: { select: { items: true } },
    },
  });
  if (!list) {
    notFound();
  }
  const [categories, library, existing] = await Promise.all([
    database.exerciseCategory.findMany({
      where: { bankId: list.bankId },
      orderBy: { title: "asc" },
      select: { title: true },
    }),
    database.libraryItem.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { title: "asc" },
      take: 300,
      select: { id: true, title: true, url: true },
    }),
    isNew ? null : loadQuestion(listId, questionId),
  ]);
  const current = existing?.question.versions[0];
  const options: readonly EditorOption[] = current
    ? current.options.map((option) => ({
        content: option.content,
        correct: option.isCorrect,
      }))
    : emptyOptions;
  const parsed = parseExerciseExplanation(current?.explanation ?? null);
  const base = `/gestao/ensino/exercicios/${listId}`;
  const resultMessage = query.resultado
    ? (resultNames[query.resultado] ?? null)
    : null;
  const number = existing ? existing.position + 1 : list._count.items + 1;

  return (
    <section className="gt-page gk-exercises">
      <GestaoCrumbTail
        items={[
          { href: base, label: "Lista" },
          { label: isNew ? "Nova questão" : `Questão ${number}` },
        ]}
      />
      {resultMessage ? (
        <output
          className={
            query.resultado === "questao-salva" ? "gk-result" : "gk-error-box"
          }
        >
          {resultMessage}
        </output>
      ) : null}
      <QuestionEditorForm
        categories={categories.map((category) => category.title)}
        category={existing?.question.category?.title ?? ""}
        explanation={parsed.explanation}
        format={current ? formatOf(current.type, options) : "SINGLE_CHOICE"}
        library={library}
        listId={list.id}
        options={options}
        questionId={existing?.question.id ?? null}
        references={parsed.references.map((reference) => ({
          href: reference.href ?? null,
          label: reference.label,
        }))}
        returnTo={isNew ? base : `${base}/questoes/${questionId}`}
        statement={current?.statement ?? ""}
        status={existing?.question.status ?? null}
        subtitle={`${list.title} · ${isNew ? "Nova questão" : `Questão ${number}`}`}
        tags={existing?.question.tags ?? []}
        versionBlock={
          existing ? (
            <VersionHistory
              latest={existing.question.latestVersion}
              status={existing.question.status}
              versions={existing.question.versions}
            />
          ) : null
        }
      />
    </section>
  );
};

export default GestaoQuestionEditorPage;
