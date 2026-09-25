import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedActivity } from "@/lib/activities";
import { requireMemberId } from "@/lib/learning";
import { submitActivity } from "../actions";

interface ActivityPageProperties {
  readonly params: Promise<{ slug: string }>;
}

const ActivityPage = async ({ params }: ActivityPageProperties) => {
  const { slug } = await params;
  const memberId = await requireMemberId();
  const activity = await getPublishedActivity(slug, memberId);

  if (!activity) {
    notFound();
  }

  const submission = activity.submissions[0];
  const isReviewed = submission?.status === "REVIEWED";
  let submissionLabel = "Rascunho";

  if (submission) {
    submissionLabel = isReviewed ? "Revisada" : "Enviada";
  }

  return (
    <div className="min-h-svh bg-background">
      <main className="mx-auto w-full max-w-[1280px] px-5 py-8 sm:px-8 lg:px-12 lg:py-14">
        <Button asChild className="mb-10 -ml-3" variant="ghost">
          <Link href="/atividades">
            <ArrowLeftIcon aria-hidden="true" /> Todas as atividades
          </Link>
        </Button>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(22rem,0.42fr)] lg:items-start">
          <article className="reading-column">
            <p className="brand-eyebrow">
              Prática guiada · {activity.course?.title ?? "caderno de campo"}
            </p>
            <span aria-hidden="true" className="brand-rule mt-4" />
            <h1 className="mt-6 font-display text-5xl leading-[1.02] tracking-tight sm:text-7xl">
              {activity.title}
            </h1>
            <p className="mt-7 font-display text-2xl text-muted-foreground leading-snug">
              {activity.prompt}
            </p>
            {activity.instructions && (
              <div className="paper-surface mt-8 border-brand-action border-l-2 p-6">
                <p className="brand-eyebrow">Como trabalhar</p>
                <p className="mt-3 whitespace-pre-wrap text-muted-foreground leading-7">
                  {activity.instructions}
                </p>
              </div>
            )}
            {activity.lesson && (
              <p className="mt-8 text-muted-foreground text-sm">
                Relacionada à aula{" "}
                <span className="font-medium text-foreground">
                  {activity.lesson.title}
                </span>
                .
              </p>
            )}
          </article>

          <aside className="paper-surface border p-6 shadow-[var(--shadow-paper)] sm:p-8 lg:sticky lg:top-24">
            <div className="flex items-center justify-between gap-3">
              <p className="brand-eyebrow">Sua resposta</p>
              <Badge variant={isReviewed ? "default" : "outline"}>
                {submissionLabel}
              </Badge>
            </div>
            {isReviewed && submission?.feedback ? (
              <div className="mt-7 border-t pt-6">
                <p className="brand-eyebrow">Nota do professor</p>
                <p className="mt-3 whitespace-pre-wrap font-display text-xl leading-7">
                  {submission.feedback.content}
                </p>
                <p className="mt-6 text-muted-foreground text-sm">
                  Você pode revisar o raciocínio e enviar uma nova versão quando
                  quiser.
                </p>
              </div>
            ) : null}
            <form action={submitActivity} className="mt-6 space-y-4">
              <input name="activityId" type="hidden" value={activity.id} />
              <label className="block" htmlFor="activity-response">
                <span className="brand-eyebrow">O que você pensa?</span>
                <textarea
                  className="mt-3 min-h-64 w-full resize-y rounded-sm border bg-background px-4 py-3 text-base leading-7 outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35"
                  defaultValue={submission?.content ?? ""}
                  id="activity-response"
                  name="content"
                  placeholder="Escreva seu raciocínio, uma dúvida ou uma hipótese..."
                  required
                />
              </label>
              <Button className="w-full" type="submit">
                Enviar resposta
              </Button>
              <p className="text-muted-foreground text-xs leading-5">
                O envio substitui a versão anterior e fica visível apenas para
                você e para a equipe docente.
              </p>
            </form>
            {activity.course && (
              <Button asChild className="mt-6 w-full" variant="ghost">
                <Link href={`/aprender/cursos/${activity.course.slug}`}>
                  <ExternalLinkIcon aria-hidden="true" /> Voltar ao curso
                </Link>
              </Button>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
};

export default ActivityPage;
