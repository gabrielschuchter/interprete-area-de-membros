import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CheckCircle2Icon,
  ListChecksIcon,
  RefreshCwIcon,
  TimerIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExerciseEyebrow } from "@/components/exercises/exercise-eyebrow";
import { ExerciseListBookmarkButton } from "@/components/exercises/exercise-list-bookmark-button";
import { ExerciseListCover } from "@/components/exercises/exercise-list-cover";
import { ExerciseProgress } from "@/components/exercises/exercise-progress";
import {
  getMemberInProgressExerciseSessionForList,
  getPublishedExerciseList,
  isExerciseListBookmarked,
} from "@/lib/exercises";
import { requireMemberId } from "@/lib/learning";
import { startExerciseSession } from "../../actions";

interface ExerciseListPageProperties {
  readonly params: Promise<{ readonly slug: string }>;
}

const ExerciseListPage = async ({ params }: ExerciseListPageProperties) => {
  const [{ slug }, memberId] = await Promise.all([params, requireMemberId()]);
  const list = await getPublishedExerciseList(slug);
  if (!list) {
    notFound();
  }
  const questionCount = list.items.filter(
    ({ question }) => question.status === "PUBLISHED"
  ).length;
  const categories = [
    ...new Set(
      list.items.flatMap(({ question }) =>
        question.status === "PUBLISHED" && question.category
          ? [question.category.title]
          : []
      )
    ),
  ];
  const [activeSession, saved] = await Promise.all([
    getMemberInProgressExerciseSessionForList(memberId, list.id),
    isExerciseListBookmarked(memberId, list.id),
  ]);
  const answeredQuestionCount =
    activeSession?.questions.filter(({ answer }) => answer).length ?? 0;

  return (
    <main className="mx-auto w-full max-w-[1080px] px-5 pt-3 pb-24 sm:px-8 sm:pt-10 lg:px-12 lg:pt-12">
      <Link
        className="hidden min-h-11 items-center gap-2 text-muted-foreground text-sm hover:text-foreground md:inline-flex"
        href="/exercicios"
      >
        <span aria-hidden="true">←</span> Voltar para Exercícios
      </Link>
      <article className="mt-6 max-w-[820px] overflow-hidden rounded-lg border bg-card">
        <div className="px-5 pt-5 md:px-9 md:pt-9">
          <ExerciseListCover
            bankTitle={list.bank.title}
            className="max-w-[360px] rounded-md"
            coverUrl={list.coverUrl}
            listSlug={list.slug}
            title={list.title}
          />
        </div>
        <div className="p-5 md:p-9 md:pt-6">
          <ExerciseEyebrow>
            {list.bank.title} · lista de exercícios
          </ExerciseEyebrow>
          <h1 className="mt-3 font-display font-semibold text-3xl leading-[1.1] tracking-[-.02em] md:text-[42px]">
            {list.title}
          </h1>
          {list.description && (
            <p className="mt-4 max-w-[640px] text-[15px] text-muted-foreground leading-[1.6] md:text-base">
              {list.description}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge variant="outline">
              {questionCount} {questionCount === 1 ? "questão" : "questões"}
            </Badge>
            {categories.map((category) => (
              <Badge key={category} variant="secondary">
                {category}
              </Badge>
            ))}
          </div>
          <ul className="mt-5 grid gap-4 border-y py-5 text-[15px] leading-[1.4] md:grid-cols-2">
            <li className="flex items-center gap-3">
              <ListChecksIcon
                aria-hidden="true"
                className="size-5 shrink-0 text-primary"
              />
              {questionCount} questões autorais
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2Icon
                aria-hidden="true"
                className="size-5 shrink-0 text-primary"
              />
              Gabarito e explicação depois de cada resposta
            </li>
            <li className="flex items-center gap-3">
              <RefreshCwIcon
                aria-hidden="true"
                className="size-5 shrink-0 text-primary"
              />
              Progresso sincronizado entre dispositivos
            </li>
            <li className="flex items-center gap-3">
              <TimerIcon
                aria-hidden="true"
                className="size-5 shrink-0 text-primary"
              />
              Resultado salvo no seu perfil
            </li>
          </ul>
          <div className="mt-5 flex flex-col gap-4">
            <div>
              <ExerciseListBookmarkButton
                initialSaved={saved}
                listId={list.id}
                title={list.title}
                variant="inline"
              />
            </div>
            {activeSession ? (
              <div className="flex flex-col gap-2.5 rounded-lg border bg-muted/60 p-5">
                <p className="m-0 font-data text-[10.5px] text-primary uppercase leading-[1.3] tracking-[.1em]">
                  Sessão em andamento
                </p>
                <ExerciseProgress
                  className="m-0"
                  questions={activeSession.questions}
                  showAnswerStatus={false}
                />
                <p className="m-0 text-[14px] text-muted-foreground leading-[1.4]">
                  {answeredQuestionCount} de {activeSession.questions.length}{" "}
                  questões respondidas
                </p>
                <form action={startExerciseSession} className="mt-1">
                  <input name="listId" type="hidden" value={list.id} />
                  <Button className="h-12 w-full px-6 md:w-auto" type="submit">
                    Retomar tentativa
                  </Button>
                </form>
              </div>
            ) : (
              <>
                <p className="m-0 text-[15px] text-muted-foreground leading-[1.6]">
                  A sessão fixa a versão de cada questão. Suas respostas e o
                  resultado ficam salvos no seu perfil.
                </p>
                <form action={startExerciseSession} className="mt-5">
                  <input name="listId" type="hidden" value={list.id} />
                  <Button
                    className="h-12 w-full px-6 md:w-auto"
                    disabled={questionCount === 0}
                    type="submit"
                  >
                    Começar sessão
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </article>
    </main>
  );
};

export default ExerciseListPage;
