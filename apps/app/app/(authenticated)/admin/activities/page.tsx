import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import Link from "next/link";
import { getStaffActivities } from "@/lib/activities";

const statusLabel = (status: string) => {
  if (status === "PUBLISHED") {
    return "Publicado";
  }
  if (status === "ARCHIVED") {
    return "Arquivado";
  }
  return "Rascunho";
};

import { createActivity, saveFeedback } from "../../atividades/actions";

const AdminActivitiesPage = async () => {
  const activities = await getStaffActivities();

  return (
    <main className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
      <Link
        className="text-muted-foreground text-sm underline underline-offset-4"
        href="/admin"
      >
        ← Área do professor
      </Link>
      <header className="mt-10 max-w-3xl">
        <p className="brand-eyebrow">Professor · prática</p>
        <h1 className="mt-4 font-display text-5xl leading-none">
          Uma pergunta continua depois da aula.
        </h1>
        <p className="mt-5 text-muted-foreground leading-7">
          Publique uma proposta, leia as respostas e devolva feedback que ajude
          o raciocínio a avançar.
        </p>
      </header>
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section>
          <h2 className="border-border border-b pb-3 font-display text-3xl">
            Atividades e envios
          </h2>
          <div className="mt-5 grid gap-5">
            {activities.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma atividade criada.</p>
            ) : (
              activities.map((activity) => (
                <article className="paper-surface border p-6" key={activity.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Badge
                        variant={
                          activity.status === "PUBLISHED"
                            ? "default"
                            : "outline"
                        }
                      >
                        {statusLabel(activity.status)}
                      </Badge>
                      <h3 className="mt-3 font-display text-2xl">
                        {activity.title}
                      </h3>
                      <p className="mt-2 text-muted-foreground leading-6">
                        {activity.prompt}
                      </p>
                    </div>
                    <span className="font-data text-muted-foreground text-xs">
                      {activity.submissions.length} envios
                    </span>
                  </div>
                  {activity.submissions.length > 0 && (
                    <div className="mt-6 divide-y border-border border-y">
                      {activity.submissions.map((submission) => (
                        <div className="py-5" key={submission.id}>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="brand-eyebrow">
                              Membro · {submission.status}
                            </p>
                            {submission.feedback && (
                              <Badge variant="outline">Feedback enviado</Badge>
                            )}
                          </div>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                            {submission.content}
                          </p>
                          <form
                            action={saveFeedback}
                            className="mt-4 grid gap-3"
                          >
                            <input
                              name="submissionId"
                              type="hidden"
                              value={submission.id}
                            />
                            <Textarea
                              className="min-h-24"
                              defaultValue={submission.feedback?.content ?? ""}
                              name="content"
                              placeholder="Escreva uma orientação breve e concreta..."
                              required
                            />
                            <div className="flex justify-end">
                              <Button size="sm" type="submit">
                                Salvar feedback
                              </Button>
                            </div>
                          </form>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        </section>
        <aside className="paper-surface border p-6 lg:sticky lg:top-24">
          <p className="brand-eyebrow">Nova prática</p>
          <form action={createActivity} className="mt-5 space-y-4">
            <label className="block" htmlFor="activity-title">
              <span className="brand-eyebrow">Título</span>
              <Input
                className="mt-2"
                id="activity-title"
                name="title"
                required
              />
            </label>
            <label className="block" htmlFor="activity-slug">
              <span className="brand-eyebrow">Slug</span>
              <Input className="mt-2" id="activity-slug" name="slug" required />
            </label>
            <label className="block" htmlFor="activity-prompt">
              <span className="brand-eyebrow">Pergunta</span>
              <Textarea
                className="mt-2 min-h-32"
                id="activity-prompt"
                name="prompt"
                required
              />
            </label>
            <label className="block" htmlFor="activity-instructions">
              <span className="brand-eyebrow">Instruções</span>
              <Textarea
                className="mt-2 min-h-24"
                id="activity-instructions"
                name="instructions"
              />
            </label>
            <Button className="w-full" type="submit">
              Salvar como rascunho
            </Button>
          </form>
        </aside>
      </div>
    </main>
  );
};

export default AdminActivitiesPage;
