import { database } from "@repo/database";
import { notFound, redirect } from "next/navigation";
import { ExerciseSessionWorkspace } from "@/components/exercises/exercise-session-workspace";
import { StudyHeartbeat } from "@/components/learning/study-heartbeat";
import { scoreExerciseSession } from "@/lib/exercise-engine";
import { getMemberExerciseSession } from "@/lib/exercises";
import { requireMemberId } from "@/lib/learning";

interface ExerciseSessionPageProperties {
  readonly params: Promise<{ readonly sessionId: string }>;
  readonly searchParams: Promise<{
    readonly erro?: string;
    readonly questao?: string;
    readonly respondida?: string;
    readonly resultado?: string;
  }>;
}

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

  if (query.resultado === "final" || session.status === "COMPLETED") {
    redirect(`/exercicios/sessoes/${session.id}/resultado`);
  }

  if (query.respondida) {
    const reviewed = session.questions.find(
      ({ id }) => id === query.respondida
    );
    if (reviewed?.answer) {
      redirect(
        `/exercicios/sessoes/${session.id}/revisao/${reviewed.position + 1}`
      );
    }
  }

  const requestedQuestion = query.questao
    ? session.questions.find(({ id }) => id === query.questao)
    : null;
  if (requestedQuestion?.answer) {
    redirect(
      `/exercicios/sessoes/${session.id}/revisao/${requestedQuestion.position + 1}`
    );
  }

  const question =
    requestedQuestion ?? session.questions.find(({ answer }) => !answer);
  if (!question) {
    redirect(`/exercicios/sessoes/${session.id}/resultado`);
  }

  const [score, currentBookmark] = await Promise.all([
    Promise.resolve(
      scoreExerciseSession(
        session.questions.flatMap(({ answer }) => (answer ? [answer] : []))
      )
    ),
    database.exerciseQuestionBookmark.findUnique({
      where: {
        memberId_questionId: {
          memberId,
          questionId: question.questionVersion.question.id,
        },
      },
      select: { id: true },
    }),
  ]);

  return (
    <>
      <StudyHeartbeat activityKind="EXERCISE" resourceId={session.id} />
      <ExerciseSessionWorkspace
        currentQuestionId={question.id}
        hasInvalidAnswer={query.erro === "answer"}
        isBookmarked={Boolean(currentBookmark)}
        score={score}
        session={session}
      />
    </>
  );
};

export default ExerciseSessionPage;
