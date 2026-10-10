import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { startExerciseFavoriteSession } from "@/app/(authenticated)/exercicios/actions";
import { ExerciseEyebrow } from "@/components/exercises/exercise-eyebrow";
import { ExerciseFavoriteAttemptWorkspace } from "@/components/exercises/exercise-favorite-attempt-workspace";
import { ExerciseSessionDraftProvider } from "@/components/exercises/exercise-session-drafts";
import {
  getMemberExerciseFavoriteQuestion,
  getMemberExerciseSession,
} from "@/lib/exercises";
import { requireMemberId } from "@/lib/learning";

interface ExerciseFavoriteQuestionPageProperties {
  readonly params: Promise<{ readonly questionId: string }>;
  readonly searchParams: Promise<{ readonly sessao?: string }>;
}

const ExerciseFavoriteQuestionPage = async ({
  params,
  searchParams,
}: ExerciseFavoriteQuestionPageProperties) => {
  const [{ questionId }, query, memberId] = await Promise.all([
    params,
    searchParams,
    requireMemberId(),
  ]);

  if (query.sessao) {
    const [session, favorite] = await Promise.all([
      getMemberExerciseSession(memberId, query.sessao),
      getMemberExerciseFavoriteQuestion(memberId, questionId),
    ]);
    const question = session?.questions[0];
    if (
      !session ||
      session.kind !== "FAVORITE" ||
      session.questions.length !== 1 ||
      question?.questionVersion.question.id !== questionId
    ) {
      notFound();
    }
    return (
      <ExerciseSessionDraftProvider key={session.id} storageKey={session.id}>
        <ExerciseFavoriteAttemptWorkspace
          isBookmarked={Boolean(favorite)}
          session={session}
        />
      </ExerciseSessionDraftProvider>
    );
  }

  const favorite = await getMemberExerciseFavoriteQuestion(
    memberId,
    questionId
  );
  const question = favorite?.question;
  const list = question?.listItems[0]?.list;
  const version = question?.versions[0];
  if (!(favorite && question && list && version)) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-[760px] px-4 pt-2 pb-5 md:px-8 md:py-10 lg:px-0">
      <Link
        className="hidden text-muted-foreground text-sm hover:text-foreground md:inline-flex"
        href="/exercicios/favoritas"
      >
        ← Questões salvas
      </Link>
      <ExerciseEyebrow className="mt-0 md:mt-6">
        Questão salva · {list.bank.title} · {list.title}
      </ExerciseEyebrow>
      <h1 className="mt-2 font-display text-4xl leading-tight md:text-5xl">
        Responder questão salva
      </h1>
      <article className="mt-6 rounded-md border bg-card p-5 md:p-8">
        <span className="rounded-sm border px-2.5 py-1 font-mono text-primary text-xs">
          Questão salva · da lista
        </span>
        <h2 className="mt-5 whitespace-pre-wrap font-display text-2xl leading-snug md:text-3xl">
          {version.statement}
        </h2>
        <p className="mt-4 text-muted-foreground text-sm">
          Selecione a alternativa e confirme para ver o gabarito e a explicação.
        </p>
        <form action={startExerciseFavoriteSession} className="mt-6">
          <input name="questionId" type="hidden" value={questionId} />
          <Button type="submit">Começar a responder</Button>
        </form>
      </article>
    </main>
  );
};

export default ExerciseFavoriteQuestionPage;
