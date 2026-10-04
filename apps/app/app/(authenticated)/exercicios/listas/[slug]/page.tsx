import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedExerciseList } from "@/lib/exercises";
import { requireMemberId } from "@/lib/learning";
import { startExerciseSession } from "../../actions";

interface ExerciseListPageProperties {
  readonly params: Promise<{ readonly slug: string }>;
}

const ExerciseListPage = async ({ params }: ExerciseListPageProperties) => {
  const [{ slug }] = await Promise.all([params, requireMemberId()]);
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

  return (
    <main className="mx-auto w-full max-w-[1200px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
      <Link
        className="text-muted-foreground text-sm underline underline-offset-4 hover:text-foreground"
        href="/exercicios"
      >
        ← Voltar para Exercícios
      </Link>
      <article className="mt-8 overflow-hidden rounded-2xl border bg-card">
        {list.coverUrl && (
          <div
            aria-label={`Capa de ${list.title}`}
            className="h-48 bg-center bg-cover bg-muted sm:h-64"
            role="img"
            style={{ backgroundImage: `url("${list.coverUrl}")` }}
          />
        )}
        <div className="p-6 sm:p-9">
          <p className="brand-eyebrow">
            {list.bank.title} · lista de exercícios
          </p>
          <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
            {list.title}
          </h1>
          {list.description && (
            <p className="mt-4 max-w-3xl text-muted-foreground leading-7">
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
          <div className="mt-8 border-t pt-6">
            <p className="text-muted-foreground text-sm">
              A sessão fixa a versão de cada questão. Suas respostas e o
              resultado ficam salvos no seu perfil.
            </p>
            <form action={startExerciseSession} className="mt-5">
              <input name="listId" type="hidden" value={list.id} />
              <Button disabled={questionCount === 0} type="submit">
                Começar sessão
              </Button>
            </form>
          </div>
        </div>
      </article>
    </main>
  );
};

export default ExerciseListPage;
