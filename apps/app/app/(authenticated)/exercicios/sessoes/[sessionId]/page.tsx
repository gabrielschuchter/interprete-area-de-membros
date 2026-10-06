import { database } from "@repo/database";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExerciseAnswerFeedback } from "@/components/exercises/exercise-answer-feedback";
import { ExerciseAnswerForm } from "@/components/exercises/exercise-answer-form";
import { StudyHeartbeat } from "@/components/learning/study-heartbeat";
import { scoreExerciseSession } from "@/lib/exercise-engine";
import { getMemberExerciseSession } from "@/lib/exercises";
import { requireMemberId } from "@/lib/learning";
import { toggleExerciseFavorite } from "../../actions";

interface ExerciseSessionPageProperties {
  readonly params: Promise<{ readonly sessionId: string }>;
  readonly searchParams: Promise<{
    readonly erro?: string;
    readonly respondida?: string;
  }>;
}

type MemberSession = NonNullable<
  Awaited<ReturnType<typeof getMemberExerciseSession>>
>;
type SessionQuestion = MemberSession["questions"][number];
type SessionScore = ReturnType<typeof scoreExerciseSession>;

const SessionProgress = ({
  session,
  score,
}: {
  readonly score: SessionScore;
  readonly session: MemberSession;
}) => (
  <header className="mt-8">
    <p className="brand-eyebrow">Sessão · {session.list.title}</p>
    <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
      {session.status === "COMPLETED"
        ? "Resultado da sessão"
        : "Pratique no seu ritmo"}
    </h1>
    <div className="mt-5 flex flex-wrap items-center gap-3 text-muted-foreground text-sm">
      <span>
        {score.answered} de {session.questions.length} respondidas
      </span>
      <span aria-hidden="true">·</span>
      <span>
        {score.correct} corretas ({score.percentage}%)
      </span>
    </div>
    <div
      aria-label={`${score.answered} de ${session.questions.length} questões respondidas`}
      aria-valuemax={session.questions.length}
      aria-valuemin={0}
      aria-valuenow={score.answered}
      className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
      role="progressbar"
    >
      <div
        className="h-full rounded-full bg-primary transition-[width]"
        style={{
          width: `${session.questions.length ? (score.answered / session.questions.length) * 100 : 0}%`,
        }}
      />
    </div>
  </header>
);

const ExerciseResultPanel = ({
  session,
  score,
}: {
  readonly score: SessionScore;
  readonly session: MemberSession;
}) => (
  <section
    aria-label="Resultado final"
    className="mt-8 rounded-xl border bg-card p-6 sm:p-8"
  >
    <Badge variant={score.percentage >= 70 ? "default" : "secondary"}>
      {score.percentage}% de acerto
    </Badge>
    <h2 className="mt-4 font-display text-3xl">
      {score.correct} de {session.questions.length} questões corretas
    </h2>
    <p className="mt-3 max-w-2xl text-muted-foreground leading-7">
      Seu resultado ficou salvo no histórico. Abra uma questão para rever o
      feedback ou inicie outra tentativa pela lista.
    </p>
    <Button asChild className="mt-6" variant="outline">
      <Link href={`/exercicios/listas/${session.list.slug}`}>
        Tentar novamente
      </Link>
    </Button>
    <div className="mt-8 grid gap-3">
      {session.questions.map((question, index) => (
        <Link
          className="rounded-lg border p-4 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href={`/exercicios/sessoes/${session.id}?respondida=${question.id}`}
          key={question.id}
        >
          <p className="text-muted-foreground text-xs">Questão {index + 1}</p>
          <p className="mt-2 line-clamp-3 text-sm leading-6">
            {question.questionVersion.statement}
          </p>
          <Badge
            className="mt-3"
            variant={question.answer?.isCorrect ? "default" : "destructive"}
          >
            {question.answer?.isCorrect ? "Correta" : "Incorreta"}
          </Badge>
        </Link>
      ))}
    </div>
  </section>
);

const ExerciseQuestionPanel = ({
  question,
  session,
  isBookmarked,
  hasInvalidAnswer,
}: {
  readonly question: SessionQuestion;
  readonly session: MemberSession;
  readonly isBookmarked: boolean;
  readonly hasInvalidAnswer: boolean;
}) => (
  <section className="mt-8 rounded-xl border bg-card p-5 sm:p-8">
    {hasInvalidAnswer && (
      <output className="mb-5 block rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
        Selecione uma alternativa válida antes de confirmar.
      </output>
    )}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Badge variant="outline">
        Questão {question.position + 1} de {session.questions.length}
      </Badge>
      <form action={toggleExerciseFavorite}>
        <input
          name="action"
          type="hidden"
          value={isBookmarked ? "remove" : "save"}
        />
        <input name="sessionId" type="hidden" value={session.id} />
        <input
          name="questionId"
          type="hidden"
          value={question.questionVersion.question.id}
        />
        <Button size="sm" type="submit" variant="ghost">
          {isBookmarked ? "Remover dos favoritos" : "Salvar questão"}
        </Button>
      </form>
    </div>
    <h2 className="mt-5 whitespace-pre-wrap font-display text-2xl leading-relaxed sm:text-3xl">
      {question.questionVersion.statement}
    </h2>
    {question.answer ? (
      <ExerciseAnswerFeedback
        correctOptionLabels={question.questionVersion.correctOptionIds
          .map(
            (id) =>
              question.questionVersion.options.find(
                (option) => option.id === id
              )?.label
          )
          .filter((label): label is string => Boolean(label))}
        explanation={question.questionVersion.explanation}
        isCorrect={question.answer.isCorrect}
        isSessionComplete={session.status === "COMPLETED"}
        nextHref={
          question.position + 1 < session.questions.length
            ? `/exercicios/sessoes/${session.id}`
            : null
        }
        resultHref={`/exercicios/sessoes/${session.id}`}
      />
    ) : (
      <ExerciseAnswerForm
        initialError={hasInvalidAnswer}
        question={question}
        session={session}
      />
    )}
  </section>
);

const ExerciseSessionPage = async ({
  params,
  searchParams,
}: ExerciseSessionPageProperties) => {
  const [{ sessionId }, memberId, query] = await Promise.all([
    params,
    requireMemberId(),
    searchParams,
  ]);
  const session = await getMemberExerciseSession(memberId, sessionId);
  if (!session) {
    notFound();
  }
  const score = scoreExerciseSession(
    session.questions.flatMap(({ answer }) => (answer ? [answer] : []))
  );
  const reviewedQuestion = query.respondida
    ? session.questions.find(({ id }) => id === query.respondida)
    : undefined;
  const question =
    reviewedQuestion ?? session.questions.find(({ answer }) => !answer);
  const showResult =
    !reviewedQuestion && (session.status === "COMPLETED" || !question);
  const currentBookmark = question
    ? await database.exerciseQuestionBookmark.findUnique({
        where: {
          memberId_questionId: {
            memberId,
            questionId: question.questionVersion.question.id,
          },
        },
        select: { id: true },
      })
    : null;

  return (
    <main className="mx-auto w-full max-w-[1000px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
      <StudyHeartbeat activityKind="EXERCISE" resourceId={session.id} />
      <Link
        className="text-muted-foreground text-sm underline underline-offset-4 hover:text-foreground"
        href="/exercicios"
      >
        ← Exercícios
      </Link>
      <SessionProgress score={score} session={session} />
      {showResult && <ExerciseResultPanel score={score} session={session} />}
      {!showResult && question && (
        <ExerciseQuestionPanel
          hasInvalidAnswer={query.erro === "answer"}
          isBookmarked={Boolean(currentBookmark)}
          question={question}
          session={session}
        />
      )}
    </main>
  );
};

export default ExerciseSessionPage;
